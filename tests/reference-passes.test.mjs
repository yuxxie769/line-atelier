import test from 'node:test';
import assert from 'node:assert/strict';
import {referencePass} from '../app/reference-passes.js';
import {blankDocument,validateBatch} from '../app/model.js';

test('reference passes honor the requested region and produce editable brush paths',()=>{
  const data=new Uint8ClampedArray(64*64*4).fill(255);
  for(let y=16;y<48;y++)for(let x=16;x<48;x++){const i=(y*64+x)*4;data[i]=170;data[i+1]=90;data[i+2]=45;}
  const image={width:64,height:64,data};
  const options={region:[16,16,32,32],spacing:2,stage:'base',layer:'paper'};
  const a=referencePass(image,options).commands;
  assert.ok(a.length>0);assert.ok(a.every(c=>c.type==='stroke'&&c.color==='#aa5a2d'));
  for(const c of a)for(const [x,y] of c.points)assert.ok(x>=16&&x<=48&&y>=16&&y<=48);
  assert.doesNotThrow(()=>validateBatch(a,blankDocument(64,64)));
  assert.throws(()=>referencePass(image,{...options,region:[50,50,32,32]}),/画布内/);
  assert.throws(()=>referencePass(image,{...options,spacing:0}),/spacing/);
  assert.equal(referencePass(image,{...options,region:[0,0,10,10]}).commands.length,0);
  assert.ok(referencePass(image,{...options,region:[0,0,10,10],includePaper:true}).commands.length>0);
});
