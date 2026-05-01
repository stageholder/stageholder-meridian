const APP_VERSION = '0.1.0';
const CACHE_NAME = `meridian-${APP_VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-http(s) schemes (chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Don't intercept API calls — Dexie handles offline data
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Don't intercept auth routes — they redirect cross-origin to the Hub,
  // and wrapping those redirects in a service-worker fetch triggers CORS
  // on the SW's cors-mode fetch. Let the browser handle them natively:
  // top-level navigations follow cross-origin redirects without CORS.
  if (
    url.pathname.startsWith('/auth/') ||
    url.pathname === '/goodbye'
  ) {
    return;
  }

  // Cache-first for static assets
  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Don't intercept top-level navigations. The SW's only value here would
  // be an offline shell fallback, but `/` is a route handler that 307s based
  // on session — the cached HTML is a redirect document, not an actual shell.
  // Letting the browser handle navigation natively avoids two whole classes
  // of SW bugs:
  //   - "redirected response used for request whose redirect mode is not
  //     'follow'" (when the proxy 307s an unauthenticated /app)
  //   - "Failed to fetch" with `{ redirect: 'manual' }` on Chrome
  // If a real offline shell is needed later, build one explicitly: precache
  // a static `/offline` route at install time and serve it from a `catch`.
  if (request.mode === 'navigate') {
    return;
  }

  // All other requests — network only.
  event.respondWith(fetch(request));
});
