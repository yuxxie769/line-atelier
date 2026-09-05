import test from 'node:test';
import assert from 'node:assert/strict';
import {PaintEngine} from '../dist/engine.js';
import {blankDocument} from '../dist/model.js';
// A recording canvas verifies draw order across seeking and document transactions.
class Context {constructor(){this.ops=[];}beginPath(){this.path=[];}moveTo(...p){this.path.push(['M',...p]);}lineTo(...p){this.path.push(['L',...p]);}closePath(){this.path.push(['Z']);}arc(...p){this.path.push(['A',...p]);}stroke(){this.ops.push({path:this.path,type:'stroke',color:this.strokeStyle,width:this.lineWidth,opacity:this.globalAlpha,blend:this.globalCompositeOperation});}fill(){this.ops.push({path:this.path,type:'fill',color:this.fillStyle,opacity:this.globalAlpha,blend:this.globalCompositeOperation});}fillRect(){}setTransform(){}save(){}restore(){}clip(){}clearRect(){this.ops=[];}drawImage(canvas,...args){this.ops.push({type:'composite',source:structuredClone(canvas.ctx.ops),opacity:this.globalAlpha,blend:this.globalCompositeOperation,args});}}
class Canvas {constructor(){this.ctx=new Context();}getContext(){return this.ctx;}}
globalThis.Path2D=class{moveTo(){}lineTo(){}closePath(){}};
globalThis.document={createElement:()=>new Canvas()};globalThis.cancelAnimationFrame=()=>{};globalThis.requestAnimationFrame=()=>1;
const states=e=>[...e.surfaces].map(([id,c])=>[id,c.ctx.ops]);
test('seek backwards and finish reproduce identical stroke order without duplicates',async()=>{
 const e=new PaintEngine(new Canvas(),blankDocument());await e.submit([{points:[[10,10],[20,20],[40,10]],width:3},{type:'erase',points:[[20,20],[25,30]],width:6}],{animate:false});const complete=structuredClone(states(e));
 e.seek(.4);assert.ok(e.cursor<e.index.total);e.finish();assert.deepEqual(states(e),complete);e.seek(0);e.finish();assert.deepEqual(states(e),complete);
});
test('undo and redo preserve complete batches and validation failures preserve prior state',async()=>{
 const e=new PaintEngine(new Canvas(),blankDocument());await e.submit([{points:[[1,1],[2,2]],color:'#abcdef'}],{animate:false});const complete=structuredClone(states(e));
 await assert.rejects(e.submit([{points:[[1,1]],layer:'missing'}]));assert.equal(e.doc.commands.length,1);assert.deepEqual(states(e),complete);
 assert.equal(e.undo(),true);assert.equal(e.doc.commands.length,0);assert.equal(e.redo(),true);assert.deepEqual(states(e),complete);
});
test('a two-point long stroke visibly advances by distance and holds a separate pen lift',async()=>{
 const e=new PaintEngine(new Canvas(),blankDocument());await e.submit([{points:[[10,10],[210,10]],width:3}],{animate:false});
 e.renderTo(25);const ops=e.ink.ctx.ops;
 assert.equal(ops.length,25);assert.deepEqual(ops.at(-1).path.at(-1),['L',60,10]);
 assert.equal(e.state().completed,0);e.renderTo(100);const inkCount=e.surfaces.get('paper').ctx.ops.length;
 e.renderTo(110);assert.equal(e.surfaces.get('paper').ctx.ops.length,inkCount);assert.equal(e.state().completed,0);
 e.finish();assert.equal(e.state().completed,1);
 const other=new PaintEngine(new Canvas(),blankDocument());await other.submit([{points:[[10,10],[60,10],[110,10],[210,10]]}],{animate:false});
 assert.equal(e.index.total,other.index.total,'coordinate sampling density must not change duration');
});

test('one translucent stroke commits opacity once, independent of segment count',async()=>{const e=new PaintEngine(new Canvas(),blankDocument());await e.submit([{points:[[10,10],[100,10],[100,90]],opacity:.4}],{animate:false});const commits=e.surfaces.get('paper').ctx.ops;assert.equal(commits.length,1);assert.equal(commits[0].opacity,.4);assert.ok(commits[0].source.every(op=>op.opacity===1));});

