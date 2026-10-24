import { GRID, inline, pdfTable, renderPdf, type InlineStyle, type PdfContent, type PdfRun } from '../documents/pdf.service.js';
import {
  bibliographyEntries, chartFigures, chartHeight, cleanDescription, declarationLine, documentTitle, isPlaceholder, LANDSCAPE_COLUMNS,
  NO_SOURCES_CITED, PLACEHOLDER, sectionLayout, subjectLine, SUPERVISOR_COPY_ABOUT, SUPERVISOR_COPY_TITLE, supervisorDescription, widestTable,
  type ExportStudy, type SectionRows,
} from './export.service.js';
import { entriesText, type CareStudyTemplate, type SectionEntries, type TemplateSection } from './template.service.js';

/**
 * The two care study exports as PDFs, matching the Word files (export.service.ts):
 * the supervisor copy with the student's notes beside each draft, and the clean
 * copy to submit, with a contents page, landscape pages for wide tables,
 * highlighted gaps and the app-plotted charts.
 */
const AMBER = '#B45309';
const GREY = '#6B7C93';
// Word image widths are in pixels at 96 dpi; PDF sizes are in points.
const pt = (px: number) => px * 0.75;

const footer = (currentPage: number): PdfContent => ({ text: String(currentPage), alignment: 'center', fontSize: 10, margin: [0, 24, 0, 0] });

/** Text with its "[Student to supply: …]" placeholders marked: highlighted, or bold amber. */
function withPlaceholders(text: string, style: InlineStyle, highlight: boolean): PdfRun[] {
  return text.split(PLACEHOLDER).filter(Boolean).flatMap((part) => isPlaceholder(part)
    ? inline(part, highlight ? { bold: true, background: 'yellow' } : { bold: true, color: AMBER })
    : inline(part, style));
}

interface TextOptions {
  size: number;
  tableSize: number;
  lineHeight?: number;
  highlightPlaceholders?: boolean;
  /** List numbered headings (1.1, 2.3 ...) on the contents page. */
  contents?: boolean;
  /** Move a heading at the foot of a page over to its text. Not inside a table cell, where it would empty the cell. */
  keepHeadingsWithText?: boolean;
  skipHeadings?: string[];
}

function textBlocks(text: string, opts: TextOptions): PdfContent[] {
  return sectionLayout(text, opts.skipHeadings).map((block): PdfContent => {
    if (block.kind === 'table') {
      return {
        ...pdfTable(block.rows, (cell, header) => ({ text: withPlaceholders(cell, { bold: header }, false) })),
        fontSize: opts.tableSize,
        margin: [0, 2, 0, 8],
      };
    }
    const { text: line, heading, numbered } = block;
    // Bold is set on the line, not its runs, so the contents page lists headings in plain type.
    return {
      text: withPlaceholders(line, {}, Boolean(opts.highlightPlaceholders)),
      bold: heading,
      fontSize: opts.size,
      lineHeight: opts.lineHeight ?? 1,
      alignment: heading ? 'left' : 'justify',
      margin: heading ? [0, 10, 0, 5] : [0, 0, 0, 6],
      ...(heading && opts.keepHeadingsWithText ? { headlineLevel: 1 } : {}),
      ...(opts.contents && numbered ? { tocItem: true, tocMargin: [15, 0, 0, 0] } : {}),
    };
  });
}

function chartBlocks(section: TemplateSection, entries: SectionEntries | undefined, widthPx: number): PdfContent[] {
  return chartFigures(section, entries).flatMap((figure) => [
    { text: inline(figure.title, { bold: true }), fontSize: 11, headlineLevel: 1, margin: [0, 12, 0, 4] },
    ...figure.images.flatMap((image) => [
      { text: inline(image.label), fontSize: 10, headlineLevel: 1, margin: [0, 4, 0, 2] },
      { image: `data:image/png;base64,${image.png.toString('base64')}`, width: pt(widthPx), height: pt(chartHeight(widthPx)), alignment: 'center', margin: [0, 0, 0, 4] },
    ]),
    ...(figure.notes ? [{ text: inline(figure.notes, { italics: true }), fontSize: 9, color: GREY, margin: [0, 0, 0, 8] }] : []),
  ]);
}

