import { Redis } from 'ioredis';
import { childLogger } from './logger.js';

const log = childLogger('redis');

let redis: Redis | null = null;
let redisSubscriber: Redis | null = null;
let redisTried = false;
let redisSubscriberTried = false;

export function getRedis(): Redis | null {
  if (redis) return redis;
  if (redisTried) return null;

  const url = process.env.REDIS_URL;
  if (!url) {
    redisTried = true;
    return null;
  }

  redisTried = true;

  redis = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectionName: 'researchpadi-main',
    retryStrategy(times: number) {
      if (times > 10) {
        log.error('Redis connection failed after 10 retries');
        redis = null;
        return null;
      }
      return Math.min(times * 200, 5000);
    },
  });

  redis.on('connect', () => log.info('Redis connected'));
  redis.on('error', (err: any) => log.error({ err }, 'Redis error'));
  redis.on('end', () => { redis = null; });

  return redis;
}

/**
 * Get a separate Redis connection for pub/sub or blocking operations.
 * Shares the same connection pool config but is a distinct connection.
 */
export function getRedisSubscriber(): Redis | null {
  if (redisSubscriber) return redisSubscriber;
  if (redisSubscriberTried) return null;

  const url = process.env.REDIS_URL;
  if (!url) {
    redisSubscriberTried = true;
    return null;
  }

  redisSubscriberTried = true;

  redisSubscriber = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectionName: 'researchpadi-subscriber',
    retryStrategy(times: number) {
      if (times > 10) {
        redisSubscriber = null;
        return null;
      }
      return Math.min(times * 200, 5000);
    },
  });

  redisSubscriber.on('end', () => { redisSubscriber = null; });

  return redisSubscriber;
}

/**
 * Get a pipeline for batch operations.
 */
export function redisPipeline() {
  const client = getRedis();
  if (!client) throw new Error('Redis not configured');
  return client.pipeline();
}

export async function closeRedis(): Promise<void> {
  const promises: Promise<any>[] = [];
  if (redis) {
    promises.push(redis.quit());
    redis = null;
  }
  if (redisSubscriber) {
    promises.push(redisSubscriber.quit());
    redisSubscriber = null;
  }
  await Promise.all(promises);
}
