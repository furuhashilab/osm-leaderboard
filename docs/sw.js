const CACHE_NAME = 'osm-leaderboard-v2';
const STATIC_ASSETS = ['./', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Cache-first for static, network-first for API
  if (e.request.url.includes('api.openstreetmap.org') || e.request.url.includes('overpass-api.de')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else if (e.request.mode === 'navigate') {
    // Network-first for page navigations so new deploys are picked up immediately
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
