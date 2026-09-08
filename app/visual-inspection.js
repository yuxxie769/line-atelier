const phases=['layout','rough','structure_review','refine','clean','lineart_review'];
const clone=value=>structuredClone(value);
const contains=(a,b)=>a[0]<=b[0]&&a[1]<=b[1]&&a[0]+a[2]>=b[0]+b[2]&&a[1]+a[3]>=b[1]+b[3];
const overlap=(a,b)=>a[0]<=b[0]+b[2]&&b[0]<=a[0]+a[2]&&a[1]<=b[1]+b[3]&&b[1]<=a[1]+a[3];
const union=(a,b)=>{const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]);return [x,y,Math.max(a[0]+a[2],b[0]+b[2])-x,Math.max(a[1]+a[3],b[1]+b[3])-y];};
const criteriaFor=phase=>phase==='layout'?[
  {id:'proportion',instruction:'比较头、胸廓、骨盆的位置、比例和倾斜。'},
  {id:'pose',instruction:'比较肩胯方向、关节位置、四肢端点和重心。'},
  {id:'negative-space',instruction:'比较身体周围与四肢之间的负形和距离。'}
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
  const verified=new Map();
  function signature(region){
    const commands=engine.doc.commands.filter(c=>{
      if(!c.points?.length)return true;
      const xs=c.points.map(p=>p[0]),ys=c.points.map(p=>p[1]),r=(c.width||0)/2+8;
      return Math.min(...xs)-r<=region[0]+region[2]&&Math.max(...xs)+r>=region[0]&&Math.min(...ys)-r<=region[1]+region[3]&&Math.max(...ys)+r>=region[1];
    });
    return JSON.stringify([engine.reviewEpoch,engine.doc.width,engine.doc.height,engine.doc.background,commands,engine.doc.layers,engine.doc.scene,engine.doc.masks,referenceKey()]);
  }
  function tasks(){
    if(!engine.doc.commands.some(c=>c.stage==='lineart'))return [];
    const full={target:'whole',region:[0,0,engine.doc.width,engine.doc.height]};
    if(engine.doc.workflow.phase==='layout')return [full];
    const changes=(engine.doc.localChanges||[]).filter(r=>r.phase===engine.doc.workflow.phase);
    const parts=partRegions().map(p=>{
      const target='part:'+p.part,exact=changes.filter(r=>r.key===target),related=exact.length?exact:changes.filter(r=>overlap(r.region,p.region));
      return {target,region:related.reduce((region,r)=>union(region,r.region),p.region)};
    });
    return [full,...parts];
  }
  function currentReport(task){
    const item=verified.get(engine.doc.workflow.phase+':'+task.target);
    return item&&item.signature===signature(task.region)&&JSON.stringify(item.region)===JSON.stringify(task.region)?item:null;
  }
  function completed(task){
    const item=currentReport(task);
    return !!item&&item.comparisons.every(c=>c.conclusion==='aligned');
  }
  function drawingCycle(){
    const phase=engine.doc.workflow.phase,changes=(engine.doc.localChanges||[]).filter(r=>r.phase===phase&&r.revision===engine.doc.revision);
    let relevant=[];
    if(changes.length){
      const available=tasks();
      relevant=phase==='layout'?available.filter(t=>t.target==='whole'):available.filter(t=>t.target!=='whole'&&changes.some(r=>r.key===t.target||overlap(r.region,t.region)));
      if(!relevant.length)relevant=available.filter(t=>t.target==='whole');
    }
    const pendingTargets=relevant.filter(t=>!currentReport(t)).map(t=>t.target);
    const unresolvedIssues=(engine.doc.partIssues||[]).filter(i=>!['resolved','dismissed'].includes(i.status)).map(i=>({id:i.id,status:i.status,description:i.description,region:clone(i.region)}));
    return {maxStrokesPerBatch:3,pendingTargets,unresolvedIssues,readyForRevision:pendingTargets.length===0,readyForNewStrokes:pendingTargets.length===0&&unresolvedIssues.length===0,
      instruction:'每批最多 3 笔。提交后先完成当前目标的图像对照与 paint_record_inspection；发现偏差先返修并复查、解决问题，再向其他部位新增笔迹。'};
  }
  function state(){
    const phase=engine.doc.workflow.phase;
    return {phase,meaning:'已提交图像绑定的逐项对照记录，不证明模型看懂或造型正确。',criteria:criteriaFor(phase),drawingCycle:drawingCycle(),pending:tasks().filter(t=>!completed(t)).map(t=>({...t,nextInspection:{tool:'paint_observe_review',arguments:{region:t.region,scale:t.target==='whole'?Math.min(1,1024/Math.max(t.region[2],t.region[3])):1}},nextRecord:{tool:'paint_record_inspection',target:t.target},instruction:'先实际看参考和当前画布，再逐项记录 reference、drawing、conclusion。different/uncertain 自动登记问题；不要为填表虚构偏差。'}))};
  }
  function record({target,observationIds=[],comparisons}={}){
    const task=tasks().find(t=>t.target===target);
    if(!task)throw Error('检查 target 不存在；读取 localFeedback.inspection.pending');
    if(engine.playing||engine.cursor!==engine.index.total)throw Error('先 finish 再检查');
    const criteria=criteriaFor(engine.doc.workflow.phase);
    if(!Array.isArray(comparisons)||comparisons.length!==criteria.length||criteria.some(c=>comparisons.filter(x=>x.criterion===c.id).length!==1))throw Error('必须逐项提交当前阶段的检查 criteria');
    for(const c of comparisons){
      if(['reference','drawing'].some(k=>typeof c[k]!=='string'||!c[k].trim()||c[k].length>1500)||!['aligned','different','uncertain'].includes(c.conclusion))throw Error('检查需分别描述参考形状、当前形状，并给出 aligned/different/uncertain');
    }
    const scale=target==='whole'?Math.min(1,1024/Math.max(...task.region.slice(2))):1;
    if(!validObservations(observationIds).some(o=>!o.mirror&&o.scale>=scale&&contains(o.region,task.region)&&(target==='whole'||o.region[2]*o.region[3]<=task.region[2]*task.region[3]*4)))throw Error('检查需要当前版本覆盖目标的参考/画布图片，局部至少原尺寸');
    const report={id:crypto.randomUUID(),phase:engine.doc.workflow.phase,revision:engine.doc.revision,target,region:clone(task.region),observationIds:[...observationIds],comparisons:clone(comparisons),createdAt:Date.now(),issueIds:[]};
    for(const c of comparisons.filter(c=>c.conclusion!=='aligned')){
      const description=`${target} / ${c.criterion}: ${c.drawing}（${c.conclusion==='uncertain'?'待核实':'与参考有偏差'}）`;
      const existing=engine.doc.partIssues?.find(i=>i.description===description&&!['resolved','dismissed'].includes(i.status));
      report.issueIds.push((existing||openIssue({description,target:c.reference,region:task.region})).id);
    }
    engine.doc.visualChecks||=[];engine.doc.visualChecks.push(report);
    verified.set(engine.doc.workflow.phase+':'+target,{...report,signature:signature(task.region)});
    engine.emit?.('change');return {...clone(report),inspection:state()};
  }
  function requireComplete(){
    if(!engine.doc.commands.some(c=>c.stage==='lineart'))return;
    const pending=state().pending;
    if(pending.length)throw Error('尚未提交当前画面的逐项检查：'+pending.map(t=>t.target).join(', ')+'；取图不等于检查，调用 paint_record_inspection');
    if(engine.doc.partIssues?.some(i=>!['resolved','dismissed'].includes(i.status)))throw Error('检查发现的问题尚未处理并复查');
  }
  function beforePhase({phase,enabled=true}){
    const current=phases.indexOf(engine.doc.workflow.phase),next=phases.indexOf(phase);
    if(next>current||engine.doc.workflow.enabled&&!enabled)requireComplete();
  }
  return {state,record,requireComplete,beforePhase};
}
