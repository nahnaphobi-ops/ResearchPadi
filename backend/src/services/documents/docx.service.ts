import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Header, BorderStyle } from 'docx';

/**
 * Every study draft carries this statement: in a box above the title and again
 * at the end. It can't be switched off, and it describes what actually happened
 * (the AI wrote the draft), unlike the author-written disclosure templates.
 */
export const STUDY_DRAFT_NOTICE =
  'This document was researched and written by artificial intelligence (ResearchPadi) from a brief supplied by the student. ' +
  "It is a study and reference draft, not the student's own work. Use it to understand the topic, plan your chapters and find sources, " +
  'then write your paper in your own words. Do not submit this draft, or any part of it, as your own work. ' +
  'AI can be wrong and can present a guess as fact: check every fact, figure, quotation and reference against the original source before you rely on it.';

export const STUDY_DRAFT_HEADER = 'AI-generated study draft (ResearchPadi) · not for submission as your own work';

export interface DocxProvenance {
  paperId: string;
  generatedAt: string;
  toolName?: string;
  toolVersion?: string;
}

/** The file details every study draft carries, in Word and PDF alike. */
export const STUDY_DRAFT_METADATA = {
  subject: 'AI-generated academic study draft',
  description: 'AI-generated study draft, not the student\'s own work. Marked for EU AI Act Article 50 transparency.',
  keywords: 'AI-generated, study draft, ResearchPadi, EU AI Act Article 50, provenance',
};

/** Machine-readable provenance: who generated the draft, when, and that it is AI-generated. */
export function provenanceProperties(provenance: DocxProvenance): { name: string; value: string }[] {
  const toolName = provenance.toolName || 'ResearchPadi';
  const toolVersion = provenance.toolVersion || '1.0';
  return [
    { name: 'c2pa.claimGenerator', value: `${toolName}/${toolVersion}` },
    { name: 'c2pa.digitalSourceType', value: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia' },
    { name: 'schema.org.creativeWorkStatus', value: 'AI-generated' },
    { name: 'schema.org.additionalType', value: 'https://schema.org/DigitalDocument' },
    { name: 'eu.ai.act.article', value: '50' },
    { name: 'eu.ai.act.marked', value: 'true' },
    { name: 'eu.ai.act.machineReadable', value: 'true' },
    { name: 'ai.generated', value: 'true' },
    { name: 'ai.tool', value: toolName },
    { name: 'ai.toolVersion', value: toolVersion },
    { name: 'ai.generatedAt', value: provenance.generatedAt },
    { name: 'ai.paperId', value: provenance.paperId },
    { name: 'ai.documentType', value: 'study-draft' },
    { name: 'ai.disclosureText', value: STUDY_DRAFT_NOTICE.slice(0, 255) },
  ];
}

/** The line under the notice box: which draft this is and when it was made. */
export const draftIdLine = (provenance: DocxProvenance) => `Draft ID ${provenance.paperId} · Generated ${provenance.generatedAt}`;

/** The last line of the closing statement. */
export const markedLine = (provenance: DocxProvenance) =>
  `Marked as AI-generated under EU AI Act Article 50 · ${draftIdLine(provenance)}`;

const FONT = 'Times New Roman';

function bodyParagraphs(content: string) {
  return content.split('\n').map(line => {
    const isHeading = line.startsWith('CHAPTER') || /^\d\.\d/.test(line);
    return new Paragraph({
      children: [
        new TextRun({
          text: line,
          size: 24,
          font: FONT,
          bold: !!isHeading
        })
      ],
      alignment: AlignmentType.JUSTIFIED,
      spacing: {
        line: 360,
        before: 200,
        after: 200
      }
    });
  });
}

function noticeBox(provenance: DocxProvenance) {
  // Three paragraphs sharing side borders read as one shaded box.
  const border = { style: BorderStyle.SINGLE, size: 8, color: 'B45309', space: 6 };
  return [
    new Paragraph({
      children: [new TextRun({ text: 'STUDY DRAFT · WRITTEN BY AI', bold: true, size: 22, font: FONT, color: 'B45309' })],
      border: { top: border, left: border, right: border },
      shading: { fill: 'FFF7ED' },
      spacing: { before: 0, after: 0 },
    }),
    new Paragraph({
      children: [new TextRun({ text: STUDY_DRAFT_NOTICE, size: 22, font: FONT })],
      border: { left: border, right: border },
      shading: { fill: 'FFF7ED' },
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 80, after: 0, line: 300 },
    }),
    new Paragraph({
      children: [new TextRun({ text: draftIdLine(provenance), size: 18, font: FONT, color: '6B7C93' })],
      border: { bottom: border, left: border, right: border },
      shading: { fill: 'FFF7ED' },
      spacing: { before: 80, after: 400 },
    }),
  ];
}

function closingStatement(provenance: DocxProvenance) {
  return [
    new Paragraph({
      text: 'About this study draft',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 600, after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: STUDY_DRAFT_NOTICE, size: 24, font: FONT, italics: true })],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, before: 120, after: 120 }
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: markedLine(provenance),
          size: 20,
          font: FONT,
          color: '6B7C93'
        })
      ],
      spacing: { before: 80, after: 200 }
    })
  ];
}

export const generateDocx = async (title: string, content: string, provenance: DocxProvenance) => {
  const toolName = provenance.toolName || 'ResearchPadi';

  const doc = new Document({
    creator: toolName,
    lastModifiedBy: toolName,
    title,
    ...STUDY_DRAFT_METADATA,
    customProperties: provenanceProperties(provenance),
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 2160,
              right: 1440
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: STUDY_DRAFT_HEADER, size: 16, font: FONT, color: 'B45309' })],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          ...noticeBox(provenance),
          new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          ...bodyParagraphs(content),
          ...closingStatement(provenance)
        ]
      }
    ]
  });

  return Packer.toBuffer(doc);
};
