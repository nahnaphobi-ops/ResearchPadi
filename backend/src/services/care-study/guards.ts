/**
 * Checks applied to every AI draft before the student sees it. The prompt
 * already forbids invented facts; these make sure of it.
 */

export const placeholder = (what: string) => `[Student to supply: ${what}]`;

/** A retrieved source as stored on the care study; the only things a draft may cite. */
export interface CareSource {
  id: string;
  title: string;
  /** Display string, "Family, I.; Family, I." */
  authors: string;
  surnames: string[];
  year: number | null;
  container?: string;
  publisher?: string;
  doi?: string;
  url?: string;
  snippet?: string;
  ghanaian?: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Every optional item the student left empty must show up as a placeholder.
 * Any the model left out are listed at the end of the section.
 */
export function ensurePlaceholders(draft: string, missing: string[]): string {
  const placeholders = [...draft.matchAll(/\[Student to supply:([^\]]*)\]/gi)].map((m) => norm(m[1]));
  const absent = missing.filter((label) => {
    const core = norm(label.replace(/^[^:]+\d+:\s*/, ''));
    return !placeholders.some((p) => p.includes(core));
  });
  if (absent.length === 0) return draft;
  return `${draft.trimEnd()}\n\nSTILL TO SUPPLY\n${absent.map((a) => `- ${placeholder(a)}`).join('\n')}`;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_RE = MONTHS.map((m) => `${m[0].toUpperCase()}${m.slice(1)}|${m.slice(0, 3)}`).join('|');

const fullYear = (y: number) => (y < 100 ? 2000 + y : y);
const dateKey = (y: number, m: number, d: number) => `${fullYear(y)}-${m}-${d}`;

/** Every date written in a text, as y-m-d keys. */
export function datesIn(text: string): Set<string> {
  const keys = new Set<string>();
  // ISO dates, including the date part of a date-time field ("2021-11-09T06:00").
  for (const m of text.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g)) keys.add(dateKey(+m[1], +m[2], +m[3]));
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/g)) keys.add(dateKey(+m[3], +m[2], +m[1]));
  const monthIndex = (name: string) => MONTHS.findIndex((mo) => mo.startsWith(name.toLowerCase().slice(0, 3))) + 1;
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})[a-z]*,?\\s+(\\d{4})\\b`, 'gi'))) {
    keys.add(dateKey(+m[3], monthIndex(m[2]), +m[1]));
  }
  for (const m of text.matchAll(new RegExp(`\\b(${MONTH_RE})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'gi'))) {
    keys.add(dateKey(+m[3], monthIndex(m[1]), +m[2]));
  }
  return keys;
}

// A single clinical value with its unit. Ranges ("11-16 g/dl") are reference
// values from the literature and are not matched.
const VALUE_PATTERNS: RegExp[] = [
  /(?<![\d/.–-])(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mm\s*hg)?(?![\d/])/gi, // blood pressure 120/80
  /(?<![\d.–-]\s?)(\d{1,3}(?:\.\d+)?)\s*(?:°|º|degrees?\s*)\s*[CF]\b/gi, // temperature
  /(?<![\d.–-]\s?)(\d{1,4}(?:\.\d+)?)\s*(?:bpm|b\/min|beats?\s*(?:per|\/)\s*min(?:ute)?|breaths?\s*(?:per|\/)\s*min(?:ute)?|cpm|c\/min)\b/gi,
  /(?<![\d.–-]\s?)(\d{1,4}(?:\.\d+)?)\s*(?:kg|kgs|g\/dl|g\/dL|gms?|mg|mcg|µg|ml|mls|iu|units?|cm|mmol\/l)\b/gi,
  /(?<![\d.–-]\s?)(\d{1,2}(?:\s*\+\s*\d)?)\s*(?:weeks?|wks?)\b/gi, // gestation
];

const numberToken = (raw: string) => raw.replace(/\s+/g, '');

const CLOCK = /(?<![\d:])(\d{1,2}):(\d{2})(?!\d)(?:\s*(a\.?m\.?|p\.?m\.?)(?![a-z]))?/gi;

/**
 * Every clock time in a text as minutes past midnight. "6:00" without am/pm
 * could be morning or evening; "06:00" and "18:00" are 24-hour and exact.
 */
export function timesIn(text: string): Set<number> {
  const keys = new Set<number>();
  for (const m of text.matchAll(CLOCK)) {
    const h = +m[1], min = +m[2];
    if (h > 23 || min > 59) continue;
    const suffix = m[3]?.toLowerCase().replace(/\./g, '');
    if (suffix) {
      if (h < 1 || h > 12) continue;
      keys.add(((h % 12) + (suffix === 'pm' ? 12 : 0)) * 60 + min);
    } else {
      keys.add(h * 60 + min);
      const ambiguous = m[1].length === 1 && h < 12;
      if (ambiguous) keys.add((h + 12) * 60 + min);
    }
  }
  return keys;
}

/**
 * Replace clinical values (readings, doses, weights, gestations, times, dates)
 * that do not appear in the student's own entries with a visible flag.
 */
