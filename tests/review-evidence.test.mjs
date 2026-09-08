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
test('refine requires whole diagnosis, then one current image-bound local diagnosis with an exact target',()=>{
  const {engine,service,reference}=fixture();engine.doc.workflow.phase='refine';
  const full=service.observe([0,0,100,100],false,1).observation.id;
  const base={observationIds:[full],referenceFacts:'参考中袖口围绕手腕形成明确开口',structureInference:'袖口是包裹手腕的截面，前后边有遮挡次序',drawingFacts:'当前草稿只有一条概括边，没有交代开口厚度',uncertainty:'手腕背侧被袖口遮挡，不能补画不可见边'};
  const earlyLocal=service.observe([20,20,40,40],false,1).observation.id;
  assert.throws(()=>service.recordRefinementDiagnosis({...base,observationIds:[earlyLocal],scope:'local',target:'right-sleeve',region:[20,20,40,40],decision:'detail',actionTarget:'补出前后袖口边'}),/整图诊断/);
  const whole=service.recordRefinementDiagnosis({...base,scope:'whole',decision:'proceed'});assert.equal(whole.authorization,'none');
  const localId=service.observe([20,20,40,40],false,1).observation.id;
  const local=service.recordRefinementDiagnosis({...base,observationIds:[localId],scope:'local',target:'right-sleeve',region:[20,20,40,40],decision:'detail',actionTarget:'补出袖口前边、后边及手腕遮挡起止'});
  assert.equal(local.authorization,'one-batch');assert.doesNotThrow(()=>service.assertRefinementDiagnosis(local.id,['right-sleeve']));
  assert.throws(()=>service.assertRefinementDiagnosis(local.id,['hair']),/target配|一致/);
  engine.doc.layers[0].visible=false;assert.throws(()=>service.assertRefinementDiagnosis(local.id,['right-sleeve']),/失效/);
  engine.doc.layers[0].visible=true;reference('reference-b');assert.throws(()=>service.assertRefinementDiagnosis(local.id,['right-sleeve']),/整图诊断/);
  assert.ok(engine.doc.refinementDiagnoses.length>=2);assert.equal(engine.doc.refinementDiagnoses.some(d=>d.imageKey||d.phaseKey),false);
  assert.equal(validateDocument(engine.doc).refinementDiagnoses.length,engine.doc.refinementDiagnoses.length);
});
test('retain diagnosis records the decision but cannot authorize refine drawing',()=>{
  const {engine,service}=fixture();engine.doc.workflow.phase='refine';
  const observationIds=[service.observe([0,0,100,100],false,1).observation.id];
  const facts={referenceFacts:'参考轮廓在该段保持平缓',structureInference:'该段属于已经确定的外轮廓',drawingFacts:'草稿轮廓与参考位置和转向一致',uncertainty:'无；相邻遮挡也清楚'};
  service.recordRefinementDiagnosis({...facts,scope:'whole',observationIds,decision:'proceed'});
  const localIds=[service.observe([10,10,30,30],false,1).observation.id];
  const retained=service.recordRefinementDiagnosis({...facts,scope:'local',target:'collar',region:[10,10,30,30],observationIds:localIds,decision:'retain'});
  assert.equal(retained.authorization,'none');assert.throws(()=>service.assertRefinementDiagnosis(retained.id,['collar']),/不授权/);
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
test('resolved issues reopen only for linked geometry and duplicate resolve is idempotent',()=>{
  const {engine,service}=fixture();engine.doc.commands=[
    {id:'collar',type:'stroke',stage:'lineart',subphase:'clean',points:[[10,10],[20,20]]},
    {id:'hair',type:'stroke',stage:'lineart',subphase:'clean',points:[[70,70],[80,80]]}
  ];
  const issue=service.update({description:'collar edge missing',guideIds:['collar'],region:[8,8,20,20]});
  const observation=service.observe(issue.region).observation.id;
  const resolved=service.update({action:'resolve',id:issue.id,note:'collar checked',observationIds:[observation]});
  const historyLength=resolved.history.length;
  const duplicate=service.update({action:'resolve',id:issue.id});
  assert.equal(duplicate.unchanged,true);assert.equal(service.issues()[0].history.length,historyLength);
  engine.doc.revision++;invalidatePartIssues(engine.doc,{ids:['hair']});
  assert.equal(service.issues()[0].status,'resolved');
  engine.doc.revision++;invalidatePartIssues(engine.doc,{ids:['collar']});
  assert.equal(service.issues()[0].status,'awaiting-review');
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
  for(const task of service.feedback().inspection.stagePending)service.recordInspection({target:task.target,observationIds:packetIds(p),comparisons:service.feedback().inspection.criteria.map(c=>({criterion:c.id,reference:'shoe heel projects and toe narrows',drawing:'heel and toe widths correspond to reference',conclusion:'aligned'}))});
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
