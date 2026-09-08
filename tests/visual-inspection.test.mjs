import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewEvidence} from '../app/review-evidence.js';
import {PaintEngine} from '../app/engine.js';
import {blankDocument,validateDocument} from '../app/model.js';
import {exportDocumentData} from '../app/document-export.js';
const png='data:image/png;base64,AA==';
function fixture(phase='layout'){
  const doc=validateDocument(blankDocument(200,200));doc.workflow={phase,enabled:true};
  doc.commands=[{id:'foot',type:'stroke',stage:'lineart',subphase:phase,points:[[10,10],[25,25]],width:1}];
  const engine={doc,reviewEpoch:1,cursor:0,index:{total:0},playing:false,emit(){},remember(){}};
  let ref='a';const service=createReviewEvidence(engine,{referenceKey:()=>ref,renderPair:()=>({drawing:{dataUrl:png},reference:{dataUrl:png}})});
  return {engine,service,reference:x=>ref=x};
}
function check(service,target,conclusion='aligned'){
  const state=service.feedback().inspection,task=state.pending.find(t=>t.target===target);
  const o=service.observe(task.region,false,1).observation;
  return service.recordInspection({target,observationIds:[o.id],comparisons:state.criteria.map(c=>({criterion:c.id,reference:'前掌先变宽再向脚尖收束',drawing:'前掌宽度与参考对应，脚尖在末端收束',conclusion}))});
}
test('layout cannot advance on images alone, empty prose, partial criteria, small/stale/fake receipts',()=>{
  const {engine,service}=fixture();
  const forward=()=>PaintEngine.prototype.setPhase.call(engine,{phase:'rough'});
  assert.throws(forward,/逐项检查/);
  const small=service.observe([0,0,200,200],false,.5).observation.id;
  assert.throws(forward,/逐项检查/);
  assert.equal(engine.doc.workflow.phase,'layout');
  assert.throws(()=>service.recordInspection({target:'whole',observationIds:[small],comparisons:[]}),/criteria/);
  const comparisons=service.feedback().inspection.criteria.map(c=>({criterion:c.id,reference:'头胸骨盆按参考倾斜',drawing:'头胸骨盆方向对应',conclusion:'aligned'}));
  for(const id of [small,'fake'])assert.throws(()=>service.recordInspection({target:'whole',observationIds:[id],comparisons}),/图片/);
  const stale=service.observe([0,0,200,200]).observation.id;engine.doc.commands[0].points[0][0]++;
  assert.throws(()=>service.recordInspection({target:'whole',observationIds:[stale],comparisons}),/图片/);
  check(service,'whole');forward();assert.equal(engine.doc.workflow.phase,'rough');
  assert.ok(service.feedback().inspection.pending.length);
});
test('differences create persistent targets; rechecking aligned does not erase unresolved issues',()=>{
  const {engine,service}=fixture();const result=check(service,'whole','uncertain');
  assert.equal(result.issueIds.length,3);assert.equal(engine.doc.partIssues[0].target,'前掌先变宽再向脚尖收束');
  assert.equal(engine.doc.visualChecks.length,1);
  check(service,'whole');assert.throws(()=>engine.beforePhaseChange({phase:'rough'}),/问题尚未处理/);
  assert.equal(engine.doc.partIssues.length,3);
  const ids=[service.observe([0,0,200,200]).observation.id];
  for(const issue of engine.doc.partIssues)service.update({action:'dismiss',id:issue.id,note:'对照后确认是误报',observationIds:ids});
  engine.beforePhaseChange({phase:'rough'});
});
test('unrelated edits preserve local checks; affected edits, reference changes and restored runtime invalidate checks',()=>{
  const {engine,service,reference}=fixture('clean');
  engine.doc.commands[0].objectId='foot';
  engine.doc.commands.push({id:'hair',objectId:'hair',type:'stroke',stage:'lineart',subphase:'clean',points:[[150,150],[170,170]],width:1});
  check(service,'part:foot');check(service,'part:hair');check(service,'whole');
  assert.equal(service.feedback().inspection.pending.length,0);
  engine.doc.commands[1].points[0][0]++;
  assert.deepEqual(service.feedback().inspection.pending.map(t=>t.target),['whole','part:hair']);
  reference('b');assert.ok(service.feedback().inspection.pending.some(t=>t.target==='part:foot'));
  reference('a');engine.reviewEpoch++;assert.ok(service.feedback().inspection.pending.some(t=>t.target==='part:foot'));
  // Empty needs-work histories never count as completed checks; going back remains possible.
  engine.beforePhaseChange({phase:'refine'});
});
test('formal review still requires image-bound checks even with every generated crop',()=>{
  const {engine,service}=fixture('lineart_review');
  engine.doc.commands[0].objectId='foot';engine.doc.commands[0].subphase='clean';
  const packet=service.prepare();const ids=[packet.full,packet.mirrored,...packet.locals].map(p=>p.observation.id);
  const review={kind:'structure-checkpoint',scope:'global',status:'pass',observationIds:ids};
  assert.throws(()=>service.validate(review),/逐项检查/);
  check(service,'whole');check(service,'part:foot');service.validate(review);
  assert.throws(()=>{engine.doc.commands[0].points[0][0]++;service.validate(review);},/observationIds/);
});

