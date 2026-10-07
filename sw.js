// Minimal service worker so Chrome offers "Install app" for the tracker.
// It deliberately caches NOTHING: page loads skip the browser cache entirely
// (GitHub Pages would otherwise let an old version linger for ~10 minutes),
// and Firebase/CDN traffic is never intercepted.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request.url, { cache: 'no-store', credentials: 'same-origin' }).catch(() =>
    new Response('<h3 style="font-family:sans-serif;padding:24px">You\'re offline — reconnect to load the NPD Tracker.</h3>',
      { headers: { 'Content-Type': 'text/html' } })));
});
