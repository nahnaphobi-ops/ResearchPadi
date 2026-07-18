/**
 * Deterministic string-similarity helpers used by the citation verifier.
 * No LLM involvement — pure string metrics.
 */

/** Normalise a string for comparison: lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaro-Winkler similarity (0..1). Good for short strings like titles/authors. */
export function jaroWinkler(s1: string, s2: string): number {
  const a = normalizeText(s1);
  const b = normalizeText(s2);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const jaro = jaroSimilarity(a, b);
  // Winkler prefix scaling (max prefix length 4).
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(a.length, b.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function jaroSimilarity(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 && lenB === 0) return 1;

  const maxDist = Math.floor(Math.max(lenA, lenB) / 2) - 1;
  const dist = Math.max(0, maxDist);

  const aMatches = new Array(lenA).fill(false);
  const bMatches = new Array(lenB).fill(false);
  let matches = 0;

  for (let i = 0; i < lenA; i++) {
    const start = Math.max(0, i - dist);
    const end = Math.min(i + dist + 1, lenB);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < lenA; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  return (
    (matches / lenA +
      matches / lenB +
      (matches - transpositions / 2) / matches) /
    3
  );
}

/** Token-set ratio (0..1): handles word reordering and extra/fewer words. */
export function tokenSetRatio(s1: string, s2: string): number {
  const a = normalizeText(s1);
  const b = normalizeText(s2);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  const inter = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 0;
  return inter.size / union.size;
}

/** Combined title similarity — max of the two metrics for robustness. */
export function titleSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  return Math.max(jaroWinkler(s1, s2), tokenSetRatio(s1, s2));
}

/**
 * Surname match between a parsed surname and a candidate name string.
 * Returns true if the surname appears as a token in the candidate.
 */
export function surnameMatches(parsedSurname: string, candidateName: string): boolean {
  const s = normalizeText(parsedSurname);
  const c = normalizeText(candidateName);
  if (!s) return false;
  return c.split(' ').some(tok => tok === s);
}

export function yearMatches(parsedYear: number | undefined, candidateYear: number | undefined, tolerance: number): boolean {
  if (parsedYear == null || candidateYear == null) return false;
  return Math.abs(parsedYear - candidateYear) <= tolerance;
}
