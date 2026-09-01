/* PED — offline worker.
   Network-first for our own files, so an update on the server reaches everyone next time they
   open the page with signal; the cached copy answers when there is none. Anything from another
   origin (map tiles, road snapping, elevation) is left alone entirely — those are never cached,
   both to respect the providers' terms and so nobody is looking at stale imagery. */
const CACHE = 'ped-1.20';
const SHELL = ['./', './index.html', './manual.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;   // tiles + services: straight to the network
  e.respondWith(
    fetch(req)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
