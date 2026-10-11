import { childLogger } from '../../lib/logger.js';
import { cacheGet, CACHE_TTL } from '../../lib/cache.js';
import { aiCall } from './gateway.service.js';

const log = childLogger('perplexity');

const RESEARCH_INSTRUCTIONS =
  'You are a research assistant for a Ghanaian student. Give current facts, statistics and findings about the topic below, ' +
  'with Ghana-specific data where it exists. Cite sources inline.';

/**
 * Live web research for the paper pipeline (Perplexity via the gateway, so it is
 * logged and costed like every other model call). Returns null when Perplexity is
 * not configured or fails; research then relies on the scholarly sources alone.
 */
export const searchPerplexity = async (topic: string): Promise<string | null> => {
  if (!process.env.PERPLEXITY_API_KEY) {
    log.debug('Perplexity API Key missing');
    return null;
  }

  return cacheGet(
    `perplexity:${topic.toLowerCase().trim()}`,
    CACHE_TTL.PERPLEXITY,
    async () => {
      try {
        const result = await aiCall({
          prompt: topic,
          tier: 'research',
          systemPrompt: RESEARCH_INSTRUCTIONS,
          meta: { action: 'research' },
        });
        const sources = (result.sources ?? [])
          .slice(0, 10)
          .map((s, i) => `[${i + 1}] ${s.title ?? s.url} — ${s.url}`)
          .join('\n');
        return sources ? `${result.text}\n\nWeb sources:\n${sources}` : result.text;
      } catch (error: any) {
        log.error({ err: error.message }, 'Perplexity request failed');
        return null;
      }
    },
  );
};
