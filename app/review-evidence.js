import {drawingProtocol} from './drawing-protocol.js';
import {localChangeFeedback} from './local-feedback.js';
import {createVisualInspection} from './visual-inspection.js';
const reviewCopy=value=>structuredClone(value);
const contains=(a,b)=>a&&b&&a[0]<=b[0]&&a[1]<=b[1]&&a[0]+a[2]>=b[0]+b[2]&&a[1]+a[3]>=b[1]+b[3];
export function normalizePartIssues(value=[]){
  if(!Array.isArray(value))throw Error('partIssues must be an array');
  return value.map(i=>{
    if(typeof i.id!=='string'||typeof i.description!=='string'||!['open','awaiting-review','resolved','dismissed'].includes(i.status))throw Error('Invalid part issue');
    if(!Array.isArray(i.region)||i.region.length!==4||i.region.some(n=>!Number.isFinite(n))||i.region[2]<=0||i.region[3]<=0||i.objectIds!==undefined&&!Array.isArray(i.objectIds)||i.history!==undefined&&!Array.isArray(i.history))throw Error('Invalid part issue region/history');
    if(i.target!==undefined&&typeof i.target!=='string'||i.guideIds!==undefined&&(!Array.isArray(i.guideIds)||i.guideIds.some(id=>typeof id!=='string')))throw Error('Invalid issue target/guides');
    return {...reviewCopy(i),objectIds:(i.objectIds||[]).map(String),history:reviewCopy(i.history||[]),target:i.target||'',guideIds:[...(i.guideIds||[])]};
  });
}
export function normalizeRefinementDiagnoses(value=[]){
  if(!Array.isArray(value))throw Error('refinementDiagnoses must be an array');
  return value.slice(-300).map(item=>{
    if(!item||typeof item.id!=='string'||!['whole','local'].includes(item.scope)||typeof item.target!=='string'||!Array.isArray(item.region)||item.region.length!==4||item.region.some(n=>!Number.isFinite(n)))throw Error('Invalid refinement diagnosis');
    return {...reviewCopy(item),observationIds:(item.observationIds||[]).map(String),guideIds:(item.guideIds||[]).map(String)};
  });
}
export function invalidatePartIssues(doc,{ids=[],objectIds=[],previousCommands=[]}={}){
  const strokes=[...ids.map(id=>doc.commands.find(c=>c.id===id)),...previousCommands];
  const intersects=(a,b)=>a[0]<=b[0]+b[2]&&b[0]<=a[0]+a[2]&&a[1]<=b[1]+b[3]&&b[1]<=a[1]+a[3];
  const bounds=c=>{const ps=c?.points||[];if(!ps.length)return null;const xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)];};
  for(const issue of doc.partIssues||[]){
    if(issue.status==='dismissed')continue;
    // A normal edit only reopens issues linked by guide, object or geometry. Restore/unknown edits remain conservative.
    const known=strokes.filter(Boolean),related=!ids.length||!known.length
      ||(issue.guideIds||[]).some(id=>ids.includes(id))
      ||(issue.objectIds||[]).some(id=>objectIds.includes(id))
      ||known.some(c=>{const b=bounds(c);return b&&intersects(issue.region,b);});
    if(!related)continue;
    issue.status='awaiting-review';issue.changedRevision=doc.revision;
  }
}
// The receipt registry is runtime-owned. Imported/self-written IDs are not proof.
export function createReviewEvidence(engine,{referenceKey,renderPair}={}){
  const observations=new Map(),approvals=new Map(),diagnoses=new Map();
  const key=()=>JSON.stringify([engine.reviewEpoch,engine.doc.width,engine.doc.height,engine.doc.background,engine.doc.commands,engine.doc.layers,engine.doc.scene,engine.doc.masks,referenceKey(),engine.cursor,engine.playing]);
  const approvalKey=()=>JSON.stringify([engine.reviewEpoch,engine.doc.width,engine.doc.height,engine.doc.background,engine.doc.commands.filter(c=>c.stage==='lineart'),engine.doc.layers,engine.doc.scene,engine.doc.masks,referenceKey()]);
  const ready=()=>{if(engine.playing||engine.cursor!==engine.index.total)throw Error('先 finish 播放，再生成审核图片');if(!referenceKey())throw Error('审核需要已授权的参考图');};
  const issues=()=>engine.doc.partIssues||=[];
  const inspection=createVisualInspection(engine,{validObservations:valid,referenceKey,partRegions,openIssue:update});
  engine.beforePhaseChange=option=>{
    inspection.beforePhase(option);
    if(engine.doc.workflow.phase==='refine'&&(['clean','lineart_review'].includes(option.phase)||engine.doc.workflow.enabled&&!option.enabled)){
      const whole=liveWholeDiagnosis();
      if(!whole||whole.decision!=='proceed')throw Error('离开 refine 前需要本次运行中允许继续的整图诊断');
    }
  };
  let baseline=null;
  engine.beforeDrawingMutation=()=>{
    baseline=null;
    if(!['refine','clean','lineart_review'].includes(engine.doc.workflow.phase)||engine.playing||engine.cursor!==engine.index.total||!referenceKey()||!engine.captureDrawingSnapshot)return;
    baseline={revision:engine.doc.revision,phase:engine.doc.workflow.phase,epoch:engine.reviewEpoch,reference:referenceKey(),key:key(),width:engine.doc.width,height:engine.doc.height,render:engine.captureDrawingSnapshot()};
  };
  function beforeAfter(region,mirror,scale){
    if(!baseline)return {status:'unavailable',reason:'本次运行没有修改前快照；不能声称已对比修改前后'};
    if(baseline.epoch!==engine.reviewEpoch||baseline.reference!==referenceKey()||baseline.phase!==engine.doc.workflow.phase||baseline.width!==engine.doc.width||baseline.height!==engine.doc.height)return {status:'unavailable',reason:'恢复、参考、阶段或画布变化，旧快照不可配对'};
    if(baseline.key===key())return {status:'unchanged',reason:'快照后尚无画面变化'};
    return {status:'available',beforeRevision:baseline.revision,afterRevision:engine.doc.revision,region:[...region],mirror,scale,drawing:{...baseline.render({region,mirror,scale}),revision:baseline.revision,evidenceRole:'before-drawing'}};
  }
  function pairSummary(pair){const {drawing,...summary}=pair;return summary;}
  function observe(region,mirror=false,scale=1){
    ready();const images=renderPair({region,mirror,scale});
    if(!images.reference?.dataUrl||!images.drawing?.dataUrl)throw Error('审核图片生成不完整');
    const receipt={id:crypto.randomUUID(),revision:engine.doc.revision,region:[...region],mirror,scale,createdAt:Date.now(),meaning:'images-generated-and-returned; visual understanding is not machine-verifiable'};
    const pair=beforeAfter(region,mirror,scale);
    observations.set(receipt.id,{...receipt,key:key(),beforeAfter:pairSummary(pair)});
    return {observation:receipt,...images,beforeAfter:pair};
  }
  function captureContext(result){
    if(engine.playing||engine.cursor!==engine.index.total||result.referenceStatus!=='available'||!referenceKey())return result;
    const panel=result.image?.panels?.drawing;
    const drawing=result.images?.drawing;
    const region=panel?.region||drawing?.region;
    if(!region||!(result.image?.dataUrl||drawing?.dataUrl&&result.images?.reference?.dataUrl))return result;
    const rows=result.commands||result.strokes||[],guideIds=rows.filter(row=>(row.relationship||row.relation)==='explicit').map(row=>row.id);
    const receipt={id:crypto.randomUUID(),revision:engine.doc.revision,region:[...region],mirror:false,scale:panel?.scale||drawing?.scale,guideIds,hasDraftGuides:!!result.images?.guides?.dataUrl||!!result.image?.panels?.guides,createdAt:Date.now(),meaning:'images-generated-and-returned; visual understanding is not machine-verifiable'};
    const pair=beforeAfter(region,false,receipt.scale);
    observations.set(receipt.id,{...receipt,key:key(),beforeAfter:pairSummary(pair)});return {...result,observation:receipt,beforeAfter:pair};
  }
  function valid(ids=[]){return ids.map(id=>observations.get(id)).filter(o=>o&&o.key===key());}
  function partRegions(){
    const lines=engine.doc.commands.filter(c=>c.stage==='lineart');
    const selected=lines.some(c=>c.subphase==='clean')?lines.filter(c=>c.subphase==='clean'):lines;
    const groups=new Map();
    for(const c of selected){const id=c.objectId||c.part||c.layer,b=groups.get(id)||[Infinity,Infinity,-Infinity,-Infinity];for(const p of c.points||[]){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}groups.set(id,b);}
    return [...groups].filter(([,b])=>Number.isFinite(b[0])).map(([part,b])=>{
      const x=Math.max(0,b[0]-8),y=Math.max(0,b[1]-8);
      return {part,region:[x,y,Math.min(engine.doc.width,b[2]+8)-x,Math.min(engine.doc.height,b[3]+8)-y]};
    }).filter(p=>p.region[2]>0&&p.region[3]>0);
  }
  const locallyCovers=(o,region)=>!o.mirror&&o.scale>=1&&contains(o.region,region)&&o.region[2]*o.region[3]<=region[2]*region[3]*4;
  const diagnosisPhaseKey=()=>JSON.stringify([engine.reviewEpoch,engine.doc.width,engine.doc.height,referenceKey(),engine.doc.workflow.phase]);
  const diagnosisText=(value,label)=>{if(typeof value!=='string'||!value.trim()||value.length>1500)throw Error(`${label} 需要 1–1500 字的具体观察`);return value.trim();};
  const diagnosisRegion=region=>{if(!Array.isArray(region)||region.length!==4||region.some(n=>!Number.isFinite(n))||region[0]<0||region[1]<0||region[2]<=0||region[3]<=0||region[0]+region[2]>engine.doc.width||region[1]+region[3]>engine.doc.height)throw Error('诊断区域无效');return [...region];};
  const liveWholeDiagnosis=()=>[...diagnoses.values()].reverse().find(d=>d.scope==='whole'&&d.phaseKey===diagnosisPhaseKey());
  function recordRefinementDiagnosis({scope,target='',region,observationIds=[],referenceFacts,structureInference,drawingFacts,uncertainty,decision,actionTarget='',guideIds=[]}={}){
    if(engine.doc.workflow.phase!=='refine')throw Error('细化前诊断仅用于 1D refine');ready();
    if(!['whole','local'].includes(scope))throw Error('scope 需要 whole 或 local');
    const full=[0,0,engine.doc.width,engine.doc.height],r=diagnosisRegion(scope==='whole'?full:region);
    if(scope==='local'&&!target.trim())throw Error('局部诊断需要精确 target，并与后续笔迹 part 或 objectId 一致');
    if(scope==='whole'&&target&&target!=='whole')throw Error('整图诊断的 target 只能为 whole');
    const allowed=scope==='whole'?['proceed','return-structure','needs-evidence']:['detail','repair','retain','needs-evidence'];
    if(!allowed.includes(decision))throw Error(`decision 需要 ${allowed.join(' / ')}`);
    const receipts=valid(observationIds);
    if(scope==='whole'?!receipts.some(o=>!o.mirror&&contains(o.region,full)):!receipts.some(o=>locallyCovers(o,r)))throw Error(scope==='whole'?'整图诊断需要当前版本覆盖整幅画布的参考/草稿对照图':'局部诊断需要当前版本覆盖该区域的原尺寸参考/草稿对照图');
    if(scope==='local'){
      const whole=liveWholeDiagnosis();
      if(!whole)throw Error('先记录本次 refine 的整图诊断');
      if(whole.decision!=='proceed')throw Error('整图诊断尚未允许分部位细化');
    }
    if(!Array.isArray(guideIds)||guideIds.some(id=>!engine.doc.commands.some(c=>c.id===id)))throw Error('guideIds 必须引用当前笔迹');
    const item={id:crypto.randomUUID(),scope,target:scope==='whole'?'whole':target.trim(),region:r,referenceFacts:diagnosisText(referenceFacts,'referenceFacts'),structureInference:diagnosisText(structureInference,'structureInference'),drawingFacts:diagnosisText(drawingFacts,'drawingFacts'),uncertainty:diagnosisText(uncertainty,'uncertainty'),decision,actionTarget:typeof actionTarget==='string'?actionTarget.trim():'',guideIds:[...guideIds],observationIds:[...observationIds],revision:engine.doc.revision,phaseKey:diagnosisPhaseKey(),imageKey:key(),at:Date.now()};
    if(['detail','repair'].includes(decision)&&!item.actionTarget)throw Error('detail / repair 需要可执行的 actionTarget');
    diagnoses.set(item.id,item);const audit=reviewCopy(item);delete audit.phaseKey;delete audit.imageKey;(engine.doc.refinementDiagnoses||=[]).push(audit);engine.doc.refinementDiagnoses=engine.doc.refinementDiagnoses.slice(-300);engine.emit?.('change');
    return {...reviewCopy(item),authorization:scope==='local'&&['detail','repair'].includes(decision)?'one-batch':'none',next:scope==='whole'&&decision==='proceed'?'修改前后都必须对比参考图；逐个局部观察并记录 local 诊断':scope==='local'&&['detail','repair'].includes(decision)?'修改前后都必须对比参考图；凭 diagnosisId 提交一个同 target 小批次，随后复看结果':'修改前后都必须对比参考图；按 decision 补证据、退回结构或保留不改'};
  }
  function assertRefinementDiagnosis(id,targets=[]){
    if(engine.doc.workflow.phase!=='refine')return;
    const whole=liveWholeDiagnosis();if(!whole||whole.decision!=='proceed')throw Error('refine 落笔前必须先完成允许继续的整图诊断');
    const d=diagnoses.get(id);if(!d||d.scope!=='local')throw Error('refine 落笔需要本次运行生成的局部 diagnosisId');
    if(d.phaseKey!==diagnosisPhaseKey()||d.imageKey!==key())throw Error('局部诊断已因画面、参考、图层、播放或恢复变化失效，请重新观察并诊断');
    if(!['detail','repair'].includes(d.decision))throw Error(`${d.decision} 结论不授权落笔；补证据或重新诊断后再改`);
    const unique=[...new Set(targets.filter(Boolean))];if(unique.length!==1||unique[0]!==d.target)throw Error(`本批笔迹 target 必须与诊断一致：${d.target}`);
    return reviewCopy(d);
  }
  function checkIssue({description,objectIds=[],region,target='',guideIds=[]}){
    if(typeof description!=='string'||!description.trim())throw Error('需要具体偏差说明');
    if(!Array.isArray(objectIds)||objectIds.some(id=>!engine.doc.scene.objects.some(o=>o.id===id)))throw Error('部位不存在');
    if(region&&(!Array.isArray(region)||region.length!==4||region.some(n=>!Number.isFinite(n))||region[0]<0||region[1]<0||region[2]<=0||region[3]<=0||region[0]+region[2]>engine.doc.width||region[1]+region[3]>engine.doc.height))throw Error('问题区域无效');
    if(typeof target!=='string'||target.length>1500)throw Error('target 需要最多 1500 字的具体目标');
    if(!Array.isArray(guideIds)||guideIds.length>200||guideIds.some(id=>!engine.doc.commands.some(c=>c.id===id&&c.type==='stroke')))throw Error('guideIds 必须引用当前保留的笔迹');
  }
  function update({action='open',id,description,objectIds=[],region,note='',observationIds=[],target,guideIds}={}){
    if(action==='open'){
      checkIssue({description,objectIds,region,target,guideIds});
      const item={id:crypto.randomUUID(),description,objectIds:[...objectIds],region:region||[0,0,engine.doc.width,engine.doc.height],target:target||'',guideIds:[...(guideIds||[])],status:'open',discoveredRevision:engine.doc.revision,history:[]};
      issues().push(item);return reviewCopy(item);
    }
    const issue=issues().find(i=>i.id===id);if(!issue)throw Error('问题 ID 不存在');
    if(action==='amend'){
      const patch={...issue,target:target??issue.target,guideIds:guideIds??issue.guideIds,description:description??issue.description};checkIssue(patch);
      issue.history.push({action,note,previousTarget:issue.target,previousGuideIds:issue.guideIds,revision:engine.doc.revision,at:Date.now()});
      Object.assign(issue,{description:patch.description,target:patch.target,guideIds:[...patch.guideIds],status:'open'});return reviewCopy(issue);
    }
    if(action==='resolve'&&issue.status==='resolved')return {...reviewCopy(issue),unchanged:true,instruction:'修改前后都必须对比参考图。关联区域未变化，无需重复 resolve；阶段最终审核使用当前局部图片复核。'};
    if(!note.trim())throw Error('需要说明处理依据');
    if(!['resolve','dismiss','reopen'].includes(action))throw Error('问题操作无效');
    if(action!=='reopen'&&!valid(observationIds).some(o=>locallyCovers(o,issue.region)))throw Error('需要当前版本覆盖该问题区域的原尺寸参考/画布对照图片');
    issue.status={resolve:'resolved',dismiss:'dismissed',reopen:'open'}[action];
    if(action==='resolve')issue.resolvedRevision=engine.doc.revision;
    issue.history.push({action,note,revision:engine.doc.revision,observationIds:[...observationIds],at:Date.now()});return reviewCopy(issue);
  }
  function prepare({regions=[]}={}){
    if(engine.doc.workflow.phase!=='lineart_review')throw Error('正式审图材料仅在 1F 生成');
    const full=[0,0,engine.doc.width,engine.doc.height],scale=Math.min(1,1024/Math.max(engine.doc.width,engine.doc.height));
    const local=[...regions,...partRegions().map(p=>p.region),...issues().filter(i=>i.status!=='dismissed').map(i=>i.region)];
    const unique=[...new Map(local.map(r=>[JSON.stringify(r),r])).values()];
    return {drawingProtocol:drawingProtocol({phase:'lineart_review'}),instruction:'先独立对照图像逐项找偏差，再处理待核实问题。检查形状、比例、体积、遮挡及精细度；闭合或可辨认不能替代造型判断。程序只核验图片生成与版本，不证明实际看懂。',full:observe(full,false,scale),mirrored:observe(full,true,scale),locals:unique.map(r=>observe(r,false,1)),pendingIssues:reviewCopy(issues().filter(i=>!['resolved','dismissed'].includes(i.status)))};
  }
  function validate(options){
    if(options.status!=='pass'||options.scope!=='global'||!['structure-checkpoint','lineart-checkpoint'].includes(options.kind))return;
    ready();if(issues().some(i=>!['resolved','dismissed'].includes(i.status)))throw Error('仍有未解决或修改后尚未复查的部位问题');
    const receipts=valid(options.observationIds),full=[0,0,engine.doc.width,engine.doc.height];
    if(!receipts.some(o=>!o.mirror&&contains(o.region,full))||!receipts.some(o=>o.mirror&&contains(o.region,full)))throw Error('正式通过需要当前版本的整图和镜像对照 observationIds');
    for(const issue of issues())if(issue.status==='resolved'&&!receipts.some(o=>locallyCovers(o,issue.region)))throw Error('正式通过缺少已登记问题的当前局部对照');
    for(const part of partRegions())if(!receipts.some(o=>locallyCovers(o,part.region)))throw Error('正式通过缺少当前部位局部对照：'+part.part);
    inspection.requireComplete();
  }
  function record(options={}){
    for(const description of options.issues||[])checkIssue({description,objectIds:options.objectIds,region:options.region?.length===4?options.region:undefined});
    validate(options);const result=engine.recordReview(options);
    for(const description of options.issues||[])if(!issues().some(i=>i.description===description&&!['resolved','dismissed'].includes(i.status)))update({description,objectIds:options.objectIds,region:options.region?.length===4?options.region:undefined});
    if(options.status==='pass'&&options.scope==='global')approvals.set(options.kind,{key:approvalKey(),review:result});
    engine.emit?.('change');
    return result;
  }
  function issueContext({objectId,region}={}){
    const overlap=(a,b)=>a&&b&&a[0]<=b[0]+b[2]&&b[0]<=a[0]+a[2]&&a[1]<=b[1]+b[3]&&b[1]<=a[1]+a[3];
    return reviewCopy(issues().filter(i=>!objectId&&!region||i.objectIds.includes(objectId)||overlap(i.region,region)).map(i=>({...i,missingGuideIds:(i.guideIds||[]).filter(id=>!engine.doc.commands.some(c=>c.id===id)),layerIds:[...new Set(engine.doc.commands.filter(c=>i.objectIds.includes(c.objectId)||c.points?.some(p=>contains(i.region,[p[0],p[1],0,0]))).map(c=>c.layer))]})));
  }
  function feedback(options={}){
    const receipts=valid([...observations.keys()]);
    const whole=liveWholeDiagnosis(),active=[...diagnoses.values()].filter(d=>d.scope==='local'&&d.phaseKey===diagnosisPhaseKey()&&d.imageKey===key()).map(reviewCopy);
    return {...localChangeFeedback(engine.doc,row=>receipts.some(o=>row.minimumScale!==undefined?!o.mirror&&o.scale>=row.minimumScale&&contains(o.region,row.region):locallyCovers(o,row.region)),options),inspection:inspection.state(),refinementDiagnosis:{required:engine.doc.workflow.phase==='refine',whole:whole?reviewCopy(whole):null,active,next:engine.doc.workflow.phase!=='refine'?null:!whole?'修改前后都必须对比参考图；观察整图并记录 whole 诊断':whole.decision!=='proceed'?'修改前后都必须对比参考图；按整图结论补证据或返回结构阶段':active.length?'修改前后都必须对比参考图；使用匹配 target 的 diagnosisId 完成一个小批次':'修改前后都必须对比参考图；观察下一个局部并记录 local 诊断'}};
  }
  return {observe,captureContext,prepare,update,record,recordInspection:inspection.record,noteCleanDraftBatch:inspection.noteCleanDraftBatch,recordRefinementDiagnosis,assertRefinementDiagnosis,issues:issueContext,feedback,validate,approved:kind=>{const a=approvals.get(kind);return !!a&&a.key===approvalKey()&&!issues().some(i=>!['resolved','dismissed'].includes(i.status));}};
}
