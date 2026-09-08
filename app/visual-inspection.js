const phases=['layout','rough','structure_review','refine','clean','lineart_review'];
const clone=value=>structuredClone(value);
const contains=(a,b)=>a[0]<=b[0]&&a[1]<=b[1]&&a[0]+a[2]>=b[0]+b[2]&&a[1]+a[3]>=b[1]+b[3];
const overlap=(a,b)=>a[0]<=b[0]+b[2]&&b[0]<=a[0]+a[2]&&a[1]<=b[1]+b[3]&&b[1]<=a[1]+a[3];
const union=(a,b)=>{const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]);return [x,y,Math.max(a[0]+a[2],b[0]+b[2])-x,Math.max(a[1]+a[3],b[1]+b[3])-y];};
const criteriaFor=phase=>phase==='layout'?[
  {id:'proportion',instruction:'比较头、胸廓、骨盆的位置、比例和倾斜。'},
  {id:'pose',instruction:'比较肩胯方向、关节位置、四肢端点和重心。'},
  {id:'negative-space',instruction:'比较身体周围与四肢之间的负形和距离。'}
]:['refine','clean','lineart_review'].includes(phase)?[
  {id:'likeness',instruction:'临摹一致性：比较主要比例、标志性轮廓和可见神态，不能以可辨认代替相似。'},
  {id:'volume',instruction:'体积成立：比较方向、厚度和转面；衣褶说明受力，手说明掌指，鞋口围绕脚踝。'},
  {id:'boundary',instruction:'边界成立：比较连接、遮挡起止与物体归属，开放发丝和衣褶不机械封口。'},
  {id:'detail',instruction:'细节充分：所需发束、掌指、衣褶和开口已有具体形状，清线保留有效结构信息。'},
  {id:'coherence',instruction:'整体协调：比较相邻比例、负形、疏密、曲率及多个偏差的共同影响；阶段检查结合整图、缩小和镜像。'}
]:[
  {id:'shape',instruction:'比较轮廓的关键转折、宽窄和体积；脚部明确比较脚跟、足背和前掌。'},
  {id:'detail',instruction:'比较当前阶段应有的内部结构与特征；颈部明确比较领口、领结和相邻头发。'},
  {id:'relation',instruction:'比较比例、相邻空隙与遮挡起止，不能用闭合或可辨认代替。'}
];

export function normalizeVisualChecks(value=[]){
  if(!Array.isArray(value))throw Error('visualChecks 必须是数组');
  return value.map(v=>{
    if(!v||typeof v.id!=='string'||!Array.isArray(v.comparisons)||!Array.isArray(v.region))throw Error('visualChecks 记录无效');
    return clone(v);
  });
}

