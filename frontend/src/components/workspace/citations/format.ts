import type { BibliographyEntry, CitationMode, CitationStyleId, PersonName, Segment, Source } from './types';

export const CITATION_STYLES: { id: CitationStyleId; label: string; numeric: boolean; bibliographyTitle: string }[] = [
  { id: 'apa7', label: 'APA 7th', numeric: false, bibliographyTitle: 'References' },
  { id: 'harvard', label: 'Harvard (KNUST / UG)', numeric: false, bibliographyTitle: 'References' },
  { id: 'mla9', label: 'MLA 9th', numeric: false, bibliographyTitle: 'Works Cited' },
  { id: 'chicago', label: 'Chicago (author-date)', numeric: false, bibliographyTitle: 'References' },
  { id: 'ieee', label: 'IEEE', numeric: true, bibliographyTitle: 'References' },
  { id: 'vancouver', label: 'Vancouver', numeric: true, bibliographyTitle: 'References' },
];

export const DEFAULT_STYLE: CitationStyleId = 'apa7';

export const styleInfo = (id: CitationStyleId) => CITATION_STYLES.find((s) => s.id === id) ?? CITATION_STYLES[0];
export const isCitationStyle = (v: unknown): v is CitationStyleId => CITATION_STYLES.some((s) => s.id === v);

// ── Name helpers ───────────────────────────────────────────────────────────

/** "Kwame Ama" → ["K", "A"]; "A.G.B." → ["A", "G", "B"]; "Jean-Paul" → ["J-P"]. */
function initialLetters(given: string): string[] {
  return given
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((part) => part.split('-').filter(Boolean).map((p) => p[0].toUpperCase()).join('-'));
}

const initialsDotted = (given: string) => initialLetters(given).map((l) => l.split('-').map((x) => `${x}.`).join('-')).join(' ');
const initialsCompact = (given: string) => initialLetters(given).map((l) => l.replace(/-/g, '')).join('');

const familyGivenInitials = (n: PersonName) => (n.given ? `${n.family}, ${initialsDotted(n.given)}` : n.family);
const initialsFamily = (n: PersonName) => (n.given ? `${initialsDotted(n.given)} ${n.family}` : n.family);
const familyGivenFull = (n: PersonName) => (n.given ? `${n.family}, ${n.given}` : n.family);
const givenFamilyFull = (n: PersonName) => (n.given ? `${n.given} ${n.family}` : n.family);

function joinList(items: string[], conj: string, serialComma: boolean): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return serialComma && conj === '&' ? `${items[0]}, & ${items[1]}` : `${items[0]} ${conj} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}${serialComma ? ',' : ''} ${conj} ${items[items.length - 1]}`;
}

function refAuthors(authors: PersonName[], style: CitationStyleId): string {
  if (!authors.length) return '';
  switch (style) {
    case 'apa7': {
      const names = authors.map(familyGivenInitials);
      if (names.length > 20) return `${names.slice(0, 19).join(', ')}, . . . ${names[names.length - 1]}`;
      return joinList(names, '&', true);
    }
    case 'harvard':
      return joinList(authors.map(familyGivenInitials), 'and', false);
    case 'mla9':
      if (authors.length === 1) return familyGivenFull(authors[0]);
      if (authors.length === 2) return `${familyGivenFull(authors[0])}, and ${givenFamilyFull(authors[1])}`;
      return `${familyGivenFull(authors[0])}, et al.`;
    case 'chicago': {
      const list = authors.length > 10 ? authors.slice(0, 7) : authors;
      const names = [familyGivenFull(list[0]), ...list.slice(1).map(givenFamilyFull)];
      if (authors.length > 10) return `${names.join(', ')}, et al.`;
      // The first name is inverted, so a comma always precedes "and": "Mensah, Kwame, and Ama Owusu".
      return names.length === 2 ? `${names[0]}, and ${names[1]}` : joinList(names, 'and', true);
    }
    case 'ieee':
      if (authors.length > 6) return `${initialsFamily(authors[0])} et al.`;
      return joinList(authors.map(initialsFamily), 'and', authors.length > 2);
    case 'vancouver': {
      const names = authors.slice(0, 6).map((n) => (n.given ? `${n.family} ${initialsCompact(n.given)}` : n.family));
      return authors.length > 6 ? `${names.join(', ')}, et al` : names.join(', ');
    }
  }
}

