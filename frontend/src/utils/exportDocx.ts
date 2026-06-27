import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat } from 'docx';
import { saveAs } from 'file-saver';

function htmlToDocxParagraphs(html: string): Paragraph[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const paragraphs: Paragraph[] = [];

  const getAlignment = (el: Element): typeof AlignmentType[keyof typeof AlignmentType] => {
    const style = el.getAttribute('style') || '';
    if (style.includes('text-align: center') || style.includes('text-align:center')) return AlignmentType.CENTER;
    if (style.includes('text-align: right') || style.includes('text-align:right')) return AlignmentType.RIGHT;
    if (style.includes('text-align: justify') || style.includes('text-align:justify')) return AlignmentType.JUSTIFIED;
    return AlignmentType.LEFT;
  };

  const getHeadingLevel = (tag: string): typeof HeadingLevel[keyof typeof HeadingLevel] | null => {
    const map: Record<string, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
      h1: HeadingLevel.HEADING_1,
      h2: HeadingLevel.HEADING_2,
      h3: HeadingLevel.HEADING_3,
      h4: HeadingLevel.HEADING_4,
    };
    return map[tag] || null;
  };

  const processNode = (node: ChildNode): Paragraph[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        return [new Paragraph({ children: [new TextRun({ text, size: 24 })] })];
      }
      return [];
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // Skip script/style
    if (tag === 'script' || tag === 'style') return [];

    // Handle headings
    const headingLevel = getHeadingLevel(tag);
    if (headingLevel) {
      const runs = Array.from(el.childNodes).flatMap(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent || '';
          const isBold = (el as HTMLElement).style?.fontWeight === 'bold' || tag === 'strong';
          return [new TextRun({ text, bold: isBold, size: tag === 'h1' ? 32 : tag === 'h2' ? 28 : 26 })];
        }
        return [];
      });
      return [new Paragraph({ children: runs, heading: headingLevel, alignment: getAlignment(el) })];
    }

    // Handle table
    if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'));
      // Just convert table to text paragraphs for simplicity
      return rows.flatMap(row => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const hasHeaderCells = cells.some(c => c.tagName.toLowerCase() === 'th');
        const text = cells.map(c => c.textContent?.trim() || '').join(' | ');
        return [new Paragraph({ children: [new TextRun({ text, size: 24, bold: hasHeaderCells })] })];
      });
    }

    // Handle block elements
    if (tag === 'p' || tag === 'div' || tag === 'li') {
      const runs = Array.from(el.childNodes).flatMap(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          return [new TextRun({ text: child.textContent || '', size: 24 })];
        }
        if (child.nodeType === Node.ELEMENT_NODE) {
          const childEl = child as Element;
          const childTag = childEl.tagName.toLowerCase();
          const text = childEl.textContent || '';
          if (childTag === 'strong' || childTag === 'b') return [new TextRun({ text, bold: true, size: 24 })];
          if (childTag === 'em' || childTag === 'i') return [new TextRun({ text, italics: true, size: 24 })];
          if (childTag === 'u') return [new TextRun({ text, underline: {}, size: 24 })];
          return [new TextRun({ text, size: 24 })];
        }
        return [];
      });
      return [new Paragraph({ children: runs, alignment: getAlignment(el) })];
    }

    // Handle list items
    if (tag === 'ul' || tag === 'ol') {
      return Array.from(el.children).flatMap(child => {
        const text = child.textContent || '';
        return [new Paragraph({
          children: [new TextRun({ text, size: 24 })],
          numbering: tag === 'ol' ? { reference: 'ordered-list', level: 0 } : { reference: 'bullet-list', level: 0 },
        })];
      });
    }

    // Default: process children
    return Array.from(el.childNodes).flatMap(child => processNode(child));
  };

  const body = doc.body;
  if (body) {
    for (const child of body.childNodes) {
      paragraphs.push(...processNode(child));
    }
  }

  return paragraphs;
}

export async function exportToDocx(html: string, title: string, filename?: string) {
  const paragraphs = htmlToDocxParagraphs(html);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullet-list',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT }],
        },
        {
          reference: 'ordered-list',
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT }],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 24 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children: [
        new Paragraph({
          children: [new TextRun({ text: title, bold: true, size: 32 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        ...paragraphs,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename || title.replace(/\s+/g, '_')}.docx`);
}
