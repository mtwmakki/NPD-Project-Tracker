// Minimal service worker so Chrome offers "Install app" for the tracker.
// It deliberately caches NOTHING: every page load still comes fresh from
// GitHub Pages, and Firebase/CDN traffic is never intercepted.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() =>
    new Response('<h3 style="font-family:sans-serif;padding:24px">You\'re offline — reconnect to load the NPD Tracker.</h3>',
      { headers: { 'Content-Type': 'text/html' } })));
});