export function guardValues(draft: string, facts: string): { text: string; flagged: string[] } {
  const factTokens = numberToken(facts.toLowerCase());
  const factDates = datesIn(facts);
  const flagged: string[] = [];

  const present = (token: string) =>
    new RegExp(`(?<![\\d.])${numberToken(token).replace(/[.+/]/g, '\\$&')}(?![\\d])`).test(factTokens);
  // A blood pressure must appear as the same pair, not just the two numbers somewhere.
  const supported = (numbers: string[]) => (numbers.length === 2 ? present(`${numbers[0]}/${numbers[1]}`) : numbers.every(present));

  let text = draft;
  // Leave placeholders and citations alone. A bracket with a date in it is not a citation and is checked.
  const protectedSpans = (t: string) => [...t.matchAll(/\[[^\]]*\]|\(([^()]*\b(?:19|20)\d{2}[a-z]?)\)/g)]
    .filter((m) => m[0].startsWith('[') || isCitation(m[1]))
    .map((m) => [m.index!, m.index! + m[0].length]);

  for (const re of VALUE_PATTERNS) {
    const spans = protectedSpans(text);
    text = text.replace(re, (whole, ...args) => {
      const offset = args[args.length - 2] as number;
      if (spans.some(([a, b]) => offset >= a && offset < b)) return whole;
      const groups = args.slice(0, -2).filter((g) => typeof g === 'string') as string[];
      if (supported(groups)) return whole;
      flagged.push(whole.trim());
      return placeholder(`check "${whole.trim()}" — not in your notes`);
    });
  }

  // Clock times, in 24-hour or am/pm form ("06:00" in the notes matches "6:00am" in the draft).
  const factTimes = timesIn(facts);
  {
    const spans = protectedSpans(text);
    text = text.replace(CLOCK, (whole: string, _h: string, _min: string, _suffix: string | undefined, offset: number) => {
      if (spans.some(([a, b]) => offset >= a && offset < b)) return whole;
      const keys = [...timesIn(whole)];
      // Not a real time (e.g. "25:70"), or the same time is in the notes.
      if (!keys.length || keys.some((k) => factTimes.has(k))) return whole;
      flagged.push(whole.trim());
      return placeholder(`check "${whole.trim()}" — not in your notes`);
    });
  }

  // Dates in any written form.
  const dateRes = [
    /\b\d{4}-\d{1,2}-\d{1,2}(?!\d)/g,
    /\b\d{1,2}[/.-]\d{1,2}[/.-](?:\d{2}|\d{4})\b/g,
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTH_RE})[a-z]*,?\\s+\\d{4}\\b`, 'gi'),
    new RegExp(`\\b(?:${MONTH_RE})[a-z]*\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, 'gi'),
  ];
  for (const re of dateRes) {
    const spans = protectedSpans(text);
    text = text.replace(re, (whole, offset: number) => {
      if (spans.some(([a, b]) => offset >= a && offset < b)) return whole;
      const keys = [...datesIn(whole)];
      if (keys.length && keys.every((k) => factDates.has(k))) return whole;
      flagged.push(whole);
      return placeholder(`check date "${whole}" — not in your notes`);
    });
  }

  return { text, flagged };
}

const CITE_PART = /^(.*?[A-Za-z].*?),?\s+((?:19|20)\d{2})[a-z]?$/;
const MONTH_WORD = new RegExp(`^(?:${MONTHS.join('|')}|${MONTHS.map((m) => m.slice(0, 3)).join('|')})\\b`, 'i');

/**
 * Whether the text before a year names an author ("Mensah et al.", "World Health
 * Organization") rather than a date ("28th October", "October") or anything else.
 */
const looksLikeAuthor = (name: string) => /^[A-Z]/.test(name.trim()) && !/\d/.test(name) && !MONTH_WORD.test(name.trim());

/** "Mensah, 2020; Owusu et al., 2019" — every part an author and a year. */
function isCitation(inner: string): boolean {
  return inner.split(';').map((p) => p.trim()).every((p) => CITE_PART.test(p) && looksLikeAuthor(p.match(CITE_PART)![1]));
}

function citable(sources: CareSource[], name: string, year: string): boolean {
  const first = norm(name.replace(/\bet al\.?/i, '').split(/,|&|\band\b/)[0]);
  if (!first) return false;
  return sources.some((s) =>
    String(s.year) === year &&
    (s.surnames.some((sn) => norm(sn) === first) || norm(s.authors).startsWith(first)));
}

/**
 * Remove citations to anything that was not retrieved for this study. A
 * statement left without a source gets a placeholder instead.
 */
export function guardCitations(draft: string, sources: CareSource[]): { text: string; removed: string[] } {
  const removed: string[] = [];
  const unsourced = placeholder('a source for this statement');

  let text = draft.replace(/\(([^()]*?(?:19|20)\d{2}[a-z]?)\)/g, (whole, inner: string) => {
    // Only treat it as a citation if every part looks like "Name, 2020" (not "28th October, 2021").
    if (!isCitation(inner)) return whole;
    const parts = inner.split(';').map((p) => p.trim());
    const kept = parts.filter((p) => {
      const [, name, year] = p.match(CITE_PART)!;
      const ok = citable(sources, name, year);
      if (!ok) removed.push(p);
      return ok;
    });
    if (kept.length === parts.length) return whole;
    return kept.length ? `(${kept.join('; ')})` : unsourced;
  });

  // Narrative citations: "Mensah (2019)", "Mensah et al. (2019)", "Mensah and Owusu (2019)".
  text = text.replace(
    /\b([A-Z][A-Za-z'’-]+(?:\s+et al\.|\s+(?:and|&)\s+[A-Z][A-Za-z'’-]+)?)\s+\(((?:19|20)\d{2})[a-z]?\)/g,
    (whole, name: string, year: string) => {
      if (!looksLikeAuthor(name) || citable(sources, name, year)) return whole;
      removed.push(`${name} (${year})`);
      return `${unsourced}`;
    }
  );

  return { text, removed };
}

/** Sources cited anywhere in the given drafts, for the bibliography. */
export function citedSources(drafts: string[], sources: CareSource[]): CareSource[] {
  const all = drafts.join('\n');
  return sources.filter((s) =>
    s.year != null && s.surnames.some((sn) =>
      new RegExp(`\\b${sn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^()\\n]{0,40}?\\(?${s.year}`, 'i').test(all)));
}
