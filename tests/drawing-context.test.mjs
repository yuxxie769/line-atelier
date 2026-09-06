import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {validateDocument,blankDocument} from '../dist/model.js';
import {collectDrawingContext,inspectDrawingContext} from '../dist/drawing-context.js';
import {PaintEngine} from '../dist/engine.js';
const require=createRequire(import.meta.url);
let native;try{native=require('@napi-rs/canvas');}catch{native=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json')('@napi-rs/canvas');}
globalThis.document={createElement:()=>native.createCanvas(1,1)};globalThis.Path2D=native.Path2D;globalThis.cancelAnimationFrame=()=>{};globalThis.requestAnimationFrame=()=>1;
function fixture(){return validateDocument({...blankDocument(200,200),layers:[{id:'draft',name:'底稿',role:'construction',visible:false,opacity:.1},{id:'ink',name:'清线',visible:true}],scene:{objects:[{id:'head',name:'头',frame:[0,0,200,200]},{id:'eye',name:'左眼',frame:[50,70,60,40],parent:'head'}],anchors:[{id:'corner',objectId:'eye',point:[0,.5]}]},commands:[{id:'eye-axis',objectId:'head',layer:'draft',subphase:'layout',through:[[0,90],[200,90]]},{id:'lid-guide',objectId:'eye',layer:'draft',subphase:'rough',space:'eye',through:[{anchor:'corner'},[.5,0],[1,.5]]},{id:'lid',objectId:'eye',layer:'ink',subphase:'clean',points:[[50,90],[80,72],[110,90]]}]});}
test('one lookup finds hidden ancestor axis and resolves local points / shared anchors to canvas',()=>{
 const doc=fixture(),before=JSON.stringify(doc),c=collectDrawingContext(doc,{query:'左眼',padding:0});
 assert.deepEqual(c.region,[50,70,60,40]);assert.equal(c.commands.length,3);assert.equal(c.commands[0].id,'lid-guide');
 assert.deepEqual(c.commands[0].coordinates.document,[[50,90],[80,70],[110,90]]);
 assert.deepEqual(c.commands[0].coordinates.localToCrop,[[0,20],[30,0],[60,20]]);
 assert.equal(c.commands.find(c=>c.id==='eye-axis').relationship,'ancestor');assert.deepEqual(c.anchors[0].document,[50,90]);
 assert.equal(JSON.stringify(doc),before);
});
test('ambiguous names, empty guides, explicit selection, pagination and invalid input are honest',()=>{
 const d=fixture();d.scene.objects.push({id:'other-eye',name:'右眼',frame:[130,70,40,40]});
 assert.equal(collectDrawingContext(d,{query:'眼'}).status,'ambiguous');assert.equal(collectDrawingContext(d,{query:'手'}).status,'not-found');
 const first=collectDrawingContext(d,{objectId:'eye',limit:1});assert.equal(first.nextOffset,1);assert.notEqual(collectDrawingContext(d,{objectId:'eye',offset:1,limit:1}).commands[0].id,first.commands[0].id);
 assert.equal(collectDrawingContext(d,{region:[150,150,20,20],padding:0}).guideStatus,'none-found');
 assert.equal(collectDrawingContext(d,{region:[150,150,20,20],padding:0,guideIds:['eye-axis']}).commands[0].relationship,'explicit');
 assert.throws(()=>collectDrawingContext(d,{objectId:'missing'}));assert.throws(()=>collectDrawingContext(d,{region:[500,500,20,20]}));assert.throws(()=>collectDrawingContext(d,{objectId:'eye',limit:1.5}));
});
test('rendered packet reveals hidden guides without changing canvas, layers, history or playhead; reference gate preserved',()=>{
 const e=new PaintEngine(native.createCanvas(200,200),fixture());e.seek(.5);
 const before=JSON.stringify(e.doc),pixels=e.canvas.toBuffer('image/png'),cursor=e.cursor,history=e.undoStack.length;
 const original=native.createCanvas(100,100);original.getContext('2d').fillRect(0,0,100,100);const reference={original,placement:[0,0,2]};
 const denied=inspectDrawingContext(e,{objectId:'eye',padding:0,maxSize:256,detail:'full'},{reference,referenceAllowed:false});
 assert.equal(denied.referenceStatus,'access-disabled');assert.equal(denied.images.reference,null);
 assert.notEqual(denied.images.guides.dataUrl,denied.images.drawing.dataUrl);
 const allowed=inspectDrawingContext(e,{objectId:'eye',padding:0,maxSize:256,detail:'full'},{reference,referenceAllowed:true});
 assert.equal(allowed.referenceStatus,'available');assert.deepEqual(allowed.images.reference.region,allowed.images.drawing.region);
 assert.equal(allowed.images.reference.width,allowed.images.drawing.width);assert.equal(allowed.images.reference.scale,allowed.images.drawing.scale);
 assert.deepEqual(allowed.images.drawing.imageToDocument,[.25,0,0,.25,50,70]);
 assert.equal(JSON.stringify(e.doc),before);assert.equal(e.cursor,cursor);assert.equal(e.undoStack.length,history);assert.deepEqual(e.canvas.toBuffer('image/png'),pixels);
});
test('actual R3 left eye returns construction guides assigned to figure, not only eye-owned lines',()=>{
 const doc=validateDocument(JSON.parse(readFileSync(new URL('../dist/line-atelier-v4-r3.line.json',import.meta.url))));
 const c=collectDrawingContext(doc,{query:'左眼'});assert.equal(c.target.id,'eye-l');assert.ok(c.commands.some(c=>c.id==='r3-layout-eye-perspective'));assert.ok(c.commands.some(c=>c.id==='r3-layout-eye-left-mass'));
 const e=new PaintEngine(native.createCanvas(doc.width,doc.height),doc);const packet=inspectDrawingContext(e,{query:'左眼',maxSize:512,detail:'full'});assert.ok(packet.images.guides.dataUrl.length>1000);assert.equal(packet.referenceStatus,'missing');
});

test('model default is one image and compact usable coordinates; data-only query skips rendering',()=>{
 const e=new PaintEngine(native.createCanvas(200,200),fixture());
 const c=inspectDrawingContext(e,{query:'左眼',padding:0,maxSize:256});
 assert.ok(c.image.dataUrl);assert.equal(c.images,undefined);assert.equal(c.commands,undefined);
 assert.deepEqual(c.strokes.find(s=>s.id==='lid-guide').points,[[50,90],[80,70],[110,90]]);
 const panel=c.image.panels.guides,[x,y]=panel.rect,[a,b,d,f,tx,ty]=panel.imageToDocument;
 assert.equal(x*a+y*d+tx,50);assert.equal(x*b+y*f+ty,70);
 const old=document.createElement;document.createElement=()=>{throw Error('must not render');};
 try{const data=inspectDrawingContext(e,{query:'左眼',includeImage:false});assert.equal(data.image,undefined);assert.ok(data.strokes.length);}finally{document.createElement=old;}
});
