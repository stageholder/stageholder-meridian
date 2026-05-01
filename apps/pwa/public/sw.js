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

  // Network-first for navigation, fall back to cached shell.
  //
  // `redirect: 'manual'` is required: a navigation request's redirect mode is
  // `manual`, and the spec forbids returning a response that already followed
  // a redirect (`response.redirected === true`) to one of those. With
  // `manual` the SW gets back an `opaqueredirect` response that the browser
  // unpacks at the navigation layer — the user sees the redirect normally
  // and you don't get "a redirected response was used for a request whose
  // redirect mode is not 'follow'" warnings spamming the console.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { redirect: 'manual' }).catch(() =>
        caches.match('/').then((cached) => cached || Response.error())
      )
    );
    return;
  }

  // All other requests — network only
  event.respondWith(fetch(request));
});
