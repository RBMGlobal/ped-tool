/* Normal PED retired: only beta remains published.
   Keep this URL so installed normal apps can update their old worker.
   Never remove beta caches, shared OCR files, or users' saved data. */
const ROOT = new URL('./', self.location.href);
const BETA = new URL('beta/', ROOT);
const isRetiredShell = name => /^ped-[0-9]/.test(name);
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(isRetiredShell).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  const url = new URL(event.request.url);
  if (url.origin !== ROOT.origin) return;
  const isMain = url.pathname === ROOT.pathname || url.pathname === ROOT.pathname + 'index.html';
  const isManual = url.pathname === ROOT.pathname + 'manual.html';
  if (!isMain && !isManual) return;
  event.respondWith(Response.redirect(new URL(isManual ? 'manual.html' : './', BETA).href, 302));
});
