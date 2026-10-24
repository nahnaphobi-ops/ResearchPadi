import { PLAGIARISM_SOURCES, type PlagiarismSource } from './plagiarism-sources.js';
import { contentPositions, extractSentences, toWords, type Words } from './plagiarism-text.js';

export interface PlagiarismMatch {
  originalText: string;
  matchedText: string;
  source: string;
  sourceUrl: string;
  similarity: number;
  position: { start: number; end: number };
}

/** One place the check searched, and whether it could. */
export interface CheckedSource {
  name: string;
  status: 'checked' | 'skipped' | 'failed';
  passages: number;
  note?: string;
  /** 'abstracts' means the body of each work was not compared. */
  scope?: 'abstracts' | 'full text';
}

export interface PlagiarismReport {
  totalWords: number;
  uniqueWords: number;
  sentencesChecked: number;
  matchCount: number;
  overallSimilarity: number;
  matches: PlagiarismMatch[];
  sources: Array<{ name: string; url: string; matchCount: number }>;
  checkedSources: CheckedSource[];
}

// A run of this many words shared with a source counts as copied wording.
const VERBATIM_RUN = 6;
// Close paraphrase: runs of this many meaningful words (stop words skipped), so
// swapping "a" for "the" or reordering filler words does not hide copying.
const PARAPHRASE_RUN = 3;
const PARAPHRASE_WEIGHT = 0.8;
const MIN_CONTENT_WORDS = 6;
// Share of a sentence that must sit inside shared runs before it is reported.
const MATCH_THRESHOLD = 0.4;
// Every sentence is compared with everything found; this bounds the work.
const MAX_SENTENCES = 150;

/** Every run of `n` words in a text, mapped to where it first starts. */
function runIndex(words: string[], n: number): Map<string, number> {
  const runs = new Map<string, number>();
  for (let i = 0; i + n <= words.length; i++) {
    const key = words.slice(i, i + n).join(' ');
    if (!runs.has(key)) runs.set(key, i);
  }
  return runs;
}

/** A text made ready to compare against: its words and the runs they form. */
interface Prepared {
  words: Words;
  content: number[];
  verbatim: Map<string, number>;
  paraphrase: Map<string, number>;
}

function prepare(text: string): Prepared {
  const words = toWords(text);
  const content = contentPositions(words.norm);
  return {
    words,
    content,
    verbatim: runIndex(words.norm, VERBATIM_RUN),
    paraphrase: runIndex(content.map(i => words.norm[i]), PARAPHRASE_RUN),
  };
}

/**
 * Share of `sentence` covered by runs of `n` consecutive words that also occur
 * in the source, and where the first shared run starts there (-1 when none).
 */
function runCoverage(sentence: string[], sourceRuns: Map<string, number>, n: number): { coverage: number; sourceAt: number } {
  if (sentence.length < n || !sourceRuns.size) return { coverage: 0, sourceAt: -1 };
  const covered = new Array<boolean>(sentence.length).fill(false);
  let sourceAt = -1;
  for (let i = 0; i + n <= sentence.length; i++) {
    const at = sourceRuns.get(sentence.slice(i, i + n).join(' '));
    if (at === undefined) continue;
    if (sourceAt === -1) sourceAt = at;
    covered.fill(true, i, i + n);
  }
  return { coverage: covered.filter(Boolean).length / sentence.length, sourceAt };
}

/** The source's own wording around a shared run, so the student can see what matched. */
function excerpt(source: Words, normAt: number): string {
  const start = source.at[normAt];
  const from = Math.max(0, start - 8);
  const to = Math.min(source.raw.length, start + VERBATIM_RUN + 14);
  return `${from > 0 ? '… ' : ''}${source.raw.slice(from, to).join(' ')}${to < source.raw.length ? ' …' : ''}`;
}

function compare(sentence: Prepared, source: Prepared): { similarity: number; excerpt: string } {
  const verbatim = runCoverage(sentence.words.norm, source.verbatim, VERBATIM_RUN);
  let similarity = verbatim.coverage;
  let sourceAt = verbatim.sourceAt;

  if (sentence.content.length >= MIN_CONTENT_WORDS) {
    const close = runCoverage(sentence.content.map(i => sentence.words.norm[i]), source.paraphrase, PARAPHRASE_RUN);
    if (close.coverage * PARAPHRASE_WEIGHT > similarity) {
      similarity = close.coverage * PARAPHRASE_WEIGHT;
      sourceAt = source.content[close.sourceAt];
    }
  }

  return { similarity, excerpt: sourceAt >= 0 ? excerpt(source.words, sourceAt) : '' };
}

