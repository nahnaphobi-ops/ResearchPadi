import axios from 'axios';
import { cacheGet, CACHE_TTL } from '../../lib/cache.js';
import { parseAuthors } from '../../lib/authors.js';
import { childLogger } from '../../lib/logger.js';
import { normaliseDoi, type Source, type SourceType } from './source.types.js';

const log = childLogger('semantic-scholar');

interface S2Paper {
  paperId: string;
  title?: string;
  authors?: { name?: string }[];
  year?: number | null;
  url?: string;
  abstract?: string | null;
  venue?: string | null;
  journal?: { name?: string; volume?: string; pages?: string } | null;
  externalIds?: { DOI?: string } | null;
  publicationTypes?: string[] | null;
  citationCount?: number;
  isOpenAccess?: boolean;
}

function mapType(types: string[] | null | undefined): SourceType {
  if (!types?.length) return 'article';
  if (types.includes('Book')) return 'book';
  if (types.includes('Conference')) return 'conference';
  if (types.includes('Review') || types.includes('JournalArticle')) return 'article';
  return 'article';
}

export async function searchSemanticScholar(query: string, opts: { yearFrom?: number; limit?: number } = {}): Promise<Source[]> {
  const q = query.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!q) return [];
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 20);

  return cacheGet(
    `citations:semantic2:${opts.yearFrom ?? ''}:${limit}:${q.toLowerCase()}`,
    CACHE_TTL.SEMANTIC_SCHOLAR,
    async () => {
      try {
        const { data } = await axios.get('https://api.semanticscholar.org/graph/v1/paper/search', {
          params: {
            query: q,
            limit,
            fields: 'title,authors,year,url,abstract,venue,journal,externalIds,publicationTypes,citationCount,isOpenAccess',
            ...(opts.yearFrom ? { year: `${opts.yearFrom}-` } : {}),
          },
          headers: process.env.SEMANTIC_SCHOLAR_API_KEY ? { 'x-api-key': process.env.SEMANTIC_SCHOLAR_API_KEY } : undefined,
          timeout: 10_000,
        });
        return ((data?.data ?? []) as S2Paper[])
          .filter((p) => p.title)
          .map((p): Source => {
            const doi = normaliseDoi(p.externalIds?.DOI);
            return {
              id: doi ? `doi:${doi}` : `s2:${p.paperId}`,
              title: p.title!.trim(),
              authors: parseAuthors((p.authors ?? []).map((a) => a.name ?? '').filter(Boolean)),
              year: p.year ?? null,
              type: mapType(p.publicationTypes),
              containerTitle: p.journal?.name || p.venue || undefined,
              volume: p.journal?.volume?.trim() || undefined,
              pages: p.journal?.pages?.replace(/\s+/g, '').replace('-', '–') || undefined,
              doi,
              url: doi ? `https://doi.org/${doi}` : p.url,
              origin: 'semantic-scholar',
              ghanaian: false,
              snippet: p.abstract ? p.abstract.slice(0, 600) : undefined,
              citedByCount: p.citationCount,
              openAccess: p.isOpenAccess,
            };
          });
      } catch (err) {
        // The keyless API is heavily rate-limited (429s are common); results from other sources still return.
        log.warn({ err: (err as Error).message }, 'Semantic Scholar search failed');
        return [];
      }
    },
  );
}
