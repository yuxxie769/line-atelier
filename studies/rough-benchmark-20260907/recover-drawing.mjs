// Rebuild accepted source geometry from the immutable log using the app's own validator.
// This is a replay artifact, not a byte-identical native export or fabricated audit history.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {blankDocument, validateDocument, validateBatch, PAINT_STAGES} from '../../app/model.js';
const root = fileURLToPath(new URL('.', import.meta.url));
const input = JSON.parse(fs.readFileSync(root+'replay-input.json','utf8'));
const log = JSON.parse(fs.readFileSync(root+'session-log.json','utf8'));
let doc = validateDocument({...blankDocument(input.new_document.width,input.new_document.height),...input.new_document,stages:PAINT_STAGES});
const selected = log.events.slice(1,56);
for (const e of selected) {
  if(e.status!=='succeeded')continue;
  const a=e.arguments;
  if(e.tool==='paint_set_plan')for(const k of ['layers','stages','title','masks'])if(k in a)doc[k]=a[k];
  if(e.tool==='paint_set_layers')for(const update of a.layers)Object.assign(doc.layers.find(l=>l.id===update.id),update);
  if(e.tool==='paint_set_phase')doc.workflow={enabled:true,phase:a.phase};
  if(e.tool==='paint_submit')doc.commands.push(...validateBatch(a.commands,doc));
  doc.revision=e.after.revision;
  if(e.tool==='paint_checkpoint'&&a.action==='save'){
    const snapshot=structuredClone({...doc,checkpoints:[]});
    doc.checkpoints.push({id:e.result.id,name:e.result.name,revision:e.result.revision,doc:snapshot});
  }
}
doc=validateDocument(doc);
if(doc.commands.length!==138||doc.checkpoints.length!==2||doc.workflow.phase!=='rough')throw Error('Replay mismatch');
const canonical=JSON.stringify(doc.commands.map(c=>[c.id,c.geometry,c.color,c.width,c.layer,c.stage,c.subphase,c.part]));
let hash=2166136261;
for(let i=0;i<canonical.length;i++)hash=Math.imul(hash^canonical.charCodeAt(i),16777619)>>>0;
// Observed from the live app's complete revision-7 compact command export.
if(hash.toString(16)!=='3e7dfc49'||canonical.length!==22286)throw Error('Live geometry projection mismatch');
fs.writeFileSync(root+'replay-verification.json',JSON.stringify({revision:7,commands:138,projectionFields:['id','geometry','color','width','layer','stage','subphase','part'],liveFnv1a:'3e7dfc49',reconstructedFnv1a:hash.toString(16),serializedLength:canonical.length,match:true,note:'Non-cryptographic cross-check of command geometry and rendering attributes; not a byte-identical full-document export.'},null,2));
const result={...doc,replayProvenance:{sessionId:log.id,firstCall:2,lastCall:56,note:'Accepted drawing geometry, layers and checkpoints reconstructed from the session log. Original audit history remains in session-log.json; no quality pass is inferred.'}};
fs.writeFileSync(root+'rough-replay.line.json',JSON.stringify(result));
console.log(JSON.stringify({validated:true,strokes:doc.commands.length,checkpoints:doc.checkpoints.map(c=>({name:c.name,count:c.doc.commands.length})),phase:doc.workflow.phase}));
