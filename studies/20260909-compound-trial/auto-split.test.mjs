import test from 'node:test';
import assert from 'node:assert/strict';
import {blankDocument,validateDocument} from '../../app/model.js';
import {compileCompound} from './auto-split.mjs';
const doc=blankDocument(600,849);
const spec={stroke:{id:'edge',path:'M 10 50 L 210 50',width:3,opacity:1,pressureFloor:0,pressureProfile:[[0,.4],[.5,1],[1,.3]]},breaks:[{at:.5,reason:'turn'}],overlapPx:10};
test('real overlap preserves source positions and full center width; round trip is stable',()=>{
  const before=JSON.stringify(spec),r=compileCompound(spec,doc),a=r.commands[0],b=r.commands[1];
  assert.equal(a.points.at(-1)[0],115);assert.equal(b.points[0][0],105);
  for(const c of r.commands){assert.ok(c.points.every(p=>p[1]===50));assert.equal(c.points.find(p=>p[0]===110)[2],1);}
  assert.equal(a.points.at(-1)[2],0);assert.equal(b.points[0][2],0);
  assert.equal(JSON.stringify(spec),before);
  assert.deepEqual(validateDocument({...doc,commands:r.commands}).commands,r.commands);
});
test('close cuts clamp overlap; invalid requests fail instead of silently changing the curve',()=>{
  const r=compileCompound({...spec,breaks:[{at:.5},{at:.51}]},doc);
  assert.ok(r.joins.every(j=>j.overlapPx<2));
  for(const breaks of [[{at:0}],[{at:1}],[{at:.7},{at:.4}]])assert.throws(()=>compileCompound({...spec,breaks},doc));
  assert.throws(()=>compileCompound({...spec,stroke:{...spec.stroke,opacity:.5}},doc),/不透明/);
});
