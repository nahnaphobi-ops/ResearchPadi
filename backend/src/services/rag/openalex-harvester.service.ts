import { CONFIG } from '../../config/index.js';
import { parseAuthors, serializeAuthors } from '../../lib/authors.js';
import { childLogger } from '../../lib/logger.js';
import { chunkText } from './chunker.service.js';
import { openAlexAuthParams, rebuildAbstract } from '../citations/openalex.service.js';
import { normaliseDoi } from '../citations/source.types.js';
import { harvestGet } from './harvest-http.js';

const log = childLogger('openalex-harvester');

/** knowledge_chunks.source_name for these works (sources.service shows it as "OpenAlex (Ghana)"). */
export const OPENALEX_GHANA = 'OpenAlex (Ghana)';

const URL = 'https://api.openalex.org/works';
const PER_PAGE = 200;
/** Without an API key OpenAlex only pages by number, and only through the first 10,000 results. */
const KEYLESS_LAST_PAGE = 10_000 / PER_PAGE;
const PAGE_RESUME = 'page:';
const SELECT = [
  'id', 'doi', 'display_name', 'publication_year', 'type', 'language', 'authorships', 'primary_location',
  'abstract_inverted_index', 'primary_topic',
].join(',');

export interface OpenAlexHarvestWork {
  id: string;
  doi?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  type?: string | null;
  language?: string | null;
  authorships?: { author?: { display_name?: string }; raw_author_name?: string; institutions?: { display_name?: string; country_code?: string }[] }[];
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null; host_organization_name?: string | null } | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  primary_topic?: { field?: { display_name?: string } | null; subfield?: { display_name?: string } | null } | null;
}

export interface KnowledgeRow {
  source_name: string;
  source_url: string;
  document_title: string;
  authors: string | null;
  year: number | null;
  institution: string;
  field: string;
  chunk_text: string;
  chunk_index: number;
  document_type: string | null;
  language: string | null;
  doi: string | null;
  journal?: string | null;
  publisher?: string | null;
}

/** One OpenAlex work with a Ghana-based author as knowledge-base rows (abstract chunks). */
export function openAlexWorkToRows(w: OpenAlexHarvestWork): KnowledgeRow[] {
  const title = w.display_name?.replace(/\s+/g, ' ').trim();
  const abstract = rebuildAbstract(w.abstract_inverted_index)?.replace(/\s+/g, ' ').trim();
  if (!title || !abstract || abstract.length < 100) return [];
  const doi = normaliseDoi(w.doi) ?? null;
  const url = doi ? `https://doi.org/${doi}` : w.primary_location?.landing_page_url || w.id;
  const names = (w.authorships ?? []).map((a) => a.author?.display_name || a.raw_author_name || '').filter(Boolean);
  const ghana = (w.authorships ?? []).flatMap((a) => a.institutions ?? []).find((i) => i.country_code === 'GH');
  const field = w.primary_topic?.subfield?.display_name || w.primary_topic?.field?.display_name || 'General';

  return chunkText(abstract, CONFIG.RAG.CHUNK_SIZE, CONFIG.RAG.CHUNK_OVERLAP).map((chunk, i) => ({
    source_name: OPENALEX_GHANA,
    source_url: url,
    document_title: title,
    authors: serializeAuthors(parseAuthors(names)) || null,
    year: w.publication_year ?? null,
    institution: ghana?.display_name || 'Ghana',
    field: field.slice(0, 120),
    chunk_text: chunk,
    chunk_index: i,
    document_type: w.type?.slice(0, 80) || null,
    language: w.language?.slice(0, 20) || null,
    doi,
    journal: w.primary_location?.source?.display_name || null,
    publisher: w.primary_location?.source?.host_organization_name || null,
  }));
}

export function openAlexGhanaFilter(fromDate: string, toDate?: string): string {
  return [
    'authorships.institutions.country_code:GH',
    'has_abstract:true',
    'type:article|review|book-chapter|dissertation|report',
    `from_publication_date:${fromDate}`,
    ...(toDate ? [`to_publication_date:${toDate}`] : []),
  ].join(',');
}

/**
 * Where to start paging. With an API key: cursor paging (no result limit), resuming a saved
 * cursor. Without one OpenAlex refuses cursors past page 1 (HTTP 401), so page by number,
 * resuming a saved "page:N". A saved position from the other mode starts the range again.
 */
export function openAlexStart(resume: string | undefined, hasKey: boolean): { cursor: string } | { page: number } {
  const savedPage = resume?.startsWith(PAGE_RESUME) ? Number(resume.slice(PAGE_RESUME.length)) : NaN;
  if (hasKey) return { cursor: resume && !resume.startsWith(PAGE_RESUME) ? resume : '*' };
  return { page: Number.isInteger(savedPage) && savedPage > 0 ? savedPage : 1 };
}

/**
 * Page through works with a Ghana-based author published between the dates
 * (200 per page), handing each page's rows and its work count to `onPage`.
 * `nextCursor` is where a partial run stopped: a cursor, or "page:N" without a key.
 */
export async function harvestOpenAlexGhana(
  range: { from: string; to?: string },
  maxPages: number,
  onPage: (rows: KnowledgeRow[], works: number) => Promise<number>,
  resume?: string,
): Promise<{ fetched: number; added: number; complete: boolean; nextCursor?: string; note?: string }> {
  const auth = openAlexAuthParams();
  let position = openAlexStart(resume, 'api_key' in auth);
  let fetched = 0;
  let added = 0;
  for (let i = 0; i < maxPages; i++) {
    if ('page' in position && position.page > KEYLESS_LAST_PAGE) {
      // Keyless paging can't go further; count the range as done rather than retrying it forever.
      const note = `Stopped at OpenAlex's 10,000-result limit for requests without an API key; set OPENALEX_API_KEY to get the rest`;
      log.warn({ ...range, fetched, added }, note);
      return { fetched, added, complete: true, note };
    }
    const { data } = await harvestGet<any>(URL, {
      params: { filter: openAlexGhanaFilter(range.from, range.to), 'per-page': PER_PAGE, select: SELECT, ...auth, ...position },
      timeout: 60_000,
    }, { minIntervalMs: 200 }); // stay well inside OpenAlex's rate limit
    const works = (data?.results ?? []) as OpenAlexHarvestWork[];
    fetched += works.length;
    added += await onPage(works.flatMap(openAlexWorkToRows), works.length);
    if ('cursor' in position) {
      const next = data?.meta?.next_cursor as string | null | undefined;
      if (!next || !works.length) return { fetched, added, complete: true };
      position = { cursor: next };
    } else {
      const total = Number(data?.meta?.count ?? 0);
      if (works.length < PER_PAGE || position.page * PER_PAGE >= total) return { fetched, added, complete: true };
      position = { page: position.page + 1 };
    }
  }
  log.info({ ...range, fetched, added, maxPages }, 'OpenAlex harvest stopped at the page limit');
  return { fetched, added, complete: false, nextCursor: 'cursor' in position ? position.cursor : `${PAGE_RESUME}${position.page}` };
}
