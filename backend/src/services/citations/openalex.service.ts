import axios from 'axios';
import { cacheGet, CACHE_TTL } from '../../lib/cache';

export const searchOpenAlex = async (topic: string) => {
  return cacheGet(
    `citations:openalex:${topic.toLowerCase().trim()}`,
    CACHE_TTL.OPENALEX,
    async () => {
      try {
        const response = await axios.get(
          `https://api.openalex.org/works?search=${encodeURIComponent(topic)}&limit=10`
        );
        return response.data.results.map((work: any) => ({
          title: work.title,
          authors: work.authorships?.map((a: any) => a.author.display_name).join(', '),
          year: work.publication_year,
          url: work.doi || work.ids?.mag || work.id,
          source: 'OpenAlex',
        }));
      } catch (error) {
        return [];
      }
    },
  );
};
