import axios from 'axios';
import { cacheGet, CACHE_TTL } from '../../lib/cache';

export const searchSemanticScholar = async (topic: string) => {
  return cacheGet(
    `citations:semantic:${topic.toLowerCase().trim()}`,
    CACHE_TTL.SEMANTIC_SCHOLAR,
    async () => {
      try {
        const response = await axios.get(
          `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(topic)}&limit=10&fields=title,authors,year,url,abstract`
        );
        return response.data.data.map((paper: any) => ({
          title: paper.title,
          authors: paper.authors?.map((a: any) => a.name).join(', '),
          year: paper.year,
          url: paper.url,
          abstract: paper.abstract,
          source: 'Semantic Scholar',
        }));
      } catch (error) {
        return [];
      }
    },
  );
};
