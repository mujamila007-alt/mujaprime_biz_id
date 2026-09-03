// sw.js - MujaPrime network-only safe mode
// Build: 20260603-theme-chat-global-v3

const MUJA_BUILD_VERSION = '20260603-theme-chat-global-v3';

async function clearAllCaches() {
  if (!self.caches) return;
  const names = await caches.keys();
  await Promise.all(names.map(name => caches.delete(name)));
}

self.addEventListener('install', event => {
  // Bersihkan cache lama, tanpa memaksa halaman yang sedang dibuka refresh.
  event.waitUntil(clearAllCaches());
});

self.addEventListener('activate', event => {
  event.waitUntil(clearAllCaches());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'MUJA_CLEAR_CACHE') {
    event.waitUntil(clearAllCaches());
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  event.respondWith(fetch(request, { cache: 'no-store' }).catch(function() {
    return fetch(request);
  }));
});
