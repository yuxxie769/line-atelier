import test from 'node:test';
import assert from 'node:assert/strict';
import {assertStrokeBatch,assertCleanDraftBasis,assertCompoundPlanning} from '../app/workflow-policy.js';

const lines=(count,overrides={})=>Array.from({length:count},(_,i)=>({id:'line-'+i,type:'stroke',part:'hair',intent:'open interior hair strand',endpoints:['open','open'],...overrides}));

test('standard drawing batches remain limited to three strokes',()=>{
  assert.equal(assertStrokeBatch({commands:lines(3),phase:'clean'}),3);
  assert.throws(()=>assertStrokeBatch({commands:lines(4),phase:'clean'}),/最多 3 笔/);
});

test('every drawing phase allows low-risk batches of five or six same-target open strokes',()=>{
  for(const phase of ['layout','rough','structure_review','refine','clean','lineart_review']){
    assert.equal(assertStrokeBatch({commands:lines(5),phase,batchMode:'low-risk-clean'}),6);
    assert.equal(assertStrokeBatch({commands:lines(6),phase,batchMode:'low-risk-clean'}),6);
  }
  assert.throws(()=>assertStrokeBatch({commands:lines(4),phase:'clean',batchMode:'low-risk-clean'}),/5–6 笔/);
  assert.throws(()=>assertStrokeBatch({commands:lines(7),phase:'clean',batchMode:'low-risk-clean'}),/最多 6 笔/);
});

test('low-risk batches reject mixed targets, connections and sensitive anatomy',()=>{
  const mixed=lines(5);mixed[4].part='costume';
  assert.throws(()=>assertStrokeBatch({commands:mixed,phase:'clean',batchMode:'low-risk-clean'}),/同一个 part/);
  assert.throws(()=>assertStrokeBatch({commands:lines(5,{endpoints:['joined','open']}),phase:'clean',batchMode:'low-risk-clean'}),/两端均明确为 open/);
  assert.throws(()=>assertStrokeBatch({commands:lines(5,{part:'eye'}),phase:'clean',batchMode:'low-risk-clean'}),/必须使用 1–3 笔/);
});

test('clean requires retained same-part draft guides while other phases stay unchanged',()=>{
  const commands=[
    {id:'draft-face',type:'stroke',part:'face',subphase:'refine',layer:'draft'},
    {id:'draft-hand',type:'stroke',objectId:'hand',subphase:'rough',layer:'draft'},
    {id:'clean-face',type:'stroke',part:'face',subphase:'clean',layer:'ink'}
  ];
  const layers=[{id:'draft',role:'sketch'},{id:'ink',role:'ink'}];
  assert.deepEqual(assertCleanDraftBasis({phase:'clean',basis:{guideIds:['draft-face']},targets:['face'],commands,layers}),['draft-face']);
  assert.throws(()=>assertCleanDraftBasis({phase:'clean',targets:['face'],commands,layers}),/basis\.guideIds/);
  assert.throws(()=>assertCleanDraftBasis({phase:'clean',basis:{guideIds:['clean-face']},targets:['face'],commands,layers}),/保留的底稿/);
  assert.throws(()=>assertCleanDraftBasis({phase:'clean',basis:{guideIds:['draft-hand']},targets:['face'],commands,layers}),/同部位底稿/);
  assert.deepEqual(assertCleanDraftBasis({phase:'refine',targets:['face'],commands,layers}),[]);
});

test('mandatory phases require every direct line to declare a justified simple sweep',()=>{
  const command={id:'sweep',type:'stroke',part:'hair'};
  assert.deepEqual(assertCompoundPlanning({commands:[command],rawCommands:[command],phase:'rough'}),[]);
  assert.throws(()=>assertCompoundPlanning({commands:[command],rawCommands:[command],phase:'clean'}),/contourMode/);
  assert.throws(()=>assertCompoundPlanning({commands:[command],rawCommands:[{...command,contourMode:'simple-sweep'}],phase:'clean'}),/simpleSweepReason/);
  assert.deepEqual(assertCompoundPlanning({commands:[command],rawCommands:[{...command,contourMode:'simple-sweep',simpleSweepReason:'单一方向的短发丝'}],phase:'clean'}),[]);
});

test('classification cannot bypass compiler-only compound output or complex geometry rejection',()=>{
  const declared={id:'edge',type:'stroke',part:'sleeve',contourMode:'simple-sweep',simpleSweepReason:'claimed simple'};
  assert.throws(()=>assertCompoundPlanning({commands:[{...declared,compoundId:'manual'}],rawCommands:[declared],phase:'refine'}),/不能直接手写/);
  assert.throws(()=>assertCompoundPlanning({commands:[declared],rawCommands:[declared],phase:'refine',qualityReport:{warnings:[{kind:'monolithic-complex-contour',strokeIds:['edge']} ]}}),/长而复杂/);
});
