import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PaintEngine} from '../app/engine.js';
import {blankDocument} from '../app/model.js';
import {renderLineMask} from '../app/renderer.js';
import {floodLineRegion,scanLineGaps} from '../app/diagnostics.js';
let native;try{native=createRequire(import.meta.url)('@napi-rs/canvas');}catch{if(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)native=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json')('@napi-rs/canvas');}
if(native){globalThis.document={createElement:()=>native.createCanvas(1,1)};globalThis.Path2D=native.Path2D;globalThis.cancelAnimationFrame=()=>{};globalThis.requestAnimationFrame=()=>1;}
const testRaster=(name,fn)=>test(name,{skip:!native},fn);
function make(commands,extra={}){return new PaintEngine(native.createCanvas(100,100),{...blankDocument(100,100),commands:commands.map(c=>({subphase:'clean',width:2,...c})),...extra});}
const loop={id:'outline',points:[[20,20],[80,20],[80,80],[20,80]],closed:true};
const probe=m=>floodLineRegion({...m,seed:[Math.floor(50*m.scaleX),Math.floor(50*m.scaleY)]});
testRaster('rendered closed ink encloses; erasing a hole leaks; checks never alter drawing or playback',()=>{
 const e=make([loop]),before=JSON.stringify(e.doc),cursor=e.cursor,history=e.undoStack.length,pixels=e.canvas.toBuffer('image/png');
 assert.equal(probe(renderLineMask(e)).status,'enclosed');assert.equal(JSON.stringify(e.doc),before);assert.equal(e.cursor,cursor);assert.equal(e.undoStack.length,history);assert.deepEqual(e.canvas.toBuffer('image/png'),pixels);
 e.doc.commands.push({...e.doc.commands[0],id:'erase',closed:false,type:'erase',width:10,points:[[47,20],[53,20]]});e.load(e.doc);assert.equal(probe(renderLineMask(e)).status,'open');
});
testRaster('invisible scene boundaries and color fills cannot make an open line pass the leakage check',()=>{
 const d={scene:{objects:[{id:'box',frame:[20,20,60,60]}],regions:[{id:'secret',objectId:'box',through:[[20,20],[80,20],[80,80],[20,80]],corners:[0,1,2,3]}]}};
 const e=make([{id:'color',type:'fill',points:[[20,20],[80,20],[80,80],[20,80]]},{id:'open',points:[[20,20],[80,20],[80,80]]}],d);assert.equal(probe(renderLineMask(e)).status,'open');
});
testRaster('layer hide and opacity are honored; fully clipped ink cannot enclose',()=>{
 const e=make([loop]);e.setLayers([{id:'paper',visible:false}]);assert.equal(probe(renderLineMask(e)).status,'open');e.setLayers([{id:'paper',visible:true,opacity:.01}]);assert.equal(probe(renderLineMask(e)).status,'open');
 const clipped=make([{id:'base',layer:'base',type:'fill',points:[[0,0],[100,0],[100,40],[0,40]]},{...loop,layer:'ink'}],{layers:[{id:'base',name:'base'},{id:'ink',name:'ink',clipTo:'base'}]});assert.equal(probe(renderLineMask(clipped)).status,'open');
});
testRaster('a fully occluded outline does not form an invisible closure',()=>{
 const e=make([{...loop,objectId:'back'}],{scene:{objects:[{id:'back',frame:[0,0,100,100]},{id:'front',frame:[0,0,100,100]}],regions:[{id:'cover',objectId:'front',through:[[0,0],[100,0],[100,100],[0,100]],corners:[0,1,2,3]}],occlusions:[{id:'hide',regionId:'cover',back:'back'}]}});assert.equal(probe(renderLineMask(e)).status,'open');
});
testRaster('pressure edit is atomic, undoable, and export/high-resolution rendering actually change width',()=>{
 const e=make([{id:'line',points:[[10,50],[90,50]],width:10}]),source=structuredClone(e.doc.commands[0]),before=e.canvas.toBuffer('image/png');
 e.recordReview({note:'prior local observation',ids:['line'],status:'pass'});
 e.editPressure({ids:['line'],pressureFloor:0,pressureCurve:[[0,0],[1,1]],pressureProfile:[[0,.1],[.5,1],[1,.1]],note:'light endpoints heavy middle'});
 assert.equal(e.doc.reviews[0].stale,true);assert.notDeepEqual(e.canvas.toBuffer('image/png'),before);
 const m=renderLineMask(e,{scale:1});assert.ok(m.alpha[54*100+50]>0);assert.equal(m.alpha[54*100+15],0);
 const doc=JSON.stringify(e.doc);assert.throws(()=>e.editPressure({ids:['line','missing'],width:4,note:'reject'}));assert.equal(JSON.stringify(e.doc),doc);
 e.undo();assert.deepEqual(e.doc.commands[0],source);e.redo();const edited=e.canvas.toBuffer('image/png');e.seek(0);e.finish();assert.deepEqual(e.canvas.toBuffer('image/png'),edited);
});
testRaster('local width edits preserve outer widths, geometry and cached unrelated layer',()=>{
 const e=make([{id:'line',layer:'a',points:[[10,50],[90,50]],width:4},{id:'other',layer:'b',points:[[10,10],[90,10]]}],{layers:[{id:'a',name:'a'},{id:'b',name:'b'}]}),cached=e.surfaces.get('b');
 e.editPressure({ids:['line'],range:[.3,.7],factor:2,feather:.05,note:'weight center'});assert.equal(e.surfaces.get('b'),cached);assert.deepEqual(e.doc.commands[0].geometry.points,[[10,50],[90,50]]);
 const m=renderLineMask(e,{scale:1});assert.equal(m.alpha[53*100+15],0);assert.ok(m.alpha[53*100+50]>0);
});

testRaster('new canvases are larger, while legacy study coordinates and high-resolution exports stay independent',()=>{
 const d=blankDocument();assert.deepEqual([d.width,d.height],[1200,1600]);const e=make([loop]);const before=JSON.stringify(e.doc);const image=e.snapshotRegion({region:[0,0,100,100],scale:3});assert.deepEqual([image.width,image.height],[300,300]);assert.equal(JSON.stringify(e.doc),before);
});

testRaster('diagnostic UI tools return reports and annotated crops, and invalidate on edits without changing artwork',async()=>{
 const {createDrawingAssist}=await import('../app/drawing-assist.js');
 const oldDocument=globalThis.document;
 class Field extends EventTarget {constructor(){super();this.value='';this.checked=false;this.hidden=false;this.children=[];}replaceChildren(...items){this.children=items;this.value=items.some(x=>x.value===this.value)?this.value:items[0]?.value||'';}setAttribute(){}getBoundingClientRect(){return {width:100};}}
 const fields=new Map();for(const id of ['diagnostic-overlay','pressure-preview']){const c=native.createCanvas(100,id==='pressure-preview'?75:100);c.getBoundingClientRect=()=>({width:100});fields.set(id,c);}
 const get=id=>{if(!fields.has(id))fields.set(id,new Field());return fields.get(id);};
 Object.entries({'pressure-response':'linear','pressure-min':'5','pressure-profile-json':'[[0,0.1],[0.5,1],[1,0]]','pressure-response-json':'[[0,0],[1,1]]','audit-phase':'clean','leak-threshold':'24'}).forEach(([id,value])=>get(id).value=value);
 globalThis.document={createElement:tag=>tag==='canvas'?native.createCanvas(1,1):new Field(),getElementById:get};globalThis.Option=class{constructor(text,value){this.text=text;this.value=value;}};globalThis.ResizeObserver=class{observe(){}};
 try{const e=make([loop]),before=JSON.stringify(e.doc);let saves=0;const a=createDrawingAssist(e,{save:()=>saves++,record:()=>{},toast:()=>{},review:()=>{},objectId:()=>'',brush:()=>({width:5,color:'#000000',opacity:1})});
 const report=await a.scan();assert.equal(report.total,0);assert.equal(a.getDiagnostics().gaps.total,0);const r=await a.previewLeak({seed:[50,50],targets:[[1,1]]});assert.equal(r.status,'enclosed');assert.equal(r.targets[0].connected,false);assert.equal(JSON.stringify(e.doc),before);assert.equal(saves,0);
 const image=a.getDiagnostics({includeImage:true,region:[10,10,80,80],scale:2}).image;assert.equal(image.width,160);assert.ok(image.dataUrl.startsWith('data:image/png;base64,'));
 await a.editPressure({ids:['outline'],width:3,note:'weight'});assert.equal(a.getDiagnostics().gaps,null);assert.equal(a.getDiagnostics().leak,null);assert.equal(saves,1);
 await a.previewLeak({seed:[50,50]});e.setLayers([{id:'paper',visible:false}]);assert.equal(a.getDiagnostics().leak,null);
 await assert.rejects(a.previewLeak({seed:[-1,20]}));
 }finally{globalThis.document=oldDocument;}
});
