import { getReadyRedis } from './redis.js';

/**
 * Per-user counts that reset at midnight GMT (Free autocompletes, coach
 * answers). Redis when it's up, so every instance sees the same count;
 * otherwise this instance's memory.
 */
const today = () => new Date().toISOString().slice(0, 10);
const keyFor = (name: string, userId: string) => `${name}:${userId}:${today()}`;
const memory = new Map<string, number>();

/** How many times this user has done `name` today. */
export async function usedToday(name: string, userId: string): Promise<number> {
  const redis = getReadyRedis();
  if (redis) {
    try {
      return parseInt((await redis.get(keyFor(name, userId))) || '0', 10);
    } catch {
      // fall through to memory
    }
  }
  return memory.get(keyFor(name, userId)) ?? 0;
}

/** Counts one more `name` for this user today; returns the new total. */
export async function countToday(name: string, userId: string): Promise<number> {
  const key = keyFor(name, userId);
  const redis = getReadyRedis();
  if (redis) {
    try {
      const [[, count]] = (await redis.pipeline().incr(key).pexpire(key, 2 * 86_400_000).exec()) as [[unknown, number]];
      return Number(count);
    } catch {
      // fall through to memory
    }
  }
  const next = (memory.get(key) ?? 0) + 1;
  memory.set(key, next);
  if (memory.size > 10_000) {
    const suffix = `:${today()}`;
    for (const k of memory.keys()) if (!k.endsWith(suffix)) memory.delete(k);
  }
  return next;
}
