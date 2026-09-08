import test from 'node:test';
import assert from 'node:assert/strict';
import {blankDocument,validateDocument,validateBatch,renderPoints} from '../app/model.js';
import {compileCompound,compileContourV1} from '../scripts/drawing/compound-v1.mjs';
import {compileCompound as approvedCompiler} from '../studies/20260909-compound-trial/auto-split.mjs';
import {makeSpec} from '../studies/20260909-local-turn-trial/scheme3-input.mjs';
import {drawings} from '../studies/20260909-compound-v1-three/inputs.mjs';
const doc={...blankDocument(600,849),layers:[{id:'ink',visible:true,opacity:1}],stages:[{id:'lineart'}]};
const close=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8;
test('frozen v1 retains the approved knee output exactly',()=>{
 for(const weighted of [false,true]){const spec=makeSpec(doc,{weighted});assert.deepEqual(compileCompound(spec,doc),approvedCompiler(spec,doc));}
});
for(const plan of drawings)test('v1 '+plan.id+' keeps source vertices, pressure handoff and round-trip',()=>{
 const input={stroke:{id:plan.id,path:plan.path,layer:'ink',stage:'lineart',subphase:'clean',opacity:1,width:plan.width,pressureFloor:0,smoothing:0,pressureProfile:plan.pressureProfile},lifts:plan.lifts,overlapPx:plan.overlapPx};
 const snapshot=structuredClone(input),r=compileContourV1(input,doc),source=renderPoints(validateBatch([input.stroke],doc)[0],doc,2);
 assert.equal(r.commands.length,3);assert.deepEqual(input,snapshot);
 for(const p of source)assert(r.commands.some(c=>c.points.some(q=>close(p,q))));
 for(const [i,lift] of plan.lifts.entries()){
   assert(close(r.joins[i].point,lift.point));
   for(const c of r.commands.slice(i,i+2)){const p=c.points.find(q=>close(q,lift.point)),q=source.find(q=>close(q,lift.point));assert(Math.abs(p[2]-q[2])<1e-8);}
   assert.equal(r.commands[i].points.at(-1)[2],0);assert.equal(r.commands[i+1].points[0][2],0);
 }
 assert.deepEqual(validateDocument({...doc,commands:r.commands}).commands,r.commands);
 assert.throws(()=>compileContourV1({...input,stroke:{...input.stroke,smoothing:.2}},doc),/平滑/);
 assert.throws(()=>compileContourV1({...input,lifts:[{point:[-200,-200],reason:'not a vertex'}]},doc),/顶点/);
 assert.throws(()=>compileContourV1({...input,stroke:{...input.stroke,opacity:.5}},doc),/不透明/);
});
