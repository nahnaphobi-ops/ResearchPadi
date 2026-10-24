import JSZip from 'jszip';
import { StatsError, type Cell, type Dataset } from './stats.js';

/**
 * Questionnaire data from a spreadsheet: Excel (.xlsx) or CSV, as Google Forms
 * and most survey tools export it. The first row holds the questions; each
 * later row is one respondent. Excel is read straight from its XML (first
 * sheet only), so no extra library is needed.
 */
export const MAX_ROWS = 5_000;
export const MAX_COLUMNS = 100;

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');

/** "B3" → column 1. */
function columnNumber(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? 'A';
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

export async function readXlsx(buffer: Buffer): Promise<Cell[][]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new StatsError("Couldn't open that Excel file. Save it as .xlsx or .csv and try again.");
  }
  const workbook = await zip.file('xl/workbook.xml')?.async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  if (!workbook || !rels) throw new StatsError("That doesn't look like an Excel workbook. Save it as .xlsx or .csv and try again.");

  // The first sheet's file, through its relationship id.
  const rid = workbook.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const target = rid ? rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1]
    ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1] : undefined;
  const path = target ? (target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`) : 'xl/worksheets/sheet1.xml';
  const sheet = await zip.file(path)?.async('string');
  if (!sheet) throw new StatsError('The first sheet of that workbook is empty.');

  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const shared = sharedXml ? [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : [];

  const rows: Cell[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: Cell[] = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const body = cell[2] ?? '';
      const col = columnNumber(attrs.match(/\br="([A-Z]+)\d*"/i)?.[1] ?? String.fromCharCode(65 + row.length));
      if (col >= MAX_COLUMNS) continue;
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value: Cell = null;
      if (type === 's') value = v !== undefined ? shared[Number(v)] ?? null : null;
      else if (type === 'inlineStr') value = textOf(body);
      else if (type === 'str') value = v !== undefined ? unescapeXml(v) : null;
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined) value = Number.isFinite(Number(v)) ? Number(v) : unescapeXml(v);
      while (row.length < col) row.push(null);
      row[col] = value;
    }
    rows.push(row);
    if (rows.length > MAX_ROWS + 1) break;
  }
  return rows;
}

/** CSV with quoted fields; the separator (comma, semicolon or tab) is taken from the header row. */
export function readCsv(text: string): Cell[][] {
  const clean = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  const header = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = [',', ';', '\t'].sort((a, b) => header.split(b).length - header.split(a).length)[0];
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === sep) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (rows.length > MAX_ROWS + 1) break;
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((v) => (typeof v === 'string' && v.trim() === '' ? null : v)));
}

/** Header row plus respondents, trimmed to the limits, with blank rows and columns dropped. */
export function toDataset(raw: Cell[][]): Dataset {
  const rows = raw.filter((r) => r.some((v) => v !== null && String(v).trim() !== ''));
  if (rows.length < 2) throw new StatsError('The sheet needs a row of questions and at least one row of answers.');
  const width = Math.min(MAX_COLUMNS, Math.max(...rows.map((r) => r.length)));
  const header = rows[0];
  const keep = Array.from({ length: width }, (_, c) => c).filter((c) => rows.some((r) => r[c] !== null && r[c] !== undefined && String(r[c]).trim() !== ''));
  const seen = new Map<string, number>();
  const columns = keep.map((c) => {
    let name = String(header[c] ?? '').replace(/\s+/g, ' ').trim() || `Column ${c + 1}`;
    const times = (seen.get(name) ?? 0) + 1;
    seen.set(name, times);
    if (times > 1) name = `${name} (${times})`;
    return name.slice(0, 200);
  });
  const body = rows.slice(1, MAX_ROWS + 1).map((r) => keep.map((c) => {
    const v = r[c] ?? null;
    return typeof v === 'string' ? v.trim().slice(0, 300) || null : v;
  }));
  return { columns, rows: body };
}

export async function readDataset(file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<Dataset> {
  const ext = file.originalname.toLowerCase().split('.').pop();
  if (ext === 'xlsx' || file.mimetype.includes('spreadsheetml')) return toDataset(await readXlsx(file.buffer));
  if (ext === 'csv' || ext === 'txt' || ext === 'tsv' || file.mimetype.includes('csv')) return toDataset(readCsv(file.buffer.toString('utf8')));
  throw new StatsError('Upload an Excel (.xlsx) or CSV file. In Google Forms, use "Download responses (.csv)".');
}
