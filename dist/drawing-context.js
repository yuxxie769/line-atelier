import {scenePoint} from './geometry.js';
import {renderPoints} from './model.js';
import {renderRegion,strokeRaster} from './renderer.js';
import {referenceCrop} from './reference.js';

const draftRoles=new Set(['construction','rough','refine','sketch']);
const inside=(p,r)=>p[0]>=r[0]&&p[0]<=r[0]+r[2]&&p[1]>=r[1]&&p[1]<=r[1]+r[3];
const overlaps=(a,b)=>a[0]<=b[0]+b[2]&&a[0]+a[2]>=b[0]&&a[1]<=b[1]+b[3]&&a[1]+a[3]>=b[1];
function bounds(ps){const xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)];}
function crosses(ps,r){
  if(ps.some(p=>inside(p,r)))return true;
  // Liang–Barsky includes a long segment crossing the crop with both ends outside.
  return ps.slice(1).some((b,i)=>{const a=ps[i],dx=b[0]-a[0],dy=b[1]-a[1];let lo=0,hi=1;
    for(const [p,q] of [[-dx,a[0]-r[0]],[dx,r[0]+r[2]-a[0]],[-dy,a[1]-r[1]],[dy,r[1]+r[3]-a[1]]]){
      if(p===0){if(q<0)return false;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;}
    }return true;});
}
function integer(n,min,max,name){if(!Number.isInteger(n)||n<min||n>max)throw Error(`${name} 需要 ${min}–${max} 的整数`);return n;}

// Reads existing model-authored geometry only. No reference pixels are analyzed.
export function collectDrawingContext(doc,{objectId,query,region,padding=40,offset=0,limit=80,guideIds=[]}={}){
  integer(offset,0,60000,'offset');integer(limit,1,200,'limit');
  if(!Number.isFinite(padding)||padding<0||padding>400)throw Error('padding 需要 0–400 画布像素');
  if(!Array.isArray(guideIds)||guideIds.length>200||guideIds.some(id=>typeof id!=='string'))throw Error('guideIds 格式错误');
  const objects=doc.scene?.objects||[],layers=new Map(doc.layers.map(l=>[l.id,l]));
  let target=objectId?objects.find(o=>o.id===objectId):null;
  if(objectId&&!target)throw Error('物体 ID 不存在');
  if(!target&&query){
    const q=String(query).trim().toLowerCase();if(!q)throw Error('请输入部位名称');
    const exact=objects.filter(o=>o.id.toLowerCase()===q||o.name.toLowerCase()===q);
    const matches=exact.length?exact:objects.filter(o=>(o.id+' '+o.name).toLowerCase().includes(q));
    if(matches.length!==1)return {status:matches.length?'ambiguous':'not-found',candidates:matches.map(o=>({id:o.id,name:o.name,frame:o.frame})),hint:'选择一个 objectId，或提供画布 region。'};
    target=matches[0];
  }
  if(!target&&!region)throw Error('需要 objectId、部位 query 或 region');
  const base=region||target.frame;
  if(!Array.isArray(base)||base.length!==4||!base.every(Number.isFinite)||base[2]<=0||base[3]<=0)throw Error('region 需要 [x,y,width,height]');
  const x=Math.max(0,Math.floor(base[0]-padding)),y=Math.max(0,Math.floor(base[1]-padding));
  const right=Math.min(doc.width,Math.ceil(base[0]+base[2]+padding)),bottom=Math.min(doc.height,Math.ceil(base[1]+base[3]+padding));
  if(right<=x||bottom<=y)throw Error('部位位于画布外');
  const crop=[x,y,right-x,bottom-y],ancestors=[];
  for(let p=target;p;p=objects.find(o=>o.id===p.parent))ancestors.push(p.id);
  const explicit=new Set(guideIds);
  for(const id of explicit)if(!doc.commands.some(c=>c.id===id&&c.type==='stroke'))throw Error(`底稿笔迹不存在：${id}`);
  const candidates=[];
  for(const c of doc.commands){
    if(c.type!=='stroke')continue;
    const l=layers.get(c.layer),draft=explicit.has(c.id)||draftRoles.has(l?.role)||['layout','rough','structure_review','refine'].includes(c.subphase);
    const ps=c.points||renderPoints(c,doc),hit=crosses(c.closed?[...ps,ps[0]]:ps,crop);
    if(!explicit.has(c.id)&&!hit)continue;
    const relationship=explicit.has(c.id)?'explicit':c.objectId===target?.id?'target':ancestors.includes(c.objectId)?'ancestor':'spatial';
    candidates.push({c,l,ps,draft,relationship,rank:explicit.has(c.id)?0:draft?(relationship==='target'?1:relationship==='ancestor'?2:3):4});
  }
  candidates.sort((a,b)=>a.rank-b.rank);
  const selected=candidates.slice(offset,offset+limit),commands=selected.map(({c,l,ps,draft,relationship},i)=>{
    const g=c.geometry;let kind,points;
    if(g?.kind==='through'){kind='through';points=g.through.map(p=>scenePoint(p,g.space,doc.scene));}
    else if(g?.kind==='control'){kind='bezier-control';points=g.control;}
    else {kind='sampled-trajectory';points=ps.length<=32?ps:Array.from({length:32},(_,j)=>ps[Math.round(j*(ps.length-1)/31)]);}
    return {label:offset+i+1,id:c.id,name:c.part||c.id,intent:c.intent||'',objectId:c.objectId||null,layer:{id:l.id,name:l.name,visible:l.visible,opacity:l.opacity},subphase:c.subphase,draft,relationship,bounds:bounds(ps),
      coordinates:{kind,document:points,localToCrop:points.map(p=>[p[0]-x,p[1]-y,...p.slice(2)]),normalizedToTarget:target?points.map(p=>[(p[0]-target.frame[0])/target.frame[2],(p[1]-target.frame[1])/target.frame[3],...p.slice(2)]):null,originalTrajectoryPointCount:ps.length,sampled:kind==='sampled-trajectory'&&ps.length>32},
      geometry:g?structuredClone(g):null,endpoints:[ps[0],ps.at(-1)]};
  });
  const anchorIds=new Set(commands.flatMap(c=>(c.geometry?.through||[]).filter(p=>p.anchor).map(p=>p.anchor)));
  const anchors=(doc.scene?.anchors||[]).map(a=>({...a,document:scenePoint({anchor:a.id},null,doc.scene)})).filter(a=>anchorIds.has(a.id)||inside(a.document,crop));
  return {status:'ready',revision:doc.revision,document:{width:doc.width,height:doc.height},target:target?structuredClone(target):null,region:crop,
    coordinates:'All returned document coordinates use the full canvas. localToCrop subtracts region origin; normalizedToTarget uses target.frame, not screenshot size.',
    objects:objects.filter(o=>ancestors.includes(o.id)||overlaps(o.frame,crop)).map(o=>structuredClone(o)),anchors,commands,
    total:candidates.length,offset,nextOffset:offset+limit<candidates.length?offset+limit:null,
    guideStatus:candidates.some(c=>c.draft)?'available':'none-found',
    notes:['Spatial matches are candidate guides, not a claim of anatomical relevance. Select or correct them yourself.','Guide views reveal retained draft stroke geometry, including hidden layers, without masks or occlusion; they are observation aids, not the exported drawing.','Coordinates describe saved geometry; drawing images show the current playback position.']};
}

