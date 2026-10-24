import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, PageBreak, Table, TableRow, TableCell, WidthType, ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';

type Block = Paragraph | Table;

/** Embedded images (data URLs) with their pixel size, read before the document is built. */
interface LoadedImage { data: Uint8Array; type: 'png' | 'jpg' | 'gif' | 'bmp'; width: number; height: number }

async function loadImages(html: string): Promise<Map<string, LoadedImage>> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const sources = [...new Set(Array.from(doc.querySelectorAll('img')).map((img) => img.getAttribute('src') || '').filter((src) => src.startsWith('data:image/')))];
  const loaded = new Map<string, LoadedImage>();
  await Promise.all(sources.map(async (src) => {
    const match = src.match(/^data:image\/(png|jpe?g|gif|bmp);base64,(.*)$/);
    if (!match) return;
    const size = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = src;
    });
    if (!size) return;
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    loaded.set(src, { data: bytes, type: match[1] === 'jpeg' ? 'jpg' : (match[1] as LoadedImage['type']), ...size });
  }));
  return loaded;
}

// At most the text width of an A4 page with 1-inch margins (about 6.3 in at 96 dpi).
const MAX_IMAGE_WIDTH = 600;

function imageRun(images: Map<string, LoadedImage>, src: string | null): ImageRun | null {
  const image = src ? images.get(src) : undefined;
  if (!image) return null;
  // Charts are drawn at twice their size; show them at half, and never wider than the page.
  const scale = Math.min(1, MAX_IMAGE_WIDTH / image.width, image.width > MAX_IMAGE_WIDTH * 1.5 ? 0.5 : 1);
  return new ImageRun({ type: image.type, data: image.data, transformation: { width: Math.round(image.width * scale), height: Math.round(image.height * scale) } });
}

function htmlToDocxParagraphs(html: string, images: Map<string, LoadedImage>): Block[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const paragraphs: Block[] = [];

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

  const processNode = (node: ChildNode): Block[] => {
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

    // Tables become real Word tables (header cells in bold).
    if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'));
      if (!rows.length) return [];
      return [new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows.map((row) => new TableRow({
          tableHeader: Array.from(row.children).every((c) => c.tagName.toLowerCase() === 'th'),
          children: Array.from(row.querySelectorAll('td, th')).map((cell) => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: cell.textContent?.trim() || '', size: 22, bold: cell.tagName.toLowerCase() === 'th' })] })],
          })),
        })),
      }), new Paragraph({ children: [] })];
    }

    // Images (charts from the Data panel are embedded PNGs).
    if (tag === 'img') {
      const run = imageRun(images, el.getAttribute('src'));
      return run ? [new Paragraph({ children: [run], alignment: AlignmentType.CENTER })] : [];
    }

    // Manual page break from the editor
    if (tag === 'div' && el.hasAttribute('data-page-break')) {
      return [new Paragraph({ children: [new PageBreak()] })];
    }

    // Reference list: title + one hanging-indent paragraph per entry
    if (tag === 'div' && el.hasAttribute('data-bibliography')) {
      return Array.from(el.children).flatMap((child) => {
        const childTag = child.tagName.toLowerCase();
        if (childTag === 'h1') {
          return [new Paragraph({ children: [new TextRun({ text: child.textContent || '', bold: true, size: 28 })], heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER })];
        }
        if (child.classList.contains('bib-empty')) return [];
        const runs = Array.from(child.childNodes).map((n) => {
          const isEm = n.nodeType === Node.ELEMENT_NODE && ['em', 'i'].includes((n as Element).tagName.toLowerCase());
          const isNumber = n.nodeType === Node.ELEMENT_NODE && (n as Element).classList.contains('bib-number');
          return new TextRun({ text: `${n.textContent || ''}${isNumber ? '\t' : ''}`, italics: isEm, size: 24 });
        });
        return [new Paragraph({ children: runs, indent: { left: 720, hanging: 720 }, spacing: { after: 160 } })];
      });
    }

    // Handle block elements
    if (tag === 'p' || tag === 'div' || tag === 'li') {
      const runs = Array.from(el.childNodes).flatMap((child): (TextRun | ImageRun)[] => {
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
          if (childTag === 'img') {
            const run = imageRun(images, childEl.getAttribute('src'));
            return run ? [run] : [];
          }
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
  saveAs(await buildDocx(html, title), `${filename || title.replace(/\s+/g, '_')}.docx`);
}

/** The document as a Word file. */
export async function buildDocx(html: string, title: string): Promise<Blob> {
  const paragraphs = htmlToDocxParagraphs(html, await loadImages(html));

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

  return Packer.toBlob(doc);
}
