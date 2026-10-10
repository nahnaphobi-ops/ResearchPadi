import axios from 'axios';
import { cacheGet, CACHE_TTL } from '../../lib/cache.js';
import { parseAuthors } from '../../lib/authors.js';
import { childLogger } from '../../lib/logger.js';
import { normaliseDoi, type Source, type SourceType } from '../citations/source.types.js';

const log = childLogger('dspace');

/**
 * Ghanaian DSpace 7 repositories with a public discovery API. Searching them live
 * reaches their full collections (tens of thousands of theses and articles), far
 * beyond what has been harvested. `sourceName` matches knowledge_chunks.source_name.
 * Verified 2026-10-10.
 */
export interface DSpaceRepo {
  sourceName: string;
  label: string;
  baseUrl: string;
  institution: string;
}

export const DSPACE_REPOSITORIES: DSpaceRepo[] = [
  { sourceName: 'UGSpace', label: 'UGSpace', baseUrl: 'https://ugspace.ug.edu.gh', institution: 'University of Ghana' },
  { sourceName: 'KNUST', label: 'KNUSTSpace', baseUrl: 'https://ir.knust.edu.gh', institution: 'Kwame Nkrumah University of Science and Technology' },
  { sourceName: 'UCC', label: 'UCC Institutional Repository', baseUrl: 'https://ir.ucc.edu.gh', institution: 'University of Cape Coast' },
  { sourceName: 'Ashesi_AIR', label: 'Ashesi Institutional Repository', baseUrl: 'https://air.ashesi.edu.gh', institution: 'Ashesi University' },
  { sourceName: 'HF_NMTC_Berekum', label: 'Holy Family NMTC Berekum Repository', baseUrl: 'https://ir.nmtcberekum.edu.gh', institution: 'Holy Family Nursing and Midwifery Training College, Berekum' },
];

const UA = 'ResearchPadi/1.0 (+https://researchpadi.com; hello@researchpadi.com)';

type Metadata = Record<string, { value: string }[] | undefined>;

export interface DSpaceItem {
  repo: DSpaceRepo;
  handle: string;
  url: string;
  title: string;
  authorsRaw: string[];
  year: number | null;
  abstract: string;
  type: string;
  description: string;
  publisher: string;
  subjects: string[];
  doi?: string;
  journal?: string;
  accessioned?: string;
  highlight?: string;
}

const first = (md: Metadata, ...keys: string[]) => {
  for (const k of keys) {
    const v = md[k]?.[0]?.value?.trim();
    if (v) return v;
  }
  return '';
};
const all = (md: Metadata, key: string) => (md[key] ?? []).map((m) => m.value?.trim()).filter((v): v is string => !!v);

function stripHighlight(html: string) {
  return html.replace(/<\/?em>/g, '').replace(/\s+/g, ' ').trim();
}

