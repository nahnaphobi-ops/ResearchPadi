/**
 * How long a sign-in lasts without activity. "Keep me signed in" (the default on
 * phones, which are rarely shared) keeps it for 7 days, as long as the sign-in
 * token itself lives; otherwise a shared computer signs out after 30 minutes.
 * A session from before this setting existed keeps the 30 minutes.
 */
const KEY = 'rp-keep-signed-in';

export const SHORT_IDLE_MS = 30 * 60 * 1000;
export const LONG_IDLE_MS = 7 * 24 * 60 * 60 * 1000;

/** Ticked by default on touch devices. */
export const defaultKeepSignedIn = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)').matches;

export function setKeepSignedIn(keep: boolean) {
  try { localStorage.setItem(KEY, keep ? '1' : '0'); } catch { /* storage unavailable */ }
}

export function clearKeepSignedIn() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

export function idleLimitMs(): number {
  try {
    return localStorage.getItem(KEY) === '1' ? LONG_IDLE_MS : SHORT_IDLE_MS;
  } catch {
    return SHORT_IDLE_MS;
  }
}
