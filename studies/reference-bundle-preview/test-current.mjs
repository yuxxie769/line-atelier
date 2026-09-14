import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {extractReferenceLines,referenceBundle,referenceIdentity} from '../../app/reference.js';
import {traceReferenceSvg} from '../../app/reference-svg.js';
import {normalizeObjectMap,validateObjectMapObservations,validateMappedObjectCommands} from '../../app/object-map.js';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json')('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const image=await loadImage('C:/Users/xie/Downloads/3b978c885e5a5cf538cd28ca349ae5f0.jpg');
const original=createCanvas(image.width,image.height);original.getContext('2d').drawImage(image,0,0);
const project=JSON.parse(await readFile('../line-atelier/studies/retrial-20260909/lineart-final.line.json','utf8'));
const map=normalizeObjectMap(project.objectMap,{width:project.width,height:project.height,sceneObjects:project.scene.objects});
const trace=traceReferenceSvg(await extractReferenceLines(original));
const svgContourCanvas=createCanvas(image.width,image.height);svgContourCanvas.getContext('2d').drawImage(await loadImage(Buffer.from(trace.svg)),0,0);
const reference={original,placement:[0,0,1],sourceDataUrl:original.toDataURL(),svgContours:trace,svgContourCanvas};
const key=referenceIdentity(reference),receipt={referenceKey:key,revision:project.revision,region:[0,0,project.width,project.height],mirror:false};
const receipts=new Map([['test-full',receipt]]);
const checks={};
checks.fullAccepted=validateObjectMapObservations(['test-full'],receipts,{referenceKey:key,revision:project.revision,width:project.width,height:project.height}).length===1;
for(const [name,fn] of [
 ['fakeRejected',()=>validateObjectMapObservations(['fake'],receipts,{referenceKey:key,revision:project.revision,width:project.width,height:project.height})],
 ['staleRejected',()=>validateObjectMapObservations(['test-full'],receipts,{referenceKey:key,revision:project.revision+1,width:project.width,height:project.height})],
 ['unboundRejected',()=>validateMappedObjectCommands([{}],map)]
]){try{fn();checks[name]=false;}catch{checks[name]=true;}}
checks.boundAccepted=validateMappedObjectCommands([{mapItemId:map.items[0].id}],map);
const packet=referenceBundle(reference,{objectMap:map,region:receipt.region,scale:1,documentWidth:project.width,documentHeight:project.height});
const output='studies/reference-bundle-preview/current-branch-tested.png';
await writeFile(output,Buffer.from(packet.dataUrl.split(',')[1],'base64'));
const report={output,checks,items:map.items.length,masks:map.items.reduce((n,i)=>n+i.visibleMasks.length,0),segments:trace.segments,truncated:trace.truncated,width:packet.width,height:packet.height,maskSource:'existing retrial project; not a new segmentation',renderer:'app/reference.js referenceBundle'};
await writeFile('studies/reference-bundle-preview/current-branch-tested.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
if(Object.values(checks).some(v=>!v))process.exitCode=1;
