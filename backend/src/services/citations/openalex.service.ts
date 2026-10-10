import axios from 'axios';
import { cacheGet, CACHE_TTL } from '../../lib/cache.js';
import { parseAuthors } from '../../lib/authors.js';
import { childLogger } from '../../lib/logger.js';
import { normaliseDoi, type Source, type SourceType } from './source.types.js';

const log = childLogger('openalex');

const OPENALEX_URL = 'https://api.openalex.org/works';
// OpenAlex's "polite pool" is faster and more reliable when requests carry a contact email.
const CONTACT = process.env.OPENALEX_EMAIL || 'hello@researchpadi.com';

const SELECT = [
  'id', 'doi', 'display_name', 'publication_year', 'type', 'authorships', 'primary_location',
  'biblio', 'abstract_inverted_index', 'cited_by_count', 'open_access',
].join(',');

interface OpenAlexWork {
  id: string;
  doi?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  type?: string | null;
  authorships?: { author?: { display_name?: string }; raw_author_name?: string; institutions?: { display_name?: string; country_code?: string }[] }[];
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null; host_organization_name?: string | null; type?: string | null } | null } | null;
  biblio?: { volume?: string | null; issue?: string | null; first_page?: string | null; last_page?: string | null };
  abstract_inverted_index?: Record<string, number[]> | null;
  cited_by_count?: number;
  open_access?: { is_oa?: boolean };
}

export interface OpenAlexOptions {
  ghanaOnly?: boolean;
  yearFrom?: number;
  perPage?: number;
}

/** OpenAlex ships abstracts as an inverted index; rebuild the text. */
export function rebuildAbstract(index: Record<string, number[]> | null | undefined): string | undefined {
  if (!index) return undefined;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const p of positions) words[p] = word;
  }
  const text = words.filter(Boolean).join(' ').trim();
  return text || undefined;
}

function mapType(t: string | null | undefined, sourceType?: string | null): SourceType {
  switch (t) {
    case 'article':
    case 'review':
    case 'letter':
    case 'editorial':
      return sourceType === 'conference' ? 'conference' : 'article';
    case 'book': return 'book';
    case 'book-chapter': return 'chapter';
    case 'dissertation': return 'thesis';
    case 'report': return 'report';
    case 'preprint': return 'article';
    default: return 'other';
  }
}

function toSource(w: OpenAlexWork, ghanaOnly: boolean): Source | null {
  const title = w.display_name?.trim();
  if (!title) return null;
  const names = (w.authorships ?? []).map((a) => a.author?.display_name || a.raw_author_name || '').filter(Boolean);
  const ghInstitution = (w.authorships ?? []).flatMap((a) => a.institutions ?? []).find((i) => i.country_code === 'GH');
  const doi = normaliseDoi(w.doi);
  const first = w.biblio?.first_page;
  const last = w.biblio?.last_page;
  const abstract = rebuildAbstract(w.abstract_inverted_index);

  return {
    id: doi ? `doi:${doi}` : `openalex:${w.id.split('/').pop()}`,
    title,
    authors: parseAuthors(names),
    year: w.publication_year ?? null,
    type: mapType(w.type, w.primary_location?.source?.type),
    containerTitle: w.primary_location?.source?.display_name || undefined,
    volume: w.biblio?.volume || undefined,
    issue: w.biblio?.issue || undefined,
    pages: first ? (last && last !== first ? `${first}–${last}` : first) : undefined,
    doi,
    url: doi ? `https://doi.org/${doi}` : w.primary_location?.landing_page_url || w.id,
    publisher: w.primary_location?.source?.host_organization_name || undefined,
    institution: ghInstitution?.display_name,
    origin: 'openalex',
    ghanaian: ghanaOnly || !!ghInstitution,
    snippet: abstract ? abstract.slice(0, 600) : undefined,
    citedByCount: w.cited_by_count,
    openAccess: w.open_access?.is_oa,
  };
}

/** Search OpenAlex; with ghanaOnly, restrict to works with a Ghana-based author institution. */
export async function searchOpenAlex(query: string, opts: OpenAlexOptions = {}): Promise<Source[]> {
  const q = query.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!q) return [];
  const perPage = Math.min(Math.max(opts.perPage ?? 10, 1), 25);
  const filters = ['type:article|book|book-chapter|dissertation|report|preprint|review'];
  if (opts.ghanaOnly) filters.push('authorships.institutions.country_code:GH');
  if (opts.yearFrom) filters.push(`from_publication_date:${opts.yearFrom}-01-01`);

  return cacheGet(
    `citations:openalex2:${opts.ghanaOnly ? 'gh' : 'all'}:${opts.yearFrom ?? ''}:${perPage}:${q.toLowerCase()}`,
    CACHE_TTL.OPENALEX,
    async () => {
      try {
        const { data } = await axios.get(OPENALEX_URL, {
          params: { search: q, filter: filters.join(','), 'per-page': perPage, select: SELECT, mailto: CONTACT },
          timeout: 12_000,
        });
        return ((data?.results ?? []) as OpenAlexWork[])
          .map((w) => toSource(w, !!opts.ghanaOnly))
          .filter((s): s is Source => !!s);
      } catch (err) {
        log.warn({ err: (err as Error).message, ghanaOnly: opts.ghanaOnly }, 'OpenAlex search failed');
        return [];
      }
    },
  );
}
