const clone=value=>structuredClone(value);
const overlap=(a,b)=>a[0]<=b[0]+b[2]&&b[0]<=a[0]+a[2]&&a[1]<=b[1]+b[3]&&b[1]<=a[1]+a[3];
export function normalizeLocalChanges(value=[]){
  if(!Array.isArray(value))throw Error('localChanges must be an array');
  return value.map(r=>{
    if(typeof r.key!=='string'||!Array.isArray(r.region)||r.region.length!==4||r.region.some(v=>!Number.isFinite(v))||r.region[2]<=0||r.region[3]<=0||!Number.isInteger(r.revision)||!Array.isArray(r.strokeIds)||!Array.isArray(r.objectIds)||!Array.isArray(r.layerIds))throw Error('Invalid local change');
    return clone(r);
  });
}
// Record geometry changes, not a claim that the model has inspected them.
export function trackLocalChanges(doc,{ids=[],previousCommands=[]}={}){
  const groups=new Map(),current=new Map(doc.commands.map(c=>[c.id,c]));
  for(const c of [...ids.map(id=>current.get(id)).filter(Boolean),...previousCommands]){
    if(c.stage!=='lineart')continue;
    const key=c.objectId?'object:'+c.objectId:c.part?'part:'+c.part:'layer:'+c.layer;
    const row=groups.get(key)||{key,objectIds:c.objectId?[c.objectId]:[],layerIds:[],strokeIds:[],bounds:[Infinity,Infinity,-Infinity,-Infinity]};
    row.layerIds.push(c.layer);row.strokeIds.push(c.id);
    for(const [x,y] of c.points||[]){row.bounds[0]=Math.min(row.bounds[0],x);row.bounds[1]=Math.min(row.bounds[1],y);row.bounds[2]=Math.max(row.bounds[2],x);row.bounds[3]=Math.max(row.bounds[3],y);}
    groups.set(key,row);
  }
  if(!ids.length||!groups.size)groups.set('document',{key:'document',objectIds:[],layerIds:[],strokeIds:ids,bounds:[0,0,doc.width,doc.height]});
  const retained=new Map((doc.localChanges||[]).map(r=>[r.key,r]));
  for(const row of groups.values()){
    const [a,b,c,d]=row.bounds;if(!Number.isFinite(a))continue;
    const x=Math.max(0,Math.floor(a-8)),y=Math.max(0,Math.floor(b-8)),right=Math.min(doc.width,Math.ceil(c+8)),bottom=Math.min(doc.height,Math.ceil(d+8));
    if(right<=x||bottom<=y)continue;
    // Keep earlier changed ranges so another edit cannot hide an unobserved area.
    const prior=retained.get(row.key),fresh=[x,y,right-x,bottom-y];
    const region=prior?union(prior.region,fresh):fresh;
    retained.set(row.key,{key:row.key,objectIds:row.objectIds,layerIds:[...new Set([...(prior?.layerIds||[]),...row.layerIds])],strokeIds:[...new Set([...(prior?.strokeIds||[]),...row.strokeIds])],region,revision:doc.revision,phase:doc.workflow.phase});
  }
  doc.localChanges=[...retained.values()];
}
function union(a,b){const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]);return [x,y,Math.max(a[0]+a[2],b[0]+b[2])-x,Math.max(a[1]+a[3],b[1]+b[3])-y];}
function layoutCalibration(doc,hasImages){
  if(doc.workflow.phase!=='layout')return null;
  const strokes=doc.commands.filter(c=>c.stage==='lineart'&&c.subphase==='layout');
  const region=[0,0,doc.width,doc.height];
  const changedIds=new Set((doc.localChanges||[]).filter(r=>r.revision===doc.revision).flatMap(r=>r.strokeIds));
  const guideIds=strokes.map(c=>c.id),anchorIds=[...new Set(strokes.flatMap(c=>(c.geometry?.through||[]).filter(p=>p.anchor).map(p=>p.anchor)))];
  return {kind:'layout-calibration',revision:doc.revision,region,
    status:!strokes.length?'awaiting-layout':hasImages({region,minimumScale:Math.min(1,1024/Math.max(doc.width,doc.height))})?'images-returned-calibration-required':'needs-whole-comparison',
    guideIds:guideIds,totalGuideIds:guideIds.length,changedGuideIds:guideIds.filter(id=>changedIds.has(id)),anchorIds,
    nextInspection:{tool:'paint_inspect_context',arguments:{region,padding:0,maxSize:1024,guideIds:guideIds}},
    originalSizeComparison:{tool:'paint_observe_review',arguments:{region,scale:1}},
    instruction:'1A 提交成功只表示占位底稿已画出，不表示定位正确。播放未完先 finish；对照整图校准头身比例、头/胸廓/骨盆的位置与倾斜、肩胯方向、关节与四肢端点、重心及身体周围负形。发现偏差直接修改这些底稿 ID 或锚点，修改后再看整图；确认接近参考后才承接到 1B，不能把纠错全留给 1C。图像返回不等于校准完成；无需凑修改次数，不增加正式审核。',
    guidePagination:null};
}
export function localChangeFeedback(doc,hasImages,{objectId,region,limit=8}={}){
  const rows=(doc.localChanges||[]).filter(r=>!objectId&&!region||r.objectIds.includes(objectId)||region&&overlap(r.region,region)).sort((a,b)=>b.revision-a.revision);
  const pending=rows.filter(r=>!hasImages(r));
  const calibration=layoutCalibration(doc,hasImages);
  return {phase:doc.workflow.phase,...(calibration?{layoutCalibration:calibration}:{}),trackedParts:rows.length,pendingImageParts:pending.length,scope:'tracked changes only; legacy work without these records is unknown',meaning:'Images returned is not proof of visual inspection or artistic quality.',next:calibration?.totalGuideIds?[calibration]:pending.slice(0,limit).map(r=>({...clone(r),strokeIds:r.strokeIds,totalStrokeIds:r.strokeIds.length,nextInspection:Math.max(r.region[2],r.region[3])>1024?{tool:'paint_observe_review',arguments:{region:r.region,scale:1}}:{tool:'paint_inspect_context',arguments:{region:r.region,padding:0,maxSize:1024}},instruction:'对照参考逐段检查关键转折、宽窄和相邻空隙；改过的目标是否更接近参考，不用顺滑或可辨认代替。'}))};
}
