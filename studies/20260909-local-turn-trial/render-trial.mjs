import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {validateDocument,validateBatch,renderPoints} from '../../app/model.js';
import {strokeRaster} from '../../app/renderer.js';
import {exportDocumentData} from '../../app/document-export.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(here,'results');fs.mkdirSync(out,{recursive:true});
const {createCanvas,loadImage,Path2D}=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'))('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};globalThis.Path2D=Path2D;
const basePath=path.join(here,'../20260908-white-haired-draft/1F-lineart.line.json');
const sourceBytes=fs.readFileSync(basePath),raw=JSON.parse(sourceBytes),base=validateDocument({...raw,checkpoints:[]});
const old=base.commands.find(c=>c.id==='ink-near-leg');
const clean=base.commands.filter(c=>c.subphase==='clean'&&base.layers.find(l=>l.id===c.layer)?.visible);
const reference=await loadImage(path.join(here,'../white-hair-seated-2026-09-07/reference.jpg'));
const region=[145,487,180,172],zoom=[151,519,45,62];
const write=(name,data)=>fs.writeFileSync(path.join(out,name),Buffer.isBuffer(data)?data:JSON.stringify(data,null,2));
function draw(commands,box,scale,{focus=[],colors=false}={}){
  const c=createCanvas(Math.ceil(box[2]*scale),Math.ceil(box[3]*scale)),ctx=c.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
  let i=0;const palette=['#287a91','#b16140','#7560a4','#538255'];
  for(const command of commands){
    const selected=!focus.length||focus.includes(command.id),temp=createCanvas(c.width,c.height),ink=temp.getContext('2d');
    ink.setTransform(scale,0,0,scale,-box[0]*scale,-box[1]*scale);
    strokeRaster(ink,{...command,color:colors&&selected?palette[i++%palette.length]:command.color},renderPoints(command,base,scale));
    ctx.globalAlpha=command.opacity*(selected?1:.18);ctx.drawImage(temp,0,0);ctx.globalAlpha=1;
  }
  return c;
}
function refCrop(box,scale){const c=createCanvas(box[2]*scale,box[3]*scale);c.getContext('2d').drawImage(reference,box[0],box[1],box[2],box[3],0,0,c.width,c.height);return c;}
function label(ctx,s,x,y,size=20){ctx.fillStyle='#35404b';ctx.font=`${size}px "Microsoft YaHei", sans-serif`;ctx.fillText(s,x,y);}
function fit(ctx,img,x,y,w,h){const s=Math.min(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*s)/2,y+(h-img.height*s)/2,img.width*s,img.height*s);}
write('reference.png',refCrop(region,4).toBuffer('image/png'));
write('before.png',draw(clean,region,4).toBuffer('image/png'));
const refinedRaw=JSON.parse(fs.readFileSync(path.join(here,'../20260908-white-haired-draft/1D-refined-draft.line.json')));
const refined=validateDocument({...refinedRaw,checkpoints:[]});
write('refined-guide.png',draw(refined.commands.filter(c=>refined.layers.find(l=>l.id===c.layer)?.visible).map(c=>({...c,opacity:c.opacity*refined.layers.find(l=>l.id===c.layer).opacity})),region,4).toBuffer('image/png'));
console.log(JSON.stringify({output:out,source:{width:base.width,height:base.height,revision:base.revision,phase:base.workflow.phase},oldPath:old.geometry.path,referenceSize:[reference.width,reference.height]},null,2));
if(process.argv.includes('--inspect'))process.exit(0);

