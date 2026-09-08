import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {localEvidencePlugin} from '../scripts/local-evidence-server.mjs';
import {createLocalEvidenceWriter} from '../app/local-evidence.js';
const session=()=>({version:1,id:crypto.randomUUID(),events:[{id:'call',images:[{id:'png'}]}],images:[{id:'png',dataUrl:'data:image/png;base64,AA=='}],persistence:'saved'});
test('local server saves unchanged full payload including PNGs, prevents regressive writes and rejects foreign origins/paths',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'atelier-evidence-'));let handler;
  localEvidencePlugin({directory}).configureServer({middlewares:{use:(_,fn)=>{handler=fn;}}});
  const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const send=(v,headers={})=>fetch(base,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(v)});
  try{
    const value=session();assert.equal((await send(value)).status,200);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory,value.id+'.json'),'utf8')),value);
    await send({...value,events:[]});assert.equal(JSON.parse(await readFile(path.join(directory,value.id+'.json'),'utf8')).events.length,1);
    assert.equal((await send({...value,id:'../../escape'})).status,400);
    assert.equal((await send(value,{Origin:'https://foreign.example'})).status,403);
  }finally{await new Promise(r=>server.close(r));assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep));await rm(directory,{recursive:true,force:true});}
});
test('transport retries failures and keeps newer pending images without changing log schema',async()=>{
  let fail=true;const saved=[];
  const writer=createLocalEvidenceWriter({fetcher:async(_,o)=>{if(fail)throw Error('offline');saved.push(JSON.parse(o.body));return {ok:true,json:async()=>({path:'logs/session.json'})};}});
  const value=session();await writer.enqueue(value);assert.equal(writer.state().status,'pending');assert.equal(writer.state().pending,1);
  value.events.push({id:'call-2'});await writer.enqueue(value);fail=false;await writer.flush();
  assert.deepEqual(saved,[value]);assert.equal(writer.state().pending,0);assert.equal(writer.state().status,'saved');
});
