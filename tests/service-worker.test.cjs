const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ROOT = 'https://rbmglobal.co.uk/ped-tool/beta/';
const CURRENT = 'ped-beta-10';
const script = fs.readFileSync(path.join(__dirname, '../beta/sw.js'), 'utf8');

function worker({ failStorage = false } = {}) {
  const listeners = {}, stores = new Map(), deleted = [], installed = [];
  let network = async () => new Response('online');
  let skipped = false, claimed = false;
  const key = request => typeof request === 'string' ? request : request.url;
  const storage = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => { deleted.push(name); return stores.delete(name); },
    open: async name => {
      if (failStorage) throw new Error('Storage unavailable');
      const data = storage(name);
      return {
        addAll: async urls => { installed.push(...urls); urls.forEach(url => data.set(url, new Response('installed'))); },
        match: async request => data.get(key(request))?.clone(),
        put: async (request, response) => { data.set(key(request), response.clone()); }
      };
    }
  };
  vm.runInNewContext(script, {
    self: {
      location: new URL('sw.js', ROOT),
      addEventListener: (name, handler) => { listeners[name] = handler; },
      skipWaiting: async () => { skipped = true; },
      clients: { claim: async () => { claimed = true; } }
    },
    caches, URL, Set, Response, fetch: request => network(request)
  });
  return {
    stores, deleted, installed,
    get skipped() { return skipped; }, get claimed() { return claimed; },
    network(fn) { network = fn; },
    seed(name, url, body) { storage(name).set(url, new Response(body)); },
    async event(name, request) {
      const pending = []; let response;
      listeners[name]({ request, respondWith: promise => { response = promise; }, waitUntil: promise => pending.push(promise) });
      const result = response ? await response : null;
      await Promise.all(pending);
      return result;
    }
  };
}

test('installation caches the complete shell with one copy of the large app', async () => {
  const app = worker();
  await app.event('install');
  assert.equal(app.installed.length, 8);
  assert.equal(app.installed.filter(url => /index\.html$/.test(url)).length, 1);
  assert.equal(app.installed.includes(ROOT), false);
  for (const url of app.installed) assert.ok(fs.existsSync(path.join(__dirname, '../beta', new URL(url).pathname.split('/').pop())));
  assert.equal(app.skipped, true);
});

test('activation removes old PED beta shell only, preserving every unrelated cache', async () => {
  const app = worker();
  const names = ['ped-beta-7', 'ped-beta-8', CURRENT, 'ped-8', 'lz-beta-8', 'tesseract-cache', 'events-shell', 'ped-beta-project-data'];
  names.forEach(name => app.seed(name, ROOT, name));
  await app.event('activate');
  assert.deepEqual(app.deleted, ['ped-beta-7', 'ped-beta-8']);
  assert.deepEqual([...app.stores.keys()], names.slice(2));
  assert.equal(app.claimed, true);
});

test('other app pages, tiles, non-shell files, POST and Range requests bypass this worker', async () => {
  const app = worker();
  app.network(() => { throw new Error('Must bypass'); });
  const requests = [
    new Request('https://rbmglobal.co.uk/lz-tool/beta/'),
    new Request('https://rbmglobal.co.uk/sentiment/data.json'),
    new Request('https://tiles.example.org/1/2/3.png'),
    new Request(ROOT + 'project.json'),
    new Request(ROOT + 'index.html', { method: 'POST', body: 'x' }),
    new Request(ROOT + 'index.html', { headers: { Range: 'bytes=0-10' } })
  ];
  for (const request of requests) assert.equal(await app.event('fetch', request), null);
});

test('successful requests refresh the cached shell before lifetime work finishes', async () => {
  const app = worker();
  app.seed(CURRENT, ROOT + 'index.html', 'old');
  app.network(async () => new Response('new'));
  const response = await app.event('fetch', new Request(ROOT));
  assert.equal(await response.text(), 'new');
  assert.equal(await app.stores.get(CURRENT).get(ROOT + 'index.html').text(), 'new');
  assert.equal(app.stores.get(CURRENT).has(ROOT), false);
});

