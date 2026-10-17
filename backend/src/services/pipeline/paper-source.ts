import { parseAuthors, serializeAuthors } from '../../lib/authors.js';
import type { Source } from '../citations/source.types.js';

/**
 * A source as the paper pipeline passes it to prompts and the reference list:
 * flat, with authors as "Family, Given; Family, Given".
 */
export interface PaperSource {
  title: string;
  authors: string;
  author_surname?: string;
  year: number | null;
  type?: string;
  venue?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  edition?: string;
  doi?: string;
  url?: string;
  publisher?: string;
  institution?: string;
  genre?: string;
  repository?: string;
  abstract?: string;
  ghanaian?: boolean;
}

export function toPaperSource(s: Source): PaperSource {
  return {
    title: s.title,
    authors: serializeAuthors(s.authors) || 'Unknown',
    author_surname: s.authors[0]?.family,
    year: s.year,
    type: s.type,
    venue: s.containerTitle,
    volume: s.volume,
    issue: s.issue,
    pages: s.pages,
    doi: s.doi,
    url: s.url,
    publisher: s.publisher,
    institution: s.institution,
    genre: s.genre,
    repository: s.repository,
    abstract: s.snippet,
    ghanaian: s.ghanaian,
  };
}

/** First author's surname as the paper cites it: "(Surname, Year)". */
export function paperSourceSurname(s: Pick<PaperSource, 'author_surname' | 'authors'>): string {
  if (s.author_surname) return s.author_surname;
  const first = parseAuthors(s.authors)[0];
  return first?.family || 'Unknown';
}

/** "(Surname, Year)" / "(Surname & Other, Year)" / "(Surname et al., Year)". */
export function citationKey(s: PaperSource): string {
  const names = parseAuthors(s.authors);
  const year = s.year ?? 'n.d.';
  if (names.length === 2) return `(${names[0].family} & ${names[1].family}, ${year})`;
  if (names.length > 2) return `(${names[0].family} et al., ${year})`;
  return `(${paperSourceSurname(s)}, ${year})`;
}

/**
 * Standard methodology texts the Chapter 3 instructions tell the writer to cite.
 * Listed as sources so those citations appear in the reference list too.
 */
export const STANDARD_METHOD_SOURCES: PaperSource[] = [
  {
    title: 'Research design: Qualitative, quantitative, and mixed methods approaches',
    authors: 'Creswell, John W.; Creswell, J. David',
    author_surname: 'Creswell',
    year: 2018,
    type: 'book',
    edition: '5th ed.',
    publisher: 'SAGE Publications',
  },
  {
    title: 'Determining sample size for research activities',
    authors: 'Krejcie, Robert V.; Morgan, Daryle W.',
    author_surname: 'Krejcie',
    year: 1970,
    type: 'article',
    venue: 'Educational and Psychological Measurement',
    volume: '30',
    issue: '3',
    pages: '607–610',
    doi: '10.1177/001316447003000308',
  },
  {
    title: 'Sampling techniques',
    authors: 'Cochran, William G.',
    author_surname: 'Cochran',
    year: 1977,
    type: 'book',
    edition: '3rd ed.',
    publisher: 'John Wiley & Sons',
  },
];
