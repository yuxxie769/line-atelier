import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {smoothStrokePoints} from '../dist/smoothing.js';
import {blankDocument,validateDocument,renderPoints} from '../dist/model.js';
import {PaintEngine} from '../dist/engine.js';
import {renderRegion} from '../dist/renderer.js';
const drawing=commands=>validateDocument({...blankDocument(),commands});
test('reduces small waviness, bounds displacement and keeps endpoint pressures',()=>{
  const ps=Array.from({length:301},(_,x)=>[x,50+2*Math.sin(x/7),x/300]);
  const out=smoothStrokePoints(ps,1);
  assert.deepEqual(out[0],ps[0]);assert.deepEqual(out.at(-1),ps.at(-1));
  const mid=out.filter(p=>p[0]>65&&p[0]<235);
  const rms=Math.sqrt(mid.reduce((n,p)=>n+(p[1]-50)**2,0)/mid.length);
  assert.ok(rms<1.2,`residual amplitude ${rms}`);
  for(const p of out){const s=p[2]*300,lo=Math.floor(s),t=s-lo,a=ps[lo],b=ps[Math.min(300,lo+1)];assert.ok(Math.hypot(p[0]-s,p[1]-(a[1]*(1-t)+b[1]*t))<=3.1);}
});
test('local-space shared anchors, corners, closed seam and trimmed endpoints remain fixed',()=>{
  const d=blankDocument();d.scene={objects:[{id:'hair',frame:[100,100,200,200]}],anchors:[{id:'joint',objectId:'hair',point:[.5,.5]}]};
  d.commands=[{id:'a',space:'hair',through:[[0,0],[.2,.3],{anchor:'joint'},[.8,.2],[1,1]],corners:[3],smoothing:1}];
  const c=validateDocument(d).commands[0];for(const p of [[100,100],[200,200],[260,140],[300,300]])assert.ok(c.points.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<1e-8));
  const closed=drawing([{id:'loop',through:[[10,10],[90,10],[90,90],[10,90]],closed:true,corners:[0,1,2,3],smoothing:1}]).commands[0];assert.deepEqual(closed.points[0].slice(0,2),closed.points.at(-1).slice(0,2));
  const g={kind:'through',through:[[10,80],[50,30],[100,50],[160,20]],trim:[.2,.8]};
  const original=drawing([{id:'trim',geometry:g}]).commands[0],trim=drawing([{id:'trim',geometry:g,smoothing:1}]).commands[0];assert.deepEqual(trim.points[0],original.points[0]);assert.deepEqual(trim.points.at(-1),original.points.at(-1));
});
test('retained source survives save/load, repeated settings, zero restore and export rendering',()=>{
  for(const raw of [{through:[[10,80,.2],[50,40,.8],[90,50,.5],[150,25,.1]]},{points:[[10,10,.2],[40,42,.8],[80,55,.2]],taper:[.1,.9,.2]},{path:'M10 80 C40 10 90 110 150 20'}]){
    const base=drawing([{id:'a',...raw}]),sm=drawing([{id:'a',...raw,smoothing:.7}]);
    assert.deepEqual(validateDocument(sm),sm);assert.deepEqual(renderPoints(sm.commands[0],sm),sm.commands[0].points);
    const restored=drawing([{...sm.commands[0],smoothing:0}]);assert.deepEqual(restored.commands[0].points,base.commands[0].points);
    const higher=renderPoints(sm.commands[0],sm,2);assert.deepEqual(higher[0],sm.commands[0].points[0]);assert.deepEqual(higher.at(-1),sm.commands[0].points.at(-1));
  }
  for(const smoothing of [-1,2,NaN,'0.5'])assert.throws(()=>drawing([{id:'bad',points:[[1,1],[10,10]],smoothing}]));
  assert.throws(()=>drawing([{id:'fill',type:'fill',points:[[0,0],[10,0],[10,10]],smoothing:.5}]));
});
test('R3 clean strokes can be smoothed without editing their retained source or point overflow',async()=>{
  const d=JSON.parse(await readFile(new URL('../dist/line-atelier-v4-r3.line.json',import.meta.url)));d.checkpoints=[];
  const before=validateDocument(d),after=validateDocument({...d,commands:d.commands.map(c=>c.subphase==='clean'&&c.type==='stroke'?{...c,smoothing:.5}:c)});
  for(let i=0;i<before.commands.length;i++){const a=before.commands[i],b=after.commands[i];assert.deepEqual(b.geometry,a.geometry);assert.deepEqual(b.points[0],a.points[0]);assert.deepEqual(b.points.at(-1),a.points.at(-1));assert.ok(b.points.length<=4096);}
});
let native;try{native=createRequire(import.meta.url)('@napi-rs/canvas');}catch{if(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)native=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json')('@napi-rs/canvas');}
test('real canvas edit is atomic, undoable, invalidates review and replays identically',{skip:!native},async()=>{
  globalThis.document={createElement:()=>native.createCanvas(1,1)};globalThis.Path2D=native.Path2D;globalThis.cancelAnimationFrame=()=>{};globalThis.requestAnimationFrame=()=>1;
  const e=new PaintEngine(native.createCanvas(1,1),{...blankDocument(300,200),stages:[{id:'lineart',name:'线稿'}],commands:[{id:'a',through:[[20,100],[60,40],[110,70],[160,30],[220,100]],width:4}]});e.finish();
  e.recordReview({scope:'global',note:'检查修改后复核失效'});const old=JSON.stringify(e.doc),original=e.canvas.toBuffer('image/png');
  assert.throws(()=>e.smoothStrokes({ids:['a','missing']}));assert.deepEqual(e.doc,JSON.parse(old));
  e.smoothStrokes({ids:['a'],smoothing:.8});assert.equal(e.doc.reviews[0].stale,true);const now=e.canvas.toBuffer('image/png');assert.notDeepEqual(now,original);
  const rev=e.doc.revision;e.smoothStrokes({ids:['a'],smoothing:.8});assert.equal(e.doc.revision,rev);
  e.seek(0);e.finish();assert.deepEqual(e.canvas.toBuffer('image/png'),now);
  assert.ok(renderRegion(e,{region:[0,0,300,200],scale:2}).toBuffer('image/png').length>1000);
  e.undo();assert.deepEqual(e.doc,JSON.parse(old));assert.deepEqual(e.canvas.toBuffer('image/png'),original);
  e.redo();assert.deepEqual(e.canvas.toBuffer('image/png'),now);e.smoothStrokes({ids:['a'],smoothing:0});assert.deepEqual(e.canvas.toBuffer('image/png'),original);
  e.doc.layers[0].locked=true;assert.throws(()=>e.smoothStrokes({ids:['a'],smoothing:1}));
});