/** Author names as they appear in the text ("Mensah & Owusu", "Mensah et al."). */
function inTextNames(authors: PersonName[], style: CitationStyleId, mode: CitationMode, title: string): string {
  if (!authors.length) {
    const short = title.split(/\s+/).slice(0, 4).join(' ');
    return `“${short}${title.split(/\s+/).length > 4 ? '…' : ''}”`;
  }
  const fam = authors.map((a) => a.family);
  const and = style === 'apa7' && mode === 'parenthetical' ? '&' : 'and';
  if (style === 'chicago') {
    if (fam.length <= 3) return joinList(fam, 'and', true);
    return `${fam[0]} et al.`;
  }
  if (fam.length === 1) return fam[0];
  if (fam.length === 2) return `${fam[0]} ${and} ${fam[1]}`;
  return `${fam[0]} et al.`;
}

// ── Small text helpers ─────────────────────────────────────────────────────

const endWithPeriod = (s: string) => (/[.?!]["”’)]?$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const normDash = (pages: string) => pages.replace(/\s*[-–—]\s*/g, '–');

function formatLocator(page: string, style: CitationStyleId): string {
  const p = page.trim();
  if (!p) return '';
  const isRange = /\d\s*[-–—]\s*\d/.test(p);
  const bare = /^[\d\s\-–—,]+$/.test(p);
  if (!bare) return p; // e.g. "para. 4", "chap. 2"
  const pp = normDash(p);
  if (style === 'mla9' || style === 'chicago') return pp;
  return `${isRange ? 'pp.' : 'p.'} ${pp}`;
}

const yearLabel = (s: Source, suffix: string) => `${s.year ?? 'n.d.'}${s.year ? suffix : suffix ? `-${suffix}` : ''}`;
const doiUrl = (doi: string) => `https://doi.org/${doi}`;

function compressNumbers(nums: number[], open: string, close: string, joiner: string): string {
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) parts.push(open === '[' ? `[${sorted[i]}]–[${sorted[j]}]` : `${sorted[i]}–${sorted[j]}`);
    else for (let k = i; k <= j; k++) parts.push(open === '[' ? `[${sorted[k]}]` : String(sorted[k]));
    i = j;
  }
  return open === '[' ? parts.join(joiner) : `${open}${parts.join(joiner)}${close}`;
}

// ── Reference-list entries ─────────────────────────────────────────────────

