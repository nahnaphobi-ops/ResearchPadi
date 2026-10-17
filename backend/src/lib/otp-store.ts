import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getReadyRedis } from './redis.js';
import { toGhanaMsisdn } from './phone.js';

export const OTP_TTL_MINUTES = 5;
const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;
/** Wrong guesses allowed per code before it is thrown away. */
export const MAX_OTP_ATTEMPTS = 5;
const memory = new Map<string, { hash: string; expires: number }>();
const attempts = new Map<string, { count: number; expires: number }>();

export type OtpCheck = 'valid' | 'invalid' | 'locked';

function otpKey(purpose: string, id: string): string {
  return `otp:${purpose}:${id}`;
}

function attemptsKey(purpose: string, id: string): string {
  return `otp-attempts:${purpose}:${id}`;
}

/** Count one verification attempt for this phone (atomic in Redis) and return the running total. */
async function countAttempt(key: string): Promise<number> {
  const redis = getReadyRedis();
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, OTP_TTL_MS);
    return count;
  }
  const now = Date.now();
  const row = attempts.get(key);
  const live = row && row.expires > now;
  const count = live ? row.count + 1 : 1;
  attempts.set(key, { count, expires: live ? row.expires : now + OTP_TTL_MS });
  if (attempts.size > 10_000) {
    for (const [k, v] of attempts) if (v.expires <= now) attempts.delete(k);
  }
  return count;
}

async function clearAttempts(key: string): Promise<void> {
  const redis = getReadyRedis();
  if (redis) await redis.del(key);
  else attempts.delete(key);
}

export function generateNumericOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function storeOtp(purpose: string, id: string, otp: string): Promise<void> {
  const hash = await bcrypt.hash(otp, 10);
  const redis = getReadyRedis();
  const key = otpKey(purpose, id);

  // A new code gets a fresh set of attempts.
  await clearAttempts(attemptsKey(purpose, id));

  if (redis) {
    await redis.set(key, hash, 'PX', OTP_TTL_MS);
    return;
  }

  memory.set(key, { hash, expires: Date.now() + OTP_TTL_MS });
}

/**
 * Check a code. Each attempt is counted per phone before the code is compared,
 * so guesses spread across many IPs (or sent all at once) still stop after
 * MAX_OTP_ATTEMPTS; then the code is deleted and a new one must be requested.
 */
export async function consumeOtp(purpose: string, id: string, otp: string): Promise<OtpCheck> {
  const redis = getReadyRedis();
  const key = otpKey(purpose, id);
  const tries = attemptsKey(purpose, id);
  const attempt = await countAttempt(tries);
  if (attempt > MAX_OTP_ATTEMPTS) return 'locked';

  let hash: string | null = null;

  if (redis) {
    hash = await redis.get(key);
  } else {
    const row = memory.get(key);
    if (row && row.expires > Date.now()) hash = row.hash;
  }

  if (!hash) return 'invalid';

  const ok = await bcrypt.compare(String(otp), hash);
  if (ok || attempt >= MAX_OTP_ATTEMPTS) {
    if (redis) await redis.del(key);
    else memory.delete(key);
  }
  if (ok) {
    await clearAttempts(tries);
    return 'valid';
  }
  return attempt >= MAX_OTP_ATTEMPTS ? 'locked' : 'invalid';
}

const cooldowns = new Map<string, number>();

/**
 * Allow one OTP send per id per window. Returns false while the id is cooling down,
 * so a single number can't be flooded with (paid) SMS from rotating IPs.
 */
export async function claimOtpCooldown(purpose: string, id: string, windowMs = 60 * 1000): Promise<boolean> {
  const key = `otp-cooldown:${purpose}:${id}`;
  const redis = getReadyRedis();

  if (redis) {
    const result = await redis.set(key, '1', 'PX', windowMs, 'NX');
    return result === 'OK';
  }

  const until = cooldowns.get(key);
  if (until && until > Date.now()) return false;
  cooldowns.set(key, Date.now() + windowMs);
  return true;
}

export async function releaseOtpCooldown(purpose: string, id: string): Promise<void> {
  const key = `otp-cooldown:${purpose}:${id}`;
  const redis = getReadyRedis();
  if (redis) await redis.del(key);
  else cooldowns.delete(key);
}

/**
 * Canonical account key for a phone number. Ghanaian numbers in any common
 * format (0244…, 233244…, +233 24 4…) become +233XXXXXXXXX so one person
 * can't end up with several accounts; anything else just loses whitespace.
 */
export function normalizePhone(phone: string): string {
  const msisdn = toGhanaMsisdn(phone);
  if (msisdn) return `+${msisdn}`;
  return String(phone).replace(/\s+/g, '').trim();
}
