/* Offline shell. Requests to the AI service are never touched. */
const CACHE = 'tangent-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'engine.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-512.png', 'vendor/math.js', 'vendor/katex/katex.min.js', 'vendor/katex/katex.min.css'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const put = (res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return res; };
  if (url.pathname.includes('/vendor/')) {
    // libraries and fonts never change: cache first
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then(put)));
  } else {
    // app files: newest when online, cached copy when offline
    e.respondWith(fetch(e.request).then(put).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
