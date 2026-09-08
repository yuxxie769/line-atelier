import fs from 'node:fs';
import assert from 'node:assert/strict';
import {base,box,out,visible} from './inspect.mjs';
import {createCanvas,reference,draw,label,fit} from '../20260909-compound-v1-three/inspect-render.mjs';
import {compileContourV1} from '../../app/compound-v1.js';
import {validateDocument,validateBatch} from '../../app/model.js';
import {exportDocumentData} from '../../app/document-export.js';

const before=base,old=before.commands.find(c=>c.id==='ink-raised-sleeve');
const plans=[{
 id:'sleeve-shape-outline',width:1.35,
 path:'M 273 264 Q 265 267 261 280 L 241 291 Q 244 301 248 314 Q 251 325 251 334 L 250 345 Q 250 358 257 372 L 264 382 Q 271 387 280 390 Q 282 378 285 369 L 295 355 Q 303 347 311 337',
 lifts:[{point:[250,345],reason:'外袖侧中段收束后转入肘部受压边'},{point:[280,390],reason:'肘底折角转入被领带遮住的内侧边'}],
 pressureProfile:[[0,.55],[.12,.82],[.3,.62],[.48,.85],[.65,1],[.8,.68],[1,.2]],roles:['silhouette','turn','silhouette']
},{
 id:'sleeve-shape-inner',width:1.05,
 path:'M 292 284 Q 293 296 298 307 Q 305 320 304 331 Q 304 339 295 342 Q 285 345 279 338',
 lifts:[{point:[304,331],reason:'内袖弯曲接入肘窝压褶的回折'}],
 pressureProfile:[[0,.55],[.3,.65],[.52,.8],[.72,.95],[1,.08]],roles:['turn','crease']
},{
 id:'sleeve-shape-seam',width:.8,
 path:'M 260 287 Q 258 311 260 333 Q 261 346 265 352 L 274 366',
 lifts:[{point:[260,333],reason:'纵向布面到肘弯受压处换向'}],
 pressureProfile:[[0,.2],[.35,.5],[.67,.68],[1,.02]],roles:['crease','crease']
}];
const removeIds=new Set(before.commands.filter(c=>c.compoundId===old.compoundId||c.id==='ink-raised-fold').map(c=>c.id));
const compiled=plans.map(p=>compileContourV1({stroke:{id:p.id,type:'stroke',layer:old.layer,stage:old.stage,part:old.part,subphase:'clean',color:old.color,width:p.width,opacity:1,smoothing:0,pressureFloor:0,path:p.path,pressureProfile:p.pressureProfile},lifts:p.lifts,roles:p.roles,overlapPx:2},before));
const details=validateBatch([
 {id:'sleeve-shape-compression',path:'M 301 344 Q 287 351 280 366',width:.8,pressureProfile:[[0,.15],[.38,.7],[1,.04]]},
 {id:'sleeve-shape-elbow-fold',path:'M 254 351 Q 259 369 271 380',width:.75,pressureProfile:[[0,.05],[.45,.5],[1,.02]]},
 {id:'sleeve-shape-lower-fold',path:'M 269 360 Q 272 374 279 385',width:.7,pressureProfile:[[0,.03],[.6,.55],[1,.04]]}
].map(c=>({...c,type:'stroke',layer:old.layer,stage:old.stage,part:old.part,subphase:'clean',color:old.color,pressureFloor:0})),{...before,commands:[]});
const newCommands=[...compiled.flatMap(c=>c.commands),...details];
const adjoiningPaths={
 'ink-left-curl':['Q 232 310 249 295','Q 232 310 244 301'],
 'ink-left-ribbon':['L 245 342','L 250 338'],
 'ink-left-low':['244 360','253 359']
};
const neighbors=new Map(before.commands.filter(c=>adjoiningPaths[c.id]).map(c=>{const {geometry,points,...style}=c;const [from,to]=adjoiningPaths[c.id];return [c.id,validateBatch([{...style,path:geometry.path.replace(from,to),...(geometry.taper?{taper:geometry.taper}:{})}],{...before,commands:[]})[0]];}));
const commands=before.commands.flatMap(c=>c.id==='ink-raised-sleeve'?newCommands:removeIds.has(c.id)?[]:[neighbors.get(c.id)||c]);
const candidate=validateDocument({...before,commands,revision:before.revision+1,title:before.title+' · 袖子按参考修形',reviews:before.reviews.map(r=>({...r,stale:true})),visualChecks:[],checkpoints:[],events:[...before.events,{revision:before.revision+1,kind:'revision',note:'依据实际参考重新修正抬臂袖轮廓与压褶；本地修形候选',ids:[...removeIds,...newCommands.map(c=>c.id)]}]});
assert.deepEqual(candidate.commands.filter(c=>!newCommands.some(n=>n.id===c.id)&&!neighbors.has(c.id)),before.commands.filter(c=>!removeIds.has(c.id)&&!neighbors.has(c.id)));
fs.writeFileSync(new URL('candidate.line.json',out),JSON.stringify(exportDocumentData(candidate,{compact:true,includeCheckpoints:false}),null,2));
fs.writeFileSync(new URL('plans.json',out),JSON.stringify(plans,null,2));
const sheet=createCanvas(1260,890),ctx=sheet.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,sheet.width,sheet.height);
label(ctx,'抬臂袖子 · 按参考重修形状',18,36,26);
[reference(box,6),draw(visible(before),box,6),draw(visible(candidate),box,6)].forEach((im,i)=>{label(ctx,['参考袖子','上一版：过长、圆兜底','修形后：收束、抬高肘部、压褶'][i],i*420+15,80,20);fit(ctx,im,i*420+12,100,396,750);});
fs.writeFileSync(new URL('comparison.png',out),sheet.toBuffer('image/png'));
fs.writeFileSync(new URL('after.png',out),draw(visible(candidate),box,6).toBuffer('image/png'));
fs.writeFileSync(new URL('whole.png',out),draw(visible(candidate),[0,0,base.width,base.height],1).toBuffer('image/png'));
console.log(JSON.stringify({removed:[...removeIds],added:newCommands.length,output:new URL('candidate.line.json',out).pathname}));
