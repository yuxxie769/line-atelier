import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
import {blankDocument,validateDocument,validateBatch,renderPoints} from '../../app/model.js';
import {strokeRaster} from '../../app/renderer.js';
import {PaintEngine} from '../../app/engine.js';
import {exportDocumentData} from '../../app/document-export.js';
import {compileCompound} from './auto-split.mjs';
import {parts} from './authored-inputs.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),out=path.join(here,process.argv.includes('--revision2')?'results-v2':'results');fs.mkdirSync(out,{recursive:true});
const native=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'))('@napi-rs/canvas');
const {createCanvas,loadImage,Path2D}=native;
globalThis.document={createElement:()=>createCanvas(1,1)};globalThis.Path2D=Path2D;
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
const basePath=path.join(here,'../20260908-white-haired-draft/1F-lineart.line.json');
const baseBytes=fs.readFileSync(basePath),raw=JSON.parse(baseBytes),base=validateDocument({...raw,checkpoints:[]});
const engine=new PaintEngine(createCanvas(base.width,base.height),base);
const state=engine.state();
const ref=await loadImage(path.join(here,'../20260908-white-haired-draft/1F-initial-materials/full.reference.png'));
const clean=base.commands.filter(c=>c.subphase==='clean'&&base.layers.find(l=>l.id===c.layer)?.visible);
const write=(name,data)=>fs.writeFileSync(path.join(out,name),typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data,null,2));
const label=(ctx,text,x,y,size=21,color='#29303a')=>{ctx.fillStyle=color;ctx.font=`${size}px "Microsoft YaHei", sans-serif`;ctx.fillText(text,x,y);};
const palettes=['#267f9f','#b45735','#6956a0','#43835b','#a34774','#6c722e'];

function drawCommands(commands,region,scale=2,{focus=[],topology=false}={}){
  const c=createCanvas(Math.ceil(region[2]*scale),Math.ceil(region[3]*scale)),ctx=c.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
  let n=0;
  for(const command of commands){
    const temp=createCanvas(c.width,c.height),ink=temp.getContext('2d');ink.setTransform(scale,0,0,scale,-region[0]*scale,-region[1]*scale);
    const selected=!focus.length||focus.includes(command.id),color=topology&&selected?palettes[n++%palettes.length]:command.color;
    strokeRaster(ink,{...command,color},renderPoints(command,base,scale));
    ctx.globalAlpha=command.opacity*(selected?1:.2);ctx.drawImage(temp,0,0);ctx.globalAlpha=1;
  }
  return c;
}
function referenceCrop(region,scale=2){const c=createCanvas(Math.ceil(region[2]*scale),Math.ceil(region[3]*scale)),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(ref,region[0]*ref.width/base.width,region[1]*ref.height/base.height,region[2]*ref.width/base.width,region[3]*ref.height/base.height,0,0,c.width,c.height);return c;}
function drawFitted(ctx,img,x,y,w,h){const s=Math.min(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*s)/2,y+(h-img.height*s)/2,img.width*s,img.height*s);}

