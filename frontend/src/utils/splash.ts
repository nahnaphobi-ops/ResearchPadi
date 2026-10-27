// Longest the splash may stay up once the app is ready, counted from page start, so a
// stalled video download never keeps someone out of the app.
const MAX_SPLASH_MS = 8_000;

let dismissing = false;

/**
 * Fade out the intro splash from index.html. Call once the first page has rendered:
 * the splash waits for the logo animation to finish, then hands over to the app.
 */
export function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash || dismissing) return;
  dismissing = true;

  const hide = () => {
    splash.classList.add('splash-out');
    window.setTimeout(() => splash.remove(), 500);
  };

  // public/splash.js marks the intro 'done' when it ends, fails or autoplay is blocked
  if (splash.dataset.state !== 'playing') return hide();

  splash.addEventListener('splashdone', hide, { once: true });
  // The app is ready, so a tap skips the rest of the intro
  splash.addEventListener('click', hide, { once: true });
  window.setTimeout(hide, Math.max(0, MAX_SPLASH_MS - performance.now()));
}

/**
 * Call just before sending the user to a page outside the app that sends them back
 * (Paystack checkout), so the intro doesn't replay when they return mid-task.
 */
export function skipSplashOnReturn() {
  try {
    sessionStorage.setItem('rp-splash-skip', '1');
  } catch {
    // Storage blocked: the intro just plays again on return
  }
}
