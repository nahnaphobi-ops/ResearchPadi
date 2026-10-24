import axios from 'axios';
import { cacheGet, CACHE_TTL } from '../../lib/cache.js';
import { parseAuthors } from '../../lib/authors.js';
import { childLogger } from '../../lib/logger.js';
import { normaliseDoi, type Source } from './source.types.js';

const log = childLogger('europepmc');

/**
 * Europe PMC indexes PubMed/MEDLINE: the clinical, nursing and midwifery
 * literature. Free, no key. https://europepmc.org/RestfulWebService
 */
const SEARCH_URL = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

interface EuropePmcRecord {
  id?: string;
  pmid?: string;
  doi?: string;
  title?: string;
  authorString?: string;
  authorList?: { author?: { fullName?: string }[] };
  journalTitle?: string;
  journalInfo?: { volume?: string; issue?: string; journal?: { title?: string } };
  pageInfo?: string;
  pubYear?: string;
  abstractText?: string;
  affiliation?: string;
  isOpenAccess?: string;
  citedByCount?: number;
}

export interface EuropePmcOptions {
  yearFrom?: number;
  limit?: number;
}

/** Europe PMC wraps emphasis in tags and entities; the text itself is what we want. */
const plain = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

/** Query syntax characters become spaces, so a sentence cannot break the search. */
const searchable = (q: string) => q.replace(/[^\p{L}\p{N}\s-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);

export function toSource(r: EuropePmcRecord): Source | null {
  const title = r.title ? plain(r.title).replace(/\.$/, '') : '';
  if (!title) return null;
  const names = (r.authorList?.author ?? []).map((a) => a.fullName || '').filter(Boolean);
  const authors = parseAuthors(names.length ? names : (r.authorString ?? '').replace(/\.$/, '').split(/,\s*/).filter(Boolean));
  const doi = normaliseDoi(r.doi);
  const year = Number(r.pubYear);
  const abstract = r.abstractText ? plain(r.abstractText) : '';

  return {
    id: doi ? `doi:${doi}` : `pmid:${r.pmid ?? r.id}`,
    title,
    authors,
    year: Number.isInteger(year) && year > 0 ? year : null,
    type: 'article',
    containerTitle: r.journalInfo?.journal?.title || r.journalTitle || undefined,
    volume: r.journalInfo?.volume || undefined,
    issue: r.journalInfo?.issue || undefined,
    pages: r.pageInfo ? r.pageInfo.replace(/\s+/g, '').replace('-', '–') : undefined,
    doi,
    url: doi ? `https://doi.org/${doi}` : r.pmid ? `https://europepmc.org/article/MED/${r.pmid}` : undefined,
    origin: 'europe-pmc',
    ghanaian: /\bGhana\b/i.test(r.affiliation ?? ''),
    snippet: abstract ? abstract.slice(0, 600) : undefined,
    citedByCount: r.citedByCount,
    openAccess: r.isOpenAccess === 'Y',
  };
}

/** PubMed records matching a query. An unreachable service gives no results, never an error. */
export async function searchEuropePmc(query: string, opts: EuropePmcOptions = {}): Promise<Source[]> {
  const q = searchable(query);
  if (!q) return [];
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 25);
  const filters = ['SRC:MED', ...(opts.yearFrom ? [`PUB_YEAR:[${opts.yearFrom} TO 3000]`] : [])];

  // A failed search is not cached, so one slow moment does not hide PubMed for hours.
  try {
    return await cacheGet(
      `citations:europepmc:${opts.yearFrom ?? ''}:${limit}:${q.toLowerCase()}`,
      CACHE_TTL.OPENALEX,
      async () => {
        const { data } = await axios.get(SEARCH_URL, {
          params: { query: `${q} AND ${filters.join(' AND ')}`, format: 'json', resultType: 'core', pageSize: limit },
          timeout: 12_000,
        });
        return ((data?.resultList?.result ?? []) as EuropePmcRecord[]).map(toSource).filter((s): s is Source => !!s);
      },
    );
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'Europe PMC search failed');
    return [];
  }
}
