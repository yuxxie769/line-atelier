import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {validateDocument,renderPoints} from '../../app/model.js';
import {strokeRaster} from '../../app/renderer.js';
import {PaintEngine} from '../../app/engine.js';
export const here=path.dirname(fileURLToPath(import.meta.url)),out=path.join(here,'results');fs.mkdirSync(out,{recursive:true});
export const {createCanvas,loadImage,Path2D}=createRequire(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'))('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};globalThis.Path2D=Path2D;globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
export const sourcePath=path.join(here,'../20260909-local-turn-trial/results-scheme3/candidate.line.json'),sourceBytes=fs.readFileSync(sourcePath);
export const base=validateDocument({...JSON.parse(sourceBytes),checkpoints:[]});
export const clean=base.commands.filter(c=>c.subphase==='clean'&&base.layers.find(l=>l.id===c.layer)?.visible);
const guide=validateDocument({...JSON.parse(fs.readFileSync(path.join(here,'../20260908-white-haired-draft/1D-refined-draft.line.json'))),checkpoints:[]});
const ref=await loadImage(path.join(here,'../white-hair-seated-2026-09-07/reference.jpg'));
export const regions=[{id:'jaw',name:'脸颊到下巴',sourceId:'ink-jaw',box:[284,198,98,65],zoom:[316,232,37,23]},
{id:'sleeve',name:'抬臂袖肘',sourceId:'ink-raised-sleeve',box:[229,276,82,145],zoom:[245,369,48,48]},
{id:'shoe',name:'鞋头',sourceId:'ink-shoe-vamp',box:[132,768,62,59],zoom:[140,790,40,25]}];
export const write=(name,data)=>fs.writeFileSync(path.join(out,name),Buffer.isBuffer(data)?data:JSON.stringify(data,null,2));
export function draw(commands,box,scale=4,focus=[],colored=false){
const c=createCanvas(Math.ceil(box[2]*scale),Math.ceil(box[3]*scale)),ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);let n=0;
for(const command of commands){const selected=!focus.length||focus.includes(command.id),tmp=createCanvas(c.width,c.height),ink=tmp.getContext('2d');ink.setTransform(scale,0,0,scale,-box[0]*scale,-box[1]*scale);strokeRaster(ink,{...command,color:colored&&selected?['#287a91','#b16140','#7560a4'][n++%3]:command.color},renderPoints(command,base,scale));ctx.globalAlpha=command.opacity*(selected?1:.18);ctx.drawImage(tmp,0,0);ctx.globalAlpha=1;}return c;
}
export function reference(box,scale=4){const c=createCanvas(box[2]*scale,box[3]*scale);c.getContext('2d').drawImage(ref,...box,0,0,c.width,c.height);return c;}
export function label(ctx,s,x,y,size=20){ctx.fillStyle='#35404b';ctx.font=`${size}px "Microsoft YaHei",sans-serif`;ctx.fillText(s,x,y);}
export function fit(ctx,img,x,y,w,h){const s=Math.min(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*s)/2,y+(h-img.height*s)/2,img.width*s,img.height*s);}
if(process.argv.includes('--inspect')){
 const state=new PaintEngine(createCanvas(base.width,base.height),base).state();write('source-state.json',{width:state.width,height:state.height,revision:state.revision,phase:state.workflow.phase,commands:state.commands});
 for(const r of regions){const canvas=createCanvas(1200,670),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1200,670);const guideCommands=guide.commands.filter(c=>guide.layers.find(l=>l.id===c.layer)?.visible).map(c=>({...c,opacity:c.opacity*guide.layers.find(l=>l.id===c.layer).opacity}));
 const images=[reference(r.box),draw(guideCommands,r.box),draw(clean,r.box)];images.forEach((im,i)=>{label(ctx,[r.name+' · 参考','旧细化稿','当前清稿'][i],i*400+15,32);fit(ctx,im,i*400+12,55,376,590);});write(r.id+'-before-context.png',canvas.toBuffer('image/png'));
 }console.log(out);
}
