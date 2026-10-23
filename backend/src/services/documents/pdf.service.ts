import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

/**
 * PDF rendering for the exports (pdfmake, on pdfkit). Text is set in Times, the
 * PDF standard font that matches the Word files' Times New Roman. Times only
 * has Western European characters, so any other character (≥, Greek letters
 * and so on) is set in Roboto, which ships with pdfmake and is embedded.
 * Characters neither font has are replaced with a close plain-text form.
 */
const require = createRequire(import.meta.url);
const pdfmake = require('pdfmake');
// pdfkit's font reader, used to ask Roboto which characters it has.
const fontkit = createRequire(createRequire(require.resolve('pdfmake')).resolve('pdfkit'))('fontkit');

// pdfmake has no type definitions: a document and its content are plain objects.
export type PdfContent = Record<string, any>;
export type PdfDocument = Record<string, any>;

export interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  color?: string;
  background?: string;
}
export type PdfRun = InlineStyle & { text: string; font?: string };

const ROBOTO_DIR = join(dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');
const ROBOTO = { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' };
const TIMES = { normal: 'Times-Roman', bold: 'Times-Bold', italics: 'Times-Italic', bolditalics: 'Times-BoldItalic' };

let roboto: { hasGlyphForCodePoint(codePoint: number): boolean } | null = null;

function setUp() {
  if (roboto) return;
  for (const file of Object.values(ROBOTO)) pdfmake.virtualfs.writeFileSync(file, readFileSync(join(ROBOTO_DIR, file)));
  pdfmake.setFonts({ Times: TIMES, Roboto: ROBOTO });
  // Documents are built from our own text: nothing is fetched, and the only "files" are the standard font names.
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((path: string) => Object.values(TIMES).includes(path));
  roboto = fontkit.openSync(join(ROBOTO_DIR, ROBOTO.normal));
}

// Times (WinAnsi): ASCII, Latin-1 and these.
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const inTimes = (ch: string) => {
  const c = ch.codePointAt(0)!;
  return c === 0x09 || c === 0x0a || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.includes(ch);
};
const inRoboto = (ch: string) => roboto!.hasGlyphForCodePoint(ch.codePointAt(0)!);

// Plain forms for characters neither font has.
const PLAIN: Record<string, string> = {
  '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '↑': 'up', '↓': 'down',
  '₵': '¢', '✓': '√', '✔': '√', '✗': '×', '✘': '×',
  'ɛ': 'e', 'Ɛ': 'E', 'ɔ': 'o', 'Ɔ': 'O',
  '​': '', '‌': '', '‍': '', '﻿': '',
};

function printable(ch: string): string {
  if (inTimes(ch)) return ch;
  if (ch in PLAIN) return PLAIN[ch];
  if (inRoboto(ch)) return ch;
  // Accented letters without a glyph lose the accent; anything else shows as "?".
  const bare = ch.normalize('NFKD').replace(/\p{M}/gu, '');
  return bare && [...bare].every((c) => inTimes(c) || inRoboto(c)) ? bare : '?';
}

/** Text as pdfmake runs: Times wherever it can be, Roboto for the characters Times lacks. */
export function inline(text: string, style: InlineStyle = {}): PdfRun[] {
  setUp();
  const runs: PdfRun[] = [];
  let current = '';
  let times = true;
  const flush = () => {
    if (current) runs.push(times ? { ...style, text: current } : { ...style, text: current, font: 'Roboto' });
    current = '';
  };
  for (const ch of [...text].map(printable).join('')) {
    if (inTimes(ch) !== times) {
      flush();
      times = !times;
    }
    current += ch;
  }
  flush();
  return runs;
}

/** Thin grey grid for tables. */
export const GRID = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#9AA5B1',
  vLineColor: () => '#9AA5B1',
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

/** A Markdown pipe table as a PDF table, its header row shaded and repeated on each page. */
export function pdfTable(rows: string[][], cell: (text: string, header: boolean) => PdfContent): PdfContent {
  const columns = Math.max(...rows.map((r) => r.length));
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: Array(columns).fill('*'),
      body: rows.map((cells, r) => Array.from({ length: columns }, (_, c) => ({
        ...cell((cells[c] ?? '').split(/<br\s*\/?>/i).join('\n'), r === 0),
        ...(r === 0 ? { fillColor: '#E8EEF5' } : {}),
      }))),
    },
    layout: GRID,
  };
}

// Page headers and footers carry this style, so they don't count as text below a heading.
const MARGIN_STYLE = 'pageMargin';
type MarginContent = PdfContent | ((currentPage: number, pageCount: number) => PdfContent);
const inMargin = (content: MarginContent | undefined) =>
  content && ((page: number, count: number) => ({ ...(typeof content === 'function' ? content(page, count) : content), style: MARGIN_STYLE }));

/**
 * Keeps a heading (headlineLevel 1) off the foot of a page, moving it to the next with its text.
 * Only headings after it count as nothing: pdfmake decides each node once, so a heading
 * followed by a subheading must move with it.
 */
const keepHeadingsWithText = (node: { headlineLevel?: number }, nodes: { getFollowingNodesOnPage(): { style?: string; headlineLevel?: number }[] }) =>
  node.headlineLevel === 1 && nodes.getFollowingNodesOnPage().every((n) => n.style === MARGIN_STYLE || n.headlineLevel === 1);

export async function renderPdf(doc: PdfDocument): Promise<Buffer> {
  setUp();
  return pdfmake.createPdf({
    pageSize: 'A4',
    language: 'en-GB',
    displayTitle: true,
    pageBreakBefore: keepHeadingsWithText,
    ...doc,
    header: inMargin(doc.header),
    footer: inMargin(doc.footer),
    styles: { [MARGIN_STYLE]: {}, ...doc.styles },
    defaultStyle: { font: 'Times', ...doc.defaultStyle },
  }).getBuffer();
}
