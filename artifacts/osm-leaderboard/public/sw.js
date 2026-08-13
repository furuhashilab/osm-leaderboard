const CACHE_NAME = 'osm-leaderboard-v1';
const STATIC_ASSETS = ['./', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
});

self.addEventListener('fetch', (e) => {
  // Cache-first for static, network-first for API
  if (e.request.url.includes('api.openstreetmap.org') || e.request.url.includes('overpass-api.de')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
