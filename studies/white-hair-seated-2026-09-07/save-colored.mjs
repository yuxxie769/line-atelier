// Serialize source paths actually exported from WebMCP at revision 45.
// This file saves and renders existing drawing geometry; it does not trace pixels.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {validateDocument} from '../../app/model.js';
import {exportDocumentData} from '../../app/document-export.js';
import {renderRegion} from '../../app/renderer.js';
const root=new URL('./',import.meta.url);
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(16)};
const rows=[...JSON.parse(await fs.readFile(new URL('color-geometry-1.json',root),'utf8')),...JSON.parse(await fs.readFile(new URL('color-geometry-2.json',root),'utf8'))];
if(fnv(JSON.stringify(rows))!=='53510526')throw Error('Color geometry transfer differs: '+fnv(JSON.stringify(rows)));
const raw=JSON.parse(await fs.readFile(new URL('clean-lineart.line.json',root),'utf8'));
const extra=rows.map(([id,objectId,layer,stage,type,color,width,opacity,path,taper])=>({id,type,layer,stage,color,width,opacity,closed:type==='fill'||id.startsWith('c-halo-'),geometry:{kind:'path',path:path.replace(/-?\d*\.?\d+/g,n=>String(Number(n)*2)),...(taper?{taper}:{})},subphase:'lineart_review',objectId}));
raw.commands.push(...extra);raw.revision=45;
const layers=[['hair-back-base','后发底色'],['hair-back-shade','后发阴影'],['coat-back-base','后摆底色'],['coat-back-shade','后摆阴影'],['legs-base','双腿底色'],['legs-shade','双腿阴影'],['dress-base','水手服底色'],['dress-shade','水手服阴影'],['coat-front-base','衣袖底色'],['coat-front-shade','衣袖阴影'],['skin-base','皮肤底色'],['skin-shade','皮肤阴影'],['hair-front-base','前发底色'],['hair-front-shade','前发阴影'],['accessory-base','配饰底色'],['accessory-shade','配饰阴影'],['highlight','高光']].map(([id,name])=>({id,name,visible:true,opacity:1,locked:false,blend:'source-over',role:'paint'}));
raw.layers=[...raw.layers.slice(0,3),...layers,raw.layers[3]];
raw.reviews.forEach(r=>r.stale=true);
const review=(kind,status,note,issues=[],at=309,revision=27)=>({at,revision,reviewPhase:'lineart_review',region:[],note,kind,scope:'global',objectIds:[],ids:[],status,evidence:['drawing','reference','context','mirrored'],issues,stale:false});
raw.reviews.push(review('structure-checkpoint','pass','revision 27 仅新增空底色图层，未改动笔迹、遮挡或原图层显示。已再次查看头发/全身对照与缩小翻转，姿态与比例保持 revision 26 的已复核结果，第一轮结论延续。'));
raw.reviews.push(review('lineart-checkpoint','pass','空色层建立后，实际渲染的线稿与 revision 26 相同；局部对照、全图翻转中既有接头与前后关系保持。此前缺口扫描和交叠腿泄漏预览仍针对同一笔迹与遮挡，第二轮结论延续。'));
raw.events.push({revision:27,kind:'plan',note:'更新绘画阶段与叠层',ids:[]});
let pos=0;
for(const [revision,count] of [[28,8],[29,5],[30,6],[31,8],[32,1],[33,6],[34,5],[36,16],[37,4],[38,8],[39,8],[40,12],[41,16],[42,11],[44,4],[45,16]]){
 if(revision===36)raw.events.push({revision:35,kind:'revision',note:'丝袜底色闭合边须沿现有弧形裙边返回，修掉直线闭合产生的白缝。',ids:['c-front-stocking']});
 if(revision===44)raw.events.push({revision:43,kind:'revision',note:'局部复看后降低袜面明暗跳变和脸颊色块强度，使体积转折与参考的轻柔表现更接近。',ids:['s-back-knee-contact','s-back-knee-light','s-front-knee-light','s-front-shin-light','s-front-leg-under','s-blush-left','s-blush-right']});
 raw.events.push({revision,kind:'submit',note:'提交模型笔迹',ids:extra.slice(pos,pos+count).map(c=>c.id)});pos+=count;
}
const baseColors=structuredClone(raw);baseColors.commands=baseColors.commands.slice(0,368);baseColors.revision=37;baseColors.events=baseColors.events.filter(e=>e.revision<=37);baseColors.checkpoints=[];
raw.checkpoints.push({id:'checkpoint-1788729816397',name:'2 · 全身底色与配饰',revision:37,doc:baseColors});
raw.reviews.push(review('observation','needs-work','首版上色完成后实际查看参考、脸手局部、裙腿和鞋口、全身缩小及水平翻转。白发、紫眼、粉色光环、黑紫制服与交叠坐姿保留；已修正刘海漏肤色及裙腿底色白缝，并降低丝袜阴影和腮红强度。当前是可继续细化的首版上色稿：衣褶分面比参考简化，丝袜与脸部阴影转折更硬，未宣称完全复现原图细腻画风。',['衣褶细节与明暗层次较参考简化','丝袜与肤色的柔和过渡仍可细化'],443,45));
const current=structuredClone(raw);current.checkpoints=[];raw.checkpoints.push({id:'checkpoint-1788731187977',name:'3 · 首版上色与整体复看',revision:45,doc:current});
const doc=validateDocument(raw),compact=exportDocumentData(doc,{compact:true});
const colorsFNV=fnv(JSON.stringify(compact.commands.slice(309))),commandsFNV=fnv(JSON.stringify(compact.commands));
if(colorsFNV!=='df1f0b30'||commandsFNV!=='f91e2e96')throw Error('Command export mismatch: '+JSON.stringify({colorsFNV,commandsFNV}));
const regionFNV=fnv(JSON.stringify(compact.scene.regions.map(r=>r.through.map(p=>p.map(v=>Math.round(v*1e9)/1e9)))));
if(regionFNV!=='3aa65b4b')throw Error('Scene region transfer exceeds numeric tolerance');
await fs.writeFile(new URL('white-hair-seated.line.json',root),JSON.stringify(compact,null,2));
const require=createRequire(import.meta.url);const {createCanvas,Path2D}=require('C:/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');globalThis.document={createElement:()=>createCanvas(1,1)};globalThis.Path2D=Path2D;
const engine={doc,layerVisible:l=>l.visible,geometry:[],commandIndex:doc.commands.length,unitIndex:0,maskPaths:new Map()};
await fs.writeFile(new URL('current-drawing.png',root),renderRegion(engine,{region:[0,0,1200,1698],scale:1}).toBuffer('image/png'));
const integrity={revision:doc.revision,commands:doc.commands.length,checkpoints:doc.checkpoints.length,commandsFNV,colorsFNV,colorRowsFNV:fnv(JSON.stringify(rows)),regionCoordinatesRoundedTo1e9FNV:regionFNV,commandsSHA256:createHash('sha256').update(JSON.stringify(compact.commands)).digest('hex'),source:'WebMCP http://127.0.0.1:5173/',sessionId:'f37ea726-00d0-47b5-b8bf-69410d2819bf',note:'Exact complete command records match the browser export. Region coordinates reconstructed from those same authored paths match at 1e-9 pixels; differences in unrounded values are floating point evaluation differences between runtimes. This validates preservation, not artistic quality.'};
await fs.writeFile(new URL('integrity.json',root),JSON.stringify(integrity,null,2));console.log(JSON.stringify(integrity));
