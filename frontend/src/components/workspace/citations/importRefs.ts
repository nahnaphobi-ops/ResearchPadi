import type { PersonName, Source, SourceType } from './types';

/**
 * References exported from Zotero, Mendeley or EndNote as BibTeX (.bib) or
 * RIS (.ris), turned into sources the editor can cite. Only what the file says
 * is used; nothing is looked up or filled in.
 */
export const MAX_IMPORT = 500;

const LATEX: Record<string, string> = { "\\'": '́', '\\`': '̀', '\\^': '̂', '\\"': '̈', '\\~': '̃', '\\c': '̧' };

/** Braces, LaTeX accents and escapes out of a BibTeX value. */
function cleanBib(value: string): string {
  return value
    .replace(/\{\\([`'^"~c])\s*\{?([A-Za-z])\}?\}/g, (_, a, ch) => (ch + (LATEX[`\\${a}`] ?? '')).normalize('NFC'))
    .replace(/\\([`'^"~])\{?([A-Za-z])\}?/g, (_, a, ch) => (ch + (LATEX[`\\${a}`] ?? '')).normalize('NFC'))
    .replace(/\\([&%$#_])/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Mensah, Kofi" or "Kofi Mensah" (or an organisation in braces). */
function parseName(raw: string): PersonName | null {
  const name = raw.trim();
  if (!name) return null;
  if (name.includes(',')) {
    const [family, ...given] = name.split(',');
    return { family: family.trim(), given: given.join(' ').trim() };
  }
  const parts = name.split(/\s+/);
  return parts.length === 1 ? { family: parts[0], given: '' } : { family: parts[parts.length - 1], given: parts.slice(0, -1).join(' ') };
}

function stableId(title: string, year: number | null): string {
  let h = 0;
  for (const ch of `${title.toLowerCase()}|${year ?? ''}`) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `imp-${(h >>> 0).toString(36)}`;
}

const yearOf = (v: string | undefined) => {
  const m = v?.match(/\b(1[89]\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
};

function make(fields: Partial<Source> & { title: string; authors: PersonName[]; year: number | null; type: SourceType }): Source {
  const doi = fields.doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim() || undefined;
  return {
    ...fields,
    doi,
    id: stableId(fields.title, fields.year),
    origin: 'imported',
    ghanaian: false,
  };
}

// ── BibTeX ─────────────────────────────────────────────────────────────────

const BIB_TYPES: Record<string, { type: SourceType; genre?: string }> = {
  article: { type: 'article' },
  book: { type: 'book' },
  inbook: { type: 'chapter' },
  incollection: { type: 'chapter' },
  inproceedings: { type: 'conference' },
  conference: { type: 'conference' },
  phdthesis: { type: 'thesis', genre: 'Doctoral dissertation' },
  mastersthesis: { type: 'thesis', genre: "Master's thesis" },
  techreport: { type: 'report' },
  online: { type: 'webpage' },
  misc: { type: 'other' },
};

/** The body of one entry as fields: name = {value}, "value" or bare number. */
function bibFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let i = body.indexOf(',') + 1; // skip the citation key
  while (i < body.length) {
    const m = /\s*([A-Za-z_-]+)\s*=\s*/y;
    m.lastIndex = i;
    const head = m.exec(body);
    if (!head) break;
    i = m.lastIndex;
    let value: string;
    if (body[i] === '{') {
      let depth = 0;
      const start = i;
      for (; i < body.length; i++) {
        if (body[i] === '{') depth++;
        else if (body[i] === '}' && --depth === 0) break;
      }
      value = body.slice(start + 1, i);
      i++;
    } else if (body[i] === '"') {
      const end = body.indexOf('"', i + 1);
      value = body.slice(i + 1, end < 0 ? body.length : end);
      i = end < 0 ? body.length : end + 1;
    } else {
      const end = body.slice(i).search(/[,}\n]/);
      value = body.slice(i, end < 0 ? body.length : i + end);
      i = end < 0 ? body.length : i + end;
    }
    fields[head[1].toLowerCase()] = value;
    const comma = body.indexOf(',', i);
    if (comma < 0) break;
    i = comma + 1;
  }
  return fields;
}

export function parseBibtex(text: string): Source[] {
  const out: Source[] = [];
  const entry = /@(\w+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = entry.exec(text)) && out.length < MAX_IMPORT) {
    const kind = m[1].toLowerCase();
    if (kind === 'comment' || kind === 'string' || kind === 'preamble') continue;
    // The entry runs to its matching closing brace.
    let depth = 1;
    let j = entry.lastIndex;
    for (; j < text.length && depth > 0; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
    }
    const f = bibFields(text.slice(entry.lastIndex, j - 1));
    entry.lastIndex = j;
    const title = cleanBib(f.title ?? '');
    if (!title) continue;
    const kindInfo = BIB_TYPES[kind] ?? { type: 'other' as SourceType };
    const authors = (f.author ?? f.editor ?? '').split(/\s+and\s+/i).map(cleanBib).map(parseName).filter((n): n is PersonName => n !== null);
    out.push(make({
      title,
      authors,
      year: yearOf(f.year ?? f.date),
      type: kindInfo.type === 'other' && f.url ? 'webpage' : kindInfo.type,
      genre: kindInfo.genre ?? (f.type ? cleanBib(f.type) : undefined),
      containerTitle: cleanBib(f.journal ?? f.journaltitle ?? f.booktitle ?? '') || undefined,
      volume: cleanBib(f.volume ?? '') || undefined,
      issue: cleanBib(f.number ?? f.issue ?? '') || undefined,
      pages: cleanBib(f.pages ?? '').replace(/--/g, '–') || undefined,
      doi: cleanBib(f.doi ?? '') || undefined,
      url: cleanBib(f.url ?? '') || undefined,
      publisher: cleanBib(f.publisher ?? '') || undefined,
      institution: cleanBib(f.school ?? f.institution ?? '') || undefined,
    }));
  }
  return out;
}

// ── RIS ────────────────────────────────────────────────────────────────────

const RIS_TYPES: Record<string, { type: SourceType; genre?: string }> = {
  JOUR: { type: 'article' }, JFULL: { type: 'article' }, MGZN: { type: 'article' }, NEWS: { type: 'article' },
  BOOK: { type: 'book' }, EBOOK: { type: 'book' }, CHAP: { type: 'chapter' }, ECHAP: { type: 'chapter' },
  THES: { type: 'thesis', genre: 'Thesis' }, RPRT: { type: 'report' }, GOVDOC: { type: 'report' },
  CONF: { type: 'conference' }, CPAPER: { type: 'conference' }, ELEC: { type: 'webpage' }, WEB: { type: 'webpage' },
};

// A byte-order mark at the start (from Windows exports) is not part of the first tag.
const stripBom = (text: string) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

export function parseRis(text: string): Source[] {
  const out: Source[] = [];
  let rec: Record<string, string[]> | null = null;
  const finish = () => {
    if (!rec || out.length >= MAX_IMPORT) return;
    const one = (...tags: string[]) => tags.map((t) => rec![t]?.[0]).find(Boolean)?.trim();
    const title = one('TI', 'T1', 'CT', 'BT') ?? '';
    if (!title) return;
    const kind = RIS_TYPES[(one('TY') ?? '').toUpperCase()] ?? { type: 'other' as SourceType };
    const authors = [...(rec.AU ?? []), ...(rec.A1 ?? [])].map(parseName).filter((n): n is PersonName => n !== null);
    const sp = one('SP');
    const ep = one('EP');
    out.push(make({
      title,
      authors,
      year: yearOf(one('PY', 'Y1', 'DA')),
      type: kind.type === 'other' && one('UR') ? 'webpage' : kind.type,
      genre: kind.genre && one('M3') ? one('M3') : kind.genre,
      containerTitle: one('T2', 'JO', 'JF', 'JA') || undefined,
      volume: one('VL') || undefined,
      issue: one('IS') || undefined,
      pages: sp ? (ep ? `${sp}–${ep}` : sp) : undefined,
      doi: one('DO') || undefined,
      url: one('UR', 'L2') || undefined,
      publisher: one('PB') || undefined,
      institution: kind.type === 'thesis' ? one('PB') || undefined : undefined,
    }));
  };
  for (const line of stripBom(text).split(/\r?\n/)) {
    const m = line.match(/^([A-Z][A-Z0-9])\s{2}-\s?(.*)$/);
    if (!m) continue;
    const [, tag, value] = m;
    if (tag === 'TY') { finish(); rec = { TY: [value] }; continue; }
    if (tag === 'ER') { finish(); rec = null; continue; }
    if (rec) (rec[tag] ??= []).push(value);
  }
  finish();
  return out;
}

/** A .bib or .ris file (decided by its content, so a wrong extension still works). */
export function parseReferences(text: string): Source[] {
  return /^\s*TY\s{2}-/m.test(text) ? parseRis(text) : parseBibtex(text);
}
