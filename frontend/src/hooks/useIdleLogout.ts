import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const CHECK_EVERY_MS = 30 * 1000;
const KEY = 'lastActivity';
const EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

function lastActivity(): number {
  try {
    return Number(localStorage.getItem(KEY)) || Date.now();
  } catch {
    return Date.now();
  }
}

/** Sign the user out after 30 minutes without activity (shared across tabs, survives closed tabs). */
export function useIdleLogout() {
  const signedIn = useAuthStore((state) => !!state.token);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!signedIn) return;

    const expired = () => Date.now() - lastActivity() > IDLE_LIMIT_MS;
    const signOut = () => {
      logout();
      window.location.assign('/login');
    };

    // A stale session left from a previous visit ends immediately.
    if (expired()) {
      signOut();
      return;
    }

    let lastWrite = 0;
    const touch = () => {
      const now = Date.now();
      if (now - lastWrite < 5000) return;
      lastWrite = now;
      try {
        localStorage.setItem(KEY, String(now));
      } catch {
        /* storage unavailable */
      }
    };
    touch();

    const check = () => {
      if (expired()) signOut();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [signedIn, logout]);
}
