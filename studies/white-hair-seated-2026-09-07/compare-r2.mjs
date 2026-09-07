import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {validateDocument} from '../../app/model.js';
import {renderRegion} from '../../app/renderer.js';
const root=new URL('./',import.meta.url);
const {createCanvas,Path2D}=createRequire(import.meta.url)('C:/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};globalThis.Path2D=Path2D;
const paths=['../../archive/data/line-atelier-v4-r2.line.json','clean-lineart.line.json'];
const engines=[];
for(const p of paths){const doc=validateDocument(JSON.parse(await fs.readFile(new URL(p,root),'utf8')));engines.push({doc,layerVisible:l=>l.visible,geometry:[],commandIndex:doc.commands.length,unitIndex:0,maskPaths:new Map()});}
const whole=createCanvas(1200,980),ctx=whole.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1200,980);ctx.fillStyle='#333333';ctx.font='22px Arial';ctx.fillText('R2 - 265 clean strokes',25,30);ctx.fillText('Current - 145 clean strokes',625,30);
engines.forEach((e,i)=>{const d=e.doc,s=Math.min(560/d.width,900/d.height);const im=renderRegion(e,{region:[0,0,d.width,d.height],scale:s});ctx.drawImage(im,i*600+(600-im.width)/2,55);});
await fs.writeFile(new URL('r2-lineart-comparison.png',root),whole.toBuffer('image/png'));
const detail=createCanvas(1120,1220),q=detail.getContext('2d');q.fillStyle='#fff';q.fillRect(0,0,1120,1220);q.fillStyle='#333';q.font='22px Arial';q.fillText('R2',20,28);q.fillText('Current',580,28);
const crops=[[[275,245,330,390],[480,140,375,440]],[[110,530,300,510],[210,745,405,640]]];
for(let row=0;row<2;row++)for(let col=0;col<2;col++){const r=crops[row][col],s=Math.min(525/r[2],555/r[3]);const im=renderRegion(engines[col],{region:r,scale:s});q.drawImage(im,col*560+15,45+row*585);}
await fs.writeFile(new URL('r2-lineart-details.png',root),detail.toBuffer('image/png'));