// Three strokes, with deliberately different tangent directions at shared endpoints.
// No random offsets, sampled-pixel tracing, pressure modulation or post-smoothing.
const style={type:'stroke',layer:old.layer,stage:old.stage,subphase:'clean',part:old.part,color:old.color,width:1.5,opacity:1,pressureFloor:0,smoothing:0};
const tail=old.geometry.path.slice(old.geometry.path.indexOf('L 354 684'));
const inputs=[
  {...style,id:'local-turn-approach',path:'M 246 474 C 207 487 175 507 163 527',compoundId:'near-knee-local-turn',strokeRole:'silhouette',joinStyle:'shared',endpoints:['occluded','joined'],intent:'承接大腿到膝前的长扫线，末端偏向左下；不均匀切碎。'},
  {...style,id:'local-turn-knee',path:'M 163 527 C 160.5 534 158.5 541 159.5 547 C 160.5 554 165 561 171 566',compoundId:'near-knee-local-turn',strokeRole:'turn',joinStyle:'shared',endpoints:['joined','joined'],intent:'较直的膝前短面接下方鼓起；入口保留约 11 度折向。'},
  {...style,id:'local-turn-calf',path:'M 171 566 C 176.6 569.7 181.2 573.6 187.2 577.8 C 213 594.4 241 616 266 630 C 275 635.1 283 639.8 290 644 '+tail,compoundId:'near-knee-local-turn',strokeRole:'silhouette',joinStyle:'shared',endpoints:['joined','occluded'],intent:'膝下以约 6 度折向接出；小腿段略有起伏，290,644 之后沿用原画。'}
];
const authored=validateBatch(inputs,{...base,commands:[]});
const uniformOld=validateBatch([{...style,id:old.id,path:old.geometry.path}],{...base,commands:[]})[0];
const beforeCommands=clean.map(c=>c.id===old.id?uniformOld:c);
const afterCommands=clean.flatMap(c=>c.id===old.id?authored:[c]);
const focus=authored.map(c=>c.id);
const sheet=createCanvas(1260,960),ctx=sheet.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,sheet.width,sheet.height);
label(ctx,'膝盖局部：不是把旧弧线切开，而是重新画每一段的方向',22,34,24);
label(ctx,'左右画稿均为 1.5 px 等宽线、无平滑；其他线淡显。原图只作形体参照。',22,65,18);
const top=[refCrop(region,4),draw(beforeCommands,region,4,{focus:[old.id]}),draw(afterCommands,region,4,{focus})];
['参考原图','原轮廓 · 等宽对照','新轮廓 · 三笔接续'].forEach((s,i)=>label(ctx,s,420*i+18,106,21));
top.forEach((img,i)=>fit(ctx,img,420*i+16,125,388,370));
label(ctx,'同倍率放大：看膝前与膝下的轻微折向（不是随机抖动）',22,534,21);
const bottom=[draw(beforeCommands,zoom,8,{focus:[old.id]}),draw(afterCommands,zoom,8,{focus}),draw(afterCommands,zoom,8,{focus,colors:true})];
['原轮廓','新轮廓','三笔着色 · 仅解释接点'].forEach((s,i)=>label(ctx,s,420*i+18,572,20));
bottom.forEach((img,i)=>fit(ctx,img,420*i+16,590,388,340));
write('comparison.png',sheet.toBuffer('image/png'));
write('after.png',draw(afterCommands,region,4).toBuffer('image/png'));
write('after-full.png',draw(afterCommands,[0,0,base.width,base.height],2).toBuffer('image/png'));
write('inputs.json',inputs);
const candidate=validateDocument({...base,title:base.title+' · 膝盖局部折向试验',commands:base.commands.flatMap(c=>c.id===old.id?authored:[c]),revision:base.revision+1,reviews:[],visualChecks:[],partIssues:[],refinementDiagnoses:[],localChanges:[],events:[],checkpoints:[],workflow:{enabled:true,phase:'clean'}});
write('candidate.line.json',exportDocumentData(candidate,{compact:true,includeCheckpoints:false}));
const joints=authored.slice(0,2).map((c,i)=>{
  const left=renderPoints(c,base,8),right=renderPoints(authored[i+1],base,8);
  assert.deepEqual(left.at(-1).slice(0,2),right[0].slice(0,2));
  const u=[left.at(-1)[0]-left.at(-2)[0],left.at(-1)[1]-left.at(-2)[1]],v=[right[1][0]-right[0][0],right[1][1]-right[0][1]];
  const angle=Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)))))*180/Math.PI;
  assert(angle>3&&angle<16);
  return {point:left.at(-1).slice(0,2),sampledAngleDegrees:angle};
});
for(const c of [uniformOld,...authored])assert(renderPoints(c,base,4).every(p=>(p[2]??1)===1));
const unchanged=base.commands.filter(c=>c.id!==old.id);
assert.deepEqual(candidate.commands.filter(c=>!focus.includes(c.id)),unchanged);
assert.equal(candidate.commands.length,base.commands.length+2);
assert.deepEqual(validateDocument(JSON.parse(fs.readFileSync(path.join(out,'candidate.line.json')))).commands,candidate.commands);
write('checks.json',{sourceUnchanged:true,otherCommandsUnchanged:unchanged.length,oldStrokeCount:1,newStrokeCount:3,uniformWidth:1.5,smoothing:0,joints,scope:'离线局部表现试验，沿用上轮实际 renderer；没有网页逐批验收记录，不是整图清线通过。',interpretation:'小折向为用户要求的风格试验；参考分辨率不足以逐个证实这些微小折角。原稿内侧膝弯硬折等未改。'});
assert(fs.readFileSync(basePath).equals(sourceBytes));
console.log(JSON.stringify({checks:'passed',joints}));
