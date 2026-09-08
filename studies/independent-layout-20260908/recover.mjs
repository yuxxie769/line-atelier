// Reconstruct editable geometry, not a byte-identical export or fabricated audit record.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateDocument,validateBatch} from '../../app/model.js';
const root=fileURLToPath(new URL('.',import.meta.url));
let doc=JSON.parse(fs.readFileSync(root+'baseline.line.json','utf8'));
const baseline=structuredClone(doc);
const log=JSON.parse(fs.readFileSync(root+'session-log.json','utf8'));
const event=log.events.find(e=>e.id.endsWith('-call-66'));
for(const patch of event.arguments.replace){
  const index=doc.commands.findIndex(c=>c.id===patch.id);
  const old=doc.commands[index];
  const input={...old,...patch};
  delete input.geometry; delete input.points;
  doc.commands[index]=validateBatch([input],{...doc,commands:doc.commands.filter(c=>c.id!==patch.id)})[0];
}
doc.revision=3;
doc=validateDocument(doc);
const projection=JSON.stringify(doc.commands.map(c=>[c.id,c.geometry,c.color,c.width,c.layer,c.stage,c.subphase,c.part]));
let hash=2166136261;
for(let i=0;i<projection.length;i++)hash=Math.imul(hash^projection.charCodeAt(i),16777619)>>>0;
if(hash.toString(16)!=='baad18b3'||projection.length!==4361)throw Error('Live command geometry mismatch');
const changed=doc.commands.filter((c,i)=>JSON.stringify(c)!==JSON.stringify(baseline.commands[i])).map(c=>c.id);
if(JSON.stringify(changed)!==JSON.stringify(['nearlegaxis','nearshin','nearfoot']))throw Error('Unexpected changed commands');
doc.replayProvenance={sessionId:log.id,repairCall:event.id,note:'Geometry reconstructed from isolated baseline and successful revision. Audit evidence retained separately in session-log.json and independent review reports. Import requires fresh observation; no pass inferred.'};
fs.writeFileSync(root+'after-replay.line.json',JSON.stringify(doc));
fs.writeFileSync(root+'replay-verification.json',JSON.stringify({revision:3,count:27,fnv1a:hash.toString(16),length:projection.length,match:true,changedIds:event.arguments.replace.map(c=>c.id),note:'Matches live revision-3 compact command geometry/rendering projection; non-cryptographic check, not full native export.'},null,2));
console.log('Verified 27 commands at revision 3; three changed IDs.');
