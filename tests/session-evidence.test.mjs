import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionEvidence,exportEvidenceSnapshot} from '../app/session-evidence.js';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4ZkAAAAASUVORK5CYII=';
function fixture(){return {doc:{revision:2,title:'trial',width:100,height:100,commands:[{id:'guide',points:[[20,30],[40,30]]}],reviews:[],events:[]},cursor:100,index:{total:100},playing:false,undoStack:[]};}
test('read / batch / result image retain real IDs and geometry without putting reads in drawing history',async()=>{
  const e=fixture(),before=JSON.stringify(e),saved=[];
  const log=createSessionEvidence(e,{save:async value=>saved.push(value)});
  const first=await log.run('paint_inspect_context',{query:'eye'},async()=>({revision:2,region:[10,10,50,50],referenceStatus:'available',strokes:e.doc.commands,anchors:[{id:'corner'}],nextOffset:null,image:{dataUrl:png,width:1,height:1}}),'webmcp');
  assert.equal(JSON.stringify(e),before);
  const batch=await log.run('paint_submit',{basis:{guideIds:['guide'],note:'Keep guide start'},commands:[{id:'ink'}]},async()=>{e.doc.commands.push({id:'ink',points:[[20,30],[40,29]],geometry:{through:[[20,30],[40,29]]}});e.doc.revision++;return {commandIds:['ink'],accepted:1};});
  const last=await log.run('paint_snapshot_region',{region:[10,10,50,50]},async()=>({region:[10,10,50,50],dataUrl:png,width:1,height:1}),'webmcp');
  const all=log.snapshot();
  assert.equal(all.events[1].basisReads[0].callIds[0],first.callEvidence.callId);
  assert.deepEqual(all.events[1].acceptedStrokes[0].geometry.through,[[20,30],[40,29]]);
  assert.deepEqual(batch.callEvidence.strokeIds,['ink']);
  assert.equal(batch.callEvidence.revisionBefore,2);assert.equal(batch.callEvidence.revisionAfter,3);
  assert.equal(all.events[2].images[0].groupIds[0],batch.callEvidence.groupId);
  assert.equal(last.callEvidence.imageIds.length,1);assert.equal(all.images.length,1);
  assert.equal(all.events[0].returnedAnchorIds[0],'corner');assert.equal(all.events[0].entryPoint,'webmcp');assert.equal(all.events[1].entryPoint,'page-api');
  assert.equal(all.events[2].images[0].visualObservation,'requires-conversation-image-evidence');
  assert.equal(JSON.stringify(all.events).includes('data:image'),false);
  assert.equal(exportEvidenceSnapshot(saved.at(-1),{includeImages:true}).images[0].dataUrl,png);
  assert.equal(log.export({limit:1}).nextOffset,1);assert.equal(log.export({offset:2}).nextOffset,null);
  assert.equal(log.export().images[0].dataUrl,undefined);
});
test('missing, incorrect and omitted guides do not block strokes; real execution failures are retained',async()=>{
  const e=fixture(),log=createSessionEvidence(e);let calls=0;
  await log.run('paint_submit',{basis:{guideIds:['missing'],note:'No usable guide; establish a position'}},async()=>{calls++;return {};});
  await log.run('paint_submit',{},async()=>{calls++;return {};});
  await assert.rejects(log.run('paint_revise',{replace:[{id:'missing'}]},async()=>{throw Error('missing stroke');}),/missing stroke/);
  assert.equal(calls,2);const events=log.snapshot().events;
  assert.deepEqual(events[0].basisReads[0].callIds,[]);assert.equal(events[1].basisStatus,'not-provided');assert.equal(events[2].status,'failed');
  assert.deepEqual(events[2].before,events[2].after);
});
test('concurrent calls are serialized, and recording/storage failure cannot turn an accepted stroke into a failed write',async()=>{
  const e=fixture(),log=createSessionEvidence(e,{save:async()=>{throw Error('quota');}});
  const submit=log.run('paint_submit',{},async()=>{await new Promise(resolve=>setTimeout(resolve,5));e.doc.revision++;return {accepted:1};});
  const read=log.run('paint_get_state',{},async()=>({revision:e.doc.revision}));
  const [a,b]=await Promise.all([submit,read]);assert.equal(b.revision,3);assert.equal(a.callEvidence.persistence,'memory');
  assert.equal(log.snapshot().events[0].status,'succeeded');assert.match(log.snapshot().events[0].persistenceError,/quota/);
  const broken=await log.run('paint_submit',{},async()=>({accepted:1,dataUrl:'data:image/png;base64,!'}));
  assert.equal(broken.accepted,1);assert.equal(log.snapshot().events[2].status,'succeeded');assert.ok(log.snapshot().events[2].evidenceError);
});
test('compact evidence retains complete source geometry and legacy trajectories without changing the saved log',()=>{
  const strokes=[{id:'source',points:[[1,2],[3,4],[5,6]],geometry:{through:[[1,2],[5,6]],space:'eye'},width:2},
    {id:'legacy',points:[[7,8],[9,10]],width:1}];
  const session={version:1,id:'test',events:[{images:[],result:{commands:strokes},acceptedStrokes:strokes}],images:[]};
  const before=structuredClone(session),output=exportEvidenceSnapshot(session,{compact:true});
  assert.deepEqual(output.events[0].result.commands[0].geometry,strokes[0].geometry);
  assert.equal(output.events[0].result.commands[0].points,undefined);
  assert.equal(output.events[0].acceptedStrokes[0].sampledPointCount,3);
  assert.deepEqual(output.events[0].result.commands[1],strokes[1]);
  assert.deepEqual(session,before);
  assert.deepEqual(exportEvidenceSnapshot(session).events[0].acceptedStrokes,strokes);
});
test('reference-card reads retain compact chapter provenance rather than chapter or image payloads',async()=>{
  const e=fixture(),log=createSessionEvidence(e);
  const jpeg='data:image/jpeg;base64,ZmFrZQ==';
  const result=await log.run('paint_get_reference_card',{id:'CSP-05'},async()=>({
    id:'CSP-05',title:'辅助线',purpose:'建立人体动作基线',source:'docs/anatomy-card-assets-clipstudio-11661/chapters/CSP-05-guides.md',sha256:'abc123',
    phases:['layout','rough'],text:'chapter body must not be retained',
    images:[{index:2,name:'019-body-5198168.jpg',source:'docs/anatomy-card-assets-clipstudio-11661/v1-source-mirror/019-body-5198168.jpg',publicPath:'/docs/anatomy-card-assets-clipstudio-11661/v1-source-mirror/019-body-5198168.jpg',dataUrl:jpeg}],totalImages:8,complete:true
  }),'webmcp');
  const event=log.snapshot().events[0];
  const expected={id:'CSP-05',title:'辅助线',purpose:'建立人体动作基线',source:'docs/anatomy-card-assets-clipstudio-11661/chapters/CSP-05-guides.md',sha256:'abc123',phases:['layout','rough'],totalImages:8,images:[{index:2,name:'019-body-5198168.jpg',source:'docs/anatomy-card-assets-clipstudio-11661/v1-source-mirror/019-body-5198168.jpg',publicPath:'/docs/anatomy-card-assets-clipstudio-11661/v1-source-mirror/019-body-5198168.jpg'}]};
  assert.deepEqual(event.referenceCard,expected);
  assert.deepEqual(event.result,{referenceCard:expected});
  assert.deepEqual(result.callEvidence.referenceCard,expected);
  assert.equal(event.images.length,0);
  assert.equal(JSON.stringify(event).includes('chapter body must not be retained'),false);
  assert.equal(JSON.stringify(event).includes(jpeg),false);
});
test('image reads record completion and the interval to the next model action in both directions',async()=>{
  const ticks=['2026-09-07T09:59:59.000Z','2026-09-07T10:00:00.000Z','2026-09-07T10:00:00.250Z','2026-09-07T10:00:02.750Z','2026-09-07T10:00:03.000Z'];
  const e=fixture(),log=createSessionEvidence(e,{now:()=>ticks.shift()});
  await log.run('paint_snapshot_region',{region:[0,0,10,10]},async()=>({region:[0,0,10,10],dataUrl:png,width:1,height:1}),'webmcp');
  await log.run('paint_submit',{commands:[{id:'next'}]},async()=>({accepted:1}),'webmcp');
  const [read,next]=log.snapshot().events;
  assert.deepEqual(read.imageRead,{completedAt:'2026-09-07T10:00:00.250Z',imageCount:1,imageIds:[read.images[0].id],referenceCardImages:[]});
  assert.deepEqual(read.nextAction,{callId:next.id,tool:'paint_submit',entryPoint:'webmcp',startedAt:'2026-09-07T10:00:02.750Z',delayMs:2500});
  assert.deepEqual(next.sinceImageRead,{callId:read.id,tool:'paint_snapshot_region',completedAt:'2026-09-07T10:00:00.250Z',delayMs:2500});
});