function referenceSegments(s: Source, style: CitationStyleId, suffix: string): Segment[] {
  const out: Segment[] = [];
  const add = (text: string, italic = false) => { if (text) out.push({ text, italic }); };
  const authors = refAuthors(s.authors, style);
  const year = yearLabel(s, suffix);
  const title = s.title.trim();
  const where = s.institution || s.publisher || s.repository || '';
  const link = s.doi ? doiUrl(s.doi) : s.url || '';
  const isArticle = s.type === 'article' || s.type === 'conference';
  const genre = s.genre || (s.type === 'thesis' ? 'Thesis' : '');

  switch (style) {
    case 'apa7': {
      if (authors) add(`${authors} (${year}). `);
      if (isArticle) {
        add(authors ? `${endWithPeriod(title)} ` : `${endWithPeriod(title)} (${year}). `);
        if (s.containerTitle) {
          add(s.containerTitle, true);
          if (s.volume) { add(', '); add(s.volume, true); }
          if (s.issue) add(`(${s.issue})`);
          if (s.pages) add(`, ${normDash(s.pages)}`);
          add('. ');
        }
      } else if (s.type === 'chapter') {
        add(`${endWithPeriod(title)} `);
        if (s.containerTitle) { add('In '); add(s.containerTitle, true); add(s.pages ? ` (pp. ${normDash(s.pages)}). ` : '. '); }
        if (s.publisher) add(`${endWithPeriod(s.publisher)} `);
      } else {
        add(title, true);
        if (!authors) add(` (${year})`);
        if (s.type === 'thesis' || s.type === 'report') {
          const bracket = [genre, s.institution].filter(Boolean).join(', ');
          add(bracket ? ` [${bracket}]. ` : '. ');
          if (s.repository) add(`${endWithPeriod(s.repository)} `);
        } else {
          add('. ');
          if (where) add(`${endWithPeriod(where)} `);
        }
      }
      add(link);
      break;
    }
    case 'harvard': {
      if (authors) add(`${authors} (${year}) `);
      else add(`${title} (${year}) `);
      if (isArticle) {
        if (authors) add(`'${title}', `);
        if (s.containerTitle) add(s.containerTitle, true);
        if (s.volume) add(`, ${s.volume}`);
        if (s.issue) add(`(${s.issue})`);
        if (s.pages) add(`, pp. ${normDash(s.pages)}`);
        add('.');
      } else {
        if (authors) add(title, true);
        add('. ');
        if (s.type === 'thesis') add(`${endWithPeriod([genre, s.institution].filter(Boolean).join('. '))}`);
        else if (where) add(endWithPeriod(where));
      }
      if (s.doi) add(` doi: ${s.doi}.`);
      else if (link) add(` Available at: ${link}.`);
      break;
    }
    case 'mla9': {
      if (authors) add(`${endWithPeriod(authors)} `);
      if (isArticle) {
        add(`“${endWithPeriod(title)}” `);
        const parts: string[] = [];
        if (s.volume) parts.push(`vol. ${s.volume}`);
        if (s.issue) parts.push(`no. ${s.issue}`);
        if (s.year) parts.push(String(s.year));
        if (s.pages) parts.push(`pp. ${normDash(s.pages)}`);
        if (s.containerTitle) { add(s.containerTitle, true); add(parts.length ? `, ${parts.join(', ')}. ` : '. '); }
        else if (parts.length) add(`${parts.join(', ')}. `);
      } else {
        add(title, true);
        add('. ');
        if (s.type === 'thesis') add(`${s.year ?? 'n.d.'}. ${[s.institution, genre].filter(Boolean).join(', ')}. `);
        else add(`${[where, s.year].filter(Boolean).join(', ')}. `);
      }
      if (link) add(endWithPeriod(link.replace(/^https?:\/\//, '')));
      break;
    }
    case 'chicago': {
      if (authors) add(`${endWithPeriod(authors)} ${year}. `);
      if (isArticle) {
        add(`“${endWithPeriod(title)}” `);
        if (s.containerTitle) {
          add(s.containerTitle, true);
          if (s.volume) add(` ${s.volume}`);
          if (s.issue) add(` (${s.issue})`);
          if (s.pages) add(`: ${normDash(s.pages)}`);
          add('. ');
        }
      } else if (s.type === 'thesis') {
        add(`“${endWithPeriod(title)}” ${endWithPeriod([genre, s.institution].filter(Boolean).join(', '))} `);
      } else {
        add(title, true);
        add(`. ${where ? endWithPeriod(where) + ' ' : ''}`);
      }
      if (!authors) add(`${year}. `);
      add(link ? endWithPeriod(link) : '');
      break;
    }
    case 'ieee': {
      if (authors) add(`${authors}, `);
      if (isArticle) {
        add(`“${title},” `);
        if (s.containerTitle) add(s.containerTitle, true);
        if (s.volume) add(`, vol. ${s.volume}`);
        if (s.issue) add(`, no. ${s.issue}`);
        if (s.pages) add(`, pp. ${normDash(s.pages)}`);
        add(`, ${s.year ?? 'n.d.'}`);
        add(s.doi ? `, doi: ${s.doi}.` : '.');
      } else if (s.type === 'thesis') {
        const degree = /doctoral/i.test(genre) ? 'Ph.D. dissertation' : /master/i.test(genre) ? "Master's thesis" : genre || 'Thesis';
        add(`“${title},” ${degree}${s.institution ? `, ${s.institution}` : ''}, ${s.year ?? 'n.d.'}.`);
      } else {
        add(title, true);
        add(`, ${[where, s.year ?? 'n.d.'].filter(Boolean).join(', ')}.`);
      }
      if (!s.doi && link) add(` [Online]. Available: ${link}`);
      break;
    }
    case 'vancouver': {
      if (authors) add(`${authors}. `);
      if (isArticle) {
        add(`${endWithPeriod(title)} `);
        if (s.containerTitle) add(`${s.containerTitle}. `);
        add(`${s.year ?? 'n.d.'}`);
        if (s.volume) add(`;${s.volume}`);
        if (s.issue) add(`(${s.issue})`);
        if (s.pages) add(`:${normDash(s.pages).replace('–', '-')}`);
        add('.');
        if (s.doi) add(` doi:${s.doi}`);
      } else if (s.type === 'thesis') {
        add(`${title} [${genre || 'Thesis'}]. ${s.institution ? `${s.institution}; ` : ''}${s.year ?? 'n.d.'}.`);
      } else {
        add(`${endWithPeriod(title)} ${where ? `${where}; ` : ''}${s.year ?? 'n.d.'}.`);
      }
      if (!s.doi && link) add(` Available from: ${link}`);
      break;
    }
  }
  // Drop trailing whitespace left when an optional final part (e.g. the link) is absent.
  if (out.length) out[out.length - 1] = { ...out[out.length - 1], text: out[out.length - 1].text.trimEnd() };
  return out.filter((seg) => seg.text);
}

// ── Whole-document computation ─────────────────────────────────────────────

export interface CitationInput {
  sources: Source[];
  page: string;
  mode: CitationMode;
}

export interface CitationOutput {
  labels: string[];
  bibliography: BibliographyEntry[];
}

/** Titles sort ignoring a leading "A", "An" or "The" (APA, Chicago and MLA rules). */
const titleSortForm = (title: string) => title.toLowerCase().replace(/^(a|an|the)\s+/, '');

const sortKey = (s: Source) =>
  `${(s.authors[0]?.family || titleSortForm(s.title)).toLowerCase()}\u0000${s.year ?? 9999}\u0000${titleSortForm(s.title)}`;

/**
 * Compute every in-text label and the reference list for a document, given its
 * citations in reading order. Handles numbering (IEEE/Vancouver), "2021a/2021b"
 * disambiguation (author-date styles) and MLA short titles for same-author works.
 */
export function computeCitations(citations: CitationInput[], style: CitationStyleId): CitationOutput {
  const info = styleInfo(style);

  // Unique sources, in order of first citation.
  const unique = new Map<string, Source>();
  for (const c of citations) for (const s of c.sources) if (!unique.has(s.id)) unique.set(s.id, s);
  const sources = [...unique.values()];

  const numbers = new Map<string, number>();
  sources.forEach((s, i) => numbers.set(s.id, i + 1));

  // Author-date disambiguation: same author list + same year → a, b, c (ordered by title).
  const suffixes = new Map<string, string>();
  if (!info.numeric && style !== 'mla9') {
    const groups = new Map<string, Source[]>();
    for (const s of sources) {
      const key = `${s.authors.map((a) => a.family.toLowerCase()).join('|') || s.title.toLowerCase()}#${s.year ?? 'nd'}`;
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      [...group].sort((a, b) => titleSortForm(a.title).localeCompare(titleSortForm(b.title))).forEach((s, i) => suffixes.set(s.id, String.fromCharCode(97 + i)));
    }
  }

  // MLA: works sharing an author key get a short title in the in-text citation.
  const mlaNeedsTitle = new Set<string>();
  if (style === 'mla9') {
    const byName = new Map<string, string[]>();
    for (const s of sources) {
      const key = s.authors.map((a) => a.family.toLowerCase()).join('|');
      if (key) byName.set(key, [...(byName.get(key) ?? []), s.id]);
    }
    for (const ids of byName.values()) if (ids.length > 1) ids.forEach((id) => mlaNeedsTitle.add(id));
  }

  const labels = citations.map((c) => {
    if (!c.sources.length) return '(citation)';
    const loc = formatLocator(c.page, style);

    if (info.numeric) {
      const nums = c.sources.map((s) => numbers.get(s.id)!);
      if (style === 'ieee') {
        const core = loc && nums.length === 1 ? `[${nums[0]}, ${loc}]` : compressNumbers(nums, '[', ']', ', ');
        return c.mode === 'narrative' ? `${inTextNames(c.sources[0].authors, 'apa7', 'narrative', c.sources[0].title)} ${core}` : core;
      }
      const core = compressNumbers(nums, '(', ')', ',');
      const withLoc = loc ? `${core.slice(0, -1)}, ${loc})` : core;
      return c.mode === 'narrative' ? `${inTextNames(c.sources[0].authors, 'apa7', 'narrative', c.sources[0].title)} ${withLoc}` : withLoc;
    }

    const ordered = style === 'apa7' || style === 'harvard'
      ? [...c.sources].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
      : c.sources;

    if (style === 'mla9') {
      const items = ordered.map((s) => {
        const names = inTextNames(s.authors, style, c.mode, s.title);
        return mlaNeedsTitle.has(s.id) ? `${names}, ${s.title.split(/[:.]/)[0].split(/\s+/).slice(0, 4).join(' ')}` : names;
      });
      if (c.mode === 'narrative') return `${items.join(' and ')}${loc ? ` (${loc})` : ''}`;
      return `(${items.join('; ')}${loc ? ` ${loc}` : ''})`;
    }

    // Group consecutive works by the same authors: (Mensah, 2019, 2021a)
    const groups: { names: string; years: string[] }[] = [];
    for (const s of ordered) {
      const names = inTextNames(s.authors, style, c.mode, s.title);
      const y = yearLabel(s, suffixes.get(s.id) ?? '');
      const last = groups[groups.length - 1];
      if (last && last.names === names) last.years.push(y);
      else groups.push({ names, years: [y] });
    }
    const sep = style === 'chicago' ? ' ' : ', ';
    const locPart = loc ? `, ${loc}` : '';

    if (c.mode === 'narrative') {
      return groups
        .map((g, i) => `${g.names} (${g.years.join(', ')}${i === groups.length - 1 ? locPart : ''})`)
        .join(' and ');
    }
    return `(${groups.map((g) => `${g.names}${sep}${g.years.join(', ')}`).join('; ')}${locPart})`;
  });

  const listed = info.numeric ? sources : [...sources].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const bibliography: BibliographyEntry[] = listed.map((s) => ({
    id: s.id,
    number: info.numeric ? String(numbers.get(s.id)) : undefined,
    segments: referenceSegments(s, style, suffixes.get(s.id) ?? ''),
  }));

  return { labels, bibliography };
}

/** One formatted reference as plain text (for "Copy reference"). */
export function referenceText(source: Source, style: CitationStyleId): string {
  return referenceSegments(source, style, '').map((s) => s.text).join('');
}

/** One formatted reference as segments (for previews). */
export function referencePreview(source: Source, style: CitationStyleId): Segment[] {
  return referenceSegments(source, style, '');
}
