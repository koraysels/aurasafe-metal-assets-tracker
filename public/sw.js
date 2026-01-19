self.addEventListener('install', (e) => {
  self.skipWaiting();
  const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isDev) return;
  e.waitUntil(
    caches.open('as-v1').then((c) => c.addAll(['/', '/manifest.webmanifest']).catch(() => {})),
  );
});
self.addEventListener('activate', (e) => self.clients.claim());
self.addEventListener('fetch', (e) => {
  const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isDev) {
    e.respondWith(fetch(e.request));
    return;
  }
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).then((resp) => {
        const copy = resp.clone();
        caches.open('as-v1').then((cache) => cache.put(e.request, copy)).catch(() => {});
        return resp;
      }).catch(() => cached || new Response('', { status: 504 }))
    )
  );
});