// Stored reports are audit history. Only this runtime can authorize advancement.
export function createVisualInspection(engine,{validObservations,referenceKey,partRegions,openIssue}){
  const verified=new Map(),cleanBatches=new Map(),cleanBatchReports=new Map();
  const inspectionTarget=key=>key==='document'?'whole':'part:'+String(key).replace(/^[^:]+:/,'');
  const hasLinework=()=>engine.doc.commands.some(c=>c.stage==='lineart'||c.type!=='fill'&&phases.includes(c.subphase));
  function signature(region){
    const commands=engine.doc.commands.filter(c=>{
      if(!c.points?.length)return true;
      const xs=c.points.map(p=>p[0]),ys=c.points.map(p=>p[1]),r=(c.width||0)/2+8;
      return Math.min(...xs)-r<=region[0]+region[2]&&Math.max(...xs)+r>=region[0]&&Math.min(...ys)-r<=region[1]+region[3]&&Math.max(...ys)+r>=region[1];
    });
    return JSON.stringify([engine.reviewEpoch,engine.doc.width,engine.doc.height,engine.doc.background,commands,engine.doc.layers,engine.doc.scene,engine.doc.masks,referenceKey()]);
  }
  function tasks(){
    if(!hasLinework())return [];
    const full={target:'whole',region:[0,0,engine.doc.width,engine.doc.height]};
    if(engine.doc.workflow.phase==='layout')return [full];
    const changes=(engine.doc.localChanges||[]).filter(r=>r.phase===engine.doc.workflow.phase);
    const parts=partRegions().map(p=>{
      const target='part:'+p.part,exact=changes.filter(r=>inspectionTarget(r.key)===target);
      return {target,region:exact.reduce((region,r)=>union(region,r.region),p.region)};
    });
    const byTarget=new Map(parts.map(p=>[p.target,p]));
    for(const change of changes){
      const target=inspectionTarget(change.key);if(target==='whole')continue;
      const prior=byTarget.get(target);byTarget.set(target,{target,region:prior?union(prior.region,change.region):clone(change.region)});
    }
    return [full,...byTarget.values()];
  }
  function currentReport(task){
    const item=verified.get(engine.doc.workflow.phase+':'+task.target);
    return item&&item.signature===signature(task.region)&&JSON.stringify(item.region)===JSON.stringify(task.region)?item:null;
  }
  function currentCleanBatch(task){
    const item=cleanBatches.get(task.target);
    return item&&item.revision===engine.doc.revision&&item.signature===signature(task.region)?item:null;
  }
  function currentCleanBatchReport(task){
    const batch=currentCleanBatch(task),item=cleanBatchReports.get(task.target);
    return batch&&item&&item.revision===batch.revision&&item.signature===batch.signature?item:null;
  }
  function completed(task){
    const item=currentReport(task);
    return !!item&&criteriaFor(engine.doc.workflow.phase).every(c=>item.comparisons.some(x=>x.criterion===c.id&&x.conclusion==='aligned'));
  }
  function taskStatus(task){
    const item=currentReport(task),previous=verified.get(engine.doc.workflow.phase+':'+task.target);
    if(!item)return previous?'stale':'needs-inspection';
    if(item.comparisons.some(c=>c.conclusion==='different'))return 'needs-work';
    if(item.comparisons.some(c=>c.conclusion==='uncertain'))return 'needs-evidence';
    if((engine.doc.partIssues||[]).some(i=>!['resolved','dismissed'].includes(i.status)&&overlap(i.region,task.region)))return 'needs-work';
    return completed(task)?'pass':'needs-inspection';
  }
  function drawingCycle(){
    const phase=engine.doc.workflow.phase,changes=(engine.doc.localChanges||[]).filter(r=>r.phase===phase&&r.revision===engine.doc.revision);
    let relevant=[];
    if(changes.length){
      const available=tasks();
      const changedTargets=new Set(changes.map(r=>inspectionTarget(r.key)));
      relevant=phase==='layout'?available.filter(t=>t.target==='whole'):available.filter(t=>t.target!=='whole'&&changedTargets.has(t.target));
      if(!relevant.length&&changedTargets.has('whole'))relevant=available.filter(t=>t.target==='whole');
    }
    const batchTargets=relevant.map(t=>t.target),pendingTargets=relevant.filter(t=>engine.doc.workflow.phase==='clean'&&currentCleanBatch(t)?!currentCleanBatchReport(t):!currentReport(t)).map(t=>t.target);
    const regressedTargets=relevant.filter(t=>currentCleanBatchReport(t)?.draftComparison.outcome==='regressed').map(t=>t.target);
    const unresolvedIssues=(engine.doc.partIssues||[]).filter(i=>!['resolved','dismissed'].includes(i.status)).map(i=>({id:i.id,status:i.status,description:i.description,region:clone(i.region)}));
    return {maxStrokesPerBatch:3,maxLowRiskCleanStrokesPerBatch:6,batchTargets,pendingTargets,regressedTargets,unresolvedIssues,readyForRevision:pendingTargets.length===0,readyForNewStrokes:pendingTargets.length===0&&regressedTargets.length===0&&unresolvedIssues.length===0,
      instruction:phase==='clean'?'修改前后都必须对比参考图。清稿每批必须承接已确认底稿；画后同时查看参考、底稿和当前清稿，只记录 preserved／improved／regressed。regressed 时只允许修当前部位；五项检查只用于阶段退出。':'修改前后都必须对比参考图。每批只检查本次实际改动的目标。多个目标共用一张当前整图并重点观察这些目标；单个目标使用局部图。普通批次最多 3 笔；所有绘画阶段中，同一部位的低风险开放线可用 low-risk-clean 模式提交 5–6 笔。整图与未改部位留在阶段推进或正式审核节点检查。发现偏差先返修并复查、解决问题，再向其他部位新增笔迹。'};
  }
  function state(){
    const phase=engine.doc.workflow.phase,cycle=drawingCycle(),allTasks=tasks();
    const full=[0,0,engine.doc.width,engine.doc.height],fullScale=Math.min(1,1024/Math.max(engine.doc.width,engine.doc.height)),shared=cycle.batchTargets.length>1&&cycle.pendingTargets.length>0;
    const cleanBatchMode=phase==='clean'&&cycle.batchTargets.length>0&&cycle.batchTargets.every(target=>currentCleanBatch(allTasks.find(t=>t.target===target)));
    const cleanGuideIds=[...new Set(cycle.batchTargets.flatMap(target=>currentCleanBatch(allTasks.find(t=>t.target===target))?.guideIds||[]))];
    const describeStage=t=>({...t,nextInspection:{tool:'paint_observe_review',arguments:{region:t.region,scale:t.target==='whole'?fullScale:1}},nextRecord:{tool:'paint_record_inspection',target:t.target,comparisons:'use inspection.criteria'},instruction:'阶段退出检查：逐项记录 reference、drawing、conclusion；五项只在这里使用。'});
    const describeBatch=(t,useShared=false)=>phase==='clean'&&currentCleanBatch(t)?({...t,nextInspection:{tool:'paint_inspect_context',arguments:{region:useShared?full:t.region,padding:0,detail:'full',guideIds:currentCleanBatch(t).guideIds}},nextRecord:{tool:'paint_record_inspection',target:t.target,draftComparison:{outcome:'preserved | improved | regressed',note:'具体结果'}},instruction:'同时查看 reference、guides 和 drawing，只判断本批清稿相对已绑定底稿是保留、改善还是退步。'}):({...t,nextInspection:{tool:'paint_observe_review',arguments:{region:useShared?full:t.region,scale:useShared?fullScale:t.target==='whole'?fullScale:1}},nextRecord:{tool:'paint_record_inspection',target:t.target},instruction:useShared?`修改前后都必须对比参考图。本批多个目标共用这张整图；重点观察 ${cycle.batchTargets.join('、')}，同一 observationId 分别记录各目标。`:'修改前后都必须对比参考图。先实际看参考和当前画布，再逐项记录 reference、drawing、conclusion。different/uncertain 自动登记问题；不要为填表虚构偏差。'});
    const batchPending=allTasks.filter(t=>cycle.pendingTargets.includes(t.target)).map(t=>describeBatch(t,shared));
    const stagePending=allTasks.filter(t=>!completed(t)).map(describeStage);
    const batchInspection=shared&&cleanBatchMode?{tool:'paint_inspect_context',arguments:{region:full,padding:0,detail:'full',guideIds:cleanGuideIds},focusTargets:cycle.batchTargets.map(target=>{const task=allTasks.find(t=>t.target===target);return {target,region:clone(task.region)};}),instruction:'修改前后都必须对比参考图。同时查看 reference、guides 和 drawing；分别为每个 focusTarget 记录 preserved／improved／regressed。'}:shared?{tool:'paint_observe_review',arguments:{region:full,scale:fullScale},focusTargets:cycle.batchTargets.map(target=>{const task=allTasks.find(t=>t.target===target);return {target,region:clone(task.region)};}),instruction:'修改前后都必须对比参考图。只取一次当前整图；在整图关系中重点检查 focusTargets，再把同一 observationId 用于各目标的 paint_record_inspection。'}:batchPending[0]?.nextInspection||null;
    return {phase,meaning:phase==='clean'?'pending 是逐批三选一检查；stagePending 才是阶段退出所需的五项检查。程序验证顺序、底稿 ID 和当前图片，视觉结论仍由模型负责。':'pending 只列本批实际改动目标；多个 pending 共用一张整图并重点观察这些部位，单个 pending 使用局部图。stagePending 是阶段推进节点所需的整图和最终部位检查。已提交图像绑定记录不证明模型看懂或造型正确。',criteria:criteriaFor(phase),targets:allTasks.map(t=>({...t,status:taskStatus(t),comparisons:clone(currentReport(t)?.comparisons||[])})),drawingCycle:cycle,batchInspection,pending:batchPending,stagePending};
  }
  function noteCleanDraftBatch({targets=[],guideIds=[]}={}){
    if(engine.doc.workflow.phase!=='clean')return;
    const available=tasks();
    for(const value of targets){
      const target=inspectionTarget(value),task=available.find(t=>t.target===target);
      if(!task)throw Error('清稿批次 target 不存在：'+target);
      cleanBatches.set(target,{target,guideIds:[...guideIds],revision:engine.doc.revision,signature:signature(task.region)});
      cleanBatchReports.delete(target);
    }
  }
  function record({target,observationIds=[],comparisons,draftComparison,changeSummary}={}){
    const task=tasks().find(t=>t.target===target);
    if(!task)throw Error('检查 target 不存在；读取 localFeedback.inspection.pending');
    if(engine.playing||engine.cursor!==engine.index.total)throw Error('先 finish 再检查');
    const phase=engine.doc.workflow.phase,batch=currentCleanBatch(task),pendingCleanBatch=phase==='clean'&&batch&&!currentCleanBatchReport(task);
    const full=[0,0,engine.doc.width,engine.doc.height],fullScale=Math.min(1,1024/Math.max(engine.doc.width,engine.doc.height)),scale=target==='whole'?fullScale:1;
    const accepts=o=>{const shared=drawingCycle().batchTargets.length>1&&drawingCycle().batchTargets.includes(target)&&o.scale>=fullScale&&contains(o.region,full);return !o.mirror&&(shared||o.scale>=scale&&contains(o.region,task.region)&&(target==='whole'||o.region[2]*o.region[3]<=task.region[2]*task.region[3]*4));};
    if(pendingCleanBatch){
      if(!draftComparison||!['preserved','improved','regressed'].includes(draftComparison.outcome)||typeof draftComparison.note!=='string'||!draftComparison.note.trim()||draftComparison.note.length>1500)throw Error('清稿批次只需记录 draftComparison：preserved／improved／regressed，并写明具体结果');
      const receipts=validObservations(observationIds).filter(accepts);
      if(!receipts.some(o=>o.hasDraftGuides&&batch.guideIds.every(id=>o.guideIds?.includes(id))))throw Error('清稿检查必须用 paint_inspect_context 同时取得参考、绑定底稿 guides 和当前 drawing');
      const report={id:crypto.randomUUID(),kind:'clean-draft-comparison',phase,revision:engine.doc.revision,target,region:clone(task.region),guideIds:[...batch.guideIds],observationIds:[...observationIds],comparisons:[],draftComparison:{outcome:draftComparison.outcome,note:draftComparison.note.trim()},changeSummary:'',beforeAfter:[],createdAt:Date.now(),issueIds:[]};
      engine.doc.visualChecks||=[];engine.doc.visualChecks.push(report);cleanBatchReports.set(target,{...report,signature:batch.signature});engine.emit?.('change');return {...clone(report),inspection:state()};
    }
    if(draftComparison)throw Error('当前没有等待记录的清稿批次');
    const criteria=criteriaFor(phase);
    if(!Array.isArray(comparisons)||comparisons.length!==criteria.length||criteria.some(c=>comparisons.filter(x=>x.criterion===c.id).length!==1))throw Error('必须逐项提交当前阶段的检查 criteria');
    for(const c of comparisons){
      if(['reference','drawing'].some(k=>typeof c[k]!=='string'||!c[k].trim()||c[k].length>1500)||!['aligned','different','uncertain'].includes(c.conclusion))throw Error('检查需分别描述参考形状、当前形状，并给出 aligned/different/uncertain');
    }
    if(!validObservations(observationIds).some(accepts))throw Error('检查需要当前版本图片：单个 pending 使用覆盖目标的原尺寸局部图，多个 pending 可共用一张当前整图');
    const checked=comparisons.map(c=>{
      const ids=c.observationIds??observationIds;
      if(!Array.isArray(ids)||!ids.length||!validObservations(ids).some(accepts))throw Error('每项检查需要当前版本覆盖目标的图片依据');
      return {...clone(c),observationIds:[...ids]};
    });
    const receipts=validObservations([...new Set([...observationIds,...checked.flatMap(c=>c.observationIds)])]);
    const pairs=receipts.filter(o=>o.beforeAfter?.status==='available').map(o=>({observationId:o.id,...clone(o.beforeAfter)}));
    if(pairs.length&&(typeof changeSummary!=='string'||!changeSummary.trim()||changeSummary.length>1500))throw Error('已提供修改前后对照，请用 changeSummary 说明具体改善或退步及相邻影响');
    const report={id:crypto.randomUUID(),kind:'stage-inspection',phase,revision:engine.doc.revision,target,region:clone(task.region),observationIds:[...observationIds],comparisons:checked,changeSummary:changeSummary||'',beforeAfter:pairs,createdAt:Date.now(),issueIds:[]};
    for(const c of comparisons.filter(c=>c.conclusion!=='aligned')){
      const description=`${target} / ${c.criterion}: ${c.drawing}（${c.conclusion==='uncertain'?'待核实':'与参考有偏差'}）`;
      const existing=engine.doc.partIssues?.find(i=>i.description===description&&!['resolved','dismissed'].includes(i.status));
      report.issueIds.push((existing||openIssue({description,target:c.reference,region:task.region})).id);
    }
    engine.doc.visualChecks||=[];engine.doc.visualChecks.push(report);
    verified.set(phase+':'+target,{...report,signature:signature(task.region)});
    engine.emit?.('change');return {...clone(report),inspection:state()};
  }
  function requireComplete(){
    if(!hasLinework())return;
    const pending=state().stagePending;
    if(pending.length)throw Error('尚未提交当前画面的逐项检查：'+pending.map(t=>t.target).join(', ')+'；取图不等于检查，调用 paint_record_inspection');
    if(engine.doc.partIssues?.some(i=>!['resolved','dismissed'].includes(i.status)))throw Error('检查发现的问题尚未处理并复查');
  }
  function beforePhase({phase,enabled=true}){
    const current=phases.indexOf(engine.doc.workflow.phase),next=phases.indexOf(phase);
    if(next>current||engine.doc.workflow.enabled&&!enabled)requireComplete();
  }
  return {state,record,noteCleanDraftBatch,requireComplete,beforePhase};
}
