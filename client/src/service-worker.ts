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
    (async (): Promise<Response> => {
      const cachedResponse = await caches.match(event.request);

      if (cachedResponse) {
        // Return cached immediately and fetch in background
        fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && response.type !== 'error') {
              const responseToCache = response.clone();
              caches.open(CACHE).then((c) => c.put(event.request, responseToCache));
            }
          })
          .catch(() => {});

        return cachedResponse;
      }

      // No cache, wait for fetch
      try {
        const response = await fetch(event.request);

        if (response && response.status === 200 && response.type !== 'error') {
          const responseToCache = response.clone();
          caches.open(CACHE).then((c) => c.put(event.request, responseToCache));
        }

        return response;
      } catch {
        // Fallback for HTML requests
        const accept = event.request.headers.get('accept');
        if (accept?.includes('text/html')) {
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
        }

        // Return error response
        return new Response('Network error', { status: 503 });
      }
    })()
  );
});
