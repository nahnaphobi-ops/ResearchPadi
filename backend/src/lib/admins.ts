import { normalizePhone } from './otp-store.js';

/**
 * Admins sign in like everyone else (phone + SMS code). An account is an admin
 * when its phone is listed in ADMIN_PHONES (comma-separated) or ADMIN_PHONE.
 * Read on every call, so removing a number in the host's env revokes access
 * on the next request.
 */
export function adminPhones(): Set<string> {
  const raw = [process.env.ADMIN_PHONES, process.env.ADMIN_PHONE].filter(Boolean).join(',');
  return new Set(
    raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map(normalizePhone),
  );
}

export function isAdminPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return adminPhones().has(normalizePhone(phone));
}
