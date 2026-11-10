import { createHash } from 'node:crypto';

export const SUGGESTION_TYPES = ['correction', 'citation', 'clarity', 'humanize', 'structure'] as const;
export const SEVERITIES = ['high', 'medium', 'low'] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];
export type Severity = (typeof SEVERITIES)[number];

export interface Suggestion {
  id: string;
  section: string;
  type: SuggestionType;
  severity: Severity;
  /** Exact text from the paper. */
  original: string;
  suggested: string;
  reason: string;
}

export interface DropCounts {
  /** "original" is not in the paper verbatim (the count the run reports as dropped). */
  not_found: number;
  /** "original" appears more than once, so accepting it can't say which one to change. */
  ambiguous: number;
  /** Same "original" as a suggestion already kept. */
  duplicate: number;
  /** Missing fields, unknown type or severity, or a replacement identical to the original. */
  invalid: number;
  /** Valid, but past the per-run cap (lowest severity goes first). */
  over_cap: number;
}

export interface GuardResult {
  kept: Suggestion[];
  drops: DropCounts;
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/**
 * Non-overlapping occurrences of `needle`, the same count Postgres gets from
 * replace() in apply_review_suggestion, so the guard and the accept agree.
 */
export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    count++;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return count;
}

/** Stable key for a suggestion within a run: retried jobs insert the same key, never a duplicate row. */
export function suggestionKey(s: Pick<Suggestion, 'original' | 'suggested'>): string {
  return createHash('sha256').update(s.original).update('\u0000').update(s.suggested).digest('hex');
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** A suggestion as the model returned it, checked field by field; null if it can't be used. */
export function coerceSuggestion(raw: unknown, index: number): Suggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = str(r.type) as SuggestionType;
  const severity = str(r.severity) as Severity;
  // Trimming keeps the text verbatim: a substring of the paper stays one when its ends are trimmed.
  const original = str(r.original).trim();
  const suggested = str(r.suggested).trim();
  const reason = str(r.reason).trim();
  if (!SUGGESTION_TYPES.includes(type) || !SEVERITIES.includes(severity)) return null;
  if (!original || !reason || original === suggested) return null;
  return {
    id: str(r.id).trim() || `s${index + 1}`,
    section: str(r.section).trim(),
    type,
    severity,
    original,
    suggested,
    reason,
  };
}

/**
 * The quality guard. Keeps only suggestions whose "original" appears exactly
 * once, verbatim, in the current paper text; then sorts by severity (model
 * order within a severity) and keeps at most `cap`.
 */
export function guardSuggestions(paper: string, raw: unknown[], cap: number): GuardResult {
  const drops: DropCounts = { not_found: 0, ambiguous: 0, duplicate: 0, invalid: 0, over_cap: 0 };
  const valid: { s: Suggestion; order: number }[] = [];

  raw.forEach((item, i) => {
    const s = coerceSuggestion(item, i);
    if (!s) {
      drops.invalid++;
      return;
    }
    const n = countOccurrences(paper, s.original);
    if (n === 0) drops.not_found++;
    else if (n > 1) drops.ambiguous++;
    else valid.push({ s, order: i });
  });

  valid.sort((a, b) => SEVERITY_ORDER[a.s.severity] - SEVERITY_ORDER[b.s.severity] || a.order - b.order);

  const kept: Suggestion[] = [];
  const seen = new Set<string>();
  for (const { s } of valid) {
    if (seen.has(s.original)) {
      drops.duplicate++;
      continue;
    }
    seen.add(s.original);
    if (kept.length >= cap) {
      drops.over_cap++;
      continue;
    }
    kept.push(s);
  }
  return { kept, drops };
}

export type ApplyOutcome = 'accepted' | 'stale' | 'ambiguous';

/**
 * Apply one accepted suggestion to the text, only if the original still
 * appears exactly once. Mirrors apply_review_suggestion (which the API uses,
 * under a row lock); used by the dry run and the tests.
 */
export function applySuggestion(content: string, original: string, suggested: string): { outcome: ApplyOutcome; content: string } {
  const n = countOccurrences(content, original);
  if (n === 0) return { outcome: 'stale', content };
  if (n > 1) return { outcome: 'ambiguous', content };
  const at = content.indexOf(original);
  return { outcome: 'accepted', content: content.slice(0, at) + suggested + content.slice(at + original.length) };
}
