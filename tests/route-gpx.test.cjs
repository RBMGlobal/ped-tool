const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../beta/index.html'),'utf8');
const code = html.slice(html.indexOf('async function exportGPX('), html.indexOf('async function exportANPCsv('));
const route = {name:'Walk', waypoints:[{lat:1,lon:2,name:'Entrance'},{lat:3,lon:4}],segments:[[[1,2],[2,2],[3,4]]]};
function setup(selected){
  const files=[];
  const ctx=vm.createContext({Blob,esc:String,slug:String,routes:{a:route,b:{...route,name:'Other'}},
    selection:new Set(selected),anavMarked:()=>[],anavPointsForExport:()=>[],
    toast:()=>{}, fdate:()=> 'test',download:(blob,name)=>files.push({blob,name})});
  vm.runInContext(code,ctx);
  return {run:ctx.exportGPX,files};
}
test('a single GPX export isolates the requested route even with an active selection',async()=>{
  const {run,files}=setup(['marker']);
  await run(route);
  assert.equal(files[0].name,'Walk.gpx');
  const xml=await files[0].blob.text();
  assert.equal(xml.match(/<rte>/g).length,1);
  assert.equal(xml.match(/<trk>/g).length,1);
  assert.match(xml,/<name>Entrance<\/name>/);
  assert.match(xml,/<trkpt lat="2" lon="2">/);
  assert.doesNotMatch(xml,/Other|<wpt /);
});
test('project GPX retains all routes and respects marker selection',async()=>{
  const bulk=setup([]);
  await bulk.run();
  assert.equal((await bulk.files[0].blob.text()).match(/<rte>/g).length,2);
  const selected=setup(['marker']);
  await selected.run();
  assert.equal(selected.files.length,0);
});