test('directory and query URLs use the same current-cache offline app', async () => {
  const app = worker();
  app.seed(CURRENT, ROOT + 'index.html', 'good');
  app.seed('another-app', ROOT + 'index.html', 'wrong');
  app.network(async () => { throw new Error('Offline'); });
  for (const url of [ROOT, ROOT + '?launch=homescreen', ROOT + 'index.html?rev=2']) {
    assert.equal(await (await app.event('fetch', new Request(url))).text(), 'good');
  }
  assert.equal(app.stores.get(CURRENT).size, 1);
});

test('HTTP errors preserve and serve the last good cached file', async () => {
  const app = worker();
  app.seed(CURRENT, ROOT + 'index.html', 'good');
  for (const status of [404, 429, 500, 503]) {
    app.network(async () => new Response('error page', { status }));
    assert.equal(await (await app.event('fetch', new Request(ROOT))).text(), 'good');
    assert.equal(await app.stores.get(CURRENT).get(ROOT + 'index.html').clone().text(), 'good');
  }
});

test('without a cached file the original HTTP error remains visible', async () => {
  const app = worker();
  app.network(async () => new Response('missing', { status: 404 }));
  const response = await app.event('fetch', new Request(ROOT + 'manual.html'));
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'missing');
  assert.equal(app.stores.get(CURRENT).size, 0);
});

test('missing assets and manual never receive index HTML as offline fallback', async () => {
  const app = worker();
  app.seed(CURRENT, ROOT + 'index.html', '<html>app</html>');
  app.network(async () => { throw new Error('Offline'); });
  for (const name of ['icon-192.png', 'manual.html', 'manifest.webmanifest']) {
    const response = await app.event('fetch', new Request(ROOT + name));
    assert.equal(response.type, 'error');
    assert.equal(response.status, 0);
  }
});

test('storage failure does not break an online response', async () => {
  const app = worker({ failStorage: true });
  assert.equal(await (await app.event('fetch', new Request(ROOT))).text(), 'online');
});

test('redirected HTML is never installed over the working shell', async () => {
  const app = worker();
  app.seed(CURRENT, ROOT + 'index.html', 'good');
  app.network(async () => {
    const response = new Response('redirect target');
    Object.defineProperty(response, 'redirected', { value: true });
    return response;
  });
  assert.equal(await (await app.event('fetch', new Request(ROOT))).text(), 'redirect target');
  assert.equal(await app.stores.get(CURRENT).get(ROOT + 'index.html').text(), 'good');
});

test('retired root redirects navigation and protects beta caches', async () => {
  const script = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
  const listeners = {}, deleted = [];
  vm.runInNewContext(script, {
    self: {
      location: new URL('../sw.js', ROOT),
      addEventListener: (name, handler) => { listeners[name] = handler; },
      clients: { claim: async () => {} }, skipWaiting: async () => {}
    },
    caches: {
      keys: async () => ['ped-8', 'ped-beta-8', CURRENT, 'lz-beta-3'],
      delete: async name => { deleted.push(name); }
    }, URL, Response
  });
  let activation;
  listeners.activate({ waitUntil: promise => { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, ['ped-8']);
  for (const [url, target] of [
    ['https://rbmglobal.co.uk/ped-tool/', ROOT],
    ['https://rbmglobal.co.uk/ped-tool/index.html', ROOT],
    ['https://rbmglobal.co.uk/ped-tool/manual.html', ROOT + 'manual.html'],
    [ROOT, null]
  ]) {
    let response;
    listeners.fetch({ request: { method: 'GET', mode: 'navigate', url }, respondWith: value => { response = value; } });
    if (target) { assert.equal(response.status, 302); assert.equal(response.headers.get('location'), target); }
    else assert.equal(response, undefined);
  }
});
