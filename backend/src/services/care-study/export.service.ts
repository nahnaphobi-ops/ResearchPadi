import {
  AlignmentType, Document, Footer, HeadingLevel, ImageRun, Packer, PageNumber, PageOrientation, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType,
  type ISectionOptions,
} from 'docx';
import { formatCitation } from '../citations/formatter.service.js';
import { chartData, chartImages, CHART_HEIGHT, CHART_WIDTH } from './chart.service.js';
import { citedSources, type CareSource } from './guards.js';
import { entriesText, type CareStudyTemplate, type SectionEntries, type TemplateSection } from './template.service.js';

/**
 * Two Word exports of a care study:
 * - supervisor copy: each section shows the student's own notes beside the
 *   polished draft, so a supervisor can see what is hers;
 * - clean copy: the study as a document to submit (the drafts only), with
 *   full-width tables and the app-plotted charts.
 * Tables in the drafts are Markdown pipe tables and become real Word tables.
 */
export interface ExportStudy {
  id: string;
  pseudonym: string;
  focus: string;
  institution_name?: string | null;
  supervisor_name?: string | null;
  consent_confirmed_at: string;
  declaration_confirmed_at: string;
  sources: CareSource[];
}

type SectionRows = Record<string, { entries?: SectionEntries; draft?: string | null } | undefined>;
type Block = Paragraph | Table;

const FONT = 'Times New Roman';
const AMBER = 'B45309';
const GREY = '6B7C93';

const run = (text: string, opts: { bold?: boolean; italics?: boolean; size?: number; color?: string; highlight?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size: opts.size ?? 20, bold: opts.bold, italics: opts.italics, color: opts.color, highlight: opts.highlight ? 'yellow' : undefined });

const isTableLine = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const splitRow = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isSeparator = (cells: string[]) => cells.every((c) => /^:?-{2,}:?$/.test(c));
const isHeading = (line: string) => line.length < 100 && /[A-Z]{3}/.test(line) && line === line.toUpperCase() && !/[.!?]$/.test(line);
const PLACEHOLDER = /(\[Student to supply:[^\]]*\])/g;
const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** How many columns the widest table in a draft has (care plans have eight). */
export function widestTable(text: string | null | undefined): number {
  let widest = 0;
  for (const line of (text ?? '').split('\n')) if (isTableLine(line)) widest = Math.max(widest, splitRow(line).length);
  return widest;
}

function pipeTable(lines: string[], opts: { size: number; wide?: boolean }): Table {
  const rows = lines.map(splitRow).filter((cells) => !isSeparator(cells));
  const columns = Math.max(...rows.map((r) => r.length));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells, r) => new TableRow({
      tableHeader: r === 0,
      cantSplit: true,
      children: Array.from({ length: columns }, (_, c) => new TableCell({
        shading: r === 0 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E8EEF5' } : undefined,
        children: (cells[c] ?? '').split(/<br\s*\/?>/i).map((t) => new Paragraph({
          children: t.split(PLACEHOLDER).filter(Boolean).map((part) => part.startsWith('[Student to supply:')
            ? run(part, { size: opts.size, bold: true, color: AMBER })
            : run(part, { size: opts.size, bold: r === 0 })),
        })),
      })),
    })),
  });
}

interface TextOptions {
  size: number;
  tableSize: number;
  /** Lines to drop when they repeat a heading already printed (e.g. the chapter title). */
  skipHeadings?: string[];
  highlightPlaceholders?: boolean;
  line?: number;
  /** Give numbered headings (1.1, 2.3 ...) a Word heading style, so the contents page can list them. */
  headingStyles?: boolean;
}

/** Draft text → paragraphs and tables. */
function textBlocks(text: string, opts: TextOptions): Block[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const skip = new Set((opts.skipHeadings ?? []).map(normalise).filter(Boolean));
  const blocks: Block[] = [];
  let seenContent = false;
  for (let i = 0; i < lines.length; i++) {
    if (isTableLine(lines[i])) {
      const start = i;
      while (i + 1 < lines.length && isTableLine(lines[i + 1])) i++;
      blocks.push(pipeTable(lines.slice(start, i + 1), { size: opts.tableSize }));
      blocks.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      seenContent = true;
      continue;
    }
    const line = lines[i].replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
    if (!line) continue;
    // Only the opening headings of a section can repeat the part heading.
    if (!seenContent && isHeading(line) && skip.has(normalise(line))) continue;
    seenContent = true;
    const numbered = /^\d+(\.\d+)+\.?\s+[A-Z]/.test(line) && line.length < 90 && !/[.!?]$/.test(line);
    // "2.1 SOCIAL HISTORY" is a heading; "1. Reassure the client" is a list item.
    const heading = isHeading(line) || numbered;
    const styled = Boolean(opts.headingStyles && numbered);
    blocks.push(new Paragraph({
      heading: styled ? HeadingLevel.HEADING_2 : undefined,
      spacing: { before: heading ? 200 : 0, after: heading ? 100 : 120, line: opts.line },
      alignment: heading ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
      keepNext: heading,
      children: line.split(PLACEHOLDER).filter(Boolean).map((part) => part.startsWith('[Student to supply:')
        ? run(part, { size: opts.size, bold: true, color: opts.highlightPlaceholders ? undefined : AMBER, highlight: opts.highlightPlaceholders })
        // Heading styles carry their own colour; keep headings black like the rest of the document.
        : run(part, { size: opts.size, bold: heading, color: styled ? '000000' : undefined })),
    }));
  }
  return blocks;
}

