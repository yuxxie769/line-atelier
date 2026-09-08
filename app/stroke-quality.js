const QUALITY_PHASES=new Set(['refine','clean','lineart_review']);

const round=(value,digits=1)=>Number(value.toFixed(digits));
const targetOf=command=>command.objectId?`object:${command.objectId}`:command.part?`part:${command.part}`:null;

function arcMetrics(points=[]){
  if(points.length<2)return {length:0,totalTurnDeg:0,directionReversals:0,strongTurns:0};
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  const length=lengths.at(-1);if(!length)return {length:0,totalTurnDeg:0,directionReversals:0,strongTurns:0};
  const count=Math.min(32,Math.max(8,Math.ceil(length/45))),sample=[];let j=1;
  for(let i=0;i<=count;i++){
    const d=length*i/count;while(j<lengths.length-1&&lengths[j]<d)j++;
    const a=points[j-1],b=points[j],t=(d-lengths[j-1])/(lengths[j]-lengths[j-1]||1);
    sample.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
  }
  const turns=[];
  for(let i=1;i<sample.length-1;i++){
    const a=sample[i-1],b=sample[i],c=sample[i+1],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];
    const angle=Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]);if(Math.abs(angle)>=Math.PI/36)turns.push(angle);
  }
  let directionReversals=0,last=0;for(const turn of turns){const sign=Math.sign(turn);if(last&&sign!==last)directionReversals++;last=sign;}
  return {length,totalTurnDeg:turns.reduce((sum,v)=>sum+Math.abs(v),0)*180/Math.PI,directionReversals,strongTurns:turns.filter(v=>Math.abs(v)>=Math.PI/7.2).length};
}

function sourceSegments(command,metrics){
  const geometry=command.geometry;
  if(geometry?.kind==='path')return (geometry.path.match(/[LQC]/g)||[]).length;
  if(geometry?.kind==='through')return Math.max(1,geometry.through.length-1);
  if(geometry?.kind==='control')return 1;
  return Math.max(1,metrics.strongTurns+metrics.directionReversals+1);
}

function hasLocalPressure(command){
  if(command.pressureProfile?.length>2||command.widthEdits?.length)return true;
  const source=command.geometry?.kind==='through'?command.geometry.through:command.geometry?.kind==='polyline'?command.geometry.points:!command.geometry?command.points:null;
  const values=(source||[]).filter(Array.isArray).filter(p=>p.length>2).map(p=>p[2]);
  return values.length>=3&&new Set(values.map(v=>round(v,3))).size>1;
}

function compoundSummary(id,commands){
  const targets=[...new Set(commands.map(targetOf).filter(Boolean))],roles=[...new Set(commands.map(c=>c.strokeRole).filter(Boolean))],joins=[...new Set(commands.map(c=>c.joinStyle).filter(Boolean))];
  return {id,strokeIds:commands.map(c=>c.id),strokes:commands.length,targets,roles,joins,complete:commands.length>1&&commands.every(c=>c.strokeRole&&c.joinStyle)&&targets.length<=1};
}

export function inspectStrokeQuality(doc,{phase,part,objectId,limit=50}={}){
  const all=(doc?.commands||[]).filter(c=>c.type==='stroke'&&QUALITY_PHASES.has(c.subphase)&&(!phase||c.subphase===phase)&&(!part||c.part===part)&&(!objectId||c.objectId===objectId));
  const groups=new Map();for(const c of all)if(c.compoundId){if(!groups.has(c.compoundId))groups.set(c.compoundId,[]);groups.get(c.compoundId).push(c);}
  const compounds=[...groups].map(([id,commands])=>compoundSummary(id,commands)),compoundById=new Map(compounds.map(g=>[g.id,g]));
  const diagonal=Math.hypot(doc?.width||1,doc?.height||1),records=all.map(command=>{
    const metrics=arcMetrics(command.points),segments=sourceSegments(command,metrics),long=metrics.length>=diagonal*.12;
    const complex=segments>=5||metrics.directionReversals>=2||(metrics.directionReversals>=1&&metrics.totalTurnDeg>=75)||metrics.strongTurns>=3;
    const compound=command.compoundId?compoundById.get(command.compoundId):null;
    return {command,metrics,segments,long,complex,compoundCovered:!!compound&&compound.strokes>1,localPressure:hasLocalPressure(command),genericTaperOnly:!!command.geometry?.taper&&!command.pressureProfile&&!command.widthEdits?.length};
  });
  const warnings=[];
  for(const record of records){
    if(record.long&&record.complex&&!record.compoundCovered)warnings.push({kind:'monolithic-complex-contour',severity:'advisory',strokeIds:[record.command.id],target:targetOf(record.command),phase:record.command.subphase,metrics:{length:round(record.metrics.length),canvasDiagonalRatio:round(record.metrics.length/diagonal,3),sourceSegments:record.segments,totalTurnDeg:round(record.metrics.totalTurnDeg),directionReversals:record.metrics.directionReversals},missingLocalPressure:!record.localPressure,note:'长笔中包含多段曲率或方向变化。请核对是否应在曲率极值、转面、遮挡或线条职责变化处分笔，并用少量搭接保持连续；若它确实是一笔简单扫线，可保留并说明。'});
  }
  for(const group of compounds){
    if(group.strokes>1&&!group.complete)warnings.push({kind:'compound-metadata-incomplete',severity:'advisory',strokeIds:group.strokeIds,compoundId:group.id,note:group.targets.length>1?'同一复合轮廓跨越多个目标；请拆组或修正 part/objectId。':'复合轮廓应为每笔声明 strokeRole 与 joinStyle，便于判断接线和局部轻重。'});
  }
  const warningCount=warnings.length,shown=warnings.slice(0,Math.max(0,limit));
  return {version:1,scope:{phase:phase||'refine+clean+lineart_review',part:part||null,objectId:objectId||null},summary:{strokes:all.length,compoundGroups:compounds.filter(g=>g.strokes>1).length,compoundCoveredStrokes:records.filter(r=>r.compoundCovered).length,locallyPressureAuthored:records.filter(r=>r.localPressure).length,genericTaperOnly:records.filter(r=>r.genericTaperOnly).length,longComplexStrokes:records.filter(r=>r.long&&r.complex).length,monolithicComplexStrokes:records.filter(r=>r.long&&r.complex&&!r.compoundCovered).length,warningCount},compoundGroups:compounds,warnings:shown,truncated:warningCount>shown.length,principle:'refine、clean、lineart_review 的复杂轮廓必须通过复合笔组规划；短线数量本身不是质量指标，简单流畅的长扫线须明确声明后保留。'};
}