function bibliography(sections: SectionRows, template: CareStudyTemplate, study: ExportStudy, page: PdfContent): PdfContent[] {
  const entries = bibliographyEntries(sections, template, study.sources);
  return [
    { text: inline('BIBLIOGRAPHY'), bold: true, fontSize: 13, alignment: 'center', margin: [0, 0, 0, 12], pageBreak: 'before', ...page },
    ...(entries.length
      ? entries.map((entry) => ({ text: inline(entry), fontSize: 12, margin: [0, 0, 0, 8] }))
      : [{ text: inline(NO_SOURCES_CITED, { italics: true }), fontSize: 11, color: GREY }]),
  ];
}

const info = (study: ExportStudy, template: CareStudyTemplate, description: string) => ({
  title: documentTitle(study, template),
  author: 'ResearchPadi',
  creator: 'ResearchPadi',
  producer: 'ResearchPadi',
  subject: description,
});

// ── Supervisor copy ───────────────────────────────────────────────────────

export async function buildCareStudyPdf(
  study: ExportStudy,
  template: CareStudyTemplate,
  sections: SectionRows,
  generatedAt = new Date().toISOString()
): Promise<Buffer> {
  const cover = (text: string) => ({ text: inline(text), fontSize: 12, alignment: 'center' });
  const body: PdfContent[] = [];
  let lastPart = '';

  for (const s of template.sections) {
    const row = sections[s.key];
    if (s.part && s.part !== lastPart) {
      body.push({ text: inline(s.part, { bold: true }), fontSize: 13, headlineLevel: 1, margin: [0, 20, 0, 10] });
      lastPart = s.part;
    }
    body.push({ text: inline(s.title, { bold: true }), fontSize: 11, headlineLevel: 1, margin: [0, 12, 0, 6] });
    const notes = entriesText(s, row?.entries);
    body.push({
      table: {
        headerRows: 1,
        widths: ['35%', '65%'],
        body: [
          [
            { text: inline("Student's own notes", { bold: true }), fillColor: '#E8EEF5' },
            { text: inline('Polished draft', { bold: true }), fillColor: '#E8EEF5' },
          ],
          [
            { stack: notes.trim()
              ? notes.split('\n').map((line) => ({ text: inline(line), fontSize: 9, margin: [0, 0, 0, 2] }))
              : [{ text: inline('Nothing entered.', { italics: true }), color: GREY }] },
            { stack: row?.draft
              ? textBlocks(row.draft, { size: 10, tableSize: 8 })
              : [{ text: inline('Not drafted yet.', { italics: true }), color: GREY }] },
          ],
        ],
      },
      layout: GRID,
      fontSize: 10,
    });
    body.push(...chartBlocks(s, row?.entries, 560));
  }

  return renderPdf({
    pageOrientation: 'landscape',
    pageMargins: [54, 54, 54, 54],
    footer,
    info: info(study, template, supervisorDescription(template)),
    content: [
      { text: inline(template.name.toUpperCase(), { bold: true }), fontSize: 15, alignment: 'center', margin: [0, 0, 0, 10] },
      ...(subjectLine(study, template) ? [cover(subjectLine(study, template)!)] : []),
      ...(study.focus ? [cover(`${template.focus_label}: ${study.focus}`)] : []),
      ...(study.institution_name ? [cover(study.institution_name)] : []),
      ...(study.supervisor_name ? [cover(`Supervisor: ${study.supervisor_name}`)] : []),
      { text: inline(SUPERVISOR_COPY_TITLE, { bold: true }), fontSize: 10, margin: [0, 15, 0, 2] },
      { text: inline(SUPERVISOR_COPY_ABOUT), fontSize: 10 },
      { text: inline(declarationLine(study, generatedAt, template), { italics: true }), fontSize: 10, color: GREY, margin: [0, 6, 0, 0] },
      { text: inline(template.notice, { italics: true }), fontSize: 10, color: GREY },
      ...body,
      ...bibliography(sections, template, study, {}),
    ],
  });
}

