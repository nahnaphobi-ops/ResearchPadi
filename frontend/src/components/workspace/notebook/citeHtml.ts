import { markdownToHtml } from '../inlineAI/markdown';
import type { PersonName, Source } from '../citations/types';
import type { NotebookCitation } from '../../../services/notebookService';

/** "Family, Given; Family2, Given2" (or an organisation name) → structured names. */
export function parseAuthorList(value: string | null | undefined): PersonName[] {
  if (!value?.trim()) return [];
  return value.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const comma = part.indexOf(',');
    return comma === -1
      ? { family: part, given: '' }
      : { family: part.slice(0, comma).trim(), given: part.slice(comma + 1).trim() };
  });
}

/** A notebook source as a citation the editor's reference list understands. */
export function toCitationSource(c: NotebookCitation): Source {
  return {
    id: `nb-${c.sourceId}`,
    title: c.title,
    authors: parseAuthorList(c.authors),
    year: c.year ?? null,
    type: c.kind === 'url' ? 'webpage' : 'other',
    url: c.url ?? undefined,
    origin: 'notebook',
    ghanaian: false,
  };
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// One or more adjacent markers, e.g. "[2]" or "[1][3]" or "[1, 3]".
const MARKERS = /\[(\d+(?:\s*,\s*\d+)*)\](?:\s*\[(\d+(?:\s*,\s*\d+)*)\])*/g;

function markerNumbers(match: string): number[] {
  return [...new Set((match.match(/\d+/g) ?? []).map(Number))];
}

/** Answer → HTML for the panel, with [n] turned into clickable chips. */
export function answerToChipHtml(markdown: string, citations: NotebookCitation[]): string {
  const known = new Set(citations.map((c) => c.n));
  return markdownToHtml(markdown).replace(MARKERS, (match) => {
    const ns = markerNumbers(match).filter((n) => known.has(n));
    if (!ns.length) return match;
    return ns.map((n) => `<button type="button" class="cite-chip" data-n="${n}" aria-label="Source ${n}">${n}</button>`).join('');
  });
}

/** Answer → HTML for the document, with [n] turned into real citations (reference list updates itself). */
export function answerToDocumentHtml(markdown: string, citations: NotebookCitation[]): string {
  const byN = new Map(citations.map((c) => [c.n, c]));
  return markdownToHtml(markdown).replace(MARKERS, (match) => {
    const sources = markerNumbers(match).map((n) => byN.get(n)).filter((c): c is NotebookCitation => Boolean(c)).map(toCitationSource);
    if (!sources.length) return '';
    return ` <span data-citation="" data-mode="parenthetical" data-sources="${escapeAttr(JSON.stringify(sources))}">(citation)</span>`;
  }).replace(/\s+(<span data-citation)/g, ' $1');
}
