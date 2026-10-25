const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../beta/index.html'), 'utf8');
const saveCode = html.slice(html.indexOf('const AUTOKEY ='), html.indexOf('// TAK / MIL-STD-2525 affiliation'));
const loadCode = html.slice(html.indexOf('function loadProject(obj){'), html.indexOf('function loadProjectInner('));
const KEY = 'ped.autosave.v1', VIEW = 'ped.view.v1';

function app({ blank = false, failure = '' } = {}) {
  const storage = new Map(), writes = [], attempts = [], warnings = [], timers = new Map();
  const pageEvents = {}, docEvents = {};
  const state = { label: 'original', attachment: 'synthetic attachment bytes' };
  let time = 0, next = 1, failureMode = failure;
  const ctx = {
    document: { visibilityState: 'visible', addEventListener: (name, fn) => { docEvents[name] = fn; } },
    addEventListener: (name, fn) => { pageEvents[name] = fn; },
    setTimeout: (fn, delay) => { const id = next++; timers.set(id, { fn, at: time + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => {
        attempts.push({ key, value });
        if (failureMode === 'all' || (failureMode === 'full' && key === KEY && !JSON.parse(value).lite)) throw new Error('Storage quota');
        storage.set(key, value); writes.push({ key, value });
      },
      removeItem: key => storage.delete(key)
    },
    allMarkers: blank ? [] : [{}], routes: {}, shapes: {}, overlays: {},
    map: { getCenter: () => ({ lat: 0, lng: 0 }), getZoom: () => 5 }, curBase: 'street', hsOn: false,
    serializeProject: opts => ({ label: state.label, lite: opts?.files === false || undefined,
      attachment: opts?.files === false ? undefined : state.attachment }),
    toast: message => warnings.push(message), console: { error: () => {} }
  };
  ctx.window = ctx;
  vm.createContext(ctx); vm.runInContext(saveCode, ctx);
  return {
    ctx, state, storage, writes, attempts, warnings, timers,
    failure: value => { failureMode = value; },
    hide() { ctx.document.visibilityState = 'hidden'; docEvents.visibilitychange(); },
    visible() { ctx.document.visibilityState = 'visible'; docEvents.visibilitychange(); },
    pagehide() { pageEvents.pagehide(); },
    advance(ms) {
      const until = time + ms;
      while (true) {
        const ready = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!ready) break;
        timers.delete(ready[0]); time = ready[1].at; ready[1].fn();
      }
      time = until;
    },
    saved: () => JSON.parse(storage.get(KEY))
  };
}

test('an edit followed immediately by pagehide is saved without waiting 800 ms', () => {
  const a = app(); a.ctx.scheduleAutosave(); a.state.label = 'latest edit'; a.pagehide();
  assert.equal(a.saved().label, 'latest edit');
  assert.equal(a.saved().attachment, 'synthetic attachment bytes');
  assert.equal(a.timers.size, 0);
});

test('hidden visibility flushes content and view exactly once across duplicate lifecycle events', () => {
  const a = app(); a.ctx.scheduleAutosave(); a.ctx.scheduleViewSave();
  a.hide(); a.pagehide(); a.hide(); a.advance(1000);
  assert.deepEqual(a.writes.map(w => w.key), [KEY, VIEW]);
  assert.deepEqual(JSON.parse(a.storage.get(VIEW)).c, [0, 0]);
});

test('visible transitions and unedited pagehide never initiate a save', () => {
  const a = app(); a.pagehide(); assert.equal(a.writes.length, 0);
  a.ctx.scheduleAutosave(); a.visible(); assert.equal(a.writes.length, 0);
  a.advance(799); assert.equal(a.writes.length, 0);
  a.advance(1); assert.equal(a.writes.length, 1);
  a.pagehide(); assert.equal(a.writes.length, 1);
});

test('blank startup never overwrites a previous project or migrates its legacy copy', () => {
  const a = app({ blank: true });
  a.storage.set(KEY, 'previous autosave'); a.storage.set('opipb.autosave.v1', 'legacy');
  a.ctx.scheduleAutosave(); a.hide(); a.pagehide(); a.advance(1000);
  assert.equal(a.storage.get(KEY), 'previous autosave');
  assert.equal(a.storage.get('opipb.autosave.v1'), 'legacy');
  assert.equal(a.writes.length, 0);
});

test('an already armed project still saves an intentional removal of all content', () => {
  const a = app(); a.ctx.scheduleAutosave(); a.advance(800);
  a.ctx.allMarkers.length = 0; a.state.label = 'empty project';
  a.ctx.scheduleAutosave(); a.hide(); assert.equal(a.saved().label, 'empty project');
});

test('debounce writes only the latest edit and clears the completed timer', () => {
  const a = app(); a.ctx.scheduleAutosave(); a.advance(700);
  a.state.label = 'second edit'; a.ctx.scheduleAutosave(); a.advance(100);
  assert.equal(a.writes.length, 0);
  a.advance(700); assert.equal(a.saved().label, 'second edit');
  a.hide(); assert.equal(a.writes.length, 1);
});

test('full quota fallback still saves lite content, warns once and migrates legacy keys only on success', () => {
  const a = app({ failure: 'full' });
  a.storage.set('opipb.autosave.v1', 'old'); a.storage.set('riskmap.autosave.v3', 'older');
  a.ctx.scheduleAutosave(); a.hide();
  assert.equal(a.saved().lite, true); assert.equal(a.saved().attachment, undefined);
  assert.equal(a.warnings.length, 1);
  assert.equal(a.storage.has('opipb.autosave.v1'), false);
  assert.equal(a.storage.has('riskmap.autosave.v3'), false);
  a.ctx.scheduleAutosave(); a.pagehide();
  assert.equal(a.warnings.length, 1); assert.equal(a.attempts.length, 3);
});

test('the eighth lite retry recovers full attachment saving after quota pressure ends', () => {
  const a = app({ failure: 'full' }); a.ctx.scheduleAutosave(); a.hide(); a.failure('');
  for (let i = 1; i <= 8; i++) { a.ctx.scheduleAutosave(); a.pagehide(); }
  assert.equal(a.saved().attachment, 'synthetic attachment bytes');
  assert.equal(a.saved().lite, undefined);
});

test('unavailable storage keeps the last good and legacy copies; duplicate lifecycle events do not retry', () => {
  const a = app({ failure: 'all' });
  a.storage.set(KEY, 'last good'); a.storage.set('opipb.autosave.v1', 'legacy');
  a.ctx.scheduleAutosave(); a.ctx.scheduleViewSave(); a.hide(); a.pagehide();
  assert.equal(a.storage.get(KEY), 'last good');
  assert.equal(a.storage.get('opipb.autosave.v1'), 'legacy');
  assert.equal(a.warnings.length, 1); assert.equal(a.attempts.length, 3);
  assert.equal(a.timers.size, 0);
});

test('import rollback cancels the failed pending write and saves the restored project', () => {
  const a = app();
  a.ctx.loadProjectInner = (obj, rollback) => {
    a.state.label = rollback ? obj.label : 'partial failed import';
    a.ctx.scheduleAutosave(); return !!rollback;
  };
  vm.runInContext(loadCode, a.ctx);
  a.ctx.loadProject({ invalid: true }); a.hide();
  assert.equal(a.saved().label, 'original'); assert.equal(a.writes.length, 1);
  a.advance(1000); assert.equal(a.writes.length, 1);
});

test('cancelled autosave cannot be resurrected by a lifecycle flush after rollback fails', () => {
  const a = app(); a.storage.set(KEY, 'last good');
  a.ctx.loadProjectInner = (obj, rollback) => {
    if (rollback) throw new Error('Rollback unavailable');
    a.ctx.scheduleAutosave(); return false;
  };
  vm.runInContext(loadCode, a.ctx);
  a.ctx.loadProject({ invalid: true }); a.pagehide(); a.advance(1000);
  assert.equal(a.storage.get(KEY), 'last good'); assert.equal(a.writes.length, 0);
});

function popup(dataURL) {
  const code = html.slice(html.indexOf('function popupHTML('), html.indexOf('function wirePopup('));
  const esc = html.split('\n').find(line => line.startsWith('function esc(s)'));
  const pt = { uid: 'audit', name: 'Synthetic', lat: 0, lon: 0, added: true, dms: '0, 0', atts: [{ name: 'test.png', dataURL }] };
  const ctx = { selection: new Set(), AFF_ORDER: [], LAYERS: [], ROLES: { generic: {} },
    affKeyOf: () => '', roleKeyOf: () => 'generic', colorOf: () => '#fff', labelOf: () => '',
    mgrsOf: () => '', cotOf: () => '', roleSelectHTML: () => '', pt, ly: { name: 'Synthetic' } };
  vm.createContext(ctx); vm.runInContext(esc + '\n' + code + ';output = popupHTML(pt, ly);', ctx);
  return { output: ctx.output, attachment: pt.atts[0] };
}

test('imported attachment quotes cannot introduce additional HTML attributes or elements', () => {
  const value = 'data:image/png;base64,AA==" data-audit="injected"><span>test</span>';
  const result = popup(value);
  assert.match(result.output, /src="data:image\/png;base64,AA==&quot; data-audit=&quot;injected&quot;&gt;&lt;span&gt;test&lt;\/span&gt;"/);
  assert.equal(result.output.includes('" data-audit="injected"'), false);
  assert.equal(result.output.includes('<span>test</span>'), false);
  assert.equal(result.attachment.dataURL, value);
});

test('ordinary image attachments retain their exact source URL', () => {
  const value = 'data:image/png;base64,c3ludGhldGlj';
  const result = popup(value);
  assert.ok(result.output.includes('<img src="' + value + '" alt="">'));
  assert.equal(result.attachment.dataURL, value);
});
