import test from 'node:test';
import assert from 'node:assert/strict';
import {traceImageDataToSvg} from '../app/reference-svg.js';
import {referenceBundle} from '../app/reference.js';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
let native;try{native=require('@napi-rs/canvas');}catch{native=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json')('@napi-rs/canvas');}
globalThis.document={createElement:()=>native.createCanvas(1,1)};

test('reference contour extraction emits deterministic observation-only SVG paths',()=>{
  const width=8,height=4,data=new Uint8ClampedArray(width*height*4);data.fill(255);
  for(const [x,y] of [[1,1],[2,1],[3,1],[5,2],[6,2]]){const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=20;data[i+3]=255;}
  const first=traceImageDataToSvg({width,height,data},{threshold:200,maxSegments:100,minComponentPixels:1}),second=traceImageDataToSvg({width,height,data},{threshold:200,maxSegments:100,minComponentPixels:1});
  assert.equal(first.svg,second.svg);assert.match(first.svg,/<path d="M1 1\.5H4M5 2\.5H7"/);assert.match(first.dataUrl,/^data:image\/svg\+xml/);assert.equal(first.segments,2);assert.equal(first.truncated,false);
});

test('reference contour extraction validates bounds and reports truncation',()=>{
  const width=400,height=2,data=new Uint8ClampedArray(width*height*4);for(let i=0;i<data.length;i+=4){const dark=(i/4)%2===0;data[i]=data[i+1]=data[i+2]=dark?0:255;data[i+3]=255;}
  const result=traceImageDataToSvg({width,height,data},{maxSegments:100,minNeighbors:0,minComponentPixels:1});assert.equal(result.segments,100);assert.equal(result.truncated,true);
  assert.throws(()=>traceImageDataToSvg({width,height,data},{threshold:999}),/0–255/);
});

test('reference contour extraction removes isolated specks and tiny islands',()=>{
  const width=24,height=12,data=new Uint8ClampedArray(width*height*4);data.fill(255);
  const dark=(x,y)=>{const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;data[i+3]=255;};
  for(let x=3;x<=17;x++)dark(x,6);
  dark(1,1);dark(21,2);dark(22,2);dark(10,10);
  const result=traceImageDataToSvg({width,height,data},{threshold:200,maxSegments:100,minComponentPixels:4});
  assert.match(result.svg,/M3 6\.5H18/);assert.equal(result.componentsKept,1);assert.equal(result.componentsRemoved,1);assert.equal(result.darkPixels,15);assert.equal(result.sourceDarkPixels,19);assert.equal(result.removedPixels,4);
});

test('one reference packet visibly contains original, SVG contours and structure mask panels',()=>{
  const original=native.createCanvas(20,20),contours=native.createCanvas(20,20);original.getContext('2d').fillRect(0,0,20,20);contours.getContext('2d').strokeRect(2,2,16,16);
  const reference={original,placement:[0,0,1],svgContourCanvas:contours,svgContours:{dataUrl:'data:image/svg+xml,test',width:20,height:20,method:'test-svg',threshold:200,step:1,segments:4,truncated:false}};
  const objectMap={items:[{id:'subject',name:'主体',visibleMasks:[{id:'subject-mask',polygon:[[2,2],[18,2],[18,18],[2,18]]}]}]};
  const packet=referenceBundle(reference,{objectMap,region:[0,0,20,20],scale:1,documentWidth:20,documentHeight:20});
  assert.equal(packet.rendering,'reference-bundle-original-svg-contours-structure-mask');assert.equal(packet.maskStatus,'available');assert.deepEqual(Object.keys(packet.panels),['original','contours','mask']);assert.ok(packet.dataUrl.startsWith('data:image/png;base64,'));assert.equal(packet.width,80);
});
