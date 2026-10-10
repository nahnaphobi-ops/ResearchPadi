import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getRedis } from './redis.js';
import { toGhanaMsisdn } from './phone.js';

export const OTP_TTL_MINUTES = 5;
const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;
const memory = new Map<string, { hash: string; expires: number }>();

function otpKey(purpose: string, id: string): string {
  return `otp:${purpose}:${id}`;
}

export function generateNumericOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function storeOtp(purpose: string, id: string, otp: string): Promise<void> {
  const hash = await bcrypt.hash(otp, 10);
  const redis = getRedis();
  const key = otpKey(purpose, id);

  if (redis) {
    await redis.set(key, hash, 'PX', OTP_TTL_MS);
    return;
  }

  memory.set(key, { hash, expires: Date.now() + OTP_TTL_MS });
}

export async function consumeOtp(purpose: string, id: string, otp: string): Promise<boolean> {
  const redis = getRedis();
  const key = otpKey(purpose, id);
  let hash: string | null = null;

  if (redis) {
    hash = await redis.get(key);
  } else {
    const row = memory.get(key);
    if (row && row.expires > Date.now()) hash = row.hash;
  }

  if (!hash) return false;

  const ok = await bcrypt.compare(String(otp), hash);
  if (ok) {
    if (redis) await redis.del(key);
    else memory.delete(key);
  }
  return ok;
}

const cooldowns = new Map<string, number>();

/**
 * Allow one OTP send per id per window. Returns false while the id is cooling down,
 * so a single number can't be flooded with (paid) SMS from rotating IPs.
 */
export async function claimOtpCooldown(purpose: string, id: string, windowMs = 60 * 1000): Promise<boolean> {
  const key = `otp-cooldown:${purpose}:${id}`;
  const redis = getRedis();

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
  const redis = getRedis();
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
