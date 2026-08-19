import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export interface DocxProvenance {
  paperId: string;
  generatedAt: string;
  disclosureId: string;
  disclosureName: string;
  disclosureText: string;
  includeStatement: boolean;
  toolName?: string;
  toolVersion?: string;
}

function bodyParagraphs(content: string) {
  return content.split('\n').map(line => {
    const isHeading = line.startsWith('CHAPTER') || /^\d\.\d/.test(line);
    return new Paragraph({
      children: [
        new TextRun({
          text: line,
          size: 24,
          font: 'Times New Roman',
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

function disclosureParagraphs(provenance: DocxProvenance) {
  if (!provenance.includeStatement) return [];
  return [
    new Paragraph({
      text: 'AI Assistance Disclosure',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 600, after: 200 }
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: provenance.disclosureText,
          size: 24,
          font: 'Times New Roman',
          italics: true
        })
      ],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, before: 120, after: 120 }
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Marked under EU AI Act Article 50 · ${provenance.disclosureName} · Generated ${provenance.generatedAt}`,
          size: 20,
          font: 'Times New Roman',
          color: '6B7C93'
        })
      ],
      spacing: { before: 80, after: 200 }
    })
  ];
}

export const generateDocx = async (title: string, content: string, provenance?: DocxProvenance) => {
  const generatedAt = provenance?.generatedAt || new Date().toISOString();
  const toolName = provenance?.toolName || 'ResearchPadi';
  const toolVersion = provenance?.toolVersion || '1.0';

  const doc = new Document({
    creator: toolName,
    lastModifiedBy: toolName,
    title,
    subject: 'AI-assisted academic research paper',
    description: provenance
      ? `AI-generated academic content marked for EU AI Act Article 50 transparency. Disclosure: ${provenance.disclosureName}.`
      : 'Academic research paper exported from ResearchPadi.',
    keywords: 'AI-generated, ResearchPadi, EU AI Act Article 50, academic writing, provenance',
    customProperties: [
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
      { name: 'ai.generatedAt', value: generatedAt },
      { name: 'ai.paperId', value: provenance?.paperId || '' },
      { name: 'ai.disclosureId', value: provenance?.disclosureId || '' },
      { name: 'ai.disclosureName', value: provenance?.disclosureName || '' },
      { name: 'ai.disclosureText', value: (provenance?.disclosureText || '').slice(0, 255) },
    ],
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
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          ...bodyParagraphs(content),
          ...(provenance ? disclosureParagraphs(provenance) : [])
        ]
      }
    ]
  });

  return Packer.toBuffer(doc);
};
