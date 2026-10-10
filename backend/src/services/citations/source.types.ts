import type { PersonName } from '../../lib/authors.js';

export type SourceType = 'article' | 'thesis' | 'book' | 'chapter' | 'report' | 'conference' | 'webpage' | 'other';
export type SourceOrigin = 'ghana-repository' | 'openalex' | 'semantic-scholar';

/**
 * One citable work, in the shape the workspace editor stores inside citation
 * nodes. Keep in sync with frontend/src/components/workspace/citations/types.ts.
 */
export interface Source {
  id: string;
  title: string;
  authors: PersonName[];
  year: number | null;
  type: SourceType;
  /** Journal, book or proceedings title. */
  containerTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  publisher?: string;
  /** Awarding/hosting institution (theses, reports). */
  institution?: string;
  /** e.g. "Master's thesis", "Patient/family care study". */
  genre?: string;
  /** Repository the item was found in, e.g. "UGSpace". */
  repository?: string;
  origin: SourceOrigin;
  ghanaian: boolean;
  snippet?: string;
  citedByCount?: number;
  openAccess?: boolean;
}

export function normaliseDoi(doi: string | null | undefined): string | undefined {
  if (!doi) return undefined;
  const m = String(doi).trim().match(/10\.\d{4,9}\/\S+/i);
  return m ? m[0].replace(/[.,;]+$/, '').toLowerCase() : undefined;
}

export function sourceKey(s: Pick<Source, 'doi' | 'title'>): string {
  if (s.doi) return `doi:${s.doi.toLowerCase()}`;
  return `title:${s.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 90)}`;
}
