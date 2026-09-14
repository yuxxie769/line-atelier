const ID=/^[a-zA-Z0-9_-]{1,64}$/;
const categories=new Set(['body','hair','clothing','accessory','prop','environment','opening','other']);
const subjects=new Set(['figure','non-figure','mixed']);
const coverageKinds=['hands','feet','joints','neck-shoulders','body-clothing'];
const coverageStatuses=new Set(['mapped','not-visible','not-applicable']);
const landmarkRoles=new Set(['connection','contact','opening','occlusion-entry','turn']);

export const OBJECT_MAP_GUIDANCE=`1B 第一次落笔前，先读取一次覆盖整幅画布的当前原参考，并把返回的 observation.id 交给 paint_record_object_map。一次记录全部主要身体部位、头发组、衣物、配饰、道具及重要开口、接触和遮挡；粒度保持在整只手、整只脚、主发束、袖子或配饰，不拆成指节、发丝或衣褶。每项 visibleMasks 使用画布坐标贴合该对象实际可见轮廓；同一对象被遮开的片段放在同一项的多个 polygon 中。遮罩只负责身份、位置、裁图和观察，不是作品选区或绘画路径，也不会自动保证造型准确。1B 及后续新笔迹必须携带有效 mapItemId。后续复用同一份物体图；发现对象身份或遮罩范围错误时 action=correct 修正原记录。每个局部仍须比较原参考、已有底稿和当前画面后自行选点。`;

const text=(value,label,max=1500,{required=true}={})=>{
  if(value===undefined||value===null)value='';
  if(typeof value!=='string'||value.trim().length>max||required&&!value.trim())throw Error(`${label} 需要 ${required?'1–':'最多 '}${max} 字`);
  return value.trim();
};
const id=(value,label='ID')=>{if(typeof value!=='string'||!ID.test(value))throw Error(`${label} 格式错误`);return value;};
const point=(value,width,height,label)=>{if(!Array.isArray(value)||value.length!==2||value.some(n=>!Number.isFinite(n)))throw Error(`${label} 需要 [x,y]`);if(value[0]<0||value[0]>width||value[1]<0||value[1]>height)throw Error(`${label} 必须位于画布内`);return [value[0],value[1]];};
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const onSegment=(a,b,p)=>Math.abs(cross(a,b,p))<1e-8&&p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8;
const intersects=(a,b,c,d)=>{const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);return (abC>0&&abD<0||abC<0&&abD>0)&&(cdA>0&&cdB<0||cdA<0&&cdB>0)||Math.abs(abC)<1e-8&&onSegment(a,b,c)||Math.abs(abD)<1e-8&&onSegment(a,b,d)||Math.abs(cdA)<1e-8&&onSegment(c,d,a)||Math.abs(cdB)<1e-8&&onSegment(c,d,b);};
function polygon(value,width,height,label){
  if(!Array.isArray(value)||value.length<3||value.length>4096)throw Error(`${label} 需要 3–4096 个点`);
  const result=value.map((p,n)=>point(p,width,height,`${label} 点 ${n+1}`));
  if(result.length>3&&result[0][0]===result.at(-1)[0]&&result[0][1]===result.at(-1)[1])result.pop();
  if(result.length<3)throw Error(`${label} 至少需要三个不同点`);
  let area=0;for(let i=0;i<result.length;i++){const a=result[i],b=result[(i+1)%result.length];area+=a[0]*b[1]-b[0]*a[1];}
  if(Math.abs(area)<1e-6)throw Error(`${label} 面积不能为零`);
  for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++)if(j!==i+1&&!(i===0&&j===result.length-1)&&intersects(result[i],result[(i+1)%result.length],result[j],result[(j+1)%result.length]))throw Error(`${label} 不能自相交`);
  return result;
}

