// Splash intro, loaded by index.html as a plain blocking script so it runs before first paint.
// It lives in its own file because the Content-Security-Policy (vercel.json) blocks inline scripts.
// The intro plays whenever the app is opened: a fresh visit, a refresh, or launching the
// installed app. Moving around inside the app never reloads the page, so it can't replay
// there; the few in-app full page loads (sign-out redirects, coming back from Paystack)
// are skipped too. Reduced-motion users always go straight in.
(function () {
  var splash = document.getElementById('splash');
  if (!splash) return;
  var video = splash.querySelector('video');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || openedFromInsideApp()) { splash.remove(); return; }
  splash.dataset.state = 'playing';
  function done() {
    if (splash.dataset.state === 'done') return;
    splash.dataset.state = 'done';
    splash.dispatchEvent(new Event('splashdone'));
  }
  video.addEventListener('ended', function () {
    splash.classList.add('splash-waiting');
    done();
  });
  video.addEventListener('error', done);
  video.preload = 'auto';
  var playing = video.play();
  // Autoplay can be blocked (e.g. iOS Low Power Mode): don't hold the app back for it
  if (playing && playing.catch) playing.catch(done);

  function openedFromInsideApp() {
    // Back/forward to a page of the app
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav && nav.type === 'back_forward') return true;
    // A refresh is a fresh open (Chrome may report the page itself as its referrer)
    if (nav && nav.type === 'reload') return false;
    // Set by skipSplashOnReturn() (src/utils/splash.ts) before leaving for a flow that comes back, such as Paystack
    try {
      if (sessionStorage.getItem('rp-splash-skip') === '1') {
        sessionStorage.removeItem('rp-splash-skip');
        return true;
      }
    } catch (e) {}
    // A full page load started from one of the app's own pages
    try {
      return !!document.referrer && new URL(document.referrer).origin === location.origin;
    } catch (e) {
      return false;
    }
  }
})();
