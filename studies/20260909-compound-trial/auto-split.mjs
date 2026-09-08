import {validateBatch,renderPoints} from '../../app/model.js';

// Experimental compiler. Model authors the contour, pressure and lift locations.
// No reference image, image-derived outline, randomness or offset is used here.
export function compileCompound(spec,doc){
  const {stroke,breaks,overlapPx=8}=spec;
  if(!Array.isArray(breaks)||!breaks.length||breaks.length>15)throw Error('需要 1–15 个分笔位置');
  if(!Number.isFinite(overlapPx)||overlapPx<=0||overlapPx>40)throw Error('搭接长度应在 0–40 像素内');
  let previous=0;
  for(const b of breaks){if(!Number.isFinite(b.at)||b.at<=previous||b.at>=1)throw Error('分笔位置必须在 0–1 内递增');previous=b.at;}
  const source=validateBatch([stroke],{...doc,commands:[]})[0];
  if(source.type!=='stroke'||source.closed||source.geometry?.path?.includes('Z'))throw Error('仅支持开放画笔轨迹');
  if(source.opacity!==1||source.pressureCurve||source.widthEdits?.length)throw Error('本原型仅支持不透明、线性压力、无局部倍率的笔迹');
  const points=renderPoints(source,doc,2),lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  const length=lengths.at(-1);if(!length)throw Error('不能拆分零长度笔迹');
  const at=d=>{let lo=1,hi=points.length-1;while(lo<hi){const m=(lo+hi)>>1;if(lengths[m]<d)lo=m+1;else hi=m;}const a=points[lo-1],b=points[lo],t=(d-lengths[lo-1])/(lengths[lo]-lengths[lo-1]||1);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,(a[2]??1)+((b[2]??1)-(a[2]??1))*t];};
  const cuts=[0,...breaks.map(b=>b.at*length),length];
  const half=cuts.map((d,i)=>i===0||i===cuts.length-1?0:Math.min(overlapPx/2,(d-cuts[i-1])*.4,(cuts[i+1]-d)*.4));
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  const commands=[];
  for(let i=0;i<cuts.length-1;i++){
    const left=cuts[i],right=cuts[i+1],start=left-half[i],end=right+half[i+1];
    const marks=new Set([start,left,right,end,...lengths.filter(d=>d>start&&d<end)]);
    // Put several width samples in each taper even when the source is a straight L.
    for(let j=1;j<8;j++){if(half[i])marks.add(start+half[i]*j/8);if(half[i+1])marks.add(right+half[i+1]*j/8);}
    const sample=[...marks].sort((a,b)=>a-b).map(d=>{
      const p=at(d);let envelope=1;
      if(d<left)envelope=smooth((d-start)/half[i]);
      if(d>right)envelope=smooth((end-d)/half[i+1]);
      // Preserve original effective width; only lower it on the overlap tail.
      const floor=source.pressureFloor??.2;p[2]=(floor+(1-floor)*p[2])*envelope;return p;
    });
    const {geometry,points:ignored,pressureProfile,taper,pressureFloor,smoothing,...style}=source;
    commands.push({...style,id:`${source.id}-auto-${i+1}`,pressureFloor:0,geometry:{kind:'polyline',points:sample},compoundId:`${source.id}-compound`,strokeRole:spec.roles?.[i]||'silhouette',joinStyle:'overlap',endpoints:[i?'joined':source.endpoints?.[0]||'open',i<cuts.length-2?'joined':source.endpoints?.[1]||'open']});
  }
  return {commands:validateBatch(commands,{...doc,commands:[]}),joins:breaks.map((b,i)=>({...b,point:at(cuts[i+1]).slice(0,2),overlapPx:half[i+1]*2})),length};
}
