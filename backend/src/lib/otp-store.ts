import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getRedis } from './redis.js';

const OTP_TTL_MS = 5 * 60 * 1000;
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

export function normalizePhone(phone: string): string {
  return String(phone).replace(/\s+/g, '').trim();
}
