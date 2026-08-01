const CACHE = 'tonefinder-v2.30';
const ASSETS = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=DM+Mono:wght@400;500&display=swap'
];

// Install — cache core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', e => {
  // Always go to network for API calls
  if (e.request.url.includes('api.anthropic.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-first for the app shell (the HTML page itself). This is the fix:
  // code changes need to reach users on their very next load, not get stuck
  // behind a stale cache-first hit. Falls back to cache only if offline.
  const isHTML = e.request.mode === 'navigate' ||
    e.request.destination === 'document' ||
    e.request.url.endsWith('/index.html') ||
    e.request.url.endsWith('/');
  if (isHTML) {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets (fonts etc.) — these rarely change and
  // benefit from instant offline-friendly loading.
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(response => {
      if (e.request.method === 'GET' && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
      }
      return response;
    }))
  );
});
