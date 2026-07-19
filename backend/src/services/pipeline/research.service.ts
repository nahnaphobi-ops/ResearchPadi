import { searchOpenAlex } from '../citations/openalex.service.js';
import { searchSemanticScholar } from '../citations/semantic.service.js';
import { searchPerplexity } from '../ai/perplexity.service.js';
import { retrieveContext } from '../rag/retriever.service.js';
import { cacheGet, CACHE_TTL } from '../../lib/cache.js';

export const performResearch = async (topic: string) => {
  return cacheGet(
    `research:${topic.toLowerCase().trim().substring(0, 100)}`,
    CACHE_TTL.CITATIONS_EXTERNAL,
    async () => {
      const [openAlexResults, semanticResults, perplexityData, ragResults] = await Promise.all([
        searchOpenAlex(topic),
        searchSemanticScholar(topic),
        searchPerplexity(topic),
        retrieveContext(topic),
      ]);

      return {
        citations: [...openAlexResults, ...semanticResults],
        ghanaianSources: ragResults || [],
        webData: perplexityData,
        summary: `Research completed for topic: ${topic}`,
      };
    },
  );
};
