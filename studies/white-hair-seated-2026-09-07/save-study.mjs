// Serialize source geometry actually returned by paint_export_document at revision 10.
// Does not inspect reference pixels or generate new strokes.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {validateDocument} from '../../app/model.js';
import {exportDocumentData} from '../../app/document-export.js';
import {renderRegion} from '../../app/renderer.js';

const root=new URL('./',import.meta.url);
const rows=JSON.parse(await fs.readFile(new URL('geometry.json',root),'utf8'));
function fnv(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16);}
if(fnv(JSON.stringify(rows))!=='5709ec65')throw Error('Geometry differs from the browser export at revision 10.');
const objects=[['figure','整体人体',[0,0,1200,1698]],['head','头颅与脸',[490,144,354,376]],['torso','胸廓与骨盆',[530,510,314,520]],['arm-up','抬起的手臂与手',[490,480,184,302]],['arm-down','下垂手臂与手',[724,600,190,738]],['leg-back','后方下垂腿与鞋',[270,888,294,768]],['leg-front','前方交叠腿与袜足',[314,944,492,562]],['hair-back','后方长发',[28,160,990,940]],['hair-front','冠发刘海与侧发',[488,144,362,482]],['dress','水手服与裙',[354,492,536,660]],['coat','宽大外套',[200,546,960,778]],['ornament','头饰与光环',[366,18,502,316]]].map(([id,name,frame])=>({id,name,frame,parent:id==='figure'?null:'figure',material:'opaque',phase:'layout',note:''}));
const anchors=[['chin',[672,500]],['knee-back',[338,982]],['knee-front',[389,1056]],['ankle-back',[350,1470]],['ankle-front',[742,1340]]].map(([id,point])=>({id,point,objectId:null,corner:false}));
const layers=[{id:'construction',name:'1A 人体定位',role:'construction',visible:false,opacity:.22},{id:'rough',name:'1B 全物体粗稿',role:'rough',visible:true,opacity:.8},{id:'refine',name:'1D 细化草稿',role:'refine',visible:true,opacity:.8},{id:'ink',name:'1E 独立清线',role:'ink',visible:true,opacity:1}].map(l=>({...l,locked:false,blend:'source-over'}));
const stages=[['lineart','完整线稿','结构定位、主要轮廓、内部结构、逐区清线'],['hair','头发大色块','前发与后发分开，沿发束连续铺色'],['skin','皮肤底色','脸、颈、手和腿分别铺色'],['clothes','服装大色块','顺布料体积铺设底色'],['accessories','配饰／鞋履底色','配饰、镜框和鞋履分别处理'],['shadows','覆盖阴影','在各部位底色上方剪贴阴影'],['highlights','高光与整理','按材质补高光，整理边缘与局部压线'],['review','局部复核','放大检查脸、手、遮挡与线条交接']].map(([id,name,description])=>({id,name,description}));
const tensionOverrides={'r-face':.8,'r-choker':.8,'r-band-top':.8,'r-fringe-mid':.9,'r-back-leg-inner':.8};
const endOverrides={'r-face':['occluded','occluded'],'r-choker':['occluded','occluded'],'r-back-leg-inner':['occluded','joined']};
const commands=rows.map(([id,objectId,width,ps,corners=[]])=>({id,type:'stroke',layer:id.startsWith('a-')?'construction':'rough',stage:'lineart',subphase:id.startsWith('a-')?'layout':'rough',objectId,color:id.startsWith('a-')?'#6286a2':'#535367',width,opacity:1,closed:false,geometry:{kind:'through',through:ps.map(([x,y])=>[x*2,y*2,.65]),space:null,corners,tension:tensionOverrides[id]??(id.startsWith('a-')?.7:1),closed:false},...(endOverrides[id]?{endpoints:endOverrides[id]}:{})}));
const reviewA={at:24,region:[],note:'1A 实际整图对照：头胸骨盆与双腿方向已建立，前腿向右下跨过后腿；膝部转折偏硬，脚形及下垂手与踝部接触待完整粗稿修订。人体推断线暂保留供衣物包覆检查。',kind:'observation',reviewPhase:'layout',ids:[],scope:'global',objectIds:[],status:'needs-work',stale:true,revision:4,evidence:['drawing','reference','context'],issues:['膝部弧线尚粗','手与踝部接触待核实']};
const reviewC={at:135,revision:10,reviewPhase:'structure_review',region:[],note:'1C 实际局部及全身翻转对照：已缩短脸颊和颈带至侧发遮挡边，补发带外缘并修刘海收束；双腿方向和全身占位保留。仍需细化辫子与手指、裙褶体积、右侧发束遮挡及袜足脚趾，当前为粗稿，不作为清线通过。',kind:'observation',scope:'global',objectIds:[],ids:[],status:'needs-work',evidence:['drawing','reference','mirrored','context'],issues:['右侧发束与衣褶交线待细化','辫子和手指形体过简','裙褶仍偏几何化','袜足脚趾轮廓待细化'],stale:false};
const events=[{revision:1,kind:'plan',note:'更新绘画阶段与叠层',ids:[]},{revision:1,kind:'phase',note:'layout',ids:[]},{revision:2,kind:'scene',note:'按全身参考建立头胸骨盆、屈臂、下垂臂和交叠双腿对象；隐藏人体延续为结构推断，需后续对照检验。',ids:[]}];
for(const [start,end,revision] of [[0,10,3],[10,24,4],[24,45,5],[45,65,6],[65,91,7],[91,105,8],[105,135,9]]){if(revision===5)events.push({revision:4,kind:'phase',note:'rough',ids:[]});events.push({revision,kind:'submit',note:'提交模型笔迹',ids:commands.slice(start,end).map(c=>c.id)});}
events.push({revision:9,kind:'phase',note:'structure_review',ids:[]},{revision:10,kind:'revision',note:'1C 修正脸发遮挡、发带边界、刘海尖端与后小腿遮挡起点。',ids:['r-face','r-choker','r-fringe-mid','r-band-top','r-side-hair','r-bow-upper','r-bow-side','r-long-right-lock','r-back-leg-inner']});
const raw={version:1,title:'白发坐姿 · 参考临摹 · 2026-09-07',width:1200,height:1698,background:'#ffffff',layers,stages,masks:[],scene:{objects,anchors,regions:[],occlusions:[]},revision:10,workflow:{enabled:true,phase:'structure_review'},events,reviews:[reviewA,reviewC],commands,checkpoints:[]};
const prior={
 'r-face':[[290,214],[298,232],[315,241],[336,250],[354,244],[374,233],[386,215]],
 'r-choker':[[337,247],[353,253],[377,246],[390,238]],
 'r-band-top':[[273,143],[281,120],[307,108],[332,105],[350,107]],
 'r-fringe-mid':[[291,137],[290,170],[299,194],[312,209],[330,203],[329,173],[333,143]],
 'r-back-leg-inner':[[195,573],[197,609],[193,662],[188,705],[188,730],[195,737]]
};
const layoutDoc=structuredClone(raw);layoutDoc.commands=layoutDoc.commands.slice(0,24);layoutDoc.revision=4;layoutDoc.workflow.phase='layout';layoutDoc.layers[0].visible=true;layoutDoc.layers[0].opacity=.6;layoutDoc.events=events.slice(0,5);layoutDoc.reviews=[{...reviewA,stale:false}];
const roughDoc=structuredClone(raw);roughDoc.revision=9;roughDoc.workflow.phase='rough';roughDoc.events=events.slice(0,-2);roughDoc.reviews=[reviewA];for(const c of roughDoc.commands){if(prior[c.id]){c.geometry.through=prior[c.id].map(([x,y])=>[2*x,2*y,.65]);c.geometry.tension=1;c.geometry.corners=[];delete c.endpoints;}}
raw.checkpoints=[{id:'checkpoint-1788724649782',name:'1A · 全身人体定位',revision:4,doc:layoutDoc},{id:'checkpoint-1788725197688',name:'1B · 全身完整粗稿',revision:9,doc:roughDoc},{id:'checkpoint-1788725419930',name:'1C · 脸发与肢体连接初修',revision:10,doc:structuredClone(raw)}];
const doc=validateDocument(raw);const compact=exportDocumentData(doc,{compact:true});
await fs.writeFile(new URL('white-hair-seated.line.json',root),JSON.stringify(compact,null,2));
await fs.copyFile('C:/Users/xie/Downloads/3b978c885e5a5cf538cd28ca349ae5f0.jpg',new URL('reference.jpg',root));
const require=createRequire(import.meta.url);
const {createCanvas,Path2D}=require('C:/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};globalThis.Path2D=Path2D;
const engine={doc,layerVisible:l=>l.visible,geometry:[],commandIndex:doc.commands.length,unitIndex:0,maskPaths:new Map()};
const preview=renderRegion(engine,{region:[0,0,1200,1698],scale:1});
await fs.writeFile(new URL('current-drawing.png',root),preview.toBuffer('image/png'));
const canonical=JSON.stringify(compact.commands);
console.log(JSON.stringify({file:fileURLToPath(new URL('white-hair-seated.line.json',root)),commands:doc.commands.length,checkpoints:doc.checkpoints.length,revision:doc.revision,geometryFNV:fnv(JSON.stringify(rows)),commandsSHA256:createHash('sha256').update(canonical).digest('hex'),commandsFNV:fnv(canonical)}));
