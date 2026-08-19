import { Redis } from 'ioredis';
import { childLogger } from './logger.js';

const log = childLogger('redis');

let redis: Redis | null = null;
let redisSubscriber: Redis | null = null;
let redisTried = false;
let redisSubscriberTried = false;
let bullmqCompatible: boolean | null = null;

const BULLMQ_MIN_MAJOR = 5;

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
 * BullMQ requires Redis 5+. Windows Redis/Memurai 3.x is still usable as a cache,
 * but constructing BullMQ queues against it throws on every reconnect.
 */
export async function redisSupportsBullmq(): Promise<boolean> {
  if (bullmqCompatible !== null) return bullmqCompatible;

  const client = getRedis();
  if (!client) {
    bullmqCompatible = false;
    return false;
  }

  try {
    const info = await client.info('server');
    const match = info.match(/redis_version:(\d+)\.(\d+)/);
    const major = match ? parseInt(match[1], 10) : 0;
    const version = match ? `${match[1]}.${match[2]}` : 'unknown';
    bullmqCompatible = major >= BULLMQ_MIN_MAJOR;
    if (!bullmqCompatible) {
      log.warn(
        { version, required: `${BULLMQ_MIN_MAJOR}+` },
        'Local Redis is too old for BullMQ — paper queue disabled. Supabase is unaffected. Install Redis 7 (or Memurai 4+) to enable workers.'
      );
    } else {
      log.info({ version }, 'Redis version is compatible with BullMQ');
    }
  } catch (err: any) {
    log.warn({ err: err.message }, 'Could not read Redis version — treating as incompatible with BullMQ');
    bullmqCompatible = false;
  }

  return bullmqCompatible;
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
