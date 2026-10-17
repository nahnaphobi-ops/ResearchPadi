import { parseAuthors } from '../../lib/authors.js';
import { paperSourceSurname, type PaperSource } from './paper-source.js';

/**
 * The reference list is built in code from the sources the chapters actually
 * cite, so it never lists uncited works or garbles details the way a model can.
 */

export interface CitedKey {
  /** First author's surname, normalised. */
  surname: string;
  /** The whole name part, normalised (for organisations: "ghana health service"). */
  names: string;
  year: number | null;
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();

const YEAR = /\b((?:19|20)\d{2})[a-z]?\b|\bn\.\s?d\./i;

function keyFromNames(namesPart: string, yearText: string): CitedKey | null {
  const names = namesPart.replace(/^(?:e\.g\.,?|see also|see|cf\.)\s+/i, '').trim();
  if (!names || /\d/.test(names)) return null;
  const firstAuthor = names.split(/\s+et\s+al\.?|\s*&\s*|\s+and\s+|,/i)[0].trim();
  const surname = norm(firstAuthor.split(/\s+/).pop() || '');
  if (!surname) return null;
  const y = yearText.match(/(?:19|20)\d{2}/);
  return { surname, names: norm(firstAuthor), year: y ? Number(y[0]) : null };
}

/** Every (Author, Year) and Author (Year) citation in the text. */
export function extractCitedKeys(text: string): CitedKey[] {
  const keys: CitedKey[] = [];

  // Parenthetical: (Mensah, 2021), (Mensah & Owusu, 2019; Boateng et al., 2020a), (Ghana Health Service, n.d.)
  for (const m of text.matchAll(/\(([^()]{3,400})\)/g)) {
    for (const part of m[1].split(';')) {
      const yearMatch = part.match(YEAR);
      if (!yearMatch || yearMatch.index === undefined) continue;
      const key = keyFromNames(part.slice(0, yearMatch.index).replace(/,\s*$/, ''), yearMatch[0]);
      if (key) keys.push(key);
    }
  }

  // Narrative: Mensah (2021), Mensah et al. (2020), Mensah and Owusu (2019)
  const narrative = /([A-Z][\p{L}'’-]+(?:\s+et\s+al\.?|\s+(?:and|&)\s+[A-Z][\p{L}'’-]+)?)\s+\(((?:19|20)\d{2})[a-z]?(?:,\s*p+\.\s*[\d–-]+)?\)/gu;
  for (const m of text.matchAll(narrative)) {
    const key = keyFromNames(m[1], m[2]);
    if (key) keys.push(key);
  }
  return keys;
}

function sourceMatches(s: PaperSource, key: CitedKey): boolean {
  if ((s.year ?? null) !== key.year) return false;
  if (norm(paperSourceSurname(s)) === key.surname) return true;
  // Organisations: compare the whole first-author name.
  const firstRaw = (s.authors || '').split(';')[0]?.trim() ?? '';
  return !!firstRaw && norm(firstRaw) === key.names;
}

/** The sources the text cites, without duplicates, in the order first found. */
export function citedSources(text: string, sources: PaperSource[]): PaperSource[] {
  const keys = extractCitedKeys(text);
  const picked: PaperSource[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const s = sources.find((src) => sourceMatches(src, key));
    if (!s) continue;
    const id = (s.doi || s.title).toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    picked.push(s);
  }
  return picked;
}

const ORGANISATION = /\b(organi[sz]ation|service|ministry|authority|commission|council|bank|fund|institute|association|agency|board|department|university|society|programme|program|bureau|government|unicef|unesco)\b/i;

function initials(given: string): string {
  return given
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((part) => part.split('-').map((p) => `${p[0].toUpperCase()}.`).join('-'))
    .join(' ');
}

/** APA 7 author list: "Mensah, K. A., Owusu, A., & Boateng, E." */
export function apaAuthors(raw: string): string {
  if (!raw || /^unknown$/i.test(raw.trim())) return '';
  const first = raw.split(';')[0].trim();
  if (!raw.includes(';') && ORGANISATION.test(first)) return first;
  const names = parseAuthors(raw).map((n) => (n.given ? `${n.family}, ${initials(n.given)}` : n.family));
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length <= 20) return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
  return `${names.slice(0, 19).join(', ')}, . . . ${names[names.length - 1]}`;
}

const endWithPeriod = (s: string) => (/[.?!]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

/** One APA 7 reference as plain text (the .docx has no italics). */
export function formatApaReference(s: PaperSource): string {
  const authors = apaAuthors(s.authors);
  const year = `(${s.year ?? 'n.d.'}).`;
  const title = endWithPeriod(`${s.title.replace(/\s+/g, ' ').trim()}${s.edition ? ` (${s.edition})` : ''}`);
  const link = s.doi ? ` https://doi.org/${s.doi}` : s.url ? ` ${s.url}` : '';
  const type = (s.type || (s.venue ? 'article' : 'other')).toLowerCase();

  let rest: string;
  if (type === 'article' || type === 'conference') {
    const volume = s.volume ? `, ${s.volume}${s.issue ? `(${s.issue})` : ''}` : s.issue ? `, (${s.issue})` : '';
    rest = s.venue ? endWithPeriod(`${s.venue}${volume}${s.pages ? `, ${s.pages}` : ''}`) : '';
  } else if (type === 'book') {
    rest = s.publisher ? endWithPeriod(s.publisher) : '';
  } else if (type === 'chapter') {
    rest = [s.venue ? `In ${s.venue}${s.pages ? ` (pp. ${s.pages})` : ''}.` : '', s.publisher ? endWithPeriod(s.publisher) : ''].filter(Boolean).join(' ');
  } else if (type === 'thesis') {
    const where = [s.genre || 'Thesis', s.institution].filter(Boolean).join(', ');
    return [authors || title, year, authors ? `${title.replace(/\.$/, '')} [${where}].` : `[${where}].`, s.repository ? endWithPeriod(s.repository) : '']
      .filter(Boolean).join(' ') + link;
  } else {
    const by = s.publisher || s.institution;
    rest = by ? endWithPeriod(by) : '';
  }

  const head = authors ? `${endWithPeriod(authors)} ${year} ${title}` : `${title} ${year}`;
  return `${[head, rest].filter(Boolean).join(' ')}${link}`.replace(/\.\./g, '.');
}

/** "References" plus one entry per cited source, alphabetical by first author then year. */
export function buildReferenceList(sources: PaperSource[]): string {
  const sortKey = (s: PaperSource) => `${norm(apaAuthors(s.authors) || s.title)} ${s.year ?? 9999}`;
  const entries = [...sources].sort((a, b) => sortKey(a).localeCompare(sortKey(b))).map(formatApaReference);
  return ['References', ...entries].join('\n\n');
}
