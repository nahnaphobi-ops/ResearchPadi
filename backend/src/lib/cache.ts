import { getRedis } from './redis.js';
import { childLogger } from './logger.js';

const log = childLogger('cache');

/**
 * Generic Redis cache wrapper.
 * - Miss: runs fn(), stores result in Redis, returns it
 * - Hit: returns cached value directly
 * - TTL: configurable per call (seconds)
 */
export async function cacheGet<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const redis = getRedis();
    const cached = await redis.get(key);
    if (cached) {
      log.debug({ key }, 'Cache hit');
      return JSON.parse(cached) as T;
    }
  } catch (err: any) {
    log.debug({ key, err: err.message }, 'Cache read failed, running function');
  }

  const result = await fn();

  try {
    const redis = getRedis();
    await redis.set(key, JSON.stringify(result), 'EX', ttlSeconds);
    log.debug({ key, ttl: ttlSeconds }, 'Cache stored');
  } catch (err: any) {
    log.debug({ key, err: err.message }, 'Cache write failed');
  }

  return result;
}

/**
 * Invalidate all keys matching a pattern using SCAN (not KEYS).
 * KEYS blocks Redis and is O(N) — SCAN iterates cursor-based without blocking.
 */
export async function cacheInvalidate(pattern: string): Promise<void> {
  try {
    const redis = getRedis();
    let cursor = '0';
    let totalDeleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');

    if (totalDeleted > 0) {
      log.info({ pattern, count: totalDeleted }, 'Cache invalidated');
    }
  } catch (err: any) {
    log.debug({ pattern, err: err.message }, 'Cache invalidate failed');
  }
}

/**
 * Invalidate a specific key.
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(key);
  } catch {
    // ignore
  }
}

/**
 * Multi-get from cache. Returns null for missing keys.
 */
export async function cacheMget<T>(keys: string[]): Promise<(T | null)[]> {
  try {
    const redis = getRedis();
    const values = await redis.mget(...keys);
    return values.map(v => (v ? JSON.parse(v) as T : null));
  } catch {
    return keys.map(() => null);
  }
}

/**
 * Set multiple cache entries at once.
 */
export async function cacheMset(entries: { key: string; value: any; ttl: number }[]): Promise<void> {
  try {
    const redis = getRedis();
    const pipeline = redis.pipeline();
    for (const entry of entries) {
      pipeline.set(entry.key, JSON.stringify(entry.value), 'EX', entry.ttl);
    }
    await pipeline.exec();
  } catch {
    // ignore
  }
}

// --- TTL presets (in seconds) ---
export const CACHE_TTL = {
  CITATIONS_EXTERNAL: 3600,       // 1 hour — external APIs change slowly
  BLUEPRINTS: 86400,              // 24 hours — blueprints rarely change
  RAG_SEARCH: 1800,               // 30 minutes — knowledge base is semi-static
  PAPER_STRUCTURE: 600,           // 10 minutes — per-user, changes often
  OPENALEX: 7200,                 // 2 hours
  SEMANTIC_SCHOLAR: 7200,         // 2 hours
  PERPLEXITY: 1800,               // 30 minutes
  USER_PROFILE: 300,              // 5 minutes
  WALLET_BALANCE: 60,             // 1 minute
  SUBSCRIPTION_STATUS: 120,       // 2 minutes
} as const;
