import { searchKnowledge, type KnowledgeHit, type SearchOptions } from '../rag/retriever.service.js';

export interface PlagiarismMatch {
  originalText: string;
  matchedText: string;
  source: string;
  sourceUrl: string;
  similarity: number;
  position: { start: number; end: number };
}

export interface PlagiarismReport {
  totalWords: number;
  uniqueWords: number;
  matchCount: number;
  overallSimilarity: number;
  matches: PlagiarismMatch[];
  sources: Array<{ name: string; url: string; matchCount: number }>;
}

type Search = (query: string, opts?: SearchOptions) => Promise<KnowledgeHit[]>;

// A run of this many words shared with a source counts as copied wording.
const VERBATIM_RUN = 6;
// Close paraphrase: runs of this many meaningful words (stop words skipped), so
// swapping "a" for "the" or reordering filler words does not hide copying.
const PARAPHRASE_RUN = 3;
const PARAPHRASE_WEIGHT = 0.8;
const MIN_CONTENT_WORDS = 6;
// Share of a sentence that must sit inside shared runs before it is reported.
const MATCH_THRESHOLD = 0.4;

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'also', 'am', 'among', 'amongst', 'an', 'and', 'any',
  'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
  'have', 'having', 'he', 'her', 'here', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its',
  'itself', 'just', 'may', 'me', 'might', 'more', 'most', 'must', 'my', 'no', 'nor', 'not', 'now', 'of', 'off',
  'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'to', 'too', 'under', 'until', 'up', 'upon', 'very', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'within', 'would', 'you', 'your',
]);

function extractSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);
}

/** Words as written (for excerpts) and normalised (for comparing), with where each normalised word came from. */
interface Words {
  raw: string[];
  norm: string[];
  at: number[];
}

function toWords(text: string): Words {
  const raw = text.split(/\s+/).filter(Boolean);
  const norm: string[] = [];
  const at: number[] = [];
  raw.forEach((token, i) => {
    const word = token.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    if (word) {
      norm.push(word);
      at.push(i);
    }
  });
  return { raw, norm, at };
}

/** Positions of the words that carry meaning. */
function contentPositions(words: string[]): number[] {
  return words.flatMap((w, i) => (STOP_WORDS.has(w) ? [] : [i]));
}

/**
 * Share of `sentence` covered by runs of `n` consecutive words that also occur in
 * `source`, and where the first shared run starts in the source (-1 when none).
 */
function runCoverage(sentence: string[], source: string[], n: number): { coverage: number; sourceAt: number } {
  if (sentence.length < n || source.length < n) return { coverage: 0, sourceAt: -1 };
  const runs = new Map<string, number>();
  for (let i = 0; i + n <= source.length; i++) {
    const key = source.slice(i, i + n).join(' ');
    if (!runs.has(key)) runs.set(key, i);
  }
  const covered = new Array<boolean>(sentence.length).fill(false);
  let sourceAt = -1;
  for (let i = 0; i + n <= sentence.length; i++) {
    const at = runs.get(sentence.slice(i, i + n).join(' '));
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

/**
 * How much of one sentence is written in the same words as a source passage:
 * the share of the sentence inside shared word runs, from 0 to 1. Sharing a
 * topic or its vocabulary scores nothing; only runs of shared wording count.
 */
export function compareToSource(sentence: string, sourceText: string): { similarity: number; excerpt: string } {
  const s = toWords(sentence);
  const src = toWords(sourceText);

  const verbatim = runCoverage(s.norm, src.norm, VERBATIM_RUN);
  let similarity = verbatim.coverage;
  let sourceAt = verbatim.sourceAt;

  const sContent = contentPositions(s.norm);
  if (sContent.length >= MIN_CONTENT_WORDS) {
    const srcContent = contentPositions(src.norm);
    const close = runCoverage(sContent.map(i => s.norm[i]), srcContent.map(i => src.norm[i]), PARAPHRASE_RUN);
    if (close.coverage * PARAPHRASE_WEIGHT > similarity) {
      similarity = close.coverage * PARAPHRASE_WEIGHT;
      sourceAt = srcContent[close.sourceAt];
    }
  }

  return { similarity, excerpt: sourceAt >= 0 ? excerpt(src, sourceAt) : '' };
}

async function findSimilarInKnowledgeBase(sentence: string, search: Search): Promise<PlagiarismMatch[]> {
  // Hybrid retrieval finds candidates even when wording is paraphrased; shared
  // word runs then decide whether a candidate is actually a match.
  const candidates = await search(sentence, { limit: 6 });
  const matches: PlagiarismMatch[] = [];
  const seen = new Set<string>();

  for (const c of candidates) {
    const key = c.source_url || c.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const { similarity, excerpt: matchedText } = compareToSource(sentence, c.chunk_text);
    if (similarity >= MATCH_THRESHOLD) {
      matches.push({
        originalText: sentence,
        matchedText,
        source: c.document_title ? `${c.document_title} (${c.source_name ?? 'Knowledge Base'})` : c.source_name || 'Knowledge Base',
        sourceUrl: c.source_url || '',
        similarity,
        position: { start: 0, end: sentence.length },
      });
    }
  }

  return matches;
}

export async function checkPlagiarism(text: string, search: Search = searchKnowledge): Promise<PlagiarismReport> {
  const capped = text.slice(0, 20_000);
  const sentences = extractSentences(capped).slice(0, 15);
  const words = text.split(/\s+/);
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));

  const allMatches: PlagiarismMatch[] = [];
  const sourceMap = new Map<string, { name: string; url: string; matchCount: number }>();
  let checkedWords = 0;
  let matchedWords = 0;

  for (const sentence of sentences) {
    const sentenceWords = toWords(sentence).norm.length;
    checkedWords += sentenceWords;
    const matches = await findSimilarInKnowledgeBase(sentence, search);

    // A sentence counts once towards the total, at its closest match, however
    // many sources it matches.
    const best = Math.max(0, ...matches.map(m => m.similarity));
    matchedWords += best * sentenceWords;

    for (const match of matches) {
      allMatches.push(match);

      const existing = sourceMap.get(match.sourceUrl);
      if (existing) {
        existing.matchCount++;
      } else {
        sourceMap.set(match.sourceUrl, {
          name: match.source,
          url: match.sourceUrl,
          matchCount: 1,
        });
      }
    }
  }

  // Share of the checked text written in a source's words.
  const overallSimilarity = checkedWords > 0 ? Math.min(1, matchedWords / checkedWords) : 0;

  return {
    totalWords: words.length,
    uniqueWords: uniqueWords.size,
    matchCount: allMatches.length,
    overallSimilarity: Math.round(overallSimilarity * 100) / 100,
    matches: allMatches.sort((a, b) => b.similarity - a.similarity).slice(0, 50),
    sources: Array.from(sourceMap.values()).sort((a, b) => b.matchCount - a.matchCount),
  };
}
