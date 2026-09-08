import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {drawingProtocol,drawingReferenceCard,drawingReferenceCardCatalog} from '../app/drawing-protocol.js';
import {syncDrawingProtocol} from '../scripts/sync-drawing-protocol.mjs';

test('browser payload and document are the complete canonical protocol with a matching version',async()=>{
  const source=(await readFile(new URL('../docs/WORKFLOW_PRINCIPLES.md',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const copy=(await readFile(new URL('../app/docs/workflow-principles.md',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const protocol=drawingProtocol();
  assert.equal(protocol.text,source);
  assert.equal(copy,source);
  assert.equal(protocol.sha256,createHash('sha256').update(source).digest('hex'));
  assert.equal(protocol.source,'docs/WORKFLOW_PRINCIPLES.md');
  await syncDrawingProtocol({check:true});
});

test('omitting text is per call; another caller always receives full text by default',()=>{
  const full=drawingProtocol();
  assert.deepEqual(drawingProtocol({includeProtocol:false}),{source:full.source,sha256:full.sha256,referenceCards:full.referenceCards});
  const modified=drawingProtocol();modified.text='caller edit';modified.sha256='caller version';
  assert.deepEqual(drawingProtocol(),full);
  assert.deepEqual(drawingProtocol({includeProtocol:true}),full);
  for(const includeProtocol of ['false',0,null])assert.throws(()=>drawingProtocol({includeProtocol}),/boolean/);
});

test('the only active anatomy set exposes complete phase-routed chapters and local images',async()=>{
  const catalog=drawingReferenceCardCatalog();
  assert.equal(catalog.sourceArticle,'https://tips.clip-studio.com/zh-cn/articles/11661');
  assert.equal(catalog.cards.length,10);
  assert.equal(catalog.cards.some(card=>card.id==='CSP-10'),false);
  const layout=drawingReferenceCardCatalog({phase:'layout'});
  assert.deepEqual(layout.requiredCardIds,['CSP-01','CSP-05']);
  assert.deepEqual(layout.cards.filter(card=>card.required).map(card=>card.id),layout.requiredCardIds);
  const refine=drawingReferenceCardCatalog({phase:'refine'});
  assert.deepEqual(refine.cards.map(card=>card.id),['CSP-08']);
  assert.deepEqual(refine.requiredCardIds,['CSP-08']);
  for(const summary of catalog.cards){
    const card=drawingReferenceCard(summary.id);
    const source=(await readFile(new URL('../'+card.source,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
    assert.equal(card.text,source);
    assert.equal(card.sha256,createHash('sha256').update(source).digest('hex'));
    assert.ok(card.images.length>0);
    for(const image of card.images){
      const original=await readFile(new URL('../'+image.source,import.meta.url));
      const served=await readFile(new URL('../app'+image.publicPath,import.meta.url));
      assert.ok(original.equals(served));
    }
  }
  assert.throws(()=>drawingReferenceCard('SC-02'),/Unknown reference card/);
});

test('each phase loads only its own canonical requirements, even when core text is omitted',async()=>{
  const phases=['layout','rough','structure_review','refine','clean','lineart_review'];
  assert.equal(drawingProtocol().stage,undefined);
  for(const phase of phases){
    const source='docs/workflow-stages/'+phase+'.md';
    const text=(await readFile(new URL('../'+source,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
    const full=drawingProtocol({phase});
    const {agentReview,...stageBody}=full.stage;
    assert.deepEqual(stageBody,{phase,source,text,sha256:createHash('sha256').update(text).digest('hex')});
    assert.equal(full.text,drawingProtocol().text);
    const brief=drawingProtocol({phase,includeProtocol:false});
    assert.equal(brief.text,undefined);
    assert.deepEqual(brief.stage,full.stage);
    if(['refine','clean','lineart_review'].includes(phase))assert.deepEqual(brief.compoundMethod,full.compoundMethod);
    else assert.equal(brief.compoundMethod,undefined);
    full.stage.text='mutated by consumer';
    assert.equal(drawingProtocol({phase}).stage.text,text);
  }
  for(const phase of ['unknown','toString','__proto__',null])assert.throws(()=>drawingProtocol({phase}),/Unknown/);
});

test('mandatory compound method is independently hashed and injected only in drawing quality phases',async()=>{
  const source=(await readFile(new URL('../docs/drawing-methods/COMPOUND_V1.md',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  for(const phase of ['refine','clean','lineart_review']){
    const method=drawingProtocol({phase,includeProtocol:false}).compoundMethod;
    assert.equal(method.id,'compound-v1');
    assert.equal(method.version,'3.1.0');
    assert.equal(method.source,'docs/drawing-methods/COMPOUND_V1.md');
    assert.equal(method.text,source);
    assert.equal(method.sha256,createHash('sha256').update(source).digest('hex'));
  }
  for(const phase of ['layout','rough','structure_review'])assert.equal(drawingProtocol({phase}).compoundMethod,undefined);
});

test('specific acceptance criteria are deferred until review, preserving cross-object checks',()=>{
  const core=drawingProtocol().text;
  assert.ok(!core.includes('泄漏预览应针对待验交界'));
  assert.ok(!drawingProtocol({phase:'layout'}).stage.text.includes('泄漏预览应针对待验交界'));
  const review=drawingProtocol({phase:'lineart_review'}).stage.text;
  assert.ok(review.includes('泄漏预览应针对待验交界'));
  assert.ok(review.includes('仅看到一条弧线或外轮廓闭合'));
  assert.ok(review.includes('临摹一致性'));
});

test('agent review instructions route only to A, C and the second F round, with fresh bounded review',async()=>{
  const text=(await readFile(new URL('../docs/workflow-actions/agent-review.md',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  for(const phase of ['layout','structure_review','lineart_review']){
    const guide=drawingProtocol({phase,includeProtocol:false}).stage.agentReview;
    assert.equal(guide.text,text);
    assert.equal(guide.sha256,createHash('sha256').update(text).digest('hex'));
    assert.equal(guide.required,true);
    assert.equal(guide.maxAgentCalls,2);
    assert.equal(guide.freshAgentForFinalReview,true);
    assert.equal(guide.formalReviewRound,phase==='lineart_review'?2:null);
    assert.equal(guide.trigger,phase==='lineart_review'?'before-lineart-checkpoint':'before-stage-advance');
    assert.equal(guide.acceptance.maxMajorIssues,0);
    assert.equal(guide.acceptance.minorIssuesBlock,false);
    assert.equal(guide.dispatchAutomatic,false);
    assert.equal(guide.reviewerIdentityVerified,false);
    guide.acceptance.maxMajorIssues=99;
    assert.equal(drawingProtocol({phase}).stage.agentReview.acceptance.maxMajorIssues,0);
  }
  for(const phase of ['rough','refine','clean'])assert.equal(drawingProtocol({phase}).stage.agentReview,undefined);
  assert.equal(drawingProtocol().stage,undefined);
});


test('combined operation guide is generated from one source and excluded from core loading',async()=>{
 const {drawingOperationGuide}=await import('../app/drawing-protocol.js');
 const source=(await readFile(new URL('../docs/workflow-actions/local-revision.md',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
 const copy=(await readFile(new URL('../app/docs/workflow-actions/local-revision.md',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
 assert.equal(copy,source);assert.equal(drawingOperationGuide().text,source);
 assert.equal(drawingOperationGuide().sha256,createHash('sha256').update(source).digest('hex'));
 assert.ok(source.includes('basis.guideIds'));assert.ok(source.includes('imageToDocument'));
 assert.ok(!drawingProtocol().text.includes('basis.guideIds'));
 assert.ok(!drawingProtocol().text.includes('## 每个部位的执行循环'));
});