/**
 * How much of one sentence is written in the same words as a source passage:
 * the share of the sentence inside shared word runs, from 0 to 1. Sharing a
 * topic or its vocabulary scores nothing; only runs of shared wording count.
 */
export function compareToSource(sentence: string, sourceText: string): { similarity: number; excerpt: string } {
  return compare(prepare(sentence), prepare(sourceText));
}

/**
 * Compare a document with published text from every source at once: the
 * ResearchPadi library, the Ghanaian university repositories, OpenAlex,
 * Semantic Scholar, Wikipedia and (when set up) the open web. Each source is
 * searched with the document's most distinctive sentences, then every
 * sentence is compared with everything found. A source that cannot be
 * searched is reported as such and never fails the check.
 */
export async function checkPlagiarism(text: string, sources: PlagiarismSource[] = PLAGIARISM_SOURCES): Promise<PlagiarismReport> {
  const capped = text.slice(0, 20_000);
  const sentences = extractSentences(capped).slice(0, MAX_SENTENCES);
  const words = text.split(/\s+/);
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));

  const searched = sentences.length
    ? await Promise.all(sources.map(async source => {
      try {
        return { source, result: await source.search(sentences) };
      } catch {
        return { source, result: { passages: [], status: 'failed' as const, note: 'could not be reached' } };
      }
    }))
    : [];

  // Everything found, once each, ready to compare.
  const seenPassages = new Set<string>();
  const pool = searched.flatMap(({ source, result }) => result.passages.flatMap(p => {
    const key = `${p.url || p.title}|${p.text.slice(0, 80)}`;
    if (!p.text || seenPassages.has(key)) return [];
    seenPassages.add(key);
    return [{ ...p, where: p.where || source.name, prepared: prepare(p.text) }];
  }));

  const allMatches: PlagiarismMatch[] = [];
  const sourceMap = new Map<string, { name: string; url: string; matchCount: number }>();
  let checkedWords = 0;
  let matchedWords = 0;

  for (const sentence of sentences) {
    const s = prepare(sentence);
    checkedWords += s.words.norm.length;

    // Best match per source document.
    const bySource = new Map<string, PlagiarismMatch>();
    for (const p of pool) {
      const { similarity, excerpt: matchedText } = compare(s, p.prepared);
      if (similarity < MATCH_THRESHOLD) continue;
      const key = p.url || p.title;
      if ((bySource.get(key)?.similarity ?? 0) >= similarity) continue;
      bySource.set(key, {
        originalText: sentence,
        matchedText,
        source: `${p.title} (${p.where})`,
        sourceUrl: p.url,
        similarity,
        position: { start: 0, end: sentence.length },
      });
    }
    const matches = [...bySource.values()];

    // A sentence counts once towards the total, at its closest match, however
    // many sources it matches.
    matchedWords += Math.max(0, ...matches.map(m => m.similarity)) * s.words.norm.length;

    for (const match of matches) {
      allMatches.push(match);
      const key = match.sourceUrl || match.source;
      const existing = sourceMap.get(key);
      if (existing) existing.matchCount++;
      else sourceMap.set(key, { name: match.source, url: match.sourceUrl, matchCount: 1 });
    }
  }

  // Share of the checked text written in a source's words.
  const overallSimilarity = checkedWords > 0 ? Math.min(1, matchedWords / checkedWords) : 0;

  return {
    totalWords: words.length,
    uniqueWords: uniqueWords.size,
    sentencesChecked: sentences.length,
    matchCount: allMatches.length,
    overallSimilarity: Math.round(overallSimilarity * 100) / 100,
    matches: allMatches.sort((a, b) => b.similarity - a.similarity).slice(0, 50),
    sources: Array.from(sourceMap.values()).sort((a, b) => b.matchCount - a.matchCount),
    checkedSources: searched.map(({ source, result }) => ({
      name: source.name,
      scope: source.scope,
      status: result.status,
      passages: result.passages.length,
      note: result.note,
    })),
  };
}