const manualMap=new Map(),autoMap=new Map(),inputs=[],stats=[];
for(const part of parts){
  const m=[],a=[],joins=[];
  for(const group of part.groups){
    const old=base.commands.find(c=>c.id===group.sourceId);if(!old)throw Error('Missing source: '+group.sourceId);
    const style={type:'stroke',layer:old.layer,stage:old.stage,color:old.color,opacity:1,width:group.width,pressureFloor:0,subphase:'clean',part:old.part};
    const manual=group.manual.map(([path,pressureProfile,strokeRole],i)=>({...style,id:`${old.id}-manual-${i+1}`,path,pressureProfile,compoundId:`${old.id}-compound`,strokeRole,joinStyle:'overlap',endpoints:[i?'joined':old.endpoints[0],i===group.manual.length-1?old.endpoints[1]:'joined'],intent:`方案2：${part.note}`}));
    const autoInput={stroke:{...style,id:old.id,path:old.geometry.path,pressureProfile:group.profile,endpoints:old.endpoints,intent:`方案3：${part.note}`},breaks:group.breaks.map((at,i)=>({at,reason:group.reasons[i]})),overlapPx:group.overlapPx,roles:group.manual.map(x=>x[2])};
    const compiled=compileCompound(autoInput,base),manualCommands=validateBatch(manual,{...base,commands:[]});
    manualMap.set(old.id,manualCommands);autoMap.set(old.id,compiled.commands);m.push(...manualCommands);a.push(...compiled.commands);joins.push(...compiled.joins);
    inputs.push({part:part.id,sourceId:old.id,scheme2:{commands:manual},scheme3:autoInput});
  }
  const selected=part.groups.map(g=>g.sourceId),baseline=clean.filter(c=>selected.includes(c.id));
  const variants=[{key:'original',name:'原画法',commands:clean,focus:selected},
    {key:'scheme2',name:'二号 · 模型逐笔写坐标',commands:clean.flatMap(c=>selected.includes(c.id)?manualMap.get(c.id):[c]),focus:m.map(c=>c.id)},
    {key:'scheme3',name:'三号 · 程序自动分笔搭接',commands:clean.flatMap(c=>selected.includes(c.id)?autoMap.get(c.id):[c]),focus:a.map(c=>c.id)}];
  const sheet=createCanvas(1440,1000),ctx=sheet.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1440,1000);
  label(ctx,part.name+'：三种画法，同一尺度',24,34,26);
  label(ctx,'上排看笔触，中排看接头，下排用颜色区分每一次落笔。其他原线以浅色显示。',24,65,18,'#59636b');
  for(let i=0;i<variants.length;i++){
    const v=variants[i],x=i*480;label(ctx,v.name,x+20,104,21);
    const crop=drawCommands(v.commands,part.region,3,{focus:v.focus});write(part.id+'-'+v.key+'.png',crop.toBuffer('image/png'));
    drawFitted(ctx,crop,x+20,125,440,420);
    const zoom=drawCommands(v.commands,part.zoom,8,{focus:v.focus});drawFitted(ctx,zoom,x+20,582,440,170);
    const topology=drawCommands(v.commands,part.region,2,{focus:v.focus,topology:true});drawFitted(ctx,topology,x+20,795,440,175);
    label(ctx,(i===0?baseline.length:i===1?m.length:a.length)+' 笔',x+20,989,17);
  }
  label(ctx,'接头放大（各列同倍率）',24,572,17,'#59636b');label(ctx,'实际分笔位置（彩色仅用于检查）',24,785,17,'#59636b');
  write(part.id+'-comparison.png',sheet.toBuffer('image/png'));
  // Separate aligned reference strip retains the actual reference pixels for review.
  const comparison=createCanvas(1600,520),cc=comparison.getContext('2d');cc.fillStyle='#fff';cc.fillRect(0,0,1600,520);
  const views=[referenceCrop(part.region,3),...variants.map(v=>drawCommands(v.commands,part.region,3))];
  ['参考原图',...variants.map(v=>v.name)].forEach((s,i)=>label(cc,s,i*400+16,32,20));
  views.forEach((v,i)=>drawFitted(cc,v,i*400+12,50,376,458));write(part.id+'-reference-comparison.png',comparison.toBuffer('image/png'));
  stats.push({part:part.id,name:part.name,region:part.region,originalStrokes:baseline.length,scheme2Strokes:m.length,scheme3Strokes:a.length,automaticJoins:joins});
}

for(const [name,map] of [['scheme2',manualMap],['scheme3',autoMap]]){
  const candidate=validateDocument({...base,title:base.title+' · '+name+' 三部位试画',commands:base.commands.flatMap(c=>map.get(c.id)||[c]),revision:base.revision+1,reviews:[],visualChecks:[],partIssues:[],refinementDiagnoses:[],localChanges:[],events:[],checkpoints:[],workflow:{enabled:true,phase:'clean'}});
  write(name+'.line.json',exportDocumentData(candidate,{compact:true,includeCheckpoints:false}));
  // Actual app engine, separate surfaces and complete replay for the full view.
  const e=new PaintEngine(createCanvas(base.width,base.height),candidate);write(name+'-full.png',e.canvas.toBuffer('image/png'));
}
write('inputs.json',inputs);
write('experiment.json',{createdAt:new Date().toISOString(),source:'studies/20260908-white-haired-draft/1F-lineart.line.json',sourceSha256:crypto.createHash('sha256').update(baseBytes).digest('hex'),sourceState:{width:state.width,height:state.height,revision:state.revision,phase:state.workflow.phase,commands:state.commands},renderer:'app/renderer.js strokeRaster + app/engine.js PaintEngine',scope:'离线清线对照试验；不是网页逐批绘画执行或整图正式验收。方案2手写独立path与压力；方案3通过通用compileCompound生成轨迹。',pressureControl:'两方案每组使用相同的最大线宽、颜色和透明度；方案2逐笔写压力，方案3一条全局压力曲线。未声称局部压力逐点相同。',geometryControl:'方案3保留原始中心线；方案2独立安排接笔坐标，大形沿用原稿但允许接头附近轻微几何差异。',parts:stats});
if(!fs.readFileSync(basePath).equals(baseBytes))throw Error('Source was unexpectedly modified');
console.log(JSON.stringify({output:out,sourceState:{width:state.width,height:state.height,revision:state.revision,commands:state.commands},parts:stats.map(({automaticJoins,...s})=>s)},null,2));
