/**
 * Minimal Markdown → HTML for AI answers inserted into the editor. Covers what the
 * inline-AI prompt allows: headings, paragraphs, bullet and numbered lists, pipe
 * tables, **bold** and *italic*. All text is HTML-escaped first, so model output
 * can't inject markup.
 */
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?=\S)([^*]+?)(?<=\S)\*(?!\*)/g, '$1<em>$2</em>');
}

const cells = (row: string) =>
  row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').replace(/^```[a-z]*\n?|\n?```$/g, '').split('\n');
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li><p>${inline(i)}</p></li>`).join('')}</${list.tag}>`);
    list = null;
  };
  const flush = () => { flushParagraph(); flushList(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flush();
      const level = Math.min(4, heading[1].length);
      out.push(`<h${level}>${inline(heading[2].replace(/\s#+$/, ''))}</h${level}>`);
      continue;
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flush();
      const header = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      i--;
      const th = header.map((c) => `<th><p>${inline(c)}</p></th>`).join('');
      const body = rows.map((r) => `<tr>${header.map((_, j) => `<td><p>${inline(r[j] ?? '')}</p></td>`).join('')}</tr>`).join('');
      out.push(`<table><tbody><tr>${th}</tr>${body}</tbody></table>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }
  flush();
  return out.join('');
}

/** For "replace selection": a single plain paragraph goes in inline, without a new block. */
export function inlineContent(html: string): string | null {
  const m = html.match(/^<p>([\s\S]*)<\/p>$/);
  return m && !m[1].includes('<p>') ? m[1] : null;
}
