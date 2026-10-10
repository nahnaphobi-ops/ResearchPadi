/** Mirrors backend/src/services/citations/source.types.ts. */

export interface PersonName {
  family: string;
  given: string;
}

export type SourceType = 'article' | 'thesis' | 'book' | 'chapter' | 'report' | 'conference' | 'webpage' | 'other';
export type SourceOrigin = 'ghana-repository' | 'openalex' | 'semantic-scholar';

export interface Source {
  id: string;
  title: string;
  authors: PersonName[];
  year: number | null;
  type: SourceType;
  containerTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  publisher?: string;
  institution?: string;
  genre?: string;
  repository?: string;
  origin: SourceOrigin;
  ghanaian: boolean;
  snippet?: string;
  citedByCount?: number;
  openAccess?: boolean;
}

export type CitationStyleId = 'apa7' | 'harvard' | 'mla9' | 'chicago' | 'ieee' | 'vancouver';
export type CitationMode = 'parenthetical' | 'narrative';

/** A run of reference-list text; italic runs become <em>. */
export interface Segment {
  text: string;
  italic?: boolean;
}

export interface BibliographyEntry {
  id: string;
  /** "1", "2"… for numeric styles. */
  number?: string;
  segments: Segment[];
}
