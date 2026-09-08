import test from 'node:test';
import assert from 'node:assert/strict';
import {blankDocument,validateBatch} from '../app/model.js';
import {inspectStrokeQuality} from '../app/stroke-quality.js';

const docWith=commands=>{const doc=blankDocument(1000,1000);doc.commands=validateBatch(commands,doc);return doc;};
const base={type:'stroke',stage:'detail',subphase:'clean',color:'#111111',width:2,part:'leg'};

test('quality audit leaves a simple long sweep alone',()=>{
  const doc=docWith([{...base,id:'sweep',path:'M 50 500 C 260 260 720 260 950 500',taper:[.2,.9,.2]}]);
  const report=inspectStrokeQuality(doc);
  assert.equal(report.summary.longComplexStrokes,0);
  assert.equal(report.summary.warningCount,0);
});

test('quality audit identifies a complex monolithic contour with generic taper',()=>{
  const doc=docWith([{...base,id:'whole-leg',path:'M 80 100 L 240 80 L 300 240 L 210 390 L 330 540 L 230 700 L 360 900',taper:[.2,.9,.2]}]);
  const report=inspectStrokeQuality(doc);
  assert.equal(report.summary.longComplexStrokes,1);
  assert.equal(report.summary.monolithicComplexStrokes,1);
  assert.equal(report.summary.genericTaperOnly,1);
  assert.equal(report.warnings[0].kind,'monolithic-complex-contour');
  assert.equal(report.warnings[0].missingLocalPressure,true);
});

test('a declared compound contour records topology and local pressure without monolithic warning',()=>{
  const commands=[
    {...base,id:'upper',compoundId:'leg-outer',strokeRole:'silhouette',joinStyle:'overlap',path:'M 80 100 Q 240 70 300 240',pressureProfile:[[0,.2],[.55,1],[1,.45]]},
    {...base,id:'knee',compoundId:'leg-outer',strokeRole:'turn',joinStyle:'overlap',path:'M 286 220 Q 230 360 330 540',pressureProfile:[[0,.35],[.45,1],[1,.3]]},
    {...base,id:'lower',compoundId:'leg-outer',strokeRole:'silhouette',joinStyle:'shared',path:'M 318 520 Q 215 700 360 900',pressureProfile:[[0,.3],[.6,.85],[1,.15]]}
  ];
  const report=inspectStrokeQuality(docWith(commands));
  assert.equal(report.summary.compoundGroups,1);
  assert.equal(report.summary.compoundCoveredStrokes,3);
  assert.equal(report.summary.locallyPressureAuthored,3);
  assert.equal(report.summary.monolithicComplexStrokes,0);
  assert.equal(report.compoundGroups[0].complete,true);
  assert.equal(report.summary.warningCount,0);
});

test('incomplete or mixed-target compound metadata stays advisory',()=>{
  const doc=docWith([
    {...base,id:'a',part:'leg',compoundId:'mixed',strokeRole:'silhouette',path:'M 0 0 L 100 100'},
    {...base,id:'b',part:'skirt',compoundId:'mixed',joinStyle:'overlap',path:'M 95 95 L 200 140'}
  ]);
  const report=inspectStrokeQuality(doc);
  assert.equal(report.warnings[0].kind,'compound-metadata-incomplete');
  assert.match(report.warnings[0].note,/多个目标/);
});
