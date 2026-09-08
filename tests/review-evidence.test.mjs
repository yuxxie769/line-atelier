import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewEvidence,invalidatePartIssues} from '../app/review-evidence.js';
import {blankDocument,validateDocument} from '../app/model.js';
const png='data:image/png;base64,AA==';
function fixture(){
  const engine={doc:validateDocument(blankDocument(100,100)),cursor:0,index:{total:0},playing:false,reviewEpoch:1,recordReview(o){this.doc.reviews.push(o);return o;}};
  engine.doc.workflow.phase='lineart_review';let ref='reference-a';
  const service=createReviewEvidence(engine,{referenceKey:()=>ref,renderPair:()=>({drawing:{dataUrl:png},reference:{dataUrl:png}})});
  return {engine,service,reference:value=>{ref=value;}};
}
const pass=ids=>({kind:'structure-checkpoint',scope:'global',status:'pass',note:'Visual comparison',observationIds:ids});
const packetIds=p=>[p.full,p.mirrored,...p.locals].map(pair=>pair.observation.id);
test('actual current paired images required; strings, fabricated IDs, changed layers/reference/playback cannot pass',()=>{
  const {engine,service,reference}=fixture();
  assert.throws(()=>service.validate(pass(['invented'])),/observationIds/);
  const ids=packetIds(service.prepare());service.validate(pass(ids));
  engine.doc.layers[0].visible=false;assert.throws(()=>service.validate(pass(ids)),/observationIds/);
  engine.doc.layers[0].visible=true;reference('reference-b');assert.throws(()=>service.validate(pass(ids)),/observationIds/);
  engine.playing=true;assert.throws(()=>service.prepare(),/finish/);
  engine.playing=false;reference(null);assert.throws(()=>service.prepare(),/参考图/);
});
test('issues survive empty reviews and import; resolution requires current original-size crop and edits reopen it',()=>{
  const {engine,service}=fixture();
  const issue=service.update({description:'heel too narrow',region:[10,70,20,20]});
  service.record({note:'still checking',issues:[]});assert.equal(service.issues().length,1);
  assert.throws(()=>service.validate(pass(packetIds(service.prepare()))),/未解决/);
  const low=service.observe(issue.region,false,.5).observation.id;
  assert.throws(()=>service.update({action:'resolve',id:issue.id,note:'corrected',observationIds:[low]}),/原尺寸/);
  const actual=service.observe(issue.region).observation.id;
  service.update({action:'resolve',id:issue.id,note:'heel shape checked',observationIds:[actual]});
  service.validate(pass(packetIds(service.prepare())));
  engine.doc=validateDocument(engine.doc);assert.equal(service.issues()[0].status,'resolved');
  engine.doc.revision++;invalidatePartIssues(engine.doc);assert.equal(service.issues()[0].status,'awaiting-review');
  assert.throws(()=>service.validate(pass(packetIds(service.prepare()))),/未解决/);
});
test('review packet omits past approval narratives; restore epochs and fresh runtimes invalidate old receipts',()=>{
  const {engine,service}=fixture();engine.doc.reviews.push({note:'EVERYTHING PERFECT'});
  const p=service.prepare();assert.equal(JSON.stringify(p).includes('EVERYTHING PERFECT'),false);
  const ids=packetIds(p);engine.reviewEpoch++;assert.throws(()=>service.validate(pass(ids)),/observationIds/);
  assert.throws(()=>fixture().service.validate(pass(ids)),/observationIds/);
});
test('coordinate-only context gives no observation; real paired context is accepted for issue resolution',()=>{
  const {service}=fixture();
  assert.equal(service.captureContext({referenceStatus:'available',region:[0,0,100,100]}).observation,undefined);
  const issue=service.update({description:'neck detail',region:[10,10,20,20]});
  const result=service.captureContext({referenceStatus:'available',image:{dataUrl:png,panels:{drawing:{region:[10,10,20,20],scale:1}}}});
  service.update({action:'resolve',id:issue.id,note:'compared',observationIds:[result.observation.id]});
  assert.equal(service.issues()[0].status,'resolved');
});
test('legacy issue text migrates once and clearing review text cannot erase it',()=>{
  const d=blankDocument(100,100);delete d.partIssues;d.reviews=[{issues:['deformed foot']}];
  const imported=validateDocument(d);assert.equal(imported.partIssues[0].description,'deformed foot');
  imported.reviews=[];assert.equal(validateDocument(imported).partIssues.length,1);
});
test('full views cannot replace small part crops; completed line approvals survive subsequent color only',()=>{
  const {engine,service}=fixture();
  engine.doc.commands=[{id:'shoe',stage:'lineart',subphase:'clean',objectId:'shoe',points:[[40,80],[50,90]]}];
  const p=service.prepare();assert.equal(p.locals.length,1);
  assert.throws(()=>service.validate(pass([p.full.observation.id,p.mirrored.observation.id])),/部位局部/);
  for(const task of service.feedback().inspection.pending)service.recordInspection({target:task.target,observationIds:packetIds(p),comparisons:service.feedback().inspection.criteria.map(c=>({criterion:c.id,reference:'shoe heel projects and toe narrows',drawing:'heel and toe widths correspond to reference',conclusion:'aligned'}))});
  service.record(pass(packetIds(p)));assert.equal(service.approved('structure-checkpoint'),true);
  engine.doc.commands.push({id:'color',stage:'base',points:[[40,80],[50,90]]});engine.cursor=5;
  assert.equal(service.approved('structure-checkpoint'),true);
  engine.doc.commands[0].points[0][0]++;assert.equal(service.approved('structure-checkpoint'),false);
});
test('concrete targets amend stable issues, preserve guide links on import and flag deleted guides',()=>{
 const {engine,service}=fixture();engine.doc.commands=[{id:'draft',type:'stroke',stage:'lineart',points:[[10,10],[20,20]]}];
 const issue=service.update({description:'heel too flat',target:'heel projects before the arch turns inward',guideIds:['draft'],region:[10,10,20,20]});
 const changed=service.update({action:'amend',id:issue.id,target:'heel projects; forefoot widens before toes taper'});
 assert.equal(changed.id,issue.id);assert.deepEqual(changed.guideIds,['draft']);assert.equal(changed.history[0].action,'amend');
 assert.throws(()=>service.update({action:'amend',id:issue.id,guideIds:['missing']}),/guideIds/);
 assert.deepEqual(service.issues()[0].guideIds,['draft']);engine.doc.commands=[];
 engine.doc=validateDocument(engine.doc);assert.match(service.issues()[0].target,/forefoot/);assert.deepEqual(service.issues()[0].missingGuideIds,['draft']);
});
