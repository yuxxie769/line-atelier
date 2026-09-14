import {smoothStrokePoints} from './smoothing.js';
import {validatePressureProfile,applyPressureProfile,validateWidthEdits,insertWidthKnots} from './pressure.js';
import {LINE_PHASES,normalizeScene,normalizeThrough,throughGeometry,scenePoint} from './geometry.js';
import {normalizeObjectMap,objectMapItem} from './object-map.js';
// Pure document model. Every visible mark is reconstructible from these records.
export const LIMITS = {commands: 60000, points: 600000, batch: 10000, side: 2048, masks:512, maskPoints:300000, layers:64};
export const PAINT_STAGES = [
  ['lineart','完整线稿','结构定位、主要轮廓、内部结构、逐区清线'],
  ['hair','头发大色块','前发与后发分开，沿发束连续铺色'],
  ['skin','皮肤底色','脸、颈、手和腿分别铺色'],
  ['clothes','服装大色块','顺布料体积铺设底色'],
  ['accessories','配饰／鞋履底色','配饰、镜框和鞋履分别处理'],
  ['shadows','覆盖阴影','在各部位底色上方剪贴阴影'],
  ['highlights','高光与整理','按材质补高光，整理边缘与局部压线'],
  ['review','局部复核','放大检查脸、手、遮挡与线条交接']
].map(([id,name,description])=>({id,name,description}));
// Curves express the agent's pen trajectory, never image-derived contours.
// One path is one pen-down gesture. A second M is rejected to prevent hidden lifts.
export function pathPoints(path,quality=1){
  if(typeof path!=='string'||path.length>40000)throw Error('path 格式错误');
  const tokens=path.match(/[MLQCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[];
  if(path.replace(/[MLQCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g,''))throw Error('path 仅支持绝对坐标 M L Q C Z');
  let i=0,p=null,start=null;const out=[];
  const pair=()=>{const a=Number(tokens[i++]),b=Number(tokens[i++]);number(a,-8192,8192,'path x');number(b,-8192,8192,'path y');return [a,b];};
  while(i<tokens.length){const op=tokens[i++];if(op==='M'){if(p)throw Error('每条 path 只允许一次落笔，请分成多条笔迹');p=pair();start=p;out.push(p);}else if(!p)throw Error('path 必须以 M 开始');else if(op==='L'){p=pair();out.push(p);}else if(op==='Q'||op==='C'){const control=[p,pair(),pair()];if(op==='C')control.push(pair());let length=0;for(let j=1;j<control.length;j++)length+=Math.hypot(control[j][0]-control[j-1][0],control[j][1]-control[j-1][1]);out.push(...curvePoints(control,Math.max(4,Math.min(256,Math.ceil(length*quality/1.5)))).slice(1));p=control.at(-1);}else if(op==='Z'){out.push([...start]);p=start;}else throw Error('path 坐标数量错误');if(out.length>4096*quality)throw Error('单笔过长，请在自然断点抬笔');}
  if(!out.length)throw Error('path 不能为空');return out;
}
function pressurePoints(points,taper){
  if(!Array.isArray(taper)||taper.length!==3)throw Error('taper 需要起笔、中段、收笔三个压力值');taper.forEach(v=>number(v,0,1,'taper'));
  const sampled=[points[0]];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3));for(let j=1;j<=n;j++){const t=j/n;sampled.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);if(sampled.length>4096)throw Error('单笔过长，请分段落笔');}}points=sampled;
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));const total=lengths.at(-1)||1;
  return points.map((p,i)=>{const t=lengths[i]/total;const edge=.18;const a=t<edge?t/edge:t>1-edge?(1-t)/edge:1;const s=a*a*(3-2*a);return [p[0],p[1],(t<.5?taper[0]:taper[2])*(1-s)+taper[1]*s];});
}
const color = /^#[0-9a-f]{6}$/i;
export function number(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw Error(`${label} 必须在 ${min}–${max} 之间`);
  return value;
}
export function blankDocument(width = 1200, height = 1600) {
  return {version: 1, title: '未命名习作', width, height, background: '#ffffff', layers: [{id:'paper',name:'绘画层',visible:true,opacity:1,locked:false}], stages:[{id:'sketch',name:'轮廓',description:'确定形状与构图'},{id:'base',name:'底色',description:'铺设主要色彩'},{id:'detail',name:'细节',description:'补充线条与明暗'},{id:'finish',name:'收尾',description:'调整边缘与高光'}],objectMap:null,commands:[]};
}
export function curvePoints(control, steps=32) {
  if (!Array.isArray(control) || ![3,4].includes(control.length)) throw Error('control 必须包含 3 个或 4 个控制点');
  control.forEach(p=>{if(!Array.isArray(p)||p.length<2)throw Error('控制点格式错误');p.slice(0,2).forEach(v=>number(v,-8192,8192,'控制点'));});
  number(steps,2,256,'steps');
  const out=[];
  for(let i=0;i<=steps;i++){let row=control.map(p=>p.slice(0,2));const t=i/steps;while(row.length>1)row=row.slice(1).map((p,j)=>[row[j][0]*(1-t)+p[0]*t,row[j][1]*(1-t)+p[1]*t]);out.push(row[0]);}
  return out;
}
function smoothCommandPoints(ps,g,smoothing,scene,closed=false){
  if(!smoothing)return ps;
  const fixed=g?.kind==='through'?g.through.flatMap((p,i)=>p.anchor||(g.corners||[]).includes(i)?[scenePoint(p,g.space,scene)]:[]):[];
  if(closed&&(ps[0][0]!==ps.at(-1)[0]||ps[0][1]!==ps.at(-1)[1]))ps=[...ps,[...ps[0]]];
  return smoothStrokePoints(ps,smoothing,fixed);
}
export function renderPoints(c,doc,quality=1){
  const g=c.geometry;if(!g)return c.points;
  let ps=g.kind==='through'?throughGeometry(g,doc.scene,quality).points:g.kind==='path'?pathPoints(g.path,quality):g.kind==='polyline'?g.points:curvePoints(g.control,Math.min(256,Math.ceil((g.steps||32)*quality)));
  if(g.taper)ps=pressurePoints(ps,g.taper);if(g.trim)ps=trimPoints(ps,g.trim);ps=smoothCommandPoints(ps,g,c.smoothing,doc.scene,c.closed);return insertWidthKnots(applyPressureProfile(ps,c.pressureProfile),c.widthEdits);
}
export function trimPoints(points,range){
  if(!Array.isArray(range)||range.length!==2||range[0]>=range[1])throw Error('trim 需要有效的 [起点比例,终点比例]');range.forEach(v=>number(v,0,1,'trim'));
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));const total=lengths.at(-1);if(!total)throw Error('零长度笔迹不能裁剪');
  const at=t=>{const d=t*total;let i=1;while(i<lengths.length-1&&lengths[i]<d)i++;const a=points[i-1],b=points[i],v=(d-lengths[i-1])/(lengths[i]-lengths[i-1]||1);return [a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v,(a[2]??1)+((b[2]??1)-(a[2]??1))*v];};
  return [at(range[0]),...points.filter((p,i)=>lengths[i]>range[0]*total&&lengths[i]<range[1]*total),at(range[1])];
}
export function validateBatch(input, doc, defaults={}) {
  if(!Array.isArray(input)||!input.length||input.length>LIMITS.batch)throw Error(`每批需要 1–${LIMITS.batch} 条指令`);
  if(doc.commands.length+input.length>LIMITS.commands)throw Error('笔迹数量达到上限，请保存后新建画布');
  let total=doc.commands.reduce((n,c)=>n+c.points.length,0);const commandIds=new Set(doc.commands.map(c=>c.id));
  const commands=input.map((raw,i)=>{
    if(!raw||typeof raw!=='object')throw Error(`指令 ${i+1} 格式错误`);
    let type=raw.type||'stroke'; if(type==='bezier')type='stroke';
    if(!['stroke','erase','fill'].includes(type))throw Error(`不支持的指令类型：${type}`);
    const layer=raw.layer||defaults.layer||doc.layers[0].id;
    const layerObj=doc.layers.find(l=>l.id===layer);if(!layerObj)throw Error(`图层不存在：${layer}`);
    if(layerObj.locked&&!defaults.importing)throw Error(`图层已锁定：${layerObj.name}`);
    const stage=raw.stage||defaults.stage||doc.stages[0].id;if(!doc.stages.some(s=>s.id===stage))throw Error(`阶段不存在：${stage}`);
    const hex=raw.color||'#142832';if(typeof hex!=='string'||!color.test(hex))throw Error('颜色需要 #RRGGBB 格式');
    let geometry=raw.geometry?structuredClone(raw.geometry):raw.through?{kind:'through',through:normalizeThrough(raw.through),space:raw.space||null,corners:raw.corners||[],tension:raw.tension??.8,closed:!!raw.closed}:raw.path?{kind:'path',path:raw.path}:raw.control?{kind:'control',control:raw.control,steps:raw.steps||32}:null;
    if(geometry&&!['through','path','control','polyline'].includes(geometry.kind))throw Error('未知曲线原件类型');
    let points=geometry?.kind==='through'?throughGeometry(geometry,doc.scene).points:geometry?.kind==='path'?pathPoints(geometry.path):geometry?.kind==='control'?curvePoints(geometry.control,geometry.steps||32):geometry?.kind==='polyline'?geometry.points:raw.points;
    const smoothing=number(raw.smoothing??0,0,1,'smoothing');if(smoothing&&type!=='stroke')throw Error('平滑仅用于画笔笔迹');
    if(raw.smoothing!==undefined&&!geometry)geometry={kind:'polyline',points:structuredClone(points)};
    const taper=raw.taper||geometry?.taper;if(taper){points=pressurePoints(points,taper);if(geometry)geometry.taper=[...taper];}
    if(geometry?.trim)points=trimPoints(points,geometry.trim);
    const pressureProfile=raw.pressureProfile?validatePressureProfile(raw.pressureProfile):null,pressureCurve=raw.pressureCurve?validatePressureProfile(raw.pressureCurve,'压感响应'):null;
    // Retain sampled originals so editing pressure remains non-destructive on legacy strokes.
    const widthEdits=raw.widthEdits?validateWidthEdits(raw.widthEdits,raw.width??4):null;
    if((pressureProfile||widthEdits?.length)&&!geometry)geometry={kind:'polyline',points:structuredClone(points)};
    points=smoothCommandPoints(points,geometry,smoothing,doc.scene,!!raw.closed);
    points=insertWidthKnots(applyPressureProfile(points,pressureProfile),widthEdits);
    if(!Array.isArray(points)||points.length<(type==='fill'?3:1)||points.length>4096)throw Error('每笔需要 1–4096 个坐标点（填色至少 3 点）');
    points=points.map(p=>{if(!Array.isArray(p)||p.length<2)throw Error('坐标格式为 [x,y] 或 [x,y,pressure]');const a=[number(p[0],-doc.width,doc.width*2,'x'),number(p[1],-doc.height,doc.height*2,'y')];if(p.length>2)a.push(number(p[2],0,1,'pressure'));return a;});
    total+=points.length;if(total>LIMITS.points)throw Error('轨迹点数量超过上限');
    if(raw.mask&&!doc.masks?.some(m=>m.id===raw.mask))throw Error(`选区不存在：${raw.mask}`);
    if(raw.objectId&&!doc.scene?.objects.some(o=>o.id===raw.objectId))throw Error('笔迹所属物体不存在');
    if(raw.mapItemId&&!objectMapItem(doc.objectMap,raw.mapItemId))throw Error('笔迹所属全局物体不存在');
    const subphase=raw.subphase||doc.workflow?.phase||'rough';if(!LINE_PHASES.some(p=>p.id===subphase))throw Error('线稿子阶段不存在');
    if(raw.endpoints&&(!Array.isArray(raw.endpoints)||raw.endpoints.length!==2||raw.endpoints.some(e=>!['open','occluded','joined','corner','contact'].includes(e))))throw Error('endpoints 需要两个线端关系');
    const id=raw.id||`c-${Date.now()}-${doc.commands.length+i}`;if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||commandIds.has(id))throw Error('笔迹 ID 重复或格式错误');commandIds.add(id);
    return {id,type,layer,stage,...(raw.smoothing!==undefined?{smoothing}:{}),color:hex.toLowerCase(),width:number(raw.width??4,.25,180,'width'),opacity:number(raw.opacity??1,0,1,'opacity'),points,closed:!!raw.closed,...((geometry||raw.geometry)?{geometry:geometry||raw.geometry}:{}),...(pressureProfile?{pressureProfile}:{}),...(pressureCurve?{pressureCurve}:{}),...(widthEdits?{widthEdits}:{}),subphase,...(raw.objectId?{objectId:raw.objectId}:{}),...(raw.mapItemId?{mapItemId:raw.mapItemId}:{}),...(raw.endpoints?{endpoints:[...raw.endpoints]}:{}),...(raw.mask?{mask:raw.mask}:{}),...(raw.pressureFloor!==undefined?{pressureFloor:number(raw.pressureFloor,0,1,'pressureFloor')}:{}),...(raw.part?{part:String(raw.part).slice(0,80)}:{}),...(raw.intent?{intent:String(raw.intent).slice(0,200)}:{})};
  });
  return commands;
}
export function validateDocument(raw,{includeCheckpoints=true}={}) {
  if(!raw||raw.version!==1)throw Error('需要 Line Atelier version 1 工程文件');
  const width=number(raw.width,64,LIMITS.side,'宽度'),height=number(raw.height,64,LIMITS.side,'高度');
  if(!Number.isInteger(width)||!Number.isInteger(height))throw Error('画布尺寸必须是整数');
  if(!color.test(raw.background))throw Error('背景颜色格式错误');
  if(!Array.isArray(raw.layers)||!raw.layers.length||raw.layers.length>LIMITS.layers)throw Error(`需要 1–${LIMITS.layers} 个图层`);
  if(!Array.isArray(raw.stages)||!raw.stages.length||raw.stages.length>24)throw Error('需要 1–24 个绘画阶段');
  const ids=new Set();const safeId=id=>{if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||ids.has(id))throw Error('ID 重复或格式错误');ids.add(id);return id;};
  const layers=raw.layers.map(l=>{if(l.blend&&!['source-over','multiply','screen'].includes(l.blend))throw Error('不支持的图层混合模式');return {id:safeId(l.id),name:String(l.name||'图层').slice(0,60),visible:l.visible!==false,opacity:number(l.opacity??1,0,1,'图层透明度'),locked:!!l.locked,blend:l.blend||'source-over',...(l.clipTo?{clipTo:String(l.clipTo)}:{}),...(l.hideAtStage?{hideAtStage:String(l.hideAtStage)}:{}),...(l.group?{group:String(l.group).slice(0,80)}:{}),...(l.role?{role:String(l.role).slice(0,40)}:{}),...(l.hideAtCommand?{hideAtCommand:String(l.hideAtCommand).slice(0,100)}:{})};});
  layers.forEach((l,i)=>{if(l.clipTo&&!layers.slice(0,i).some(b=>b.id===l.clipTo))throw Error('裁切图层必须引用下方已有图层');});
  ids.clear();const stages=raw.stages.map(s=>({id:safeId(s.id),name:String(s.name||'阶段').slice(0,60),description:String(s.description||'').slice(0,160)}));
  layers.forEach(l=>{if(l.hideAtStage&&!stages.some(s=>s.id===l.hideAtStage))throw Error('草稿隐藏阶段不存在');});
  ids.clear();let maskPoints=0;if(raw.masks&&(!Array.isArray(raw.masks)||raw.masks.length>LIMITS.masks))throw Error('选区数量超过上限');
  const masks=(raw.masks||[]).map(m=>{if(!Array.isArray(m.polygons)||!m.polygons.length)throw Error('选区需要多边形边界');return {id:safeId(m.id),name:String(m.name||'色块选区').slice(0,80),polygons:m.polygons.map(poly=>{if(!Array.isArray(poly)||poly.length<3)throw Error('选区轮廓至少三个点');maskPoints+=poly.length;if(maskPoints>LIMITS.maskPoints)throw Error('选区边界点超过上限');return poly.map(p=>{if(!Array.isArray(p)||p.length!==2)throw Error('选区点需要 [x,y]');return [number(p[0],-width,width*2,'选区 x'),number(p[1],-height,height*2,'选区 y')];});})};});
  if(!Array.isArray(raw.commands)||raw.commands.length>LIMITS.commands)throw Error('笔迹列表格式错误或数量过多');
  const phase=raw.workflow?.phase||'rough';if(!LINE_PHASES.some(p=>p.id===phase))throw Error('工作流子阶段不存在');
  const scene=normalizeScene(raw.scene),objectMap=normalizeObjectMap(raw.objectMap,{width,height,sceneObjects:scene.objects});
  const doc={version:1,title:String(raw.title||'导入的习作').slice(0,100),width,height,background:raw.background,layers,stages,masks,objectMap,commands:[],scene,revision:Number.isInteger(raw.revision)?Math.max(0,raw.revision):0,workflow:{enabled:!!raw.workflow?.enabled,phase},events:(raw.events||[]).slice(-300).map(e=>({revision:Number(e.revision)||0,kind:String(e.kind||'edit').slice(0,40),note:String(e.note||'').slice(0,1000),ids:(e.ids||[]).slice(0,1000).map(String)}))};
  for(let i=0;i<raw.commands.length;i+=LIMITS.batch)doc.commands.push(...validateBatch(raw.commands.slice(i,i+LIMITS.batch),doc,{importing:true}));
  doc.reviews=Array.isArray(raw.reviews)?raw.reviews.slice(-100).map(r=>({at:Number(r.at)||0,region:Array.isArray(r.region)?r.region.slice(0,4).map(Number):[],note:String(r.note||'').slice(0,1500),kind:String(r.kind||'observation').slice(0,40),reviewPhase:LINE_PHASES.some(p=>p.id===r.reviewPhase)?r.reviewPhase:null,ids:Array.isArray(r.ids)?r.ids.slice(0,200).map(String):[],scope:r.scope==='global'?'global':'local',objectIds:(r.objectIds||[]).slice(0,128).map(String),status:['pass','needs-work'].includes(r.status)?r.status:'needs-work',stale:!!r.stale,revision:Number(r.revision)||0,evidence:(r.evidence||[]).slice(0,5).map(String),issues:(r.issues||[]).slice(0,20).map(s=>String(s).slice(0,500))})):[];
  doc.checkpoints=includeCheckpoints?(raw.checkpoints||[]).slice(-8).map(c=>({id:String(c.id).slice(0,100),name:String(c.name).slice(0,100),revision:Number(c.revision)||0,doc:validateDocument({...c.doc,checkpoints:[]},{includeCheckpoints:false})})):[];return doc;
}
// Replay uses physical arc length, independent of how many points the sender sampled.
// Each unit moves the brush by 2 document pixels; 18 quiet units lift the pen.
export const PIXELS_PER_UNIT=2, PEN_LIFT_UNITS=18;
export function strokeGeometry(c){
  const lengths=[0];let length=0;
  const points=c.closed&&c.points.length>1?[...c.points,c.points[0]]:c.points;
  for(let i=1;i<points.length;i++){length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);lengths.push(length);}
  const drawingUnits=c.type==='fill'?1:Math.max(1,Math.ceil(length/PIXELS_PER_UNIT));
  return {points:points.map((p,i)=>[p[0],p[1],p[2]??1,lengths[i]/(length||1)]),lengths,length,drawingUnits,units:drawingUnits+PEN_LIFT_UNITS};
}
export function commandUnits(c){return strokeGeometry(c).units;}
export function planIndex(commands){const ends=[];let total=0;for(const c of commands){total+=commandUnits(c);ends.push(total);}return {ends,total};}
export function createDemo() {
  const d=blankDocument(800,1000);d.title='潮汐 · 笔迹练习';d.stages=[{id:'sketch',name:'路径骨架',description:'细线建立流向'},{id:'base',name:'青蓝笔触',description:'沿曲线逐笔铺色'},{id:'detail',name:'暖色交织',description:'穿插有节奏的线条'},{id:'finish',name:'细线收尾',description:'补充明亮的边缘'}];
  const cs=[];
  for(let i=0;i<16;i++)cs.push({stage:'sketch',color:'#b8cdd0',width:1,opacity:.6,control:[[110+i*8,260],[740,140+i*8],[-40,850-i*6],[620+i*6,690]]});
  for(let i=0;i<92;i++)cs.push({stage:'base',color:i%3===0?'#1e5969':i%3===1?'#358d94':'#66b6b6',width:2+(i%4)*.65,opacity:.8,control:[[100+i*4.8,260+i*1.3],[760-i*2,130+i*2.1],[-120+i*4,810+i*.6],[470+i*2.3,775-i*.7]],steps:52});
  for(let i=0;i<32;i++)cs.push({stage:'detail',color:i%3?'#d99573':'#eabc98',width:2,opacity:.9,control:[[590+i*2,280+i*3],[280-i*2,160+i*3],[100+i*3,990-i*3],[670-i*2,700-i*2]],steps:52});
  for(let i=0;i<16;i++)cs.push({stage:'finish',color:'#d1e9e6',width:.8,opacity:.9,control:[[160+i*6,260+i*3],[620,230+i*2],[50+i*4,690],[540+i*6,790-i*2]],steps:48});
  d.commands=validateBatch(cs,d);return d;
}