// ── Clean copy ────────────────────────────────────────────────────────────

/**
 * The care study as a document to submit: drafts only, in order, with a
 * contents page, full-width tables and charts. Sections with a wide table (care
 * plans, drug lists) are on landscape pages. Anything the student has not
 * supplied stays highlighted so it cannot slip through.
 */
export async function buildCleanCareStudyPdf(
  study: ExportStudy,
  template: CareStudyTemplate,
  sections: SectionRows
): Promise<Buffer> {
  const title: PdfContent[] = [
    { text: inline(template.name.toUpperCase(), { bold: true }), fontSize: 16, alignment: 'center', margin: [0, 120, 0, 20] },
    ...(subjectLine(study, template) ? [{ text: inline(subjectLine(study, template)!), fontSize: 13, alignment: 'center', margin: [0, 0, 0, 10] }] : []),
    ...(study.focus ? [{ text: inline(`${template.focus_label}: ${study.focus}`), fontSize: 13, alignment: 'center', margin: [0, 0, 0, 10] }] : []),
    ...(study.institution_name ? [{ text: inline(study.institution_name, { bold: true }), fontSize: 13, alignment: 'center', margin: [0, 30, 0, 10] }] : []),
    ...(study.supervisor_name ? [{ text: inline(`Supervisor: ${study.supervisor_name}`), fontSize: 12, alignment: 'center' }] : []),
  ];

  const contents: PdfContent = {
    toc: {
      title: { text: inline('TABLE OF CONTENTS', { bold: true }), fontSize: 14, alignment: 'center', margin: [0, 0, 0, 15] },
      textStyle: { fontSize: 12 },
      numberStyle: { fontSize: 12 },
    },
    pageBreak: 'before',
  };

  const body: PdfContent[] = [];
  let lastPart = '';
  let orientation = '';

  for (const s of template.sections) {
    const row = sections[s.key];
    const wanted = widestTable(row?.draft) >= LANDSCAPE_COLUMNS ? 'landscape' : 'portrait';
    const blocks: PdfContent[] = [];

    const newPart = Boolean(s.part && s.part !== lastPart);
    if (newPart) {
      blocks.push({ text: inline(s.part!), bold: true, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 15], tocItem: true });
      lastPart = s.part!;
    }

    if (row?.draft) {
      blocks.push(...textBlocks(row.draft, {
        size: 12, tableSize: 9, lineHeight: 1.5, highlightPlaceholders: true, contents: true, keepHeadingsWithText: true,
        skipHeadings: [s.part ?? '', ...(s.part?.split(':') ?? []), s.title],
      }));
    } else {
      blocks.push({ text: withPlaceholders(`[Student to supply: the "${s.title}" section has not been drafted yet]`, {}, true), fontSize: 12, margin: [0, 0, 0, 8] });
    }
    blocks.push(...chartBlocks(s, row?.entries, wanted === 'landscape' ? 640 : 520));

    // A new part starts a page, and so does a section that needs the other orientation.
    if (newPart) blocks[0] = { ...blocks[0], pageBreak: 'before', pageOrientation: wanted };
    else if (wanted !== orientation) blocks.unshift({ text: '', pageBreak: 'before', pageOrientation: wanted });
    if (newPart || wanted !== orientation) orientation = wanted;
    body.push(...blocks);
  }

  return renderPdf({
    pageMargins: [108, 72, 72, 72],
    footer,
    info: info(study, template, cleanDescription(template)),
    content: [
      ...title,
      contents,
      ...body,
      ...bibliography(sections, template, study, { pageOrientation: 'portrait' }).map((block, i) => (i === 0 ? { ...block, tocItem: true } : block)),
    ],
  });
}
