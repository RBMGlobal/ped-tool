const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const html = readFileSync(join(__dirname, '../beta/index.html'), 'utf8');
const source = html.slice(html.indexOf('function linePlacemark('), html.indexOf('function addLineExportButtons('));
function exporter(){
  const files = [], warnings = [];
  const ctx = vm.createContext({Blob, esc:String, slug:String, kmlColor:()=> 'ff000000',
    toast:message=>warnings.push(message), download:(blob,name)=>files.push({blob,name})});
  vm.runInContext(source, ctx);
  return {exportLine:ctx.exportDrawingLine, files, warnings};
}
const line = {kind:'line',name:'Walk',latlngs:[{lat:1.00001,lon:-2},{lat:-3,lon:4},{lat:5,lon:-6}]};
test('single drawing exports preserve coordinate order and original endpoints', async () => {
  const {exportLine, files} = exporter();
  exportLine(line,'kml'); exportLine(line,'gpx');
  assert.deepEqual(files.map(f=>f.name), ['Walk.kml','Walk.gpx']);
  assert.match(await files[0].blob.text(), /<coordinates>-2,1\.00001,0 4,-3,0 -6,5,0<\/coordinates>/);
  const gpx = await files[1].blob.text();
  const points = Array.from(gpx.matchAll(/<trkpt lat="([^"]+)" lon="([^"]+)"\/>/g), m=>[+m[1],+m[2]]);
  assert.deepEqual(points, line.latlngs.map(p=>[p.lat,p.lon]));
});
test('incomplete geometry never results in a partial line download', () => {
  const {exportLine, files, warnings} = exporter();
  exportLine({...line,latlngs:[...line.latlngs,null]},'gpx');
  assert.equal(files.length,0); assert.equal(warnings.length,1);
});
