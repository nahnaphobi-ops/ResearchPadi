import { Redis } from 'ioredis';
import { childLogger } from './logger';

const log = childLogger('redis');

let redis: Redis | null = null;
let redisSubscriber: Redis | null = null;

export function getRedis(): Redis {
  if (redis) return redis;

  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  redis = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectionName: 'researchpadi-main',
    retryStrategy(times: number) {
      if (times > 10) {
        log.error('Redis connection failed after 10 retries');
        return null;
      }
      return Math.min(times * 200, 5000);
    },
  });

  redis.on('connect', () => log.info('Redis connected'));
  redis.on('error', (err: any) => log.error({ err }, 'Redis error'));

  return redis;
}

/**
 * Get a separate Redis connection for pub/sub or blocking operations.
 * Shares the same connection pool config but is a distinct connection.
 */
export function getRedisSubscriber(): Redis {
  if (redisSubscriber) return redisSubscriber;

  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  redisSubscriber = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectionName: 'researchpadi-subscriber',
    retryStrategy(times: number) {
      if (times > 10) return null;
      return Math.min(times * 200, 5000);
    },
  });

  return redisSubscriber;
}

/**
 * Get a pipeline for batch operations.
 */
export function redisPipeline() {
  const client = getRedis();
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
