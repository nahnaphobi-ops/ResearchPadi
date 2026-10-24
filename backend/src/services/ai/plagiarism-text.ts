// Text handling shared by the plagiarism check and the sources it searches.

export const STOP_WORDS = new Set([
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

export function extractSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);
}

/** Words as written (for excerpts) and normalised (for comparing), with where each normalised word came from. */
export interface Words {
  raw: string[];
  norm: string[];
  at: number[];
}

export function toWords(text: string): Words {
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
export function contentPositions(words: string[]): number[] {
  return words.flatMap((w, i) => (STOP_WORDS.has(w) ? [] : [i]));
}

/**
 * A search-engine query from a sentence: its `max` longest meaningful words
 * (the rarest, so the likeliest to find the source), in sentence order.
 * Hyphens and slashes split words here, as search engines expect.
 */
export function keywordQuery(sentence: string, max = 10): string {
  const words = [...new Set(
    sentence.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => (w.length >= 3 || /\d/.test(w)) && !STOP_WORDS.has(w)),
  )];
  const keep = new Set([...words].sort((a, b) => b.length - a.length).slice(0, max));
  return words.filter(w => keep.has(w)).join(' ');
}

/**
 * The `n` sentences most worth searching for: the ones with the most long or
 * numeric words, which are the likeliest to find their source. Kept in
 * document order.
 */
export function pickQueries(sentences: string[], n: number): string[] {
  const distinct = (s: string) => {
    const { norm } = toWords(s);
    return contentPositions(norm).filter(i => norm[i].length >= 6 || /\d/.test(norm[i])).length;
  };
  return sentences
    .map((s, i) => ({ s, i, score: distinct(s) }))
    .sort((a, b) => b.score - a.score || b.s.length - a.s.length)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map(x => x.s);
}
