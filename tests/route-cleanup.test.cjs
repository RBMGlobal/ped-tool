const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../beta/route-cleanup.js'), 'utf8'), context);
const waypoints = [0,1,2,3,4].map(i => ({lat:10 + i, lon:20 + i}));
const segments = waypoints.slice(1).map((p,i) => [[10+i,20+i],[10.4+i,20.6+i],[p.lat,p.lon]]);
const route = {waypoints, segments};

for (const [label, removed, expected] of [
  ['first stop', [0], [[1,2,3,4]]],
  ['last stop', [4], [[0,1,2,3]]],
  ['interior stop', [2], [[0,1],[3,4]]],
  ['adjacent stops', [1,2], [[0],[3,4]]],
  ['isolated stops', [1,3], [[0],[2],[4]]],
  ['all stops', [0,1,2,3,4], []]
]) {
  test('Edited copy preserves exactly the surviving geometry for ' + label, () => {
    const before = JSON.stringify(route);
    const parts = context.retainedRouteSections(route,removed);
    assert.deepEqual(JSON.parse(JSON.stringify(parts.map(s => s.indices))), expected);
    for (const part of parts) {
      assert.equal(part.segments.length, part.indices.length - 1);
      part.segments.forEach((leg,i) => assert.equal(leg,segments[part.indices[i]]));
    }
    assert.equal(JSON.stringify(route), before);
  });
}
