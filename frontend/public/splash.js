// Splash intro, loaded by index.html as a plain blocking script so it runs before first paint.
// It lives in its own file because the Content-Security-Policy (vercel.json) blocks inline scripts.
// The intro plays once per browser session; later loads (refreshes, new links in the
// same tab) and reduced-motion users go straight in.
(function () {
  var splash = document.getElementById('splash');
  if (!splash) return;
  var video = splash.querySelector('video');
  var seen = false;
  try { seen = sessionStorage.getItem('rp-splash-seen') === '1'; } catch (e) {}
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (seen || reduce) { splash.remove(); return; }
  try { sessionStorage.setItem('rp-splash-seen', '1'); } catch (e) {}
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
})();