test('checks survive export and normalization as audit history, not imported completion authority',()=>{
  const {engine,service}=fixture();check(service,'whole');
  // Use a normal empty document to isolate metadata round-trip from the mock stroke.
  const doc=validateDocument({...blankDocument(200,200),visualChecks:engine.doc.visualChecks});
  const exported=exportDocumentData(doc);assert.equal(exported.visualChecks[0].comparisons.length,3);
  const restored=validateDocument(exported);assert.deepEqual(restored.visualChecks,doc.visualChecks);
  const fresh=fixture();fresh.engine.doc.visualChecks=restored.visualChecks;
  assert.throws(()=>fresh.engine.beforePhaseChange({phase:'rough'}),/逐项检查/);
  assert.throws(()=>fresh.engine.beforePhaseChange({phase:'layout',enabled:false}),/逐项检查/);
});
test('each changed part must be inspected before another mutation, and a reported difference blocks new strokes until resolved',()=>{
  const {engine,service}=fixture('rough');engine.doc.commands[0].part='legs';engine.doc.revision=1;
  engine.doc.localChanges=[{key:'part:legs',objectIds:[],layerIds:['paper'],strokeIds:['foot'],region:[2,2,31,31],revision:1,phase:'rough'}];
  let cycle=service.feedback().inspection.drawingCycle;
  assert.deepEqual(cycle.pendingTargets,['part:legs']);assert.equal(cycle.readyForRevision,false);assert.equal(cycle.readyForNewStrokes,false);
  const report=check(service,'part:legs','different');cycle=service.feedback().inspection.drawingCycle;
  assert.equal(cycle.pendingTargets.length,0);assert.equal(cycle.readyForRevision,true);assert.equal(cycle.readyForNewStrokes,false);assert.equal(cycle.unresolvedIssues.length,3);
  engine.doc.commands[0].points[1]=[28,24];engine.doc.revision=2;engine.doc.localChanges[0]={...engine.doc.localChanges[0],revision:2};
  cycle=service.feedback().inspection.drawingCycle;assert.deepEqual(cycle.pendingTargets,['part:legs']);
  const repaired=check(service,'part:legs','aligned');
  for(const issue of engine.doc.partIssues)service.update({action:'resolve',id:issue.id,note:'返修后与参考重新对照',observationIds:repaired.observationIds});
  cycle=service.feedback().inspection.drawingCycle;assert.equal(cycle.readyForNewStrokes,true);assert.equal(report.issueIds.length,3);
});