test('layer toggles and their undo preserve cursor and cached painted surfaces',async()=>{
 const e=new PaintEngine(new Canvas(),blankDocument());await e.submit([{id:'a',path:'M 10 10 C 70 5 80 90 130 120'}],{animate:false});e.seek(.5);
 const cursor=e.cursor,paint=e.surfaces.get('paper'),ops=structuredClone(paint.ctx.ops),units=e.metrics.drawUnits;
 e.setLayers([{id:'paper',visible:false}]);assert.equal(e.cursor,cursor);assert.equal(e.surfaces.get('paper'),paint);assert.deepEqual(paint.ctx.ops,ops);assert.equal(e.metrics.drawUnits,units);
 e.undo();assert.equal(e.doc.layers[0].visible,true);assert.equal(e.cursor,cursor);assert.equal(e.metrics.drawUnits,units);
});
test('local revision retains IDs, repaints only affected layers, and survives replay',async()=>{
 const d=blankDocument();d.layers.push({id:'other',name:'other'});const e=new PaintEngine(new Canvas(),d);
 await e.submit([{id:'a',path:'M 10 10 L 50 20'},{id:'b',layer:'other',path:'M 10 70 L 80 70'}],{animate:false});const cached=e.surfaces.get('other'),cachedOps=structuredClone(cached.ctx.ops);
 const result=e.revise({replace:[{id:'a',path:'M 10 10 Q 30 60 60 30'}],note:'correct arc'});assert.deepEqual(result.repaintedLayers,['paper']);assert.equal(e.surfaces.get('other'),cached);assert.deepEqual(cached.ctx.ops,cachedOps);assert.deepEqual(e.doc.commands.map(c=>c.id),['a','b']);
 const final=structuredClone(states(e));e.seek(0);e.finish();assert.deepEqual(states(e),final);e.undo();assert.deepEqual(e.doc.commands[0].points,[[10,10],[50,20]]);
});
test('invalid local revision is atomic even during partial playback',async()=>{
 const e=new PaintEngine(new Canvas(),blankDocument());await e.submit([{id:'a',path:'M 10 10 L 50 20'}],{animate:false});e.seek(.4);const cursor=e.cursor,doc=JSON.stringify(e.doc);
 assert.throws(()=>e.revise({replace:[{id:'a',path:'M 10 10 L NaN 20'}]}));assert.equal(e.cursor,cursor);assert.equal(JSON.stringify(e.doc),doc);
});
test('construction automatically hides when clean linework starts',async()=>{
 const d=blankDocument();d.layers[0].hideAtCommand='ink';d.layers.push({id:'ink-layer',name:'ink'});
 d.commands=[{id:'guide',points:[[10,10],[20,20]]},{id:'ink',layer:'ink-layer',points:[[10,10],[30,20]]}];const e=new PaintEngine(new Canvas(),d);
 assert.equal(e.layerVisible(e.doc.layers[0]),false);e.seek(0);assert.equal(e.layerVisible(e.doc.layers[0]),true);e.finish();e.setLayers([{id:'paper',visible:true}]);assert.equal(e.layerVisible(e.doc.layers[0]),true);
});

