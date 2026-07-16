/* global caches, fetch, self */

const CACHE_VERSION = 'ktv-picker-app-shell-v1';
const APP_SHELL_URLS = ['/en', '/zh', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
const STATIC_ASSET_URLS = new Set(['/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const {request} = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.method === 'GET' && STATIC_ASSET_URLS.has(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match('/en'));
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put(request, response.clone());
  }

  return response;
}
