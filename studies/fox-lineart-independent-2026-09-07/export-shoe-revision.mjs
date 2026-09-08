// Reconstruct the WebMCP-exported revision 33 from its saved revision 32 and
// exact exported delta. Verify the full compact-document fingerprint before saving.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {validateDocument} from '../../app/model.js';
import {exportDocumentData} from '../../app/document-export.js';
import {renderRegion} from '../../app/renderer.js';
const dir=new URL('./',import.meta.url);
const raw=JSON.parse(fs.readFileSync(new URL('fox-independent.line.json',dir),'utf8'));
if(raw.revision!==32)throw Error('Expected saved revision 32');
const paths=[
 ['i-shoe-l-backrim-a','M 218 1031 Q 223 1028.5 229.5 1028','左鞋口后缘','鞋口与脚踝分界，在拉片左侧结束',['contact','occluded']],
 ['i-shoe-l-backrim-b','M 240.5 1028 Q 244.5 1028.7 248 1031','左鞋口后缘','拉片右侧至脚踝，连续界定鞋口',['occluded','contact']],
 ['i-shoe-r-backrim-a','M 302 1035 Q 306 1032.8 310.5 1032','右鞋口后缘','鞋口与脚踝分界，在拉片左侧结束',['contact','occluded']],
 ['i-shoe-r-backrim-b','M 321.5 1032 Q 327 1032 332 1035','右鞋口后缘','拉片右侧至脚踝，连续界定鞋口',['occluded','contact']]
];
raw.commands.push(...paths.map(([id,path,part,intent,endpoints])=>({id,type:'stroke',layer:'ink',stage:'lineart',color:'#49424a',width:1.05,opacity:1,closed:false,geometry:{kind:'path',path,taper:[.85,.95,.85]},subphase:'clean',endpoints,part,intent})));
raw.revision=33;
raw.workflow={enabled:true,phase:'lineart_review'};
raw.events.push({revision:32,kind:'phase',note:'clean',ids:[]},{revision:33,kind:'submit',note:'提交模型笔迹',ids:paths.map(p=>p[0])},{revision:33,kind:'phase',note:'lineart_review',ids:[]});
raw.reviews.forEach(r=>r.stale=true);
const review=(at,revision,kind,status,note,evidence,issues=[],stale=false)=>({at,region:[],note,kind,reviewPhase:'lineart_review',ids:[],scope:'global',objectIds:[],status,stale,revision,evidence,issues});
raw.reviews.push(
 review(410,32,'lineart-checkpoint','needs-work','用户指出鞋腿混读后复查：两鞋的后侧鞋口横跨脚踝的边界遗漏，腿轮廓直接转接鞋外轮廓；拉片无明确附着。上轮 pass 判断有误，必须返修鞋口结构和对象归属。',['drawing','reference','context'],['鞋口顶面与腿部混读','拉片悬空','缺少鞋腿相邻区域验证'],true),
 review(414,33,'structure-checkpoint','pass','鞋口返修后的第一轮复查：已对照两鞋与脚踝局部，并看正向和翻转全图。鞋口上缘横跨脚踝并在拉片处被遮挡，前弧与后缘构成开口厚度；腿侧在鞋口处结束，拉片附着关系可读。四条新增边界没有改变鞋体大小、脚踝位置和全身比例。上轮遗漏已记录，不撤销历史问题记录。',['drawing','reference','mirrored','context']),
 review(414,33,'lineart-checkpoint','pass','鞋口返修后的第二轮复查：新增四条分界在脚踝侧相接、拉片侧消失，纯线稿可区分腿部和鞋口顶面。相同坐标阈值24连通性对照：左腿[233,1005]→鞋口[223,1035]、右腿[317,1010]→鞋口[305,1040]，revision32均true，revision33均false。已看实际诊断图及鞋履局部和全图，不以衣身封闭替代鞋腿验证。',['drawing','reference','mirrored','context'])
);
const doc=validateDocument(raw);
const compact=exportDocumentData(doc,{compact:true,includeCheckpoints:false});
const canon=v=>Array.isArray(v)?'['+v.map(canon).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}':JSON.stringify(v);
const str=canon(compact);let h=2166136261;for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);
const fingerprint={characters:str.length,fnv1a:(h>>>0).toString(16)};
console.log(fingerprint);
if(fingerprint.characters!==166100||fingerprint.fnv1a!=='8479848f')throw Error('Does not match actual browser export');
doc.checkpoints.push({id:'checkpoint-1788757839968',name:'1F 鞋腿交界返修·相邻区域验证',revision:33,doc:validateDocument(compact)});
fs.writeFileSync(new URL('fox-shoe-boundary-fixed.line.json',dir),JSON.stringify(exportDocumentData(doc,{compact:true})));
const require=createRequire(import.meta.url);
const {createCanvas,Path2D}=require('C:/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Path2D=Path2D;
const engine={doc,layerVisible:l=>l.visible,geometry:[],commandIndex:doc.commands.length,unitIndex:0,maskPaths:new Map()};
fs.writeFileSync(new URL('fox-shoe-boundary-fixed.png',dir),renderRegion(engine,{region:[0,0,586,1246],scale:3}).toBuffer('image/png'));
fs.writeFileSync(new URL('shoe-boundary-detail.png',dir),renderRegion(engine,{region:[198,1005,155,90],scale:4}).toBuffer('image/png'));
console.log('Saved exact revision 33, 414 strokes and 7 checkpoints; rendered full drawing and detail.');