/** Charts plotted by the app from the student's numbers, as captioned figures. */
function chartBlocks(section: TemplateSection, entries: SectionEntries | undefined, width: number): Block[] {
  const out: Block[] = [];
  const height = Math.round((width * CHART_HEIGHT) / CHART_WIDTH);
  for (const spec of section.charts ?? []) {
    const data = chartData(spec, entries);
    const images = chartImages(data);
    if (!images.length) continue;
    out.push(new Paragraph({ keepNext: true, spacing: { before: 240, after: 80 }, children: [run(spec.title, { bold: true, size: 22 })] }));
    for (const image of images) {
      out.push(new Paragraph({ keepNext: true, spacing: { before: 80, after: 40 }, children: [run(image.label, { size: 20 })] }));
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
        new ImageRun({ type: 'png', data: image.png, transformation: { width, height }, altText: { name: image.label, description: `${spec.title}: ${image.label}`, title: image.label } }),
      ] }));
    }
    const notes = [spec.note, data.skipped ? `${data.skipped} reading${data.skipped === 1 ? ' has' : 's have'} no date or time and ${data.skipped === 1 ? 'is' : 'are'} not plotted.` : '']
      .filter(Boolean).join(' ');
    if (notes) out.push(new Paragraph({ spacing: { after: 160 }, children: [run(notes, { italics: true, size: 18, color: GREY })] }));
  }
  return out;
}

function bibliographyBlocks(sections: SectionRows, template: CareStudyTemplate, sources: CareSource[]): Block[] {
  const cited = citedSources(template.sections.map((s) => sections[s.key]?.draft ?? ''), sources);
  const entries = cited
    .map((s) => formatCitation({ title: s.title, authors: s.authors, year: s.year ?? undefined, source: s.container || s.publisher, url: s.doi ? `https://doi.org/${s.doi}` : s.url }, 'apa').replace(/\*/g, ''))
    .sort((a, b) => a.localeCompare(b));
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [run('BIBLIOGRAPHY', { bold: true, size: 26 })] }),
    ...(entries.length
      ? entries.map((b) => new Paragraph({ indent: { left: 720, hanging: 720 }, spacing: { after: 160 }, children: [run(b, { size: 24 })] }))
      : [new Paragraph({ children: [run('No retrieved sources are cited yet.', { italics: true, color: GREY, size: 22 })] })]),
  ];
}

const footer = () => new Footer({
  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })],
});

const headerCell = (text: string) => new TableCell({
  shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E8EEF5' },
  children: [new Paragraph({ children: [run(text, { bold: true })] })],
});

const notesBlocks = (text: string): Paragraph[] =>
  text.trim()
    ? text.split('\n').map((line) => new Paragraph({ spacing: { after: 40 }, children: [run(line, { size: 18 })] }))
    : [new Paragraph({ children: [run('Nothing entered.', { italics: true, color: GREY })] })];

// ── Supervisor copy ───────────────────────────────────────────────────────

export async function buildCareStudyDocx(
  study: ExportStudy,
  template: CareStudyTemplate,
  sections: SectionRows,
  generatedAt = new Date().toISOString()
): Promise<Buffer> {
  const body: Block[] = [];
  let lastPart = '';

  for (const s of template.sections) {
    const row = sections[s.key];
    if (s.part && s.part !== lastPart) {
      body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [run(s.part, { bold: true, size: 26 })] }));
      lastPart = s.part;
    }
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [run(s.title, { bold: true, size: 22 })] }));
    body.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [35, 65],
      rows: [
        new TableRow({ tableHeader: true, children: [headerCell("Student's own notes"), headerCell('Polished draft')] }),
        new TableRow({
          children: [
            new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: notesBlocks(entriesText(s, row?.entries)) }),
            new TableCell({
              width: { size: 65, type: WidthType.PERCENTAGE },
              children: row?.draft
                ? (textBlocks(row.draft, { size: 20, tableSize: 16 }) as Paragraph[])
                : [new Paragraph({ children: [run('Not drafted yet.', { italics: true, color: GREY })] })],
            }),
          ],
        }),
      ],
    }));
    body.push(...chartBlocks(s, row?.entries, 560));
  }

  const doc = new Document({
    creator: 'ResearchPadi',
    title: `${template.name} — ${study.pseudonym}`,
    description: "Care study export: the student's own notes beside the AI-assisted draft.",
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      footers: { default: footer() },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [run(template.name.toUpperCase(), { bold: true, size: 30 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`Client: ${study.pseudonym}`, { size: 24 })] }),
        ...(study.focus ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`${template.focus_label}: ${study.focus}`, { size: 24 })] })] : []),
        ...(study.institution_name ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(study.institution_name, { size: 24 })] })] : []),
        ...(study.supervisor_name ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`Supervisor: ${study.supervisor_name}`, { size: 24 })] })] : []),
        new Paragraph({ spacing: { before: 300 }, children: [run('About this export', { bold: true })] }),
        new Paragraph({ children: [run(
          "Each section shows the student's own notes on the left and the AI-assisted draft on the right. The AI was instructed to reword, order and explain only what the student entered. Items the student has not supplied appear as [Student to supply: …]. Charts are plotted by ResearchPadi from the numbers the student entered. This document has not been approved by any college or council.",
        )] }),
        new Paragraph({ spacing: { before: 120 }, children: [run(
          `Student declared they personally cared for this client on ${study.declaration_confirmed_at.slice(0, 10)} and confirmed the client's consent on ${study.consent_confirmed_at.slice(0, 10)}. Exported ${generatedAt.slice(0, 16).replace('T', ' ')} UTC. Study ID ${study.id}.`,
          { italics: true, color: GREY },
        )] }),
        new Paragraph({ children: [run(template.notice, { italics: true, color: GREY })] }),
        ...body,
        ...bibliographyBlocks(sections, template, study.sources),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

