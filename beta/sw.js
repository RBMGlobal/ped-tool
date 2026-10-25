/* PED beta — network-first app shell with an offline fallback.
   CacheStorage is shared by every app on this origin. Only this beta's shell
   belongs to us; other apps, map tiles and user data must remain untouched. */
const CACHE_PREFIX = 'ped-beta-';
const CACHE = CACHE_PREFIX + '9';
const ROOT = new URL('./', self.location.href);
// The directory URL uses index.html's cached copy, avoiding a second 7.7 MB copy.
const SHELL = ['./index.html', './manual.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png',
  './apple-touch-icon.png'].map(path => new URL(path, ROOT).href);
const SHELL_URLS = new Set(SHELL);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => /^ped-beta-\d+$/.test(key) && key !== CACHE)
      .map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== ROOT.origin) return;
  url.search = ''; url.hash = '';
  if (url.pathname === ROOT.pathname) url.pathname += 'index.html';
  if (!SHELL_URLS.has(url.href)) return;

  const cached = () => caches.open(CACHE).then(cache => cache.match(url.href)).catch(() => undefined);
  let cacheWrite = Promise.resolve();
  const response = fetch(req).then(async res => {
    if (res.ok) {
      if (!res.redirected && res.status === 200) {
        const copy = res.clone();
        cacheWrite = caches.open(CACHE).then(cache => cache.put(url.href, copy)).catch(() => {});
      }
      return res;
    }
    // A transient server error must not replace a working offline copy.
    return (await cached()) || res;
  }).catch(async () => (await cached()) || Response.error());
  event.respondWith(response);
  // Keep cache writes alive after the response is delivered. Storage failures
  // must never prevent the online app from opening.
  event.waitUntil(response.then(() => cacheWrite).catch(() => {}));
});
