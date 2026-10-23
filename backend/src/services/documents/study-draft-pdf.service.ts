import { draftBlocks } from './draft-text.js';
import {
  STUDY_DRAFT_HEADER, STUDY_DRAFT_METADATA, STUDY_DRAFT_NOTICE, draftIdLine, markedLine, provenanceProperties, type DocxProvenance,
} from './docx.service.js';
import { inline, pdfTable, renderPdf, type PdfContent } from './pdf.service.js';

/**
 * A study draft as a PDF, laid out like the Word file and carrying the same AI
 * labels: the notice box above the title, the header on every page, the closing
 * statement, and the provenance in the file's details.
 */
const AMBER = '#B45309';
const GREY = '#6B7C93';
// Word's page: 1 inch margins, 1.5 inches on the binding side.
const MARGINS = [108, 72, 72, 72];

function noticeBox(provenance: DocxProvenance): PdfContent {
  const amber = () => AMBER;
  return {
    table: {
      widths: ['*'],
      body: [[{
        fillColor: '#FFF7ED',
        stack: [
          { text: inline('STUDY DRAFT · WRITTEN BY AI', { bold: true }), fontSize: 11, color: AMBER },
          { text: inline(STUDY_DRAFT_NOTICE), fontSize: 11, alignment: 'justify', margin: [0, 4, 0, 0] },
          { text: inline(draftIdLine(provenance)), fontSize: 9, color: GREY, margin: [0, 4, 0, 0] },
        ],
      }]],
    },
    layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: amber, vLineColor: amber, paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 6, paddingBottom: () => 6 },
    margin: [0, 0, 0, 20],
  };
}

function body(content: string): PdfContent[] {
  return draftBlocks(content).map((block): PdfContent => {
    if (block.kind === 'table') {
      return { ...pdfTable(block.rows, (text, header) => ({ text: inline(text, { bold: header }) })), fontSize: 9, margin: [0, 4, 0, 12] };
    }
    const heading = block.text.startsWith('CHAPTER') || /^\d\.\d/.test(block.text);
    return heading
      ? { text: inline(block.text, { bold: true }), fontSize: 12, headlineLevel: 1, margin: [0, 10, 0, 6] }
      : { text: inline(block.text), fontSize: 12, alignment: 'justify', lineHeight: 1.5, margin: [0, 0, 0, 10] };
  });
}

function closingStatement(provenance: DocxProvenance): PdfContent[] {
  return [
    { text: inline('About this study draft', { bold: true }), fontSize: 14, headlineLevel: 1, margin: [0, 30, 0, 10] },
    { text: inline(STUDY_DRAFT_NOTICE, { italics: true }), fontSize: 12, alignment: 'justify', lineHeight: 1.5, margin: [0, 0, 0, 6] },
    { text: inline(markedLine(provenance)), fontSize: 10, color: GREY },
  ];
}

export async function generateStudyDraftPdf(title: string, content: string, provenance: DocxProvenance): Promise<Buffer> {
  const toolName = provenance.toolName || 'ResearchPadi';
  const toolVersion = provenance.toolVersion || '1.0';
  return renderPdf({
    pageMargins: MARGINS,
    header: () => ({ text: inline(STUDY_DRAFT_HEADER), fontSize: 8, color: AMBER, alignment: 'center', margin: [MARGINS[0], 36, MARGINS[2], 0] }),
    info: {
      title,
      author: toolName,
      creator: `${toolName}/${toolVersion}`,
      producer: toolName,
      ...STUDY_DRAFT_METADATA,
      ...Object.fromEntries(provenanceProperties(provenance).map((p) => [p.name, p.value])),
    },
    content: [
      noticeBox(provenance),
      { text: inline(title, { bold: true }), fontSize: 16, alignment: 'center', margin: [0, 0, 0, 20] },
      ...body(content),
      ...closingStatement(provenance),
    ],
  });
}
