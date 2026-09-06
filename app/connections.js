import {throughGeometry} from './geometry.js';

// Geometry-only assistance: no image input and no automatic snapping or quality pass.
function connectionDistance(p,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
  const point=[a[0]+t*dx,a[1]+t*dy];return {distance:Math.hypot(p[0]-point[0],p[1]-point[1]),point};
}
function connectionInside(p,ps){let inside=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const a=ps[i],b=ps[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function checkConnections(doc,{objectId,tolerance=1.25,limit=80,layerIds}={}){
  if(!Number.isFinite(tolerance)||tolerance<.1||tolerance>8)throw Error('接头容差需要 0.1–8 像素');
  if(!Number.isInteger(limit)||limit<1||limit>200)throw Error('提示上限需要 1–200');
  if(objectId&&!doc.scene.objects.some(o=>o.id===objectId))throw Error('检查对象不存在');
  const visible=new Set(layerIds||doc.layers.filter(l=>l.visible&&l.role!=='rough'&&l.role!=='construction').map(l=>l.id));
  const cs=doc.commands.filter(c=>c.subphase==='clean'&&c.type!=='erase'&&visible.has(c.layer));
  const regions=new Map(doc.scene.regions.map(r=>[r.id,throughGeometry({...r,closed:true},doc.scene).points]));
  const hidden=(p,c)=>doc.scene.occlusions.some(o=>o.back===c.objectId&&connectionInside(p,regions.get(o.regionId)));
  const nearOccluder=(p,c)=>doc.scene.occlusions.some(o=>{if(o.back!==c.objectId)return false;const ps=regions.get(o.regionId);return connectionInside(p,ps)||ps.some((a,i)=>connectionDistance(p,a,ps[(i+1)%ps.length]).distance<=tolerance);});
  const bounds=new Map(cs.map(c=>[c.id,c.points.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity])]));
  const issues=[];let checked=0,openEnds=0;
  for(const c of cs){if(objectId&&c.objectId!==objectId||c.closed||c.points.length<2)continue;
    for(const [end,point,claim] of [['start',c.points[0],c.endpoints?.[0]],['end',c.points.at(-1),c.endpoints?.[1]]]){
      if(!claim||claim==='open'||claim==='corner'){openEnds++;continue;}checked++;
      if(hidden(point,c)||claim==='occluded'&&nearOccluder(point,c))continue;
      let nearest=null;
      for(const other of cs){if(other.id===c.id)continue;const b=bounds.get(other.id),radius=nearest?.distance??64;if(point[0]<b[0]-radius||point[0]>b[2]+radius||point[1]<b[1]-radius||point[1]>b[3]+radius)continue;
        for(let i=1;i<other.points.length;i++){const candidate=connectionDistance(point,other.points[i-1],other.points[i]);if(candidate.distance>=(nearest?.distance??64)||hidden(candidate.point,other))continue;nearest={...candidate,strokeId:other.id,objectId:other.objectId};}
      }
      if(nearest&&nearest.distance<=tolerance)continue;
      issues.push({strokeId:c.id,objectId:c.objectId,end,claim,point:point.slice(0,2),distance:nearest?Number(nearest.distance.toFixed(2)):null,nearestStrokeId:nearest?.strokeId||null,note:claim==='occluded'?'遮挡端未接近已定义遮挡边界或其他可见线':'标记为相接，但附近没有相接的可见线'});
    }
  }
  return {revision:doc.revision,checked,openEnds,total:issues.length,issues:issues.slice(0,limit),truncated:issues.length>limit,tolerance,limitation:'仅检查已声明接头的几何支持；不判断人体、物体语义或艺术质量。开放的发丝衣褶需另行目视复核。'};
}