export function inspectDrawingContext(engine,options={}, {reference=null,referenceAllowed=false}={}){
  const data=collectDrawingContext(engine.doc,options);if(data.status!=='ready')return data;
  const maxSize=integer(options.maxSize??640,256,1024,'maxSize'),r=data.region,scale=Math.max(.25,Math.min(4,maxSize/Math.max(r[2],r[3])));
  const drawing=renderRegion(engine,{region:r,scale}),overlay=document.createElement('canvas');overlay.width=drawing.width;overlay.height=drawing.height;
  const ox=overlay.getContext('2d');ox.drawImage(drawing,0,0);ox.fillStyle='rgba(255,255,255,.68)';ox.fillRect(0,0,overlay.width,overlay.height);
  const guides=document.createElement('canvas');guides.width=drawing.width;guides.height=drawing.height;const gx=guides.getContext('2d');gx.fillStyle='#fff';gx.fillRect(0,0,guides.width,guides.height);
  for(const ctx of [ox,gx]){
    ctx.save();ctx.scale(scale,scale);ctx.translate(-r[0],-r[1]);
    for(const entry of data.commands.filter(c=>c.draft)){
      const c=engine.doc.commands.find(c=>c.id===entry.id),ps=renderPoints(c,engine.doc);
      strokeRaster(ctx,{...c,color:'#007e9c',width:Math.max(c.width,1.4/scale)},ps);
      const p=ps.find(p=>inside(p,r));if(p){ctx.font=`${12/scale}px sans-serif`;ctx.fillStyle='#005d74';ctx.fillText(String(entry.label),p[0]+3/scale,p[1]-3/scale);}
    }ctx.restore();
  }
  let ref=null;const referenceStatus=!reference?'missing':referenceAllowed?'available':'access-disabled';
  if(referenceStatus==='available')ref=referenceCrop(reference,{region:r,scale:Math.max(.25,scale),documentWidth:engine.doc.width,documentHeight:engine.doc.height});
  const full=[0,0,engine.doc.width,engine.doc.height],fullScale=maxSize/Math.max(full[2],full[3]),overview=renderRegion(engine,{region:full,scale:fullScale});
  const vx=overview.getContext('2d');vx.strokeStyle='#dc6635';vx.lineWidth=2;vx.strokeRect(r[0]*fullScale,r[1]*fullScale,r[2]*fullScale,r[3]*fullScale);
  const encode=(canvas,region,scale)=>({dataUrl:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,region,scale,documentToImage:[scale,0,0,scale,-region[0]*scale,-region[1]*scale],imageToDocument:[1/scale,0,0,1/scale,region[0],region[1]]});
  return {...data,playback:engine.state(),referenceStatus,images:{reference:ref,drawing:encode(drawing,r,scale),drawingWithGuides:encode(overlay,r,scale),guides:encode(guides,r,scale),overview:encode(overview,full,fullScale)}};
}
