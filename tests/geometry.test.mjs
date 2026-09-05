import test from 'node:test';
import assert from 'node:assert/strict';
import {throughGeometry,normalizeScene} from '../dist/geometry.js';
import {validateDocument,blankDocument} from '../dist/model.js';
test('through curves pass through all model points, keep endpoints and preserve declared corners',()=>{
 const source={through:[[0,0],[30,40],[60,0],[90,20]],corners:[1]};const g=throughGeometry(source);for(const p of source.through)assert.ok(g.points.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<1e-8));const incoming=g.segments[0],outgoing=g.segments[1];assert.notEqual(Math.sign(incoming[3][1]-incoming[2][1]),Math.sign(outgoing[1][1]-outgoing[0][1]));assert.equal(g.points.at(-1)[0],90);
});
test('source geometry and local frames round-trip without drift or double transforms',()=>{
 const d=blankDocument();d.scene={objects:[{id:'eye',frame:[100,200,50,20]}],anchors:[{id:'corner',objectId:'eye',point:[0,.5]}]};d.commands=[{id:'a',objectId:'eye',space:'eye',through:[{anchor:'corner'},[.5,0],[1,.5]],taper:[.2,1,.3]}];const once=validateDocument(d),twice=validateDocument(JSON.parse(JSON.stringify(once)));assert.deepEqual(twice,once);assert.deepEqual(once.commands[0].points[0].slice(0,2),[100,210]);assert.deepEqual(once.commands[0].geometry.through[0],{anchor:'corner'});
});
test('transparent occluders, dangling anchors and cyclic parents are rejected',()=>{
 assert.throws(()=>normalizeScene({objects:[{id:'a',frame:[0,0,10,10],parent:'b'},{id:'b',frame:[0,0,10,10],parent:'a'}]}));assert.throws(()=>throughGeometry({through:[{anchor:'missing'},[1,1]]}));assert.throws(()=>normalizeScene({objects:[{id:'lens',frame:[0,0,10,10],material:'transparent'},{id:'eye',frame:[0,0,10,10]}],regions:[{id:'r',objectId:'lens',through:[[0,0],[10,0],[10,10]]}],occlusions:[{id:'occlude',regionId:'r',back:'eye'}]}));
});
