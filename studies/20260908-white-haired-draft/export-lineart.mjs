// Serialize the recorded, successful app operations; no new drawing or image rendering.
import fs from 'node:fs';
import {validateDocument, blankDocument} from '../../app/model.js';
import {exportDocumentData} from '../../app/document-export.js';
const log = JSON.parse(fs.readFileSync(new URL('../../logs/sessions/0364457c-6dfc-49bf-b994-9615847b56fe.json', import.meta.url), 'utf8'));
let doc;
for (const e of log.events) {
  if (e.status !== 'succeeded') continue;
  const a=e.arguments, r=e.result;
  if(e.tool==='paint_new_document') doc=validateDocument({...blankDocument(a.width,a.height),...a});
  if(!doc) continue;
  if(e.tool==='paint_set_plan') doc=validateDocument({...doc,...a});
  if(e.tool==='paint_set_layers') doc=validateDocument({...doc,layers:doc.layers.map(l=>({...l,...(a.layers.find(p=>p.id===l.id)||{})}))});
  if(e.tool==='paint_set_phase') doc.workflow={enabled:a.enabled??true,phase:a.phase};
  if(e.tool==='paint_submit') doc=validateDocument({...doc,commands:[...doc.commands,...a.commands]});
  if(e.tool==='paint_revise') {
    let commands=doc.commands.filter(c=>!(a.remove||[]).includes(c.id)).map(c=>{
      const p=(a.replace||[]).find(p=>p.id===c.id);if(!p)return c;
      const updated={...c,...p};if(p.path){delete updated.geometry;delete updated.points;}return updated;
    });
    for(const ins of a.insert||[])commands.splice(commands.findIndex(c=>c.id===ins.beforeId),0,...ins.commands);
    doc=validateDocument({...doc,commands});
  }
  doc.revision=e.after.revision;
  for(const review of doc.reviews) if(review.revision!==doc.revision)review.stale=true;
  if(e.tool==='paint_record_review')doc.reviews.push(structuredClone(r));
  if(e.tool==='paint_record_inspection')doc.visualChecks.push(structuredClone(r));
  if(e.tool==='paint_update_issue'){
    doc.partIssues=doc.partIssues.filter(i=>i.id!==r.id);doc.partIssues.push(structuredClone(r));
  }
  if(e.tool==='paint_checkpoint'&&a.action==='save'){
    const snapshot=structuredClone(doc);snapshot.checkpoints=[];
    doc.checkpoints.push({id:r.id,name:r.name,revision:r.revision,doc:snapshot});
  }
}
const out=exportDocumentData(validateDocument(doc),{compact:true,includeCheckpoints:true});
const signature=d=>JSON.stringify({revision:d.revision,workflow:d.workflow,layers:d.layers,stages:d.stages,commands:d.commands.map(c=>[c.id,c.type,c.layer,c.stage,c.color,c.width,c.opacity,c.closed,c.subphase,c.part,c.geometry]),checkpoints:d.checkpoints.map(c=>[c.id,c.name,c.revision,c.doc.commands.length])});
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(16);};
const s=signature(out);
if(hash(s)!==process.argv[2]||s.length!==Number(process.argv[3]))throw Error('Export differs from current WebMCP document: '+hash(s)+' / '+s.length);
const commandSignature=JSON.stringify(out.commands);
if(process.argv[5]&&(hash(commandSignature)!==process.argv[5]||commandSignature.length!==Number(process.argv[6])))throw Error('Full stroke data differs from WebMCP: '+hash(commandSignature)+' / '+commandSignature.length);
const prefix=process.argv[4]||'1F-lineart';
fs.writeFileSync(new URL(prefix+'.line.json',import.meta.url),JSON.stringify(out));
const event=log.events.filter(e=>e.tool==='paint_observe_review'&&e.arguments.region[2]===600&&!e.arguments.mirror&&e.arguments.scale===1).at(-1);
const im=log.images.find(i=>i.id===event.images.find(i=>i.path==='result.drawing').id);
fs.writeFileSync(new URL(prefix+'.png',import.meta.url),Buffer.from(im.dataUrl.split(',')[1],'base64'));
console.log(JSON.stringify({revision:out.revision,phase:out.workflow.phase,commands:out.commands.length,checkpoints:out.checkpoints.map(c=>c.name),hash:hash(s),pngSha256:im.sha256}));