test('shared local anchor edits rebuild connected curves, preserve unrelated cache and invalidate reviews',async()=>{
 const d=blankDocument();d.layers.push({id:'other',name:'other'});d.scene={objects:[{id:'face',frame:[100,200,100,100]}],anchors:[{id:'chin',objectId:'face',point:[.5,.9]}]};const e=new PaintEngine(new Canvas(),d);
 await e.submit([{id:'a',objectId:'face',space:'face',through:[[0,.3],{anchor:'chin'}]},{id:'b',objectId:'face',space:'face',through:[{anchor:'chin'},[1,.3]]},{id:'untouched',layer:'other',points:[[10,10],[20,10]]}],{animate:false});
 e.recordReview({note:'viewed',objectIds:['face'],status:'pass'});const cache=e.surfaces.get('other'),ops=structuredClone(cache.ctx.ops);const r=e.editGeometry({anchorId:'chin',point:[.55,.95],note:'adjust shape'});
 assert.deepEqual(e.doc.commands[0].points.at(-1).slice(0,2),[155,295]);assert.deepEqual(e.doc.commands[1].points[0].slice(0,2),[155,295]);assert.deepEqual(r.repaintedLayers,['paper']);assert.equal(e.doc.reviews[0].stale,true);assert.equal(e.surfaces.get('other'),cache);assert.deepEqual(cache.ctx.ops,ops);
 e.undo();assert.deepEqual(e.doc.scene.anchors[0].point,[.5,.9]);assert.equal(e.doc.reviews[0].stale,false);
});
test('working checkpoints retain editable source, preserve baseline and restore undoably',async()=>{
 const e=new PaintEngine(new Canvas(),blankDocument());await e.submit([{id:'a',through:[[20,20],[40,50],[80,20]],corners:[1]}],{animate:false});e.checkpoint({action:'save',id:'rough',name:'rough'});e.editGeometry({id:'a',index:1,point:[45,60],note:'revise'});e.checkpoint({action:'save',id:'refined',name:'refined'});e.checkpoint({action:'restore',id:'rough'});assert.deepEqual(e.doc.commands[0].geometry.through[1],[40,50]);assert.equal(e.doc.checkpoints.length,2);e.undo();assert.deepEqual(e.doc.commands[0].geometry.through[1],[45,60]);
});
test('line-art workflow cannot color before review; subsequent color batches do not invalidate line review',async()=>{
 const d=blankDocument();d.stages=[{id:'lineart'},{id:'hair'}];d.workflow={phase:'rough',enabled:true};const e=new PaintEngine(new Canvas(),d);await assert.rejects(e.submit([{points:[[1,1]],stage:'hair'}]));assert.throws(()=>e.setPhase({phase:'clean'}));
 e.recordReview({scope:'global',kind:'structure-checkpoint',note:'checked proportions',status:'pass',evidence:['drawing','reference','mirrored']});e.setPhase({phase:'clean'});await e.submit([{id:'a',points:[[1,1],[20,20]],stage:'lineart'}],{animate:false});e.setPhase({phase:'lineart_review'});e.recordReview({scope:'global',kind:'lineart-checkpoint',note:'checked clean lines',status:'pass',evidence:['drawing','reference','mirrored']});await e.submit([{points:[[1,1]],stage:'hair'}],{animate:false});await e.submit([{points:[[2,2]],stage:'hair'}],{animate:false});assert.equal(e.reviewPassed('lineart-checkpoint'),true);e.revise({replace:[{id:'a',points:[[1,1],[25,20]]}],note:'shape changed'});assert.equal(e.reviewPassed('lineart-checkpoint'),false);
});
test('geometry snapshot and trial revision leave document, playhead and live surfaces untouched',async()=>{
 Canvas.prototype.toDataURL=function(){return 'data:image/png;mock,'+this.width+'x'+this.height;};const e=new PaintEngine(new Canvas(),blankDocument());await e.submit([{id:'a',through:[[10,10],[40,50],[80,20]]}],{animate:false});e.seek(.4);const before=JSON.stringify(e.doc),cursor=e.cursor,units=e.metrics.drawUnits,paint=structuredClone(states(e)),undo=e.undoStack.length;
 const result=e.snapshotRegion({region:[0,0,100,100],scale:3,mirror:true});assert.equal(result.width,300);assert.equal(result.rendering,'geometry');e.previewRevision({replace:[{id:'a',through:[[10,10],[40,80],[80,20]]}],region:[0,0,100,100]});assert.equal(JSON.stringify(e.doc),before);assert.equal(e.cursor,cursor);assert.equal(e.metrics.drawUnits,units);assert.deepEqual(states(e),paint);assert.equal(e.undoStack.length,undo);
});

test('trimming keeps source geometry editable and does not join across an occluded end',async()=>{
 const e=new PaintEngine(new Canvas(),blankDocument());await e.submit([{id:'a',through:[[10,10,.4],[60,10,1],[110,10,.2]]}],{animate:false});e.editGeometry({id:'a',trim:[.2,.8],note:'end hidden behind hair'});assert.deepEqual(e.doc.commands[0].points[0].slice(0,2),[30,10]);assert.deepEqual(e.doc.commands[0].points.at(-1).slice(0,2),[90,10]);assert.deepEqual(e.doc.commands[0].geometry.through[0],[10,10,.4]);assert.equal(e.doc.commands[0].closed,false);e.load(e.doc);assert.deepEqual(e.doc.commands[0].points.at(-1).slice(0,2),[90,10]);
});
test('moving an occlusion boundary shared anchor rebuilds the rear layer, not an unrelated one',async()=>{
 const d=blankDocument();d.layers.push({id:'rear',name:'rear'},{id:'other',name:'other'});d.scene={objects:[{id:'leg',frame:[0,0,100,100]},{id:'tail',frame:[0,0,100,100]},{id:'head',frame:[0,0,100,100]}],anchors:[{id:'edge',objectId:'leg',point:[.5,0]}],regions:[{id:'volume',objectId:'leg',through:[{anchor:'edge'},[50,80],[0,80],[0,0]],corners:[0,1,2,3]}],occlusions:[{id:'front',regionId:'volume',back:'tail'}]};const e=new PaintEngine(new Canvas(),d);await e.submit([{id:'tail-line',objectId:'tail',layer:'rear',points:[[0,40],[100,40]]},{id:'head-line',objectId:'head',layer:'other',points:[[0,90],[100,90]]}],{animate:false});e.recordReview({objectIds:['head'],status:'pass',note:'head inspected'});const r=e.editGeometry({anchorId:'edge',point:[.7,0],note:'leg volume changed'});assert.deepEqual(r.repaintedLayers,['rear']);assert.equal(e.doc.reviews[0].stale,false);
});