// ── Clean copy ────────────────────────────────────────────────────────────

const BODY: TextOptions = { size: 24, tableSize: 18, line: 360, highlightPlaceholders: true, headingStyles: true };

/**
 * The care study as a document to submit: drafts only, in order, with the
 * chapter headings, full-width tables and charts. Sections with a wide table
 * (care plans, drug lists) are laid out on landscape pages. Anything the
 * student has not supplied stays highlighted so it cannot slip through.
 */
export async function buildCleanCareStudyDocx(
  study: ExportStudy,
  template: CareStudyTemplate,
  sections: SectionRows
): Promise<Buffer> {
  const title = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 400 }, children: [run(template.name.toUpperCase(), { bold: true, size: 32 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [run(`Client: ${study.pseudonym}`, { size: 26 })] }),
    ...(study.focus ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [run(`${template.focus_label}: ${study.focus}`, { size: 26 })] })] : []),
    ...(study.institution_name ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 200 }, children: [run(study.institution_name, { bold: true, size: 26 })] })] : []),
    ...(study.supervisor_name ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`Supervisor: ${study.supervisor_name}`, { size: 24 })] })] : []),
  ];

  // Consecutive sections with the same page orientation share a Word section.
  interface Group { landscape: boolean; children: Block[] }
  const groups: Group[] = [];
  let lastPart = '';

  for (const s of template.sections) {
    const row = sections[s.key];
    const landscape = widestTable(row?.draft) >= 6;
    const blocks: Block[] = [];

    if (s.part && s.part !== lastPart) {
      blocks.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: groups.length > 0 || blocks.length > 0,
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 300 },
        children: [run(s.part, { bold: true, size: 28, color: '000000' })],
      }));
      lastPart = s.part;
    }

    if (row?.draft) {
      blocks.push(...textBlocks(row.draft, { ...BODY, skipHeadings: [s.part ?? '', ...(s.part?.split(':') ?? []), s.title] }));
    } else {
      blocks.push(new Paragraph({ spacing: { after: 160 }, children: [
        run(`[Student to supply: the "${s.title}" section has not been drafted yet]`, { bold: true, size: 24, highlight: true }),
      ] }));
    }
    blocks.push(...chartBlocks(s, row?.entries, landscape ? 640 : 520));

    const last = groups[groups.length - 1];
    if (last && last.landscape === landscape) last.children.push(...blocks);
    else groups.push({ landscape, children: blocks });
  }

  const portrait = { page: { margin: { top: 1440, bottom: 1440, left: 2160, right: 1440 } } };
  const landscapePage = { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } };

  // The contents page is a Word field: Word fills in the headings and page numbers when it updates fields.
  const contents: Block[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [run('TABLE OF CONTENTS', { bold: true, size: 28 })] }),
    new TableOfContents('Table of contents', { hyperlink: true, headingStyleRange: '1-2' }),
  ];

  const docSections: ISectionOptions[] = [
    { properties: portrait, footers: { default: footer() }, children: title },
    { properties: portrait, footers: { default: footer() }, children: contents },
    ...groups.map((g, i): ISectionOptions => ({
      properties: g.landscape ? landscapePage : portrait,
      footers: { default: footer() },
      children: i === groups.length - 1 && !g.landscape ? [...g.children, ...bibliographyBlocks(sections, template, study.sources)] : g.children,
    })),
  ];
  // A trailing landscape group needs a portrait section for the bibliography.
  if (groups.length && groups[groups.length - 1].landscape) {
    docSections.push({ properties: portrait, footers: { default: footer() }, children: bibliographyBlocks(sections, template, study.sources) });
  }

  const doc = new Document({
    creator: 'ResearchPadi',
    title: `${template.name} — ${study.pseudonym}`,
    description: 'Care study prepared with ResearchPadi from the student\'s own entries. Not approved by any college or council.',
    // Word asks to update fields on opening, which fills in the contents page.
    features: { updateFields: true },
    sections: docSections,
  });
  return Packer.toBuffer(doc);
}
