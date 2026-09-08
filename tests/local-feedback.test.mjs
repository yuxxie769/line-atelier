import test from 'node:test';
import assert from 'node:assert/strict';
import {trackLocalChanges,localChangeFeedback} from '../app/local-feedback.js';
import {blankDocument,validateDocument} from '../app/model.js';
function fixture(){return validateDocument({...blankDocument(100,100),stages:[{id:'lineart',name:'线稿'}],commands:[{id:'a',stage:'lineart',points:[[20,20],[30,30]],objectId:'foot'}],scene:{objects:[{id:'foot',name:'脚',frame:[10,10,50,50]}]}});}
test('pending crop includes old and new positions; repeated edits retain earlier regions and real stroke IDs',()=>{
 const doc=fixture(),old=structuredClone(doc.commands[0]);doc.revision=1;
 doc.commands[0].points=[[60,60],[70,70]];trackLocalChanges(doc,{ids:['a'],previousCommands:[old]});
 const first=localChangeFeedback(doc,()=>false);assert.deepEqual(first.next[0].region,[12,12,66,66]);assert.match(first.next[0].instruction,/修改前后都必须对比参考图/);
 doc.revision++;doc.commands[0].points=[[40,40],[45,45]];trackLocalChanges(doc,{ids:['a']});
 const after=localChangeFeedback(doc,()=>false);assert.deepEqual(after.next[0].region,first.next[0].region);assert.deepEqual(after.next[0].strokeIds,['a']);
 assert.equal(after.next[0].nextInspection.tool,'paint_inspect_context');assert.equal(after.next[0].revision,2);
});
test('geometry export/import retains pending locations; images suppress prompts without certifying a part',()=>{
 const doc=fixture();trackLocalChanges(doc,{ids:['a']});
 const imported=validateDocument(doc);assert.deepEqual(imported.localChanges,doc.localChanges);
 assert.equal(localChangeFeedback(imported,()=>false).pendingImageParts,1);
 const returned=localChangeFeedback(imported,()=>true);assert.equal(returned.pendingImageParts,0);assert.match(returned.meaning,/not proof/);
 assert.equal(imported.localChanges.length,1);
 assert.match(localChangeFeedback(validateDocument(blankDocument(100,100)),()=>false).scope,/unknown/);
});
test('removed marks remain inspectable and a large region requests original-size paired images',()=>{
 const doc=fixture(),old=doc.commands[0];doc.commands=[];trackLocalChanges(doc,{ids:['a'],previousCommands:[old]});
 assert.deepEqual(doc.localChanges[0].strokeIds,['a']);
 const large=validateDocument(blankDocument(1200,1600));trackLocalChanges(large);
 assert.equal(localChangeFeedback(large,()=>false).next[0].nextInspection.tool,'paint_observe_review');
});
test('1A prioritizes whole-drawing calibration after a batch, even when requesting one part',()=>{
 const doc=fixture();doc.workflow.phase='layout';doc.commands[0].subphase='layout';doc.revision=1;
 trackLocalChanges(doc,{ids:['a']});
 const feedback=localChangeFeedback(doc,()=>false,{objectId:'foot'}),calibration=feedback.layoutCalibration;
 assert.equal(feedback.next[0].kind,'layout-calibration');assert.deepEqual(calibration.region,[0,0,100,100]);
 assert.deepEqual(calibration.guideIds,['a']);assert.deepEqual(calibration.changedGuideIds,['a']);
 assert.deepEqual(calibration.nextInspection.arguments.region,[0,0,100,100]);assert.equal(calibration.status,'needs-whole-comparison');
 assert.match(calibration.instruction,/不表示定位正确/);assert.match(calibration.instruction,/修改前后都必须对比参考图/);
 const returned=localChangeFeedback(doc,()=>true);assert.equal(returned.next[0].status,'images-returned-calibration-required');
 assert.match(returned.next[0].instruction,/图像返回不等于校准完成/);
 doc.workflow.phase='rough';assert.equal(localChangeFeedback(doc,()=>false).layoutCalibration,undefined);
});
test('empty 1A does not pretend a draft exists; revisions retain only current real guide IDs',()=>{
 const doc=fixture();doc.workflow.phase='layout';doc.commands=[];
 assert.equal(localChangeFeedback(doc,()=>false).layoutCalibration.status,'awaiting-layout');
 doc.commands=[{id:'axis',stage:'lineart',subphase:'layout',type:'stroke',layer:'paper',points:[[10,10],[30,30]],geometry:{through:[{anchor:'joint'}]}}];
 trackLocalChanges(doc,{ids:['axis']});
 const c=localChangeFeedback(doc,()=>false).layoutCalibration;assert.deepEqual(c.anchorIds,['joint']);
 doc.commands=[];assert.deepEqual(localChangeFeedback(doc,()=>false).layoutCalibration.guideIds,[]);
});
test('changes without scene objects stay separated by semantic part instead of merging an entire layer',()=>{
 const doc=validateDocument(blankDocument(100,100));doc.commands=[
  {id:'leg',stage:'lineart',subphase:'rough',part:'legs',layer:'paper',points:[[10,10],[20,20]]},
  {id:'hair',stage:'lineart',subphase:'rough',part:'head',layer:'paper',points:[[70,70],[80,80]]}
 ];doc.workflow.phase='rough';doc.revision=1;
 trackLocalChanges(doc,{ids:['leg']});
 assert.equal(doc.localChanges[0].key,'part:legs');assert.deepEqual(doc.localChanges[0].strokeIds,['leg']);
});
