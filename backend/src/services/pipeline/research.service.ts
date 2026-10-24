import { searchOpenAlex } from '../citations/openalex.service.js';
import { searchSemanticScholar } from '../citations/semantic.service.js';
import { searchEuropePmc } from '../citations/europepmc.service.js';
import { searchPerplexity } from '../ai/perplexity.service.js';
import { searchKnowledge, type KnowledgeHit } from '../rag/retriever.service.js';
import { cacheGet, CACHE_TTL } from '../../lib/cache.js';
import { sourceKey } from '../citations/source.types.js';
import { knowledgeHitToSource } from '../citations/sources.service.js';
import { dspaceItemToSource, searchGhanaRepositories } from '../rag/dspace.service.js';
import { toPaperSource, type PaperSource } from './paper-source.js';

/** A Ghanaian excerpt for the drafting brief, with the source it came from. */
export interface GhanaExcerpt {
  source: PaperSource;
  excerpt: string;
}

const dedupeKey = (s: PaperSource) => sourceKey({ doi: s.doi, title: s.title });

function hitToExcerpt(hit: KnowledgeHit): GhanaExcerpt {
  return { source: toPaperSource(knowledgeHitToSource(hit)), excerpt: (hit.chunk_text || '').slice(0, 600) };
}

export const performResearch = async (topic: string) => {
  return cacheGet(
    `research4:${topic.toLowerCase().trim().substring(0, 100)}`,
    CACHE_TTL.CITATIONS_EXTERNAL,
    async () => {
      const [ghanaWorks, globalWorks, semanticResults, pubmedGhana, pubmedResults, perplexityData, ragHits, repositoryItems] = await Promise.all([
        searchOpenAlex(topic, { ghanaOnly: true, perPage: 10 }),
        searchOpenAlex(topic, { perPage: 10 }),
        searchSemanticScholar(topic),
        searchEuropePmc(topic, { ghanaOnly: true, limit: 6 }),
        searchEuropePmc(topic, { limit: 10 }),
        searchPerplexity(topic),
        searchKnowledge(topic, { limit: 8 }),
        searchGhanaRepositories(topic, { perRepo: 3 }),
      ]);

      // Knowledge-base excerpts first, then live repository hits with abstracts, without duplicates.
      const ghanaian: GhanaExcerpt[] = ragHits.map(hitToExcerpt);
      const knownUrls = new Set(ragHits.map((r) => r.source_url));
      for (const item of repositoryItems) {
        if (ghanaian.length >= 16) break;
        if (!item.abstract || knownUrls.has(item.url)) continue;
        ghanaian.push({ source: toPaperSource(dspaceItemToSource(item)), excerpt: item.abstract.slice(0, 600) });
      }

      // Ghana-affiliated research first, then global; drop duplicates across APIs.
      const seen = new Set<string>();
      const citations = [...ghanaWorks, ...pubmedGhana, ...globalWorks, ...pubmedResults, ...semanticResults]
        .filter((s) => {
          const key = sourceKey(s);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(toPaperSource);

      return { citations, ghanaian, webData: perplexityData };
    },
  );
};

/**
 * More Ghanaian evidence once the plan names the themes and questions: one
 * knowledge-base search per theme, so each chapter has local sources to draw on.
 */
export async function ghanaEvidenceFor(topic: string, queries: string[], known: PaperSource[], max = 12): Promise<GhanaExcerpt[]> {
  const seen = new Set(known.map(dedupeKey));
  const results = await Promise.all(queries.slice(0, 8).map((q) => searchKnowledge(`${q} ${topic}`, { limit: 3 }).catch(() => [])));
  const extra: GhanaExcerpt[] = [];
  for (const hit of results.flat()) {
    const excerpt = hitToExcerpt(hit);
    const key = dedupeKey(excerpt.source);
    if (seen.has(key)) continue;
    seen.add(key);
    extra.push(excerpt);
    if (extra.length >= max) break;
  }
  return extra;
}
