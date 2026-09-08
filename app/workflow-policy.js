export const STANDARD_STROKE_BATCH_LIMIT=3;
export const LOW_RISK_CLEAN_BATCH_LIMIT=6;
const mandatoryCompoundPhases=new Set(['refine','clean','lineart_review']);

const targetOf=command=>command?.objectId?`object:${command.objectId}`:command?.part?`part:${command.part}`:null;
const draftSubphases=new Set(['layout','rough','structure_review','refine']);
const draftRoles=new Set(['construction','rough','refine','sketch']);
const cleanTarget=value=>String(value||'').replace(/^(?:part|object):/,'');

export function assertStrokeBatch({commands,phase,batchMode='standard',label='提交'}={}){
  if(!Array.isArray(commands)||!commands.length)throw Error(label+'没有可执行的笔迹');
  if(!['standard','low-risk-clean'].includes(batchMode))throw Error('batchMode 需要 standard 或 low-risk-clean');
  if(batchMode==='standard'){
    if(commands.length>STANDARD_STROKE_BATCH_LIMIT)throw Error(`${label}每批最多 ${STANDARD_STROKE_BATCH_LIMIT} 笔；请围绕一个具体轮廓关系分批绘制。`);
    return STANDARD_STROKE_BATCH_LIMIT;
  }
  if(commands.length<5)throw Error('low-risk-clean 用于 5–6 笔；1–3 笔请使用 standard');
  if(commands.length>LOW_RISK_CLEAN_BATCH_LIMIT)throw Error(`低风险清线每批最多 ${LOW_RISK_CLEAN_BATCH_LIMIT} 笔`);
  const targets=new Set(commands.map(targetOf));
  if(targets.has(null)||targets.size!==1)throw Error('low-risk-clean 必须为每笔声明同一个 part 或 objectId');
  if(commands.some(c=>!['stroke','bezier'].includes(c.type||'stroke')))throw Error('low-risk-clean 只允许画笔线条');
  if(commands.some(c=>!Array.isArray(c.endpoints)||c.endpoints.length!==2||c.endpoints.some(e=>e!=='open')))throw Error('low-risk-clean 在所有阶段都只允许两端均明确为 open 的非连接线；接头、遮挡和转折仍按 1–3 笔处理');
  const semantics=commands.flatMap(c=>[c.objectId,c.part,c.intent]).filter(Boolean).join(' ').toLowerCase();
  if(/eye|face|hand|finger|foot|shoe|mouth|nose|neck|collar|wrist|ankle|joint|occlu|connect|join|眼|脸|手|指|脚|鞋|嘴|鼻|颈|领|腕|踝|关节|遮挡|接头/.test(semantics))throw Error('该语义包含五官、手脚、关节、遮挡或接头，必须使用 1–3 笔标准批次');
  return LOW_RISK_CLEAN_BATCH_LIMIT;
}

// Direct commands remain available for simple sweeps. Once the retained
// geometry itself is long and structurally complex, planning through a
// compoundGroup is mandatory; compound metadata hand-authored on final
// commands cannot bypass the compiler and its counted 2–3 stroke output.
export function assertCompoundPlanning({commands=[],rawCommands=commands,phase,qualityReport}={}){
  if(!mandatoryCompoundPhases.has(phase))return [];
  const unclassified=(rawCommands||[]).filter(c=>['stroke','bezier'].includes(c?.type||'stroke')&&(c.contourMode!=='simple-sweep'||typeof c.simpleSweepReason!=='string'||!c.simpleSweepReason.trim()));
  if(unclassified.length)throw Error('当前阶段每条普通线都必须显式声明 contourMode:"simple-sweep" 并填写 simpleSweepReason；不能确认是简单扫线时，请改用 compoundGroups 规划复合轮廓');
  const directCompound=commands.filter(c=>c.type==='stroke'&&c.compoundId);
  if(directCompound.length)throw Error('复合轮廓不能直接手写最终分笔；请改用 compoundGroups，由模型提交完整 path、1–2 个有原因的接点和压力计划，程序自动生成 2–3 笔');
  const warnings=(qualityReport?.warnings||[]).filter(w=>w.kind==='monolithic-complex-contour');
  if(warnings.length)throw Error(`检测到长而复杂的单笔轮廓（${warnings.flatMap(w=>w.strokeIds).join('、')}）。当前阶段必须改用 compoundGroups 规划，不能继续提交一条普通长 path`);
  return [];
}

// Clean linework must inherit a concrete, retained draft for every affected part.
// This validates provenance only; the post-batch image check still decides whether
// the result preserved, improved, or regressed from that draft.
export function assertCleanDraftBasis({phase,basis,targets=[],commands=[],layers=[]}={}){
  if(phase!=='clean')return [];
  if(!basis||!Array.isArray(basis.guideIds)||!basis.guideIds.length)throw Error('清稿必须用 basis.guideIds 绑定当前部位已经确认的底稿');
  const ids=[...new Set(basis.guideIds.map(String))];
  if(ids.length!==basis.guideIds.length)throw Error('basis.guideIds 不能重复');
  const layerRoles=new Map(layers.map(layer=>[layer.id,layer.role]));
  const byId=new Map(commands.map(command=>[command.id,command]));
  const guides=ids.map(id=>{
    const command=byId.get(id);
    if(!command)throw Error('底稿笔迹不存在：'+id);
    if(!draftSubphases.has(command.subphase)&&!draftRoles.has(layerRoles.get(command.layer)))throw Error('清稿依据必须引用 layout／rough／structure_review／refine 中保留的底稿：'+id);
    return command;
  });
  const affected=[...new Set(targets.map(cleanTarget).filter(Boolean))];
  if(!affected.length)throw Error('清稿笔迹必须声明 part 或 objectId，才能绑定对应底稿');
  for(const target of affected)if(!guides.some(guide=>cleanTarget(guide.part)===target||cleanTarget(guide.objectId)===target))throw Error(`清稿部位 ${target} 没有绑定同部位底稿`);
  return ids;
}
