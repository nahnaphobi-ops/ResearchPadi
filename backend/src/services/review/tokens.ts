import { citationKey, paperSourceSurname, type PaperSource } from '../pipeline/paper-source.js';
import { citedSources } from '../pipeline/references.service.js';
import { splitPaper } from '../pipeline/supervise.service.js';
import { countOccurrences } from './spans.js';

/** A source as the reader sees it, with a short key (S1, S2...) its notes can point to. */
export interface ReaderSource {
  key: string;
  /** "(Surname, Year)" as the paper cites it. */
  citation: string;
  title: string;
  doi?: string;
  abstract: string;
  /** The paper cites it. */
  cited: boolean;
  source: PaperSource;
}

export type ReaderStrategy = 'full' | 'top_sources' | 'by_section';

export interface ReaderChunk {
  label: string;
  part: number;
  parts: number;
  text: string;
  sources: ReaderSource[];
  /** Whole-request size from the token-count endpoint. */
  promptTokens: number;
}

export interface ReaderPlan {
  strategy: ReaderStrategy;
  chunks: ReaderChunk[];
  sourcesTotal: number;
}

/** Tokens the reader request would use for this part of the paper and these sources. */
export type CountTokens = (paperPart: string, sources: ReaderSource[]) => Promise<number>;

export const TRIMMED_ABSTRACT_CHARS = 600;
const MAX_SPLIT_DEPTH = 6;

/**
 * Sources ranked for the reader: those the paper cites first (most-mentioned
 * first), then the rest in their original order. Keys follow this order.
 */
export function rankSources(paper: string, sources: PaperSource[]): ReaderSource[] {
  const cited = new Set(citedSources(paper, sources));
  const mentions = new Map(sources.map((s) => [s, countOccurrences(paper, paperSourceSurname(s))]));
  const ordered = [
    ...sources.filter((s) => cited.has(s)).sort((a, b) => (mentions.get(b) ?? 0) - (mentions.get(a) ?? 0)),
    ...sources.filter((s) => !cited.has(s)),
  ];
  return ordered.map((s, i) => ({
    key: `S${i + 1}`,
    citation: citationKey(s),
    title: s.title,
    doi: s.doi,
    abstract: (s.abstract ?? '').trim(),
    cited: cited.has(s),
    source: s,
  }));
}

export function trimSources(list: ReaderSource[], chars = TRIMMED_ABSTRACT_CHARS): ReaderSource[] {
  return list.map((s) => (s.abstract.length > chars ? { ...s, abstract: `${s.abstract.slice(0, chars).trimEnd()}...` } : s));
}

/** Split at blank lines into `pieces` runs of paragraphs of similar length. */
export function splitByParagraphs(text: string, pieces: number): string[] {
  const paragraphs = text.split(/(\n\s*\n)/);
  // Re-attach each separator to the paragraph before it so the pieces join back exactly.
  const blocks: string[] = [];
  for (let i = 0; i < paragraphs.length; i += 2) blocks.push(paragraphs[i] + (paragraphs[i + 1] ?? ''));
  if (blocks.length < 2 || pieces < 2) return [text];

  const target = text.length / pieces;
  const out: string[] = [];
  let current = '';
  for (const b of blocks) {
    if (current && current.length + b.length > target && out.length < pieces - 1) {
      out.push(current);
      current = '';
    }
    current += b;
  }
  if (current) out.push(current);
  return out.filter((p) => p.trim());
}

function splitInHalf(text: string): string[] {
  const byParagraph = splitByParagraphs(text, 2);
  if (byParagraph.length >= 2) return byParagraph;
  const mid = text.lastIndexOf(' ', Math.floor(text.length / 2));
  const at = mid > 0 ? mid : Math.floor(text.length / 2);
  return [text.slice(0, at), text.slice(at)];
}

/**
 * Fit the reader's input under `budget` tokens, cheapest change first:
 *   full        the whole paper and every source
 *   top_sources the whole paper and only the sources it cites (abstracts trimmed if needed)
 *   by_section  one call per chapter, each with the sources that chapter cites
 * The paper itself is never cut; only split into parts that are read in turn.
 */
export async function planReaderInput(paper: string, ranked: ReaderSource[], budget: number, count: CountTokens): Promise<ReaderPlan> {
  const single = (strategy: ReaderStrategy, sources: ReaderSource[], promptTokens: number): ReaderPlan => ({
    strategy,
    sourcesTotal: ranked.length,
    chunks: [{ label: 'Whole paper', part: 1, parts: 1, text: paper, sources, promptTokens }],
  });

  const full = await count(paper, ranked);
  if (full <= budget) return single('full', ranked, full);

  const cited = ranked.filter((s) => s.cited);
  for (const candidate of [cited, trimSources(cited)]) {
    const n = await count(paper, candidate);
    if (n <= budget) return single('top_sources', candidate, n);
  }

  const chunks = await sectionChunks(paper, ranked, budget, count);
  return { strategy: 'by_section', sourcesTotal: ranked.length, chunks };
}

async function sectionChunks(paper: string, ranked: ReaderSource[], budget: number, count: CountTokens): Promise<ReaderChunk[]> {
  const parts = splitPaper(paper);
  const sections: { label: string; text: string }[] = parts
    ? parts.chapters.map((text, i) => ({ label: `Chapter ${parts.info[i].num}: ${parts.info[i].title}`, text }))
    : [{ label: 'Paper', text: paper }];
  // The abstract reads with the first chapter; the reference list with the last.
  if (parts?.head) sections[0].text = `${parts.head}\n\n${sections[0].text}`;
  if (parts?.tail) sections[sections.length - 1].text = `${sections[sections.length - 1].text}\n\n${parts.tail}`;

  const all = ranked.map((r) => r.source);
  const out: Omit<ReaderChunk, 'part' | 'parts'>[] = [];

  const fit = async (label: string, text: string, depth: number): Promise<void> => {
    const citedHere = new Set(citedSources(text, all));
    let sources = trimSources(ranked.filter((r) => citedHere.has(r.source)));
    let n = await count(text, sources);
    // Fewer sources first (lowest-ranked go), then split the text itself.
    while (n > budget && sources.length > 0) {
      sources = sources.slice(0, Math.floor(sources.length / 2));
      n = await count(text, sources);
    }
    if (n <= budget || depth >= MAX_SPLIT_DEPTH) {
      out.push({ label, text, sources, promptTokens: n });
      return;
    }
    const halves = splitInHalf(text);
    for (let i = 0; i < halves.length; i++) await fit(`${label} (${i + 1}/${halves.length})`, halves[i], depth + 1);
  };

  for (const s of sections) await fit(s.label, s.text, 0);
  return out.map((c, i) => ({ ...c, part: i + 1, parts: out.length }));
}
