import test from 'node:test';
import assert from 'node:assert/strict';
import {PaintEngine} from '../dist/engine.js';
import {blankDocument} from '../dist/model.js';
// A recording canvas verifies draw order across seeking and document transactions.
class Context {constructor(){this.ops=[];}beginPath(){this.path=[];}moveTo(...p){this.path.push(['M',...p]);}lineTo(...p){this.path.push(['L',...p]);}closePath(){this.path.push(['Z']);}arc(...p){this.path.push(['A',...p]);}stroke(){this.ops.push({path:this.path,type:'stroke',color:this.strokeStyle,width:this.lineWidth,opacity:this.globalAlpha,blend:this.globalCompositeOperation});}fill(){this.ops.push({path:this.path,type:'fill',color:this.fillStyle,opacity:this.globalAlpha,blend:this.globalCompositeOperation});}fillRect(){}drawImage(){}}
class Canvas {constructor(){this.ctx=new Context();}getContext(){return this.ctx;}}
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
