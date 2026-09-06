// Geometry is authored by the model or pen user. This module has no image input.
export const LINE_PHASES = [
  ['layout','整体定位'],['rough','完整粗稿'],['structure_review','结构修稿'],
  ['refine','细化草稿'],['clean','精细清线'],['lineart_review','1F · 两轮整体审核']
].map(([id,name])=>({id,name}));
const geomId=v=>{if(typeof v!=='string'||!/^[\w-]{1,100}$/.test(v))throw Error('几何 ID 格式错误');return v;};
const geomNumber=(v,min=-8192,max=8192)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error('几何坐标超出范围');return v;};
const geomPoint=p=>{if(!Array.isArray(p)||p.length<2||p.length>3)throw Error('经过点需要 [x,y,pressure?]');return [geomNumber(p[0]),geomNumber(p[1]),...(p.length===3?[geomNumber(p[2],0,1)]:[])];};
export function normalizeThrough(points){
  if(!Array.isArray(points)||points.length<2||points.length>256)throw Error('每条曲线需要 2–256 个经过点');
  return points.map(p=>Array.isArray(p)?geomPoint(p):{anchor:geomId(p?.anchor)});
}
export function normalizeScene(raw={}){
  const unique=(items,max)=>{if(!Array.isArray(items)||items.length>max)throw Error('对象数据超过上限');const ids=new Set();for(const x of items){geomId(x.id);if(ids.has(x.id))throw Error('对象 ID 重复');ids.add(x.id);}return items;};
  const objects=unique(raw.objects||[],128).map(o=>{
    const frame=o.frame||[0,0,1,1];if(!Array.isArray(frame)||frame.length!==4)throw Error('对象 frame 需要 [x,y,w,h]');frame.forEach(v=>geomNumber(v));if(frame[2]<=0||frame[3]<=0)throw Error('对象宽高必须大于零');
    if(o.phase&&!LINE_PHASES.some(p=>p.id===o.phase))throw Error('对象子阶段不存在');
    return {id:o.id,name:String(o.name||o.id).slice(0,100),frame:[...frame],parent:o.parent?geomId(o.parent):null,material:String(o.material||'opaque').slice(0,60),phase:o.phase||'rough',note:String(o.note||'').slice(0,1000)};
  });
  const known=new Map(objects.map(o=>[o.id,o]));
  for(const o of objects){let p=o,seen=new Set();while(p){if(seen.has(p.id))throw Error('对象父子关系不能成环');seen.add(p.id);if(p.parent&&!known.has(p.parent))throw Error('父对象不存在');p=known.get(p.parent);}}
  const anchors=unique(raw.anchors||[],2048).map(a=>{if(a.objectId&&!known.has(a.objectId))throw Error('锚点所属对象不存在');return {id:a.id,objectId:a.objectId||null,point:geomPoint(a.point),corner:!!a.corner,...(a.tangent?{tangent:geomPoint(a.tangent).slice(0,2)}:{})};});
  const scene={objects,anchors,regions:[],occlusions:[]};
  scene.regions=unique(raw.regions||[],256).map(r=>{
    if(!known.has(r.objectId)||r.space&&!known.has(r.space))throw Error('区域所属对象或坐标空间不存在');
    const item={id:r.id,objectId:r.objectId,space:r.space||null,through:normalizeThrough(r.through),corners:(r.corners||[]).map(v=>geomNumber(v,0,r.through.length-1)),purpose:String(r.purpose||'hidden-boundary').slice(0,100)};
    if(item.through.length<3)throw Error('闭合区域至少三个经过点');throughGeometry({...item,closed:true},scene);return item;
  });
  scene.occlusions=unique(raw.occlusions||[],256).map(o=>{
    const r=scene.regions.find(r=>r.id===o.regionId);if(!r||!known.has(o.back)||r.objectId===o.back)throw Error('遮挡需要前景区域和不同的后景对象');
    if(known.get(r.objectId).material==='transparent')throw Error('透明物体不能当作不透明遮挡；请单独定义镜框等不透明对象');
    return {id:o.id,regionId:r.id,front:r.objectId,back:o.back,note:String(o.note||'').slice(0,300)};
  });
  for(const o of objects){const walk=(id,seen)=>{if(seen.has(id))throw Error('全局遮挡成环；请拆分穿插物体为局部片段');const next=new Set([...seen,id]);for(const rel of scene.occlusions.filter(r=>r.front===id))walk(rel.back,next);};walk(o.id,new Set());}
  return scene;
}
export function scenePoint(point,space,scene){
  let p=point,frameId=space;if(!Array.isArray(point)){const a=scene?.anchors.find(a=>a.id===point.anchor);if(!a)throw Error('经过点引用的锚点不存在：'+point.anchor);p=a.point;frameId=a.objectId;}
  if(!frameId)return [...p];const o=scene?.objects.find(o=>o.id===frameId);if(!o)throw Error('局部坐标对象不存在：'+frameId);
  return [o.frame[0]+p[0]*o.frame[2],o.frame[1]+p[1]*o.frame[3],...(p.length>2?[p[2]]:[])];
}
export function throughGeometry(source,scene={objects:[],anchors:[]},quality=1){
  const raw=normalizeThrough(source.through),points=raw.map(p=>scenePoint(p,source.space,scene));
  const tension=geomNumber(source.tension??.8,0,1),corners=new Set(source.corners||[]);
  for(const c of corners)if(!Number.isInteger(c)||c<0||c>=points.length)throw Error('尖角索引超出经过点范围');
  raw.forEach((p,i)=>{if(p.anchor&&scene.anchors.find(a=>a.id===p.anchor)?.corner)corners.add(i);});
  const closed=!!source.closed,n=points.length,segments=[];
  const at=i=>points[closed?(i+n)%n:Math.max(0,Math.min(n-1,i))];
  const tangent=(i,side,length)=>{
    const p=at(i),other=at(i+side);if(corners.has((i+n)%n))return [(other[0]-p[0])*side*tension,(other[1]-p[1])*side*tension];
    const anchor=raw[(i+n)%n]?.anchor&&scene.anchors.find(a=>a.id===raw[(i+n)%n].anchor);
    if(anchor?.tangent){const o=scene.objects.find(o=>o.id===anchor.objectId),v=[anchor.tangent[0]*(o?.frame[2]||1),anchor.tangent[1]*(o?.frame[3]||1)],mag=Math.hypot(...v)||1;return v.map(x=>x/mag*length*tension);}
    const prev=at(i-1),next=at(i+1),span=Math.hypot(p[0]-prev[0],p[1]-prev[1])+Math.hypot(next[0]-p[0],next[1]-p[1]);
    return span?[(next[0]-prev[0])/span*length*tension,(next[1]-prev[1])/span*length*tension]:[0,0];
  };
  const out=[[...points[0]]];
  for(let i=0;i<(closed?n:n-1);i++){
    const a=at(i),b=at(i+1),len=Math.hypot(b[0]-a[0],b[1]-a[1]),ta=tangent(i,1,len),tb=tangent(i+1,-1,len);
    const c1=[a[0]+ta[0]/3,a[1]+ta[1]/3],c2=[b[0]-tb[0]/3,b[1]-tb[1]/3];segments.push([a.slice(0,2),c1,c2,b.slice(0,2)]);
    const steps=Math.max(2,Math.ceil((len+Math.hypot(...ta)/3+Math.hypot(...tb)/3)*quality/1.2));
    for(let j=1;j<=steps;j++){const t=j/steps,s=1-t;out.push([s*s*s*a[0]+3*s*s*t*c1[0]+3*s*t*t*c2[0]+t*t*t*b[0],s*s*s*a[1]+3*s*s*t*c1[1]+3*s*t*t*c2[1]+t*t*t*b[1],(a[2]??1)*(1-t)+(b[2]??1)*t]);if(out.length>16384)throw Error('曲线过长，请在自然断点分笔');}
  }
  return {points:out,segments,landmarks:points};
}
export function geometryPatch(old,patch){
  const next={...old,...patch};if(['through','path','control','points'].some(k=>Object.hasOwn(patch,k)))delete next.geometry;
  if(patch.geometry===null)delete next.geometry;
  return next;
}
export function sceneIssues(doc){
  const issues=[];for(const c of doc.commands){if(c.subphase!=='clean')continue;if(!c.objectId)issues.push({strokeId:c.id,kind:'ownership',note:'清线尚未指定物体'});if(!c.closed&&!c.endpoints)issues.push({strokeId:c.id,kind:'endpoints',note:'说明开放线端、遮挡或连接关系'});}
  for(const a of doc.scene.anchors){const linked=doc.commands.filter(c=>c.geometry?.through?.some(p=>p.anchor===a.id));if(linked.length>1)issues.push({anchorId:a.id,kind:'shared',strokeIds:linked.map(c=>c.id),note:a.corner?'共享转折点':'共享点；切线是否连续仍需查看'});}
  return issues;
}
