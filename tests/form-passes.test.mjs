import test from 'node:test';
import assert from 'node:assert/strict';
import {formPass} from '../dist/form-passes.js';
import {blankDocument,validateBatch} from '../dist/model.js';

test('form brushes follow a curved guide and never substitute dots or horizontal scans',()=>{
 const width=100,height=160,data=new Uint8ClampedArray(width*height*4).fill(255),painted={data:data.slice()};
 for(let y=12;y<148;y++)for(let x=0;x<100;x++){const center=30+y*y/480;if(Math.abs(x-center)<13){const i=(y*width+x)*4;data[i]=218;data[i+1]=143;data[i+2]=126;}}
 const options={guides:[[[30,12],[34,45],[44,80],[58,116],[74,147]]],brush:10,minLength:8,tolerance:20};
 const result=formPass({width,height,data},painted,options);
 assert.ok(result.commands.length>0);validateBatch(result.commands,blankDocument(width,height));
 for(const c of result.commands){assert.equal(c.type,'stroke');const length=c.points.reduce((s,p,i)=>i?s+Math.hypot(p[0]-c.points[i-1][0],p[1]-c.points[i-1][1]):0,0);assert.ok(length>=7.98);}
 assert.ok(result.commands.some(c=>Math.abs(c.points.at(-1)[1]-c.points[0][1])>40));
 assert.deepEqual(formPass({width,height,data},painted,options),result,'same image and directions replay deterministically');
 assert.throws(()=>formPass({width,height,data},painted,{minLength:0}));
});
