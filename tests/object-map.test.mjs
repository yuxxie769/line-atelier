import test from 'node:test';
import assert from 'node:assert/strict';
import {blankDocument,validateDocument} from '../app/model.js';
import {OBJECT_MAP_GUIDANCE,objectMapBounds,objectMapSummary,validateMappedObjectCommands,validateObjectMapObservations} from '../app/object-map.js';
import {collectDrawingContext} from '../app/drawing-context.js';

const map={id:'map-1',referenceKey:'reference-1',coordinateSpace:'document',subjectType:'figure',status:'ready',observationIds:['reference-1'],anatomyCoverage:[
  {kind:'hands',status:'mapped',itemIds:['right-hand']},{kind:'feet',status:'not-visible',itemIds:[]},{kind:'joints',status:'mapped',itemIds:['right-hand']},{kind:'neck-shoulders',status:'not-visible',itemIds:[]},{kind:'body-clothing',status:'mapped',itemIds:['right-hand']}
],items:[{id:'right-hand',name:'右手',category:'body',form:'掌块连到袖口，手指成组向右展开',relations:'腕部进入袖口',uncertainty:'掌侧受道具遮挡',visibleMasks:[{id:'hand-main',polygon:[[100,100],[150,96],[170,125],[140,150],[102,138]]},{id:'hand-tip',polygon:[[176,116],[184,119],[181,130],[174,126]]}],landmarks:[{role:'connection',point:[102,120]}],status:'ready'}],revision:1,history:[]};

test('object map persists fixed reference masks without turning them into artwork selections',()=>{
  const doc=validateDocument({...blankDocument(300,300),objectMap:map,commands:[{id:'hand-line',mapItemId:'right-hand',points:[[105,120],[140,110]],color:'#112233'}]});
  assert.equal(doc.masks.length,0);
  assert.equal(doc.commands[0].mapItemId,'right-hand');
  assert.deepEqual(objectMapBounds(doc.objectMap.items[0],{padding:10,width:300,height:300}),[90,86,104,74]);
  assert.equal(objectMapSummary(doc.objectMap,'reference-1').ready,true);
  assert.equal(objectMapSummary(doc.objectMap,'other-reference').status,'reference-mismatch');
});

test('map item context derives the crop from the fixed observation mask',()=>{
  const doc=validateDocument({...blankDocument(300,300),objectMap:map,commands:[{id:'hand-guide',mapItemId:'right-hand',subphase:'rough',points:[[105,120],[140,110]],color:'#112233'}]});
  const context=collectDrawingContext(doc,{mapItemId:'right-hand',padding:10});
  assert.equal(context.cropBasis,'object-observation-mask');
  assert.equal(context.mapItem.form,map.items[0].form);
  assert.equal(context.commands[0].relationship,'map-item');
  assert.deepEqual(context.region,[90,86,104,74]);
});

test('object map requires a current non-mirrored full-canvas reference observation',()=>{
  const observations=new Map([
    ['full',{id:'full',referenceKey:'reference-1',revision:3,region:[0,0,300,300],mirror:false}],
    ['local',{id:'local',referenceKey:'reference-1',revision:3,region:[0,0,200,200],mirror:false}],
    ['mirror',{id:'mirror',referenceKey:'reference-1',revision:3,region:[0,0,300,300],mirror:true}]
  ]);
  assert.equal(validateObjectMapObservations(['full'],observations,{referenceKey:'reference-1',revision:3,width:300,height:300})[0].id,'full');
  assert.throws(()=>validateObjectMapObservations(['local'],observations,{referenceKey:'reference-1',revision:3,width:300,height:300}),/整幅画布/);
  assert.throws(()=>validateObjectMapObservations(['mirror'],observations,{referenceKey:'reference-1',revision:3,width:300,height:300}),/整幅画布/);
  assert.throws(()=>validateObjectMapObservations(['full'],observations,{referenceKey:'reference-1',revision:4,width:300,height:300}),/整幅画布/);
  assert.match(OBJECT_MAP_GUIDANCE,/不是作品选区或绘画路径/);
  assert.match(OBJECT_MAP_GUIDANCE,/mapItemId/);
});

test('new 1B strokes bind a ready global object while layout remains an app-level exception',()=>{
  assert.equal(validateMappedObjectCommands([{mapItemId:'right-hand'}],map),true);
  assert.throws(()=>validateMappedObjectCommands([{}],map),/mapItemId/);
  assert.throws(()=>validateMappedObjectCommands([{mapItemId:'missing'}],map),/不存在/);
  const pending={...map,items:[{...map.items[0],status:'needs-evidence'}]};
  assert.throws(()=>validateMappedObjectCommands([{mapItemId:'right-hand'}],pending),/缺观察证据/);
});
