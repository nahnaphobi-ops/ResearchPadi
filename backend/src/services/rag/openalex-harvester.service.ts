import axios from 'axios';
import { CONFIG } from '../../config/index.js';
import { parseAuthors, serializeAuthors } from '../../lib/authors.js';
import { childLogger } from '../../lib/logger.js';
import { chunkText } from './chunker.service.js';
import { rebuildAbstract } from '../citations/openalex.service.js';
import { normaliseDoi } from '../citations/source.types.js';

const log = childLogger('openalex-harvester');

/** knowledge_chunks.source_name for these works (sources.service shows it as "OpenAlex (Ghana)"). */
export const OPENALEX_GHANA = 'OpenAlex (Ghana)';

const URL = 'https://api.openalex.org/works';
const CONTACT = process.env.OPENALEX_EMAIL || 'hello@researchpadi.com';
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
 * Page through works with a Ghana-based author published between the dates
 * (cursor paging, 200 per page), handing each page's rows to `onPage`.
 */
export async function harvestOpenAlexGhana(
  range: { from: string; to?: string },
  maxPages: number,
  onPage: (rows: KnowledgeRow[]) => Promise<number>,
  startCursor = '*',
): Promise<{ fetched: number; added: number; complete: boolean; nextCursor?: string }> {
  let cursor = startCursor;
  let fetched = 0;
  let added = 0;
  for (let page = 0; page < maxPages; page++) {
    const { data } = await axios.get(URL, {
      params: { filter: openAlexGhanaFilter(range.from, range.to), 'per-page': 200, cursor, select: SELECT, mailto: CONTACT },
      timeout: 30_000,
      headers: { 'User-Agent': 'ResearchPadi-Harvester/2.0' },
    });
    const works = (data?.results ?? []) as OpenAlexHarvestWork[];
    fetched += works.length;
    added += await onPage(works.flatMap(openAlexWorkToRows));
    const next = data?.meta?.next_cursor as string | null | undefined;
    if (!next || !works.length) return { fetched, added, complete: true };
    cursor = next;
    await new Promise((r) => setTimeout(r, 200)); // stay well inside OpenAlex's rate limit
  }
  log.info({ ...range, fetched, added, maxPages }, 'OpenAlex harvest stopped at the page limit');
  return { fetched, added, complete: false, nextCursor: cursor };
}
