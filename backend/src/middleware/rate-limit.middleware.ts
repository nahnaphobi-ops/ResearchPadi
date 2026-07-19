import rateLimit from 'express-rate-limit';
import { createRequire } from 'module';
import { getRedis } from '../lib/redis.js';

const _require = createRequire(import.meta.url);

function createRedisStore() {
  try {
    const redisClient = getRedis();
    const { RedisStore } = _require('rate-limit-redis');
    const Store = RedisStore.default || RedisStore;
    return new Store({
      sendCommand: (...args: string[]) => (redisClient.call as (...a: string[]) => Promise<any>)(...args),
      prefix: 'rl:global:',
    });
  } catch {
    // Fallback to memory store if rate-limit-redis is unavailable
    return undefined;
  }
}

export function createGlobalRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.GLOBAL_RATE_LIMIT || '200', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    store: createRedisStore(),
  });
}

export function createAuthRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts, please try again later' },
    store: createRedisStore(),
    keyGenerator: (req) => `auth:${req.ip}`,
  });
}
