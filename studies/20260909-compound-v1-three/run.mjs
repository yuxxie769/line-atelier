import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {validateDocument,renderPoints,validateBatch} from '../../app/model.js';
import {PaintEngine} from '../../app/engine.js';
import {exportDocumentData} from '../../app/document-export.js';
import {compileContourV1,COMPOUND_VERSION} from '../../scripts/drawing/compound-v1.mjs';
import {base,clean,sourcePath,sourceBytes,here,out,regions,createCanvas,draw,reference,write,label,fit} from './inspect-render.mjs';
import {drawings} from './inputs.mjs';
const close=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8;
const id=process.argv[2];
if(id!=='--assemble'){
const part=regions.find(r=>r.id===id),plan=drawings.find(r=>r.id===id);assert(part&&plan,'choose jaw, sleeve or shoe');
const old=base.commands.find(c=>c.id===part.sourceId);
const input={stroke:{id:`v1-${id}`,type:'stroke',layer:old.layer,stage:old.stage,part:old.part,subphase:'clean',color:old.color,opacity:1,smoothing:0,pressureFloor:0,path:plan.path,width:plan.width,pressureProfile:plan.pressureProfile,endpoints:old.endpoints,intent:plan.note},lifts:plan.lifts,overlapPx:plan.overlapPx,roles:['silhouette','turn','silhouette']};
const compiled=compileContourV1(input,base),commands=clean.flatMap(c=>c.id===old.id?compiled.commands:[c]);
assert.equal(compiled.commands.length,3);
const origin=renderPoints(validateBatch([input.stroke],{...base,commands:[]})[0],base,2);
for(const p of origin)assert(compiled.commands.some(c=>c.points.some(q=>close(p,q))));
for(let i=0;i<plan.lifts.length;i++){
const point=plan.lifts[i].point;assert(close(point,compiled.joins[i].point));
for(const c of compiled.commands.slice(i,i+2)){const p=c.points.find(q=>close(q,point)),target=origin.find(q=>close(q,point));assert(p&&target&&Math.abs(p[2]-target[2])<1e-8);}
}
const oldPoints=renderPoints(old,base,2);assert(close(origin[0],oldPoints[0]));assert(close(origin.at(-1),oldPoints.at(-1)));
write(id+'-input.json',input);write(id+'-compiled.json',compiled);
write(id+'-after.png',draw(commands,part.box).toBuffer('image/png'));
const sheet=createCanvas(1200,840),ctx=sheet.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1200,840);label(ctx,part.name+' · 三号复合笔组 v1',18,33,25);
const views=[reference(part.box),draw(clean,part.box),draw(commands,part.box)];
views.forEach((im,i)=>{label(ctx,['参考','修改前','v1 试画 · 3 笔'][i],i*400+16,72);fit(ctx,im,i*400+14,90,372,410);});
label(ctx,'同倍率放大：旧线 / 新线 / 自动分笔着色（仅解释接点）',18,539,20);
const zooms=[draw(clean,part.zoom,10,[old.id]),draw(commands,part.zoom,10,compiled.commands.map(c=>c.id)),draw(commands,part.zoom,10,compiled.commands.map(c=>c.id),true)];
zooms.forEach((im,i)=>fit(ctx,im,i*400+14,560,372,245));write(id+'-comparison.png',sheet.toBuffer('image/png'));
write(id+'-checks.json',{version:COMPOUND_VERSION,passed:true,strokes:3,preservedEndpoints:true,sourceSamplesRetained:true,joins:compiled.joins,note:plan.note});
console.log(JSON.stringify({part:id,strokes:3,checks:'passed',joins:compiled.joins}));
}else{
const results=regions.map(r=>({part:r,result:JSON.parse(fs.readFileSync(path.join(out,r.id+'-compiled.json')))}));
const map=new Map(results.map(r=>[r.part.sourceId,r.result.commands]));
const candidate=validateDocument({...base,title:base.title+' · v1 三部位试画',commands:base.commands.flatMap(c=>map.get(c.id)||[c]),revision:base.revision+1,reviews:[],visualChecks:[],partIssues:[],refinementDiagnoses:[],localChanges:[],events:[],checkpoints:[],workflow:{enabled:true,phase:'clean'}});
const addedIds=new Set(results.flatMap(r=>r.result.commands.map(c=>c.id))),unchanged=base.commands.filter(c=>!map.has(c.id));assert.deepEqual(candidate.commands.filter(c=>!addedIds.has(c.id)),unchanged);
write('candidate.line.json',exportDocumentData(candidate,{compact:true,includeCheckpoints:false}));assert.deepEqual(validateDocument(JSON.parse(fs.readFileSync(path.join(out,'candidate.line.json')))).commands,candidate.commands);
write('full.png',new PaintEngine(createCanvas(base.width,base.height),candidate).canvas.toBuffer('image/png'));
const sheet=createCanvas(1200,1130),ctx=sheet.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1200,1130);
label(ctx,'三号复合笔组 v1 · 三个新位置',18,32,25);
['参考原图','修改前','定型方案试画'].forEach((s,i)=>label(ctx,s,i*400+18,71,21));
for(const [row,{part}] of results.entries()){
const y=100+row*340;label(ctx,part.name,16,y+20,19);
const after=candidate.commands.filter(c=>c.subphase==='clean'&&candidate.layers.find(l=>l.id===c.layer)?.visible);
[reference(part.box),draw(clean,part.box),draw(after,part.box)].forEach((im,i)=>fit(ctx,im,i*400+14,y+32,372,288));
}write('overview.png',sheet.toBuffer('image/png'));
write('checks.json',{passed:true,version:COMPOUND_VERSION,source:sourcePath,sha256:crypto.createHash('sha256').update(sourceBytes).digest('hex'),unchangedCommands:unchanged.length,replacedCommands:3,generatedCommands:9,scope:'脚本级离线三部位试画，不是正式网页绘画验收；膝部沿用上轮候选。'});
console.log(JSON.stringify({assembled:true,unchanged:unchanged.length,generated:9}));
}
assert(fs.readFileSync(sourcePath).equals(sourceBytes));
