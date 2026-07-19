/**
 * Simple in-process token-bucket-ish rate limiter for external API calls.
 * Throttles bursts so we never fire OpenAlex/Semantic Scholar in a tight loop.
 */
import { CONFIG } from '../../../config/index.js';
import { childLogger } from '../../../lib/logger.js';

const log = childLogger('citation-ratelimit');

let tokens = CONFIG.CITATION_VERIFY.EXTERNAL_RATE_LIMIT_MAX;
let lastRefill = Date.now();

function refill() {
  const now = Date.now();
  const windowMs = CONFIG.CITATION_VERIFY.EXTERNAL_RATE_LIMIT_WINDOW;
  const capacity = CONFIG.CITATION_VERIFY.EXTERNAL_RATE_LIMIT_MAX;
  const elapsed = now - lastRefill;
  if (elapsed >= windowMs) {
    tokens = capacity;
    lastRefill = now;
  }
}

/** Wait until a token is available (resolves when we can make a call). */
export async function acquireToken(): Promise<void> {
  refill();
  if (tokens > 0) {
    tokens -= 1;
    return;
  }
  const windowMs = CONFIG.CITATION_VERIFY.EXTERNAL_RATE_LIMIT_WINDOW;
  const wait = windowMs - (Date.now() - lastRefill);
  log.debug({ wait }, 'Rate limit hit, throttling external API call');
  await new Promise(r => setTimeout(r, Math.max(0, wait)));
  return acquireToken();
}
