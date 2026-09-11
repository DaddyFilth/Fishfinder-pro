const CACHE_VERSION = 'fishfinder-pro-v3';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

const isSameOrigin = (url) => url.origin === self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('fishfinder-pro-'))
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (!isSameOrigin(url)) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({
            offline: true,
            error: 'Offline — live fishing data is unavailable.',
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'X-Fishfinder-Offline': 'true',
            },
          },
        ),
      ),
    );

    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();

            void caches.open(RUNTIME_CACHE).then((cache) => {
              void cache.put(request, copy);
            });
          }

          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);

          if (cachedPage) return cachedPage;

          const cachedHome = await caches.match('/');

          if (cachedHome) return cachedHome;

          return caches.match('/offline');
        }),
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((response) => {
          if (!response || !response.ok) return response;

          const copy = response.clone();

          void caches.open(RUNTIME_CACHE).then((cache) => {
            void cache.put(request, copy);
          });

          return response;
        })
        .catch(() => {
          if (request.destination === 'image') {
            return new Response('', {
              status: 504,
              statusText: 'Offline image unavailable',
            });
          }

          return new Response('', {
            status: 503,
            statusText: 'Offline resource unavailable',
          });
        });
    }),
  );
});
