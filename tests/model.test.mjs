import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {blankDocument,validateBatch,validateDocument,curvePoints,createDemo,planIndex} from '../dist/model.js';

test('batch validation is atomic and rejects unknown or locked layers',()=>{
 const d=blankDocument();const a={points:[[10,20],[30,40]],color:'#277f88'};
 assert.throws(()=>validateBatch([a,{...a,layer:'missing'}],d),/图层不存在/);
 assert.equal(d.commands.length,0);
 d.layers[0].locked=true;assert.throws(()=>validateBatch([a],d),/锁定/);
});
test('malformed input and oversized geometry are rejected before drawing',()=>{
 const d=blankDocument();
 for(const cmd of [{points:[[NaN,0]]},{points:[[9000,0]]},{points:[[0,0,2]]},{points:[[0,0]],color:'url(x)'},{points:[[0,0]],width:0},{type:'fill',points:[[0,0],[1,1]]},{type:'fetch',points:[[0,0]]}])assert.throws(()=>validateBatch([cmd],d));
 assert.throws(()=>validateDocument({...d,width:1}));
 assert.throws(()=>validateDocument({...d,stages:[{id:'a'},{id:'a'}]}));
});
test('curves retain exact endpoints, deterministic sampling, pressure and stages',()=>{
 const pts=curvePoints([[10,20],[30,80],[100,90],[120,10]],40);
 assert.deepEqual(pts[0],[10,20]);assert.deepEqual(pts.at(-1),[120,10]);assert.equal(pts.length,41);
 assert.deepEqual(pts,curvePoints([[10,20],[30,80],[100,90],[120,10]],40));
 const d=blankDocument();const c=validateBatch([{type:'bezier',control:[[0,0],[20,30],[40,0]],steps:12,stage:'detail'}],d)[0];
 assert.equal(c.type,'stroke');assert.equal(c.stage,'detail');assert.equal(c.points.length,13);
});
test('export/import retains complete replayable geometry including locked layers',()=>{
 const d=createDemo();d.layers[0].locked=true;const r=validateDocument(JSON.parse(JSON.stringify(d)));
 assert.equal(r.commands.length,d.commands.length);assert.deepEqual(planIndex(r.commands),planIndex(d.commands));
 r.commands.forEach((c,i)=>assert.deepEqual(c.points,d.commands[i].points));
});
test('existing references cannot be removed by stage or layer reconfiguration',()=>{
 const d=createDemo();assert.throws(()=>validateDocument({...d,stages:[{id:'other',name:'Other'}]}),/阶段不存在/);
 assert.throws(()=>validateDocument({...d,layers:[{id:'other'}]}),/图层不存在/);
});
test('reference reconstruction generates valid strokes that depend on image pixels',async()=>{
 const source=await readFile(new URL('../dist/trace-worker.js',import.meta.url),'utf8');
 function run(pixels){const outputs=[];const self={postMessage:o=>outputs.push(o)};vm.runInNewContext(source,{self,Math,Error});self.onmessage({data:{pixels,width:32,height:40,canvasWidth:800,canvasHeight:1000,detail:2}});return outputs.at(-1);}
 const pixels=new Uint8ClampedArray(32*40*4);for(let y=0;y<40;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;pixels[i]=x<16?30:220;pixels[i+1]=y<20?100:180;pixels[i+2]=120;pixels[i+3]=255;}
 const result=run(pixels);assert.ok(result.done);assert.ok(result.commands.length>0);assert.ok(result.commands.every(c=>c.type==='stroke'));
 const doc=validateDocument({...blankDocument(),stages:result.stages,commands:result.commands});assert.equal(doc.commands.length,result.commands.length);
 const white=new Uint8ClampedArray(pixels.length).fill(255);const blank=run(white);assert.notDeepEqual(result.commands.map(c=>c.color),blank.commands.map(c=>c.color));
 assert.ok(result.stages.every(s=>typeof s.description==='string'));
});