function toItem(repo: DSpaceRepo, obj: { hitHighlights?: Record<string, string[]>; _embedded?: { indexableObject?: { handle?: string; metadata?: Metadata } } }): DSpaceItem | null {
  const it = obj._embedded?.indexableObject;
  const md = it?.metadata;
  if (!it?.handle || !md) return null;
  const title = first(md, 'dc.title').replace(/\s+/g, ' ');
  if (!title) return null;
  const issued = first(md, 'dc.date.issued');
  const yearMatch = issued.match(/\b(19|20)\d{2}\b/);
  const doiValue = first(md, 'dc.identifier.doi') || all(md, 'dc.identifier').find((v) => /10\.\d{4,9}\//.test(v)) || '';
  const hl = obj.hitHighlights?.['dc.description.abstract']?.[0];
  return {
    repo,
    handle: it.handle,
    url: `${repo.baseUrl}/handle/${it.handle}`,
    title,
    authorsRaw: all(md, 'dc.contributor.author').length ? all(md, 'dc.contributor.author') : all(md, 'dc.creator'),
    year: yearMatch ? Number(yearMatch[0]) : null,
    abstract: first(md, 'dc.description.abstract').replace(/\s+/g, ' '),
    type: first(md, 'dc.type'),
    description: first(md, 'dc.description'),
    publisher: first(md, 'dc.publisher'),
    subjects: all(md, 'dc.subject'),
    doi: normaliseDoi(doiValue),
    journal: first(md, 'dc.relation.ispartof', 'dc.source', 'dc.relation.ispartofseries') || undefined,
    accessioned: first(md, 'dc.date.accessioned') || undefined,
    highlight: hl ? stripHighlight(hl) : undefined,
  };
}

/** Degree wording used by APA/Harvard thesis references. */
export function thesisGenre(item: Pick<DSpaceItem, 'description' | 'type' | 'title'>): string {
  const text = `${item.description} ${item.type}`;
  if (/\b(ph\.?\s?d|doctor(al|ate)?|dphil)\b/i.test(text)) return 'Doctoral dissertation';
  if (/\b(m\.?\s?phil|mba|m\.?\s?sc|m\.?\s?a\b|m\.?\s?ed|m\.?\s?com|llm|mph|master'?s?|masters)\b/i.test(text)) return "Master's thesis";
  if (/\b(b\.?\s?sc|b\.?\s?a\b|b\.?\s?ed|bachelor|undergraduate|diploma)\b/i.test(text)) return 'Undergraduate thesis';
  if (/care study/i.test(item.title)) return 'Patient/family care study';
  return 'Thesis';
}

function mapType(item: DSpaceItem): { type: SourceType; genre?: string } {
  const t = item.type.toLowerCase();
  if (t.includes('thesis') || t.includes('dissertation')) return { type: 'thesis', genre: thesisGenre(item) };
  if (t.includes('article')) return { type: 'article' };
  if (t.includes('chapter')) return { type: 'chapter' };
  if (t.includes('book')) return { type: 'book' };
  if (t.includes('report') || /care study/i.test(item.title)) return { type: 'report', genre: /care study/i.test(item.title) ? 'Patient/family care study' : undefined };
  if (t.includes('conference') || t.includes('proceeding')) return { type: 'conference' };
  return item.journal ? { type: 'article' } : { type: 'thesis', genre: thesisGenre(item) };
}

export function dspaceItemToSource(item: DSpaceItem): Source {
  const { type, genre } = mapType(item);
  return {
    id: item.doi ? `doi:${item.doi}` : `kb:${item.url}`,
    title: item.title,
    authors: parseAuthors(item.authorsRaw),
    year: item.year,
    type,
    genre,
    containerTitle: item.journal,
    doi: item.doi,
    url: item.url,
    publisher: type === 'thesis' ? undefined : item.publisher || undefined,
    institution: item.publisher && !/^knust$/i.test(item.publisher) ? item.publisher : item.repo.institution,
    repository: item.repo.label,
    origin: 'ghana-repository',
    ghanaian: true,
    snippet: (item.highlight || item.abstract || '').slice(0, 600) || undefined,
  };
}

/** Full-text search of one repository's discovery index. */
export async function searchRepository(repo: DSpaceRepo, query: string, size = 5): Promise<DSpaceItem[]> {
  const q = query.replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!q) return [];
  return cacheGet(`dspace:${repo.sourceName}:${size}:${q.toLowerCase()}`, CACHE_TTL.RAG_SEARCH, async () => {
    try {
      const { data } = await axios.get(`${repo.baseUrl}/server/api/discover/search/objects`, {
        params: { query: q, dsoType: 'ITEM', size },
        headers: { Accept: 'application/json', 'User-Agent': UA },
        timeout: 9_000,
      });
      const objects = data?._embedded?.searchResult?._embedded?.objects ?? [];
      return (objects as Parameters<typeof toItem>[1][]).map((o) => toItem(repo, o)).filter((i): i is DSpaceItem => !!i);
    } catch (err) {
      log.warn({ repo: repo.sourceName, err: (err as Error).message }, 'Repository search failed');
      return [];
    }
  });
}

/** Search every Ghanaian DSpace repository in parallel, interleaving their best results. */
export async function searchGhanaRepositories(query: string, opts: { perRepo?: number; yearFrom?: number } = {}): Promise<DSpaceItem[]> {
  const perRepo = opts.perRepo ?? 4;
  const results = await Promise.all(DSPACE_REPOSITORIES.map((r) => searchRepository(r, query, perRepo)));
  const interleaved: DSpaceItem[] = [];
  for (let i = 0; i < perRepo; i++) {
    for (const list of results) if (list[i]) interleaved.push(list[i]);
  }
  return interleaved.filter((it) => !opts.yearFrom || (it.year ?? 0) >= opts.yearFrom);
}

/** Newest items first, for harvesting DSpace 7 sites whose OAI index is empty. */
export async function listRecentItems(repo: DSpaceRepo, page: number, size = 100): Promise<{ items: DSpaceItem[]; totalPages: number }> {
  const { data } = await axios.get(`${repo.baseUrl}/server/api/discover/search/objects`, {
    params: { dsoType: 'ITEM', size, page, sort: 'dc.date.accessioned,DESC' },
    headers: { Accept: 'application/json', 'User-Agent': UA },
    timeout: 30_000,
  });
  const sr = data?._embedded?.searchResult;
  const items = ((sr?._embedded?.objects ?? []) as Parameters<typeof toItem>[1][]).map((o) => toItem(repo, o)).filter((i): i is DSpaceItem => !!i);
  return { items, totalPages: sr?.page?.totalPages ?? 0 };
}
