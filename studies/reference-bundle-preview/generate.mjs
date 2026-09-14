import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
let canvasLib;try{canvasLib=require('@napi-rs/canvas');}catch{canvasLib=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json')('@napi-rs/canvas');}
const {createCanvas,loadImage}=canvasLib;
globalThis.document={createElement:()=>createCanvas(1,1)};

const {extractReferenceLines}=await import('../../app/reference.js');
const {traceReferenceSvg}=await import('../../app/reference-svg.js');
const input=resolve(process.argv[2]);
const output=resolve(process.argv[3]||'studies/reference-bundle-preview/reference-bundle.png');
const objectMapFile=process.argv[4]?resolve(process.argv[4]):null;
const image=await loadImage(input),original=createCanvas(image.width,image.height),originalCtx=original.getContext('2d');originalCtx.fillStyle='#fff';originalCtx.fillRect(0,0,image.width,image.height);originalCtx.drawImage(image,0,0);
const rasterLines=await extractReferenceLines(original),trace=traceReferenceSvg(rasterLines),svgImage=await loadImage(Buffer.from(trace.svg)),svgCanvas=createCanvas(image.width,image.height);svgCanvas.getContext('2d').drawImage(svgImage,0,0);

// Use a supplied project's model-authored object map when available. The fallback
// remains an explicitly simulated example, separate from automatic SVG extraction.
const fallbackMasks=[
  {name:'halo',hue:332,polygon:[[339,38],[367,32],[406,43],[430,68],[429,86],[414,98],[383,94],[350,78],[337,57]]},
  {name:'head + main hair',hue:190,polygon:[[256,79],[310,69],[365,78],[406,113],[432,174],[449,260],[485,354],[474,465],[446,517],[402,481],[386,390],[330,326],[261,310],[231,256],[241,166]]},
  {name:'rear hair mass',hue:215,polygon:[[238,190],[222,257],[181,325],[113,366],[43,372],[93,397],[179,388],[249,350],[286,296]]},
  {name:'torso uniform',hue:255,polygon:[[294,252],[369,240],[431,286],[457,384],[413,475],[335,462],[275,401],[254,322]]},
  {name:'near sleeve + hand',hue:31,polygon:[[397,288],[448,306],[464,390],[446,477],[425,579],[397,634],[365,626],[365,547],[382,448]]},
  {name:'skirt',hue:285,polygon:[[214,371],[346,372],[413,432],[396,499],[318,566],[229,552],[151,480],[101,449],[108,402]]},
  {name:'raised leg',hue:126,polygon:[[196,449],[252,447],[302,483],[351,537],[390,601],[377,647],[333,615],[283,574],[230,543],[175,523],[154,485]]},
  {name:'support leg',hue:92,polygon:[[154,467],[196,458],[185,563],[178,672],[174,753],[142,760],[135,649],[136,540]]},
  {name:'shoe',hue:56,polygon:[[141,744],[178,742],[211,775],[207,806],[183,827],[149,824],[136,808]]},
  {name:'back garment',hue:10,polygon:[[430,442],[500,470],[556,536],[583,590],[570,632],[520,661],[453,651],[407,616],[423,548]]}
];
const hash32=(value,seed=2166136261)=>{let hash=seed>>>0;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}return hash>>>0;};
let masks=fallbackMasks,maskSource='simulated';
if(objectMapFile){const document=JSON.parse(await readFile(objectMapFile,'utf8')),map=document.objectMap;if(!map?.items?.length)throw Error('工程文件没有 objectMap');if(document.width!==image.width||document.height!==image.height)throw Error('工程 objectMap 与参考图尺寸不一致');masks=map.items.flatMap(item=>item.visibleMasks.map(mask=>({name:item.name,itemId:item.id,maskId:mask.id,hue:hash32(item.id)%360,polygon:mask.polygon})));maskSource=`${objectMapFile}#objectMap@${map.revision}`;}
const masked=createCanvas(image.width,image.height),maskCtx=masked.getContext('2d');maskCtx.drawImage(original,0,0);for(const mask of masks){maskCtx.beginPath();mask.polygon.forEach(([x,y],i)=>i?maskCtx.lineTo(x,y):maskCtx.moveTo(x,y));maskCtx.closePath();maskCtx.fillStyle=`hsla(${mask.hue},85%,52%,.28)`;maskCtx.strokeStyle=`hsla(${mask.hue},88%,35%,.95)`;maskCtx.lineWidth=2;maskCtx.fill();maskCtx.stroke();}

const header=44,gap=10,panelWidth=image.width,panelHeight=image.height,sheet=createCanvas(panelWidth*3+gap*2,panelHeight+header),ctx=sheet.getContext('2d');ctx.fillStyle='#f4f6f7';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.fillStyle='#172d37';ctx.font='bold 18px sans-serif';
for(const [label,index,source] of [['ORIGINAL',0,original],['SVG CONTOURS',1,svgCanvas],[objectMapFile?'STRUCTURE MASKS (PROJECT)':'STRUCTURE MASKS (SIMULATED)',2,masked]]){const x=index*(panelWidth+gap);ctx.fillText(label,x+10,29);ctx.drawImage(source,x,header);}
await mkdir(dirname(output),{recursive:true});await writeFile(output,sheet.toBuffer('image/png'));await writeFile(resolve(dirname(output),'reference-contours.svg'),trace.svg);await writeFile(resolve(dirname(output),'simulation.json'),JSON.stringify({input,width:image.width,height:image.height,svg:{method:trace.method,threshold:trace.threshold,segments:trace.segments,step:trace.step,darkPixels:trace.darkPixels,sourceDarkPixels:trace.sourceDarkPixels,removedPixels:trace.removedPixels,componentsKept:trace.componentsKept,componentsRemoved:trace.componentsRemoved,minNeighbors:trace.minNeighbors,minComponentPixels:trace.minComponentPixels,truncated:trace.truncated},maskSource,masks:masks.map(({name,itemId,maskId,polygon})=>({name,itemId,maskId,polygon}))},null,2));
console.log(JSON.stringify({output,svg:resolve(dirname(output),'reference-contours.svg'),width:sheet.width,height:sheet.height,segments:trace.segments,darkPixels:trace.darkPixels,sourceDarkPixels:trace.sourceDarkPixels,removedPixels:trace.removedPixels,componentsKept:trace.componentsKept,componentsRemoved:trace.componentsRemoved,truncated:trace.truncated,maskSource,maskCount:masks.length}));
