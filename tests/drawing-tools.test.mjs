import test from 'node:test';
import assert from 'node:assert/strict';
import {blankDocument,validateDocument,renderPoints} from '../dist/model.js';
import {scanLineGaps,floodLineRegion} from '../dist/diagnostics.js';
import {pressureWidth,validatePressureProfile,localWidthProfile} from '../dist/pressure.js';
const drawing=commands=>validateDocument({...blankDocument(100,100),commands:commands.map(c=>({subphase:'clean',width:1,...c}))});
test('active scan finds gaps even when both ends declare open and reports intentional open tips separately',()=>{
 const d=drawing([{id:'a',points:[[10,20],[40,20]],endpoints:['open','open']},{id:'b',points:[[45,20],[80,20]],endpoints:['open','open']}]);const before=JSON.stringify(d),r=scanLineGaps(d);
 assert.ok(r.issues.some(i=>i.kind==='gap'&&i.strokeId==='a'&&i.targetStrokeId==='b'));assert.ok(r.counts.dangling>=2);assert.equal(JSON.stringify(d),before);
});
test('T junctions and touching thick ink are connected, hidden layers cannot justify a connection',()=>{
 const d=drawing([{id:'a',points:[[20,10],[20,39]],width:2},{id:'b',points:[[10,40],[50,40]],width:2}]);
 assert.ok(!scanLineGaps(d).issues.some(i=>i.strokeId==='a'&&i.end==='end'));d.layers.push({id:'hidden',name:'hidden',visible:false,opacity:1});d.commands[1].layer='hidden';assert.ok(scanLineGaps(d).issues.some(i=>i.strokeId==='a'&&i.end==='end'));
});
test('same stroke near-loop gap is scanned, fully closed path is not flagged',()=>{
 const d=drawing([{id:'loop',points:[[20,20],[70,20],[70,70],[20,70],[20,25]]}]);assert.ok(scanLineGaps(d).counts.gap>0);d.commands[0].closed=true;assert.equal(scanLineGaps(d).total,0);
});
test('occluded endpoints do not become gaps and an unrelated open end is still inspected',()=>{
 const d=drawing([{id:'a',points:[[10,20],[50,20]]}]);
 d.commands[0].objectId='back';d.scene={objects:[{id:'back',frame:[0,0,100,100]},{id:'front',frame:[0,0,100,100]}],anchors:[],regions:[{id:'cover',objectId:'front',through:[[40,10],[60,10],[60,30],[40,30]],corners:[0,1,2,3]}],occlusions:[{id:'o',regionId:'cover',front:'front',back:'back'}]};
 const r=scanLineGaps(d);assert.equal(r.occluded,1);assert.ok(r.issues.some(i=>i.end==='start'));assert.ok(!r.issues.some(i=>i.end==='end'));
});
test('flood detects a one-pixel breach, target connectivity, and does not bridge gaps',()=>{
 const width=20,height=20,alpha=new Uint8Array(400);for(let i=4;i<=15;i++){alpha[4*20+i]=alpha[15*20+i]=alpha[i*20+4]=alpha[i*20+15]=255;}
 const a=floodLineRegion({alpha,width,height,seed:[10,10],targets:[[1,1],[11,11]]});assert.equal(a.status,'enclosed');assert.deepEqual(a.targets,[false,true]);alpha[4*20+10]=0;
 const b=floodLineRegion({alpha,width,height,seed:[10,10],targets:[[1,1]]});assert.equal(b.status,'open');assert.equal(b.targets[0],true);assert.equal(alpha[4*20+10],0);
 assert.equal(floodLineRegion({alpha,width,height,seed:[4,4]}).status,'on-line');
});
test('alpha threshold is explicit: faint ink can cease to enclose a region',()=>{
 const alpha=new Uint8Array(100);for(let i=2;i<8;i++){alpha[2*10+i]=alpha[7*10+i]=alpha[i*10+2]=alpha[i*10+7]=20;}
 assert.equal(floodLineRegion({alpha,width:10,height:10,seed:[4,4],threshold:10}).status,'enclosed');assert.equal(floodLineRegion({alpha,width:10,height:10,seed:[4,4],threshold:24}).status,'open');
});
test('multi-knot pressure, custom response and sampled originals survive save/load without compounding',()=>{
 const d=drawing([{id:'p',points:[[10,10,.2],[90,10,.8]],pressureProfile:[[0,0],[.3,1],[.6,.1],[1,0]],pressureFloor:0,pressureCurve:[[0,0],[.5,.25],[1,1]]}]);const c=d.commands[0];assert.ok(c.geometry);assert.equal(c.points.find(p=>Math.abs(p[0]-34)<.001)[2],1);assert.equal(pressureWidth(c,.5),.25);assert.deepEqual(validateDocument(d).commands[0].points,c.points);assert.deepEqual(renderPoints(c,d),c.points);
 const restored=validateDocument({...d,commands:[{...c,pressureProfile:null}]});assert.deepEqual(restored.commands[0].points,[[10,10,.2],[90,10,.8]]);
});
test('local width edits preserve source path and pressure exactly outside the interval and feather',()=>{
 const d=drawing([{id:'p',through:[[10,10,.2],[40,60,.9],[90,10,.3]],pressureCurve:[[0,0],[.5,.1],[1,1]],width:3}]),c=d.commands[0];
 const patch=localWidthProfile(c,{range:[.3,.6],factor:2,feather:.05}),edited=validateDocument({...d,commands:[{...c,...patch}]}).commands[0];
 assert.deepEqual(edited.geometry,c.geometry);assert.deepEqual(edited.pressureCurve,c.pressureCurve);assert.equal(pressureWidth(edited,.7,.1),pressureWidth(c,.7,.1));assert.equal(pressureWidth(edited,.7,.5),2*pressureWidth(c,.7,.5));assert.equal(pressureWidth(edited,.7,.9),pressureWidth(c,.7,.9));assert.deepEqual(validateDocument({...d,commands:[edited]}).commands[0],edited);
});
test('malformed pressure profiles and invalid diagnostic inputs reject clearly',()=>{
 assert.throws(()=>validatePressureProfile([[0,0],[.5,1],[.5,.2],[1,0]]));assert.throws(()=>validatePressureProfile([[.1,0],[1,0]]));assert.throws(()=>scanLineGaps(drawing([]),{maxGap:NaN}));assert.throws(()=>floodLineRegion({alpha:new Uint8Array(100),width:10,height:10,seed:[-1,1]}));
});
