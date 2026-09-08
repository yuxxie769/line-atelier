import fs from 'node:fs';
import {createCanvas,reference,draw,label} from '../20260909-compound-v1-three/inspect-render.mjs';
import {validateDocument} from '../../app/model.js';
export const out=new URL('./results/',import.meta.url);fs.mkdirSync(out,{recursive:true});
export const base=validateDocument(JSON.parse(fs.readFileSync(new URL('../20260909-compound-gate-test/results/candidate.line.json',import.meta.url))));
export const box=[230,260,92,158];
export const visible=doc=>doc.commands.filter(c=>c.subphase==='clean'&&doc.layers.find(l=>l.id===c.layer)?.visible);
const r=reference(box,6),ctx=r.getContext('2d');ctx.strokeStyle='#008d8d77';ctx.lineWidth=1;ctx.font='14px sans-serif';ctx.fillStyle='#d00030';
for(let x=240;x<322;x+=10){ctx.beginPath();ctx.moveTo((x-box[0])*6,0);ctx.lineTo((x-box[0])*6,r.height);ctx.stroke();ctx.fillText(x,(x-box[0])*6+2,16);}
for(let y=270;y<418;y+=10){ctx.beginPath();ctx.moveTo(0,(y-box[1])*6);ctx.lineTo(r.width,(y-box[1])*6);ctx.stroke();ctx.fillText(y,2,(y-box[1])*6-2);}
fs.writeFileSync(new URL('reference-grid.png',out),r.toBuffer('image/png'));
fs.writeFileSync(new URL('before.png',out),draw(visible(base),box,6).toBuffer('image/png'));
console.log(JSON.stringify(visible(base).filter(c=>c.points.some(p=>p[0]>=230&&p[0]<=322&&p[1]>=260&&p[1]<=418)).map(c=>({id:c.id,part:c.part,path:c.geometry?.path,start:c.points[0],end:c.points.at(-1),compoundId:c.compoundId})),null,2));
