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
export function invalidatePartIssues(doc,{ids=[],objectIds=[],previousCommands=[]}={}){
  const strokes=[...ids.map(id=>doc.commands.find(c=>c.id===id)),...previousCommands];
  const intersects=(a,b)=>a[0]<=b[0]+b[2]&&b[0]<=a[0]+a[2]&&a[1]<=b[1]+b[3]&&b[1]<=a[1]+a[3];
  for(const issue of doc.partIssues||[]){
    if(issue.status==='dismissed')continue;
    // Object membership is primary. Unidentified/deleted geometry is conservative.
    if(ids.length&&strokes.every(Boolean)&&issue.objectIds?.length&&objectIds.length&&!issue.objectIds.some(id=>objectIds.includes(id))&&!strokes.some(c=>{
      const xs=c.points.map(p=>p[0]),ys=c.points.map(p=>p[1]);return intersects(issue.region,[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)]);
    }))continue;
    issue.status='awaiting-review';issue.changedRevision=doc.revision;
  }
}
// The receipt registry is runtime-owned. Imported/self-written IDs are not proof.
export function createReviewEvidence(engine,{referenceKey,renderPair}={}){
  const observations=new Map(),approvals=new Map();
  const key=()=>JSON.stringify([engine.reviewEpoch,engine.doc.width,engine.doc.height,engine.doc.background,engine.doc.commands,engine.doc.layers,engine.doc.scene,engine.doc.masks,referenceKey(),engine.cursor,engine.playing]);
  const approvalKey=()=>JSON.stringify([engine.reviewEpoch,engine.doc.width,engine.doc.height,engine.doc.background,engine.doc.commands.filter(c=>c.stage==='lineart'),engine.doc.layers,engine.doc.scene,engine.doc.masks,referenceKey()]);
  const ready=()=>{if(engine.playing||engine.cursor!==engine.index.total)throw Error('先 finish 播放，再生成审核图片');if(!referenceKey())throw Error('审核需要已授权的参考图');};
  const issues=()=>engine.doc.partIssues||=[];
  const inspection=createVisualInspection(engine,{validObservations:valid,referenceKey,partRegions,openIssue:update});
  engine.beforePhaseChange=inspection.beforePhase;
  function observe(region,mirror=false,scale=1){
    ready();const images=renderPair({region,mirror,scale});
    if(!images.reference?.dataUrl||!images.drawing?.dataUrl)throw Error('审核图片生成不完整');
    const receipt={id:crypto.randomUUID(),revision:engine.doc.revision,region:[...region],mirror,scale,createdAt:Date.now(),meaning:'images-generated-and-returned; visual understanding is not machine-verifiable'};
    observations.set(receipt.id,{...receipt,key:key()});
    return {observation:receipt,...images};
  }
  function captureContext(result){
    if(engine.playing||engine.cursor!==engine.index.total||result.referenceStatus!=='available'||!referenceKey())return result;
    const panel=result.image?.panels?.drawing;
    const drawing=result.images?.drawing;
    const region=panel?.region||drawing?.region;
    if(!region||!(result.image?.dataUrl||drawing?.dataUrl&&result.images?.reference?.dataUrl))return result;
    const receipt={id:crypto.randomUUID(),revision:engine.doc.revision,region:[...region],mirror:false,scale:panel?.scale||drawing?.scale,createdAt:Date.now(),meaning:'images-generated-and-returned; visual understanding is not machine-verifiable'};
    observations.set(receipt.id,{...receipt,key:key()});return {...result,observation:receipt};
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
    if(!note.trim())throw Error('需要说明处理依据');
    if(!['resolve','dismiss','reopen'].includes(action))throw Error('问题操作无效');
    if(action!=='reopen'&&!valid(observationIds).some(o=>locallyCovers(o,issue.region)))throw Error('需要当前版本覆盖该问题区域的原尺寸参考/画布对照图片');
    issue.status={resolve:'resolved',dismiss:'dismissed',reopen:'open'}[action];
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
    return {...localChangeFeedback(engine.doc,row=>receipts.some(o=>row.minimumScale!==undefined?!o.mirror&&o.scale>=row.minimumScale&&contains(o.region,row.region):locallyCovers(o,row.region)),options),inspection:inspection.state()};
  }
  return {observe,captureContext,prepare,update,record,recordInspection:inspection.record,issues:issueContext,feedback,validate,approved:kind=>{const a=approvals.get(kind);return !!a&&a.key===approvalKey()&&!issues().some(i=>!['resolved','dismissed'].includes(i.status));}};
}
