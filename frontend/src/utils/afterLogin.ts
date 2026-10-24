/** Where to go after signing in, e.g. back to a shared document's edit link. */
export const AFTER_LOGIN_KEY = 'rp-after-login';

export function takeAfterLogin(): string | null {
  try {
    const path = sessionStorage.getItem(AFTER_LOGIN_KEY);
    sessionStorage.removeItem(AFTER_LOGIN_KEY);
    return path?.startsWith('/shared/') ? path : null;
  } catch {
    return null;
  }
}
