import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {validateDocument,validateBatch,renderPoints,pathPoints} from '../../app/model.js';
import {strokeRaster} from '../../app/renderer.js';
import {PaintEngine} from '../../app/engine.js';
import {exportDocumentData} from '../../app/document-export.js';
import {compileCompound} from '../20260909-compound-trial/auto-split.mjs';
import {contour,liftLocations,makeSpec} from './scheme3-input.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),out=path.join(here,'results-scheme3');fs.mkdirSync(out,{recursive:true});
const {createCanvas,loadImage,Path2D}=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'))('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};globalThis.Path2D=Path2D;
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
const basePath=path.join(here,'results/candidate.line.json'),baseBytes=fs.readFileSync(basePath);
const originalPath=path.join(here,'../20260908-white-haired-draft/1F-lineart.line.json'),originalBytes=fs.readFileSync(originalPath);
const base=validateDocument({...JSON.parse(baseBytes),checkpoints:[]});
const state=new PaintEngine(createCanvas(base.width,base.height),base).state();
const ids=['local-turn-approach','local-turn-knee','local-turn-calf'];
const source=base.commands.filter(c=>ids.includes(c.id));assert.equal(source.length,3);
const marker='L 354 684',oldTail=source[2].geometry.path.slice(source[2].geometry.path.indexOf(marker));
const priorLocal=source.map(c=>c.geometry.path).join(' ').replace('M 163 527 ','').replace('M 171 566 ','').split(marker)[0].trim();
assert.equal(priorLocal,contour);
const tail=validateBatch([{type:'stroke',id:'knee-unchanged-continuation',layer:'ink',stage:'lineart',subphase:'clean',part:'body',color:'#37323f',width:1.5,opacity:1,pressureFloor:0,smoothing:0,path:'M 290 644 '+oldTail,endpoints:['joined','occluded'],intent:'只将上轮尾段独立存放，几何和等宽保持不变'}],{...base,commands:[]})[0];
const specs=[makeSpec(base,{weighted:false}),makeSpec(base)];
const compiled=specs.map(spec=>compileCompound(spec,base));
const clean=base.commands.filter(c=>c.subphase==='clean'&&base.layers.find(l=>l.id===c.layer)?.visible);
function replace(commands,newCommands){return commands.flatMap(c=>c.id===ids[0]?[...newCommands,tail]:ids.includes(c.id)?[]:[c]);}
const variants=[{name:'上轮 · 手写接续 / 等宽',key:'previous',commands:clean,focus:ids},
  ...compiled.map((r,i)=>({name:i?'这轮 · 三号搭接 + 轻重':'三号 · 自动搭接 / 等宽',key:i?'weighted':'uniform',commands:replace(clean,r.commands),focus:[...r.commands.map(c=>c.id),tail.id]}))];
