import test from 'node:test';
import assert from 'node:assert/strict';
import {blankDocument,validateBatch,renderPoints} from '../../app/model.js';
import {compileCompound} from '../20260909-compound-trial/auto-split.mjs';
import {makeSpec,liftLocations} from './scheme3-input.mjs';
const doc={...blankDocument(600,849),layers:[{id:'ink',visible:true,opacity:1}],stages:[{id:'lineart'}]};
const close=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8;
test('scheme 3 preserves the authored corner vertex and both neighboring directions in both overlapping strokes',()=>{
  const spec=makeSpec(doc),snapshot=structuredClone(spec),source=renderPoints(validateBatch([spec.stroke],doc)[0],doc,2),result=compileCompound(spec,doc);
  assert.equal(result.commands.length,3);assert.deepEqual(spec,snapshot);
  for(const [i,{point}] of liftLocations.entries()){
    const at=source.findIndex(p=>close(p,point));assert(at>0&&at<source.length-1);
    let left=at-1,right=at+1;
    while(left>0&&close(source[left],point))left--;
    while(right<source.length-1&&close(source[right],point))right++;
    for(const c of result.commands.slice(i,i+2)){
      for(const p of [source[left],source[at],source[right]])assert(c.points.some(q=>close(q,p)),'both sides of the corner remain in each overlap');
      const center=c.points.find(p=>close(p,point));assert(Math.abs(center[2]-source[at][2])<1e-8,'handoff keeps full intended pressure');
    }
    assert.equal(result.joins[i].overlapPx,5);
    assert.equal(result.commands[i].points.at(-1)[2],0);
    assert.equal(result.commands[i+1].points[0][2],0);
  }
  const last=result.commands.at(-1).points.at(-1);assert(close(last,[290,644]));assert(Math.abs(last[2]*spec.stroke.width-1.5)<1e-9);
});
