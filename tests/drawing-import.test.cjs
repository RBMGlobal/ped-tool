const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const html = readFileSync(join(__dirname, '../beta/index.html'), 'utf8');
const readEvent = html.slice(html.indexOf('function readCotEvent('), html.indexOf('function tidyRemarks('));
const writeShape = html.slice(html.indexOf('function shapeCot('), html.indexOf('async function exportShapeTAK('));
const points = [[1,2], [2,3], [4,5]];

for (const [label, type, coords, closedFlag, kind] of [
  ['two-point drawing', 'u-d-f', points.slice(0,2), null, 'line'],
  ['open drawing with fill colour', 'u-d-f', points, null, 'line'],
  ['polygon with repeated end', 'u-d-f', [...points, points[0]], null, 'poly'],
  ['explicitly closed polygon', 'u-d-f', points, 'true', 'poly'],
  ['rectangle', 'u-d-r', [...points,[3,1]], null, 'poly']
]) {
  test(label + ' keeps its drawing geometry', () => {
    let shape;
    const ctx = vm.createContext({
      readCotDetail: () => ({vertices:[], links:coords.map(([lat,lon])=>({lat,lon})),fill:-1}),
      byLocal: (_, name) => name === 'polyline' && closedFlag ? [{getAttribute:()=>closedFlag}] : [],
      argbToHex: () => '#aa9900', createShape: value => {shape=value;},
      argbInt:()=>0, esc:String, euid:String
    });
    vm.runInContext(readEvent + writeShape, ctx);
    const counts = {shapes:0};
    assert.equal(ctx.readCotEvent({getAttribute:()=>type}, counts), true);
    assert.equal(counts.shapes, 1);
    assert.equal(shape.kind, kind);
    const xml = ctx.shapeCot({...shape, uid:'example',name:'Drawing'}, {});
    const links = [...xml.matchAll(/<link point="([^"]+)"\/>/g)].map(m=>m[1]);
    const expected = coords.map(point => point.join(','));
    if (kind === 'poly' && expected.at(-1) !== expected[0]) expected.push(expected[0]);
    assert.deepEqual(links, expected);
  });
}
