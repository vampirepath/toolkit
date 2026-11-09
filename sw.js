// Gap Cutter service worker.
// The page itself is fetched fresh from the server whenever you're online (so updates show up
// right away) and falls back to the saved copy when you're offline.
// The speech model is cached separately by the speech library ("transformers-cache") and is kept.
const CACHE = 'gap-cutter-v4';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('gap-cutter-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === location.origin;

  // Pages and the app's own files: network first, saved copy when offline.
  if (e.request.mode === 'navigate' || sameOrigin) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Fonts and the speech library code: saved copy first (they never change at a given version).
  if (url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com') || url.host === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      }))
    );
  }
  // Everything else (speech model files) goes straight to the network.
});
