/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />
declare const self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      for (const key of keys) {
        if (key !== CACHE) await caches.delete(key);
      }
      self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Don't cache external requests or API calls
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Clone immediately; cloning later can fail once the browser starts consuming the body.
          const responseToCache = response.clone();
          event.waitUntil(caches.open(CACHE).then((c) => c.put(event.request, responseToCache)));

          return response;
        })
        .catch(() => {
          // Return a fallback for offline navigation
          const accept = event.request.headers.get('accept');
          if (accept?.includes('text/html')) {
            return caches.match('/index.html') as Promise<Response>;
          }
          // Return cached asset or fail gracefully for offline
          return caches.match(event.request) as Promise<Response>;
        });
    })
  );
});
