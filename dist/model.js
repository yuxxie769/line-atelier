// Pure document model. Every visible mark is reconstructible from these records.
export const LIMITS = {commands: 60000, points: 600000, batch: 10000, side: 2048};
const color = /^#[0-9a-f]{6}$/i;
export function number(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw Error(`${label} 必须在 ${min}–${max} 之间`);
  return value;
}
export function blankDocument(width = 800, height = 1000) {
  return {version: 1, title: '未命名习作', width, height, background: '#ffffff', layers: [{id:'paper',name:'绘画层',visible:true,opacity:1,locked:false}], stages:[{id:'sketch',name:'轮廓',description:'确定形状与构图'},{id:'base',name:'底色',description:'铺设主要色彩'},{id:'detail',name:'细节',description:'补充线条与明暗'},{id:'finish',name:'收尾',description:'调整边缘与高光'}],commands:[]};
}
export function curvePoints(control, steps=32) {
  if (!Array.isArray(control) || ![3,4].includes(control.length)) throw Error('control 必须包含 3 个或 4 个控制点');
  control.forEach(p=>{if(!Array.isArray(p)||p.length<2)throw Error('控制点格式错误');p.slice(0,2).forEach(v=>number(v,-8192,8192,'控制点'));});
  number(steps,2,256,'steps');
  const out=[];
  for(let i=0;i<=steps;i++){let row=control.map(p=>p.slice(0,2));const t=i/steps;while(row.length>1)row=row.slice(1).map((p,j)=>[row[j][0]*(1-t)+p[0]*t,row[j][1]*(1-t)+p[1]*t]);out.push(row[0]);}
  return out;
}
export function validateBatch(input, doc, defaults={}) {
  if(!Array.isArray(input)||!input.length||input.length>LIMITS.batch)throw Error(`每批需要 1–${LIMITS.batch} 条指令`);
  if(doc.commands.length+input.length>LIMITS.commands)throw Error('笔迹数量达到上限，请保存后新建画布');
  let total=doc.commands.reduce((n,c)=>n+c.points.length,0);
  const commands=input.map((raw,i)=>{
    if(!raw||typeof raw!=='object')throw Error(`指令 ${i+1} 格式错误`);
    let type=raw.type||'stroke'; if(type==='bezier')type='stroke';
    if(!['stroke','erase','fill'].includes(type))throw Error(`不支持的指令类型：${type}`);
    const layer=raw.layer||defaults.layer||doc.layers[0].id;
    const layerObj=doc.layers.find(l=>l.id===layer);if(!layerObj)throw Error(`图层不存在：${layer}`);
    if(layerObj.locked&&!defaults.importing)throw Error(`图层已锁定：${layerObj.name}`);
    const stage=raw.stage||defaults.stage||doc.stages[0].id;if(!doc.stages.some(s=>s.id===stage))throw Error(`阶段不存在：${stage}`);
    const hex=raw.color||'#142832';if(typeof hex!=='string'||!color.test(hex))throw Error('颜色需要 #RRGGBB 格式');
    let points=raw.control?curvePoints(raw.control,raw.steps||32):raw.points;
    if(!Array.isArray(points)||points.length<(type==='fill'?3:1)||points.length>4096)throw Error('每笔需要 1–4096 个坐标点（填色至少 3 点）');
    points=points.map(p=>{if(!Array.isArray(p)||p.length<2)throw Error('坐标格式为 [x,y] 或 [x,y,pressure]');const a=[number(p[0],-doc.width,doc.width*2,'x'),number(p[1],-doc.height,doc.height*2,'y')];if(p.length>2)a.push(number(p[2],0,1,'pressure'));return a;});
    total+=points.length;if(total>LIMITS.points)throw Error('轨迹点数量超过上限');
    return {id:raw.id||`c-${Date.now()}-${doc.commands.length+i}`,type,layer,stage,color:hex.toLowerCase(),width:number(raw.width??4,.25,180,'width'),opacity:number(raw.opacity??1,0,1,'opacity'),points,closed:!!raw.closed};
  });
  return commands;
}
export function validateDocument(raw) {
  if(!raw||raw.version!==1)throw Error('需要 Line Atelier version 1 工程文件');
  const width=number(raw.width,64,LIMITS.side,'宽度'),height=number(raw.height,64,LIMITS.side,'高度');
  if(!Number.isInteger(width)||!Number.isInteger(height))throw Error('画布尺寸必须是整数');
  if(!color.test(raw.background))throw Error('背景颜色格式错误');
  if(!Array.isArray(raw.layers)||!raw.layers.length||raw.layers.length>12)throw Error('需要 1–12 个图层');
  if(!Array.isArray(raw.stages)||!raw.stages.length||raw.stages.length>24)throw Error('需要 1–24 个绘画阶段');
  const ids=new Set();const safeId=id=>{if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||ids.has(id))throw Error('ID 重复或格式错误');ids.add(id);return id;};
  const layers=raw.layers.map(l=>({id:safeId(l.id),name:String(l.name||'图层').slice(0,60),visible:l.visible!==false,opacity:number(l.opacity??1,0,1,'图层透明度'),locked:!!l.locked}));
  ids.clear();const stages=raw.stages.map(s=>({id:safeId(s.id),name:String(s.name||'阶段').slice(0,60),description:String(s.description||'').slice(0,160)}));
  if(!Array.isArray(raw.commands)||raw.commands.length>LIMITS.commands)throw Error('笔迹列表格式错误或数量过多');
  const doc={version:1,title:String(raw.title||'导入的习作').slice(0,100),width,height,background:raw.background,layers,stages,commands:[]};
  for(let i=0;i<raw.commands.length;i+=LIMITS.batch)doc.commands.push(...validateBatch(raw.commands.slice(i,i+LIMITS.batch),doc,{importing:true}));
  doc.commands.forEach((c,i)=>c.id=`c-${i}`);return doc;
}
export function commandUnits(c){return c.type==='fill'?1:Math.max(1,c.points.length-1)+(c.closed?1:0);}
export function planIndex(commands){const ends=[];let total=0;for(const c of commands){total+=commandUnits(c);ends.push(total);}return {ends,total};}
export function createDemo() {
  const d=blankDocument();d.title='潮汐 · 笔迹练习';d.stages=[{id:'sketch',name:'路径骨架',description:'细线建立流向'},{id:'base',name:'青蓝笔触',description:'沿曲线逐笔铺色'},{id:'detail',name:'暖色交织',description:'穿插有节奏的线条'},{id:'finish',name:'细线收尾',description:'补充明亮的边缘'}];
  const cs=[];
  for(let i=0;i<16;i++)cs.push({stage:'sketch',color:'#b8cdd0',width:1,opacity:.6,control:[[110+i*8,260],[740,140+i*8],[-40,850-i*6],[620+i*6,690]]});
  for(let i=0;i<92;i++)cs.push({stage:'base',color:i%3===0?'#1e5969':i%3===1?'#358d94':'#66b6b6',width:2+(i%4)*.65,opacity:.8,control:[[100+i*4.8,260+i*1.3],[760-i*2,130+i*2.1],[-120+i*4,810+i*.6],[470+i*2.3,775-i*.7]],steps:52});
  for(let i=0;i<32;i++)cs.push({stage:'detail',color:i%3?'#d99573':'#eabc98',width:2,opacity:.9,control:[[590+i*2,280+i*3],[280-i*2,160+i*3],[100+i*3,990-i*3],[670-i*2,700-i*2]],steps:52});
  for(let i=0;i<16;i++)cs.push({stage:'finish',color:'#d1e9e6',width:.8,opacity:.9,control:[[160+i*6,260+i*3],[620,230+i*2],[50+i*4,690],[540+i*6,790-i*2]],steps:48});
  d.commands=validateBatch(cs,d);return d;
}
