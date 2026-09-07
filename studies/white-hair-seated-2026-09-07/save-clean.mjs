// Save the independently authored paths exported from the active WebMCP painting.
// No reference pixels are read by this script.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {validateDocument} from '../../app/model.js';
import {exportDocumentData} from '../../app/document-export.js';
import {renderRegion} from '../../app/renderer.js';
const root=new URL('./',import.meta.url);
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(16)};
let base;
try{base=JSON.parse(await fs.readFile(new URL('backup/initial-1c.line.json',root),'utf8'))}
catch{base=JSON.parse(await fs.readFile(new URL('white-hair-seated.line.json',root),'utf8'));if(base.revision!==10)throw Error('Expected original 1C source');await fs.writeFile(new URL('backup/initial-1c.line.json',root),JSON.stringify(base,null,2))}
const rows=JSON.parse(await fs.readFile(new URL('clean-geometry.json',root),'utf8'));
if(fnv(JSON.stringify(rows))!=='335ea95d')throw Error('Clean source geometry transfer mismatch');
const command=([id,objectId,width,path,taper])=>({id,type:'stroke',layer:id.startsWith('d-')?'refine':'ink',stage:'lineart',color:id.startsWith('d-')?'#876e8b':'#474451',width,opacity:1,closed:false,geometry:{kind:'path',path:path.replace(/-?\d*\.?\d+/g,n=>String(Number(n)*2)),...(taper?{taper}:{})},subphase:id.startsWith('d-')?'refine':'clean',objectId});
const extra=rows.map(command),raw=structuredClone(base);raw.commands.push(...extra);raw.revision=26;raw.workflow.phase='lineart_review';raw.layers=raw.layers.map(l=>({...l,visible:l.id==='ink',opacity:({construction:.22,rough:.12,refine:.18,ink:1})[l.id]}));raw.reviews.forEach(r=>r.stale=true);
raw.scene.objects.push({id:'hair-foreground',name:'覆盖右衣袖的前景发束',frame:[825,670,190,450],parent:'figure',material:'opaque',phase:'clean',note:'由模型独立清线的曲线限定边界，与后发分片以表达遮挡。'});
const coatIds=raw.commands.filter(c=>c.objectId==='coat').map(c=>c.id);
const event=(revision,kind,note,ids=[])=>raw.events.push({revision,kind,note,ids});
event(10,'phase','refine');
for(const [a,b,r] of [[0,17,11],[17,29,12],[29,59,13],[59,93,14],[93,122,15],[122,142,16],[142,164,17],[164,172,18]]){if(r===13)event(12,'phase','clean');event(r,'submit','提交模型笔迹',extra.slice(a,b).map(c=>c.id))}
event(19,'scene','按已绘制的右侧发束源曲线建立隐形边界，仅用于前后遮挡，不使用参考像素。',coatIds);
event(20,'revision','右侧卷发、长束和细尖端归入前景发束对象。',['i-hair-right-curl','i-hair-right-long','i-hair-right-tip']);
event(21,'revision','修正前景发束根部缺少可见边界的问题，补足弯曲内缘后重新匹配隐形区域。',['i-hair-right-curl','i-hair-right-long']);
event(22,'scene','将三个前景发束的隐形边界与刚修订的清线同步。',coatIds);
event(22,'phase','lineart_review');event(22,'phase','clean');
event(23,'revision','截短脸颊与颈带的穿发线头，补耳侧与发边连接及辫子外轮廓接头。',['i-face','i-choker-front','i-choker-rear','i-neck-left','i-neck-right','i-ear','i-braid-c']);
event(24,'revision','领口接到袖子遮挡边，领巾回到结扣并收口；上衣下摆在领巾后止线，袖子与领口、衣摆与裙腿接合。',['i-collar-main','i-collar-left','i-tie-left','i-tie-right','i-shirt-hem-right','i-shirt-sleeve-out','i-shirt-sleeve-in','i-coat-left-edge','i-coat-tail-bottom','i-skirt-waist-r']);
event(25,'submit','提交模型笔迹',extra.slice(172).map(c=>c.id));
event(26,'scene','补辫尾遮住袖口、领巾遮住抬袖以及后侧细发束遮住衣摆的可见关系。',coatIds);event(26,'phase','lineart_review');
const review=(at,revision,kind,status,note,evidence,issues=[],stale=false)=>({at,region:[],note,kind,reviewPhase:'lineart_review',ids:[],scope:'global',objectIds:[],status,stale,revision,evidence,issues});
raw.reviews.push(review(307,22,'structure-checkpoint','pass','1F 第一轮：实际查看参考/清线全图、缩小图与水平翻转；头胸骨盆同向，屈臂、交叠膝部、后脚鞋口与下垂手的接触关系可读，外套围住四肢。保留遮眼刘海、蝴蝶结、光环、飘发及坐姿；右侧前景发束已分片遮挡衣袖。主要比例和负形成立，后续第二轮专查边界接头与局部穿线。',['drawing','reference','context','mirrored'],[],true));
raw.reviews.push(review(307,22,'lineart-checkpoint','needs-work','1F 第二轮实际放大对照与缺口扫描：脸颊和颈带有穿入侧发的线头，辫子与袖口有少量穿线，领口/上衣下摆/左衣摆有接缝；开放发丝、五官与衣褶不按缺口补齐。需修正后复看，尚未通过清线审核。',['drawing','reference','context','mirrored','gaps'],['脸颈与侧发穿线','辫尾和袖口穿线','领口与上衣下摆边界待连接','左衣摆边界待连接'],true));
raw.reviews.push(review(309,26,'structure-checkpoint','pass','返修后在 revision 26 重新查看参考与当前全身、缩小水平翻转，以及脸颈、裙腿、袖口的局部。头胸骨盆和交叠腿方向统一，腕入袖口、手与踝接触成立；脸颈在侧发后结束，领巾和前景发束前后可读。主要角色轮廓与姿态保留；裙褶细节较参考简化，形体和整体比例达到进入底色的线稿要求。',['drawing','reference','context','mirrored']));
raw.reviews.push(review(309,26,'lineart-checkpoint','pass','第二轮复看 revision 26 实际全图/翻转及脸颈、领巾袖口、裙腿局部：此前穿线与主要衣摆接头已修正。缺口扫描检查 288 个端点，155 个候选以开放发丝、五官、褶线和遮挡终止为主，不把它们强行封闭。前方交叠腿泄漏预览实际查看，色区不达背景边缘且不进入背景测试点。主要物体边界可独立辨认，保留内部结构提示线，清线通过。',['drawing','reference','context','mirrored']));
function setRegions(d,ids){const normalized=validateDocument(d);d.scene.regions=ids.map(id=>{const c=normalized.commands.find(c=>c.id===id);const through=c.points.filter((p,i,a)=>i%4===0||i===a.length-1).map(p=>p.slice(0,2));return{id:id+'-cover',objectId:c.objectId,through,corners:through.map((_,i)=>i),purpose:'model-authored-foreground-boundary',space:null}});d.scene.occlusions=d.scene.regions.map(r=>({id:r.id+'-coat',regionId:r.id,front:r.objectId,back:'coat',note:'前景发束或领巾遮住外套，按模型已画曲线决定边界。'}));}
const foreground=['i-hair-right-curl','i-hair-right-long','i-hair-right-tip'];setRegions(raw,[...foreground,'i-braid-tail','i-tie-left','i-tie-right','i-hair-right-rear']);
const oldRows=[['i-face','head',2.1,'M 289 214 Q 293 227 300 233 Q 315 242 336 250 Q 353 244 367 235',[.65,1,.75]],['i-ear','head',1.5,'M 402 188 Q 408 189 407 199 Q 407 208 400 211'],['i-neck-left','torso',1.6,'M 336 250 L 334 257'],['i-neck-right','torso',1.6,'M 388 242 Q 388 252 395 257'],['i-choker-front','torso',3.2,'M 337 252 Q 349 257 362 257'],['i-choker-rear','torso',3.2,'M 380 250 Q 387 248 391 245'],['i-braid-c','hair-front',1.3,'M 271 236 Q 267 244 275 253 L 281 258 L 285 252 Q 279 245 277 243'],['i-collar-main','dress',2.1,'M 395 257 Q 409 265 422 281 L 442 307 Q 380 319 317 328 L 297 294'],['i-collar-left','dress',1.4,'M 296 282 Q 305 303 311 322'],['i-tie-left','dress',1.7,'M 312 337 Q 303 355 287 371 Q 280 382 277 405 L 291 390 Q 308 371 312 347'],['i-tie-right','dress',1.7,'M 317 336 Q 324 354 329 373 Q 334 397 336 429 L 320 407 Q 309 391 307 380 L 314 348'],['i-shirt-hem-right','dress',1.65,'M 330 417 Q 350 420 365 415'],['i-shirt-sleeve-out','dress',1.85,'M 438 311 Q 448 331 434 363 Q 414 411 361 454'],['i-shirt-sleeve-in','dress',1.6,'M 407 326 Q 384 354 377 386 Q 369 417 361 454'],['i-coat-left-edge','coat',2.1,'M 265 380 Q 218 377 180 380 Q 151 387 117 409 L 103 431 L 110 451 L 113 465 Q 132 472 141 471 L 162 461'],['i-skirt-waist-r','dress',1.5,'M 335 419 L 341 452 L 354 451 L 359 419'],['i-coat-tail-bottom','coat',1.9,'M 436 616 L 433 634 Q 479 665 511 661 L 536 657 L 483 615 L 439 602']];
if(fnv(JSON.stringify(oldRows))!=='39ba329f')throw Error('Checkpoint 1E delta mismatch');
const detail=structuredClone(base);detail.commands.push(...extra.slice(0,29));detail.revision=12;detail.workflow.phase='refine';detail.reviews.forEach(r=>r.stale=true);detail.events=raw.events.slice(0,raw.events.findIndex(e=>e.revision===12&&e.kind==='phase'));detail.checkpoints=[];
const clean=structuredClone(raw);clean.commands=clean.commands.slice(0,307).map(c=>oldRows.find(r=>r[0]===c.id)?command(oldRows.find(r=>r[0]===c.id)):c);clean.revision=22;clean.workflow.phase='clean';clean.reviews=clean.reviews.slice(0,2);clean.events=raw.events.slice(0,raw.events.findIndex(e=>e.revision===22&&e.kind==='phase'));clean.checkpoints=[];setRegions(clean,foreground);
raw.checkpoints.push({id:'checkpoint-1788726234186',name:'1D · 手指五官与裙腿细化草稿',revision:12,doc:detail},{id:'checkpoint-1788727456071',name:'1E · 全身独立清线与前景发束',revision:22,doc:clean});
const verified=structuredClone(raw);verified.checkpoints=[];raw.checkpoints.push({id:'checkpoint-1788728832084',name:'1F · 返修后两轮清线复核',revision:26,doc:verified});
const doc=validateDocument(raw),compact=exportDocumentData(doc,{compact:true});
if(fnv(JSON.stringify(compact.commands))!=='8d8d8d2b')throw Error('Complete command export differs: '+fnv(JSON.stringify(compact.commands)));
console.log(JSON.stringify({commands:doc.commands.length,revision:doc.revision,commandFNV:fnv(JSON.stringify(compact.commands)),regionsFNV:fnv(JSON.stringify(compact.scene.regions))}));
await fs.writeFile(new URL('white-hair-seated.line.json',root),JSON.stringify(compact,null,2));
await fs.writeFile(new URL('clean-lineart.line.json',root),JSON.stringify(compact,null,2));
const require=createRequire(import.meta.url);const {createCanvas,Path2D}=require('C:/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');globalThis.document={createElement:()=>createCanvas(1,1)};globalThis.Path2D=Path2D;
const engine={doc,layerVisible:l=>l.visible,geometry:[],commandIndex:doc.commands.length,unitIndex:0,maskPaths:new Map()};const png=renderRegion(engine,{region:[0,0,1200,1698],scale:1}).toBuffer('image/png');await fs.writeFile(new URL('current-drawing.png',root),png);await fs.writeFile(new URL('clean-lineart.png',root),png);
