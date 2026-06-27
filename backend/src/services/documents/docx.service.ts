import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export const generateDocx = async (title: string, content: string) => {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 2160, // 1.5 inch
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
          ...content.split('\n').map(line => {
            const isHeading = line.startsWith('CHAPTER') || line.match(/^\d\.\d/);
            return new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  size: 24, // 12pt
                  font: 'Times New Roman',
                  bold: isHeading ? true : false
                })
              ],
              alignment: AlignmentType.JUSTIFIED,
              spacing: {
                line: 360, // 1.5 line spacing
                before: 200,
                after: 200
              }
            });
          })
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
};