export const objectMapItem=(map,itemId)=>map?.items?.find(item=>item.id===itemId)||null;
export function objectMapBounds(item,{padding=0,width,height}={}){
  if(!item?.visibleMasks?.length)return null;
  const points=item.visibleMasks.flatMap(mask=>mask.polygon),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const left=Math.max(0,Math.min(...xs)-padding),top=Math.max(0,Math.min(...ys)-padding),right=Math.min(width,Math.max(...xs)+padding),bottom=Math.min(height,Math.max(...ys)+padding);
  return [left,top,right-left,bottom-top];
}
export function normalizeObjectMap(value,{width,height,sceneObjects=[]}={}){
  if(value===undefined||value===null)return null;
  if(!value||typeof value!=='object'||!Number.isFinite(width)||!Number.isFinite(height))throw Error('objectMap 格式或画布尺寸错误');
  if(value.coordinateSpace!==undefined&&value.coordinateSpace!=='document')throw Error('objectMap.coordinateSpace 只支持 document');
  if(!subjects.has(value.subjectType))throw Error('objectMap.subjectType 需要 figure、non-figure 或 mixed');
  if(typeof value.referenceKey!=='string'||!value.referenceKey)throw Error('objectMap 需要 referenceKey');
  if(!Array.isArray(value.observationIds)||!value.observationIds.length||value.observationIds.length>20||value.observationIds.some(v=>typeof v!=='string'||!v))throw Error('objectMap 需要 1–20 个整图 observationIds');
  if(!Array.isArray(value.items)||!value.items.length||value.items.length>128)throw Error('objectMap 需要 1–128 个主要对象');
  const sceneIds=new Set(sceneObjects.map(item=>item.id)),itemIds=new Set(),maskIds=new Set();let totalPoints=0;
  const items=value.items.map((raw,n)=>{
    if(!raw||typeof raw!=='object')throw Error(`objectMap 对象 ${n+1} 格式错误`);
    const itemId=id(raw.id,`objectMap 对象 ${n+1} ID`);if(itemIds.has(itemId))throw Error(`objectMap 对象 ID 重复：${itemId}`);itemIds.add(itemId);
    if(!categories.has(raw.category))throw Error(`${itemId}.category 不受支持`);
    if(raw.sceneObjectId!==undefined&&(!ID.test(raw.sceneObjectId)||!sceneIds.has(raw.sceneObjectId)))throw Error(`${itemId}.sceneObjectId 不存在`);
    if(!Array.isArray(raw.visibleMasks)||!raw.visibleMasks.length||raw.visibleMasks.length>32)throw Error(`${itemId} 需要 1–32 个可见遮罩区域`);
    const visibleMasks=raw.visibleMasks.map((mask,index)=>{if(!mask||typeof mask!=='object')throw Error(`${itemId} 遮罩格式错误`);const maskId=id(mask.id,`${itemId} 遮罩 ID`);if(maskIds.has(maskId))throw Error(`观察遮罩 ID 重复：${maskId}`);maskIds.add(maskId);const ps=polygon(mask.polygon,width,height,`${itemId}.${maskId}`);totalPoints+=ps.length;if(totalPoints>100000)throw Error('objectMap 遮罩点总数超过 100000');return {id:maskId,polygon:ps};});
    if(raw.relatedItemIds!==undefined&&!Array.isArray(raw.relatedItemIds)||raw.landmarks!==undefined&&!Array.isArray(raw.landmarks))throw Error(`${itemId} 的 landmarks / relatedItemIds 格式错误`);
    const relatedItemIds=(raw.relatedItemIds||[]).map(v=>id(v,`${itemId}.relatedItemIds`));if(relatedItemIds.length>128||new Set(relatedItemIds).size!==relatedItemIds.length)throw Error(`${itemId}.relatedItemIds 重复或过多`);
    const landmarks=(raw.landmarks||[]).map((row,index)=>{if(!row||!landmarkRoles.has(row.role))throw Error(`${itemId} 标记点 ${index+1} role 无效`);return {role:row.role,point:point(row.point,width,height,`${itemId} 标记点 ${index+1}`),...(row.relatedItemId?{relatedItemId:id(row.relatedItemId,'relatedItemId')}:{})};});if(landmarks.length>64)throw Error(`${itemId} 标记点超过 64 个`);
    const status=raw.status||'ready';if(!['ready','needs-evidence','corrected'].includes(status))throw Error(`${itemId}.status 无效`);
    return {id:itemId,name:text(raw.name,`${itemId}.name`,100),category:raw.category,...(raw.sceneObjectId?{sceneObjectId:raw.sceneObjectId}:{}),relatedItemIds,form:text(raw.form,`${itemId}.form`),relations:text(raw.relations,`${itemId}.relations`,1500,{required:false}),uncertainty:text(raw.uncertainty,`${itemId}.uncertainty`,1500,{required:false}),visibleMasks,landmarks,status};
  });
  for(const item of items){for(const related of item.relatedItemIds)if(!itemIds.has(related))throw Error(`${item.id} 引用了不存在的相关对象：${related}`);for(const mark of item.landmarks)if(mark.relatedItemId&&!itemIds.has(mark.relatedItemId))throw Error(`${item.id} 标记点引用了不存在的对象：${mark.relatedItemId}`);}
  let anatomyCoverage=[];
  if(value.subjectType!=='non-figure'){
    if(!Array.isArray(value.anatomyCoverage))throw Error('人物 objectMap 需要 anatomyCoverage');const rows=new Map();
    for(const row of value.anatomyCoverage){if(!row||!coverageKinds.includes(row.kind)||rows.has(row.kind)||!coverageStatuses.has(row.status)||row.itemIds!==undefined&&!Array.isArray(row.itemIds))throw Error('anatomyCoverage 格式、类别或状态无效');const ids=(row.itemIds||[]).map(v=>id(v,'anatomyCoverage.itemIds'));if(row.status==='mapped'&&!ids.length)throw Error(`${row.kind} 标为 mapped 时需要 itemIds`);if(ids.some(v=>!itemIds.has(v)))throw Error(`${row.kind} 引用了不存在的 objectMap 对象`);rows.set(row.kind,{kind:row.kind,status:row.status,itemIds:ids,note:text(row.note,`${row.kind}.note`,500,{required:false})});}
    anatomyCoverage=coverageKinds.map(kind=>{const row=rows.get(kind);if(!row)throw Error(`人物 objectMap 缺少固定关注项：${kind}`);return row;});
  }
  const status=value.status||'ready';if(!['ready','stale'].includes(status))throw Error('objectMap.status 无效');
  const history=(value.history||[]).slice(-50).map(row=>({action:['replace','correct'].includes(row?.action)?row.action:'correct',note:text(row?.note,'objectMap.history.note',1000,{required:false}),revision:Number.isInteger(row?.revision)&&row.revision>0?row.revision:1,at:Number.isFinite(row?.at)?row.at:0}));
  return {id:id(value.id||`object-map-${Date.now()}`,'objectMap.id'),referenceKey:value.referenceKey,coordinateSpace:'document',subjectType:value.subjectType,status,observationIds:[...value.observationIds],anatomyCoverage,items,revision:Number.isInteger(value.revision)&&value.revision>0?value.revision:1,history};
}
export function objectMapSummary(map,currentReferenceKey=null){
  if(!map)return {status:'missing',ready:false,itemCount:0,items:[]};const current=!!currentReferenceKey&&map.referenceKey===currentReferenceKey&&map.status==='ready';
  return {id:map.id,status:current?'ready':map.status==='stale'?'stale':'reference-mismatch',ready:current,revision:map.revision,subjectType:map.subjectType,itemCount:map.items.length,anatomyCoverage:structuredClone(map.anatomyCoverage),items:map.items.map(item=>({id:item.id,name:item.name,category:item.category,status:item.status,sceneObjectId:item.sceneObjectId||null,maskRegions:item.visibleMasks.length,bounds:objectMapBounds(item,{width:Infinity,height:Infinity})}))};
}

