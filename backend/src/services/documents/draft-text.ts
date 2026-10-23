/**
 * AI draft text as blocks, for the Word and PDF exports: Markdown pipe tables
 * become tables and every other non-empty line a paragraph, with Markdown
 * heading and bold marks removed.
 */
export type DraftBlock =
  | { kind: 'table'; rows: string[][] }
  | { kind: 'line'; text: string };

export const isTableLine = (line: string) => /^\s*\|.*\|\s*$/.test(line);
export const splitRow = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isSeparator = (cells: string[]) => cells.every((c) => /^:?-{2,}:?$/.test(c));

export function draftBlocks(text: string): DraftBlock[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: DraftBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isTableLine(lines[i])) {
      const start = i;
      while (i + 1 < lines.length && isTableLine(lines[i + 1])) i++;
      blocks.push({ kind: 'table', rows: lines.slice(start, i + 1).map(splitRow).filter((cells) => !isSeparator(cells)) });
      continue;
    }
    const line = lines[i].replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
    if (line) blocks.push({ kind: 'line', text: line });
  }
  return blocks;
}