const write=(name,data)=>fs.writeFileSync(path.join(out,name),Buffer.isBuffer(data)?data:JSON.stringify(data,null,2));
const ref=await loadImage(path.join(here,'../white-hair-seated-2026-09-07/reference.jpg'));
const box=[145,487,180,172],zoom=[151,519,45,62];
function draw(commands,region,scale,focus=[],colored=false){
  const c=createCanvas(Math.ceil(region[2]*scale),Math.ceil(region[3]*scale)),ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
  let index=0;const colors=['#287a91','#b16140','#7560a4'];
  for(const command of commands){const selected=!focus.length||focus.includes(command.id),t=createCanvas(c.width,c.height),ink=t.getContext('2d');ink.setTransform(scale,0,0,scale,-region[0]*scale,-region[1]*scale);
    strokeRaster(ink,{...command,color:colored&&selected?colors[index++%3]:command.color},renderPoints(command,base,scale));
    ctx.globalAlpha=command.opacity*(selected?1:.18);ctx.drawImage(t,0,0);ctx.globalAlpha=1;
  }return c;
}
function reference(region,scale){const c=createCanvas(region[2]*scale,region[3]*scale);c.getContext('2d').drawImage(ref,...region,0,0,c.width,c.height);return c;}
function label(ctx,s,x,y,size=20){ctx.fillStyle='#35404b';ctx.font=`${size}px "Microsoft YaHei",sans-serif`;ctx.fillText(s,x,y);}
function fit(ctx,img,x,y,w,h){const s=Math.min(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*s)/2,y+(h-img.height*s)/2,img.width*s,img.height*s);}
const sheet=createCanvas(1260,980),ctx=sheet.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1260,980);
label(ctx,'保留小转折，再用三号方案自动分笔、搭接、控制轻重',20,34,25);
label(ctx,'三列轮廓形状相同；中列检查接笔，右列再加入轻重。其他笔迹统一淡显。',20,67,18);
for(const [i,v] of variants.entries()){
  label(ctx,v.name,i*420+16,110,20);const img=draw(v.commands,box,4,v.focus);fit(ctx,img,i*420+16,130,388,370);write(v.key+'.png',draw(v.commands,box,4).toBuffer('image/png'));
  const detail=draw(v.commands,zoom,10,v.focus);fit(ctx,detail,i*420+16,575,388,350);write(v.key+'-zoom.png',detail.toBuffer('image/png'));
}
label(ctx,'接头同倍率放大：小折向没有被自动磨圆',20,543,21);
label(ctx,'左 → 中：只换分笔方式。中 → 右：只改变压力计划；不靠移动轮廓制造效果。',20,960,18);
write('comparison.png',sheet.toBuffer('image/png'));
const referenceSheet=createCanvas(1200,490),rc=referenceSheet.getContext('2d');rc.fillStyle='#fff';rc.fillRect(0,0,1200,490);
[reference(box,4),draw(variants[0].commands,box,4),draw(variants[2].commands,box,4)].forEach((img,i)=>{label(rc,['参考原图','上轮','这轮三号方案'][i],i*400+16,31);fit(rc,img,i*400+12,50,376,420);});
write('reference-comparison.png',referenceSheet.toBuffer('image/png'));
write('join-colors.png',draw(variants[2].commands,zoom,10,variants[2].focus,true).toBuffer('image/png'));
const candidate=validateDocument({...base,title:base.title+' · 三号自动搭接',commands:replace(base.commands,compiled[1].commands),revision:base.revision+1,reviews:[],visualChecks:[],partIssues:[],refinementDiagnoses:[],localChanges:[],events:[],checkpoints:[],workflow:{enabled:true,phase:'clean'}});
write('candidate.line.json',exportDocumentData(candidate,{compact:true,includeCheckpoints:false}));
write('full.png',new PaintEngine(createCanvas(base.width,base.height),candidate).canvas.toBuffer('image/png'));
write('model-input.json',{liftLocations,spec:specs[1]});write('compiled-strokes.json',compiled[1]);
// Check geometry at every compiler source vertex, both sides of every join,
// and positive overlap. The compiler must never refit or smooth the turn.
const jointChecks=[];
for(const [variant,r] of compiled.entries()){
  const center=pathPoints(contour,2);
  for(const p of center)assert(r.commands.some(c=>c.points.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<1e-8)));
  for(let i=0;i<liftLocations.length;i++){
    const p=liftLocations[i].point;assert(Math.hypot(...r.joins[i].point.map((v,k)=>v-p[k]))<1e-8);assert.equal(r.joins[i].overlapPx,5);
    const turns=[];for(const c of [r.commands[i],r.commands[i+1]]){
      const ps=renderPoints(c,base,2),n=ps.findIndex(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<1e-8);assert(n>0&&n<ps.length-1);
      // Arc-length cut/profile knots can differ by machine epsilon. Ignore
      // those coincident samples when measuring a geometrical direction.
      const b=ps[n];let left=n-1,right=n+1;
      while(left>=0&&Math.hypot(ps[left][0]-b[0],ps[left][1]-b[1])<1e-5)left--;
      while(right<ps.length&&Math.hypot(ps[right][0]-b[0],ps[right][1]-b[1])<1e-5)right++;
      assert(left>=0&&right<ps.length);
      const a=ps[left],d=ps[right],u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-b[0],d[1]-b[1]];
      const angle=Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)))))*180/Math.PI;assert(angle>3&&angle<16,JSON.stringify({variant,i,angle}));turns.push(angle);
    }jointChecks.push({variant,point:p,overlapPx:5,angles:turns});
  }
}
const finalPoints=renderPoints(compiled[1].commands.at(-1),base,2);assert(Math.abs(finalPoints.at(-1)[2]*1.8-tail.width)<1e-9);
const unchanged=base.commands.filter(c=>!ids.includes(c.id));assert.deepEqual(candidate.commands.filter(c=>!c.id.startsWith('knee-')),unchanged);
assert.deepEqual(validateDocument(JSON.parse(fs.readFileSync(path.join(out,'candidate.line.json')))).commands,candidate.commands);
assert(fs.readFileSync(basePath).equals(baseBytes));assert(fs.readFileSync(originalPath).equals(originalBytes));
write('checks.json',{passed:true,source:{path:basePath,sha256:crypto.createHash('sha256').update(baseBytes).digest('hex'),state:{width:state.width,height:state.height,phase:state.workflow.phase,revision:state.revision}},unchangedCommands:unchanged.length,jointChecks,outputStrokes:compiled[1].commands.length,continuationStrokes:1,scope:'离线局部试画；不是网页正式绘画验收。沿用已重画轮廓，未修改几何；自动分笔搭接并增加局部压力。'});
console.log(JSON.stringify({output:out,checks:'passed',jointChecks},null,2));
