import axios from 'axios';
import { childLogger } from '../../lib/logger';
import { cacheGet, CACHE_TTL } from '../../lib/cache';

const log = childLogger('perplexity');

export const searchPerplexity = async (topic: string) => {
  if (!process.env.PERPLEXITY_API_KEY) {
    log.debug('Perplexity API Key missing');
    return null;
  }

  return cacheGet(
    `perplexity:${topic.toLowerCase().trim()}`,
    CACHE_TTL.PERPLEXITY,
    async () => {
      try {
        const response = await axios.post(
          'https://api.perplexity.ai/chat/completions',
          {
            model: 'sonar',
            messages: [
              {
                role: 'system',
                content:
                  'You are a research assistant. Provide current facts and data about the given topic.',
              },
              { role: 'user', content: topic },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 30_000,
          },
        );

        return response.data.choices[0].message.content;
      } catch (error: any) {
        log.error({ err: error.message }, 'Perplexity request failed');
        return null;
      }
    },
  );
};
