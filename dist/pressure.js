// Pressure and line-width edits are authored independently of path geometry.
const pressureClamp = v => Math.max(0,Math.min(1,v));
export function validatePressureProfile(value,name='压力曲线') {
  if(!Array.isArray(value)||value.length<2||value.length>64)throw Error(name+'需要 2–64 个 [位置,压力] 节点');
  let prev=-1;
  const result=value.map(p=>{if(!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||v<0||v>1)||p[0]<=prev)throw Error(name+'节点须在 0–1 内，位置严格递增');prev=p[0];return [...p];});
  if(result[0][0]!==0||result.at(-1)[0]!==1)throw Error(name+'必须包含位置 0 和 1');return result;
}
export function pressureAt(profile,t) {
  t=pressureClamp(t);let i=1;while(i<profile.length-1&&profile[i][0]<t)i++;
  const a=profile[i-1],b=profile[i],f=(t-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*f;
}
export function pressureWidth(command,p=1,t=0) {
  const floor=command.pressureFloor??.2;
  const value=command.pressureCurve?pressureAt(command.pressureCurve,pressureClamp(p)):pressureClamp(p);
  return command.width*(floor+(1-floor)*value)*(command.widthEdits||[]).reduce((m,e)=>m*widthEditFactor(e,t),1);
}
export function applyPressureProfile(points,profile) {
  if(!profile)return points;
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  const total=lengths.at(-1);if(!total)return points.map(p=>[p[0],p[1],pressureAt(profile,0)]);
  // Include profile knots even on a long two-point path. Geometry stays unchanged.
  const marks=[...new Set([...lengths,...profile.map(p=>p[0]*total)])].sort((a,b)=>a-b),out=[];let j=1;
  for(const d of marks){while(j<lengths.length-1&&lengths[j]<d)j++;const a=points[j-1],b=points[j],t=(d-lengths[j-1])/(lengths[j]-lengths[j-1]||1);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,pressureAt(profile,d/total)]);}return out;
}
export function widthEditFactor({range:[a,b],factor,feather},t) {
  const influence=t>=a&&t<=b?1:t<a&&feather?Math.max(0,1-(a-t)/feather):t>b&&feather?Math.max(0,1-(t-b)/feather):0;
  return 1+(factor-1)*influence;
}
export function validateWidthEdits(edits,width) {
  if(!Array.isArray(edits)||edits.length>32)throw Error('最多保留 32 次局部线宽修改');
  const result=edits.map(({range,factor,feather=.05})=>{
    if(!Array.isArray(range)||range.length!==2||range.some(v=>!Number.isFinite(v)||v<0||v>1)||range[0]>=range[1])throw Error('线宽范围需要 0–1 内递增的起终点');
    if(!Number.isFinite(factor)||factor<.1||factor>4||!Number.isFinite(feather)||feather<.001||feather>.5)throw Error('倍率需要 0.1–4，过渡范围需要 0.001–0.5');
    return {range:[...range],factor,feather};
  });
  if(width*result.reduce((m,e)=>m*Math.max(1,e.factor),1)>180)throw Error('累计线宽可能超过 180 px，请减少倍率');return result;
}
export function localWidthProfile(command,{range=[0,1],factor=1,feather=.05}={}) {
  return {widthEdits:validateWidthEdits([...(command.widthEdits||[]),{range,factor,feather}],command.width)};
}
export function insertWidthKnots(points,edits) {
  if(!edits?.length||points.length<2)return points;
  const ls=[0];for(let i=1;i<points.length;i++)ls.push(ls.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));const total=ls.at(-1);if(!total)return points;
  const marks=[...new Set([...ls,...edits.flatMap(e=>[Math.max(0,e.range[0]-e.feather),...e.range,Math.min(1,e.range[1]+e.feather)]).map(t=>t*total)])].sort((a,b)=>a-b);let j=1;
  return marks.map(d=>{while(j<ls.length-1&&ls[j]<d)j++;const a=points[j-1],b=points[j],t=(d-ls[j-1])/(ls[j]-ls[j-1]||1);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,(a[2]??1)+((b[2]??1)-(a[2]??1))*t];});
}