export function validateObjectMapObservations(observationIds,observations,{referenceKey,revision,width,height}={}){
  if(!Array.isArray(observationIds)||!observationIds.length||observationIds.some(value=>typeof value!=='string'||!value))throw Error('建立或纠正全局物体图需要 observationIds');
  const rows=observationIds.map(observationId=>observations?.get?.(observationId)).filter(row=>row&&row.referenceKey===referenceKey&&row.revision===revision);
  const coversFull=row=>!row.mirror&&row.region[0]<=0&&row.region[1]<=0&&row.region[0]+row.region[2]>=width&&row.region[1]+row.region[3]>=height;
  if(!rows.some(coversFull))throw Error('建立或纠正全局物体图需要当前版本覆盖整幅画布的原参考观察');
  return rows;
}

export function validateMappedObjectCommands(commands,objectMap){
  if(!objectMap?.items?.length)throw Error('1B 及后续落笔前必须先建立全局物体图');
  for(const command of commands){if(!command.mapItemId)throw Error('1B 及后续每条新笔迹都需要 mapItemId');const item=objectMapItem(objectMap,command.mapItemId);if(!item)throw Error(`全局物体对象不存在：${command.mapItemId}`);if(item.status==='needs-evidence')throw Error(`${item.name} 尚缺观察证据，不能据此落笔`);}
  return true;
}
