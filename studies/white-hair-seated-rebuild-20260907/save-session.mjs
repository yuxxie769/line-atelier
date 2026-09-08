import fs from 'node:fs';
import {blankDocument,validateDocument,validateBatch} from '../../app/model.js';
import {geometryPatch} from '../../app/geometry.js';
import {localWidthProfile} from '../../app/pressure.js';
import {exportDocumentData} from '../../app/document-export.js';
const session=JSON.parse(fs.readFileSync(new URL('../../logs/sessions/43106c18-2d1e-44da-8de1-c02ed53153d2.json',import.meta.url),'utf8'));
let doc;
for(const event of session.events){
 if(event.status!=='succeeded')continue;
 const a=event.arguments||{}, name=event.tool;
 if(name==='paint_new_document')doc=validateDocument({...blankDocument(a.width,a.height),...a});
 if(!doc)continue;
 if(name==='paint_set_plan')doc=validateDocument({...doc,...a});
 if(name==='paint_set_scene'){
  const scene={...doc.scene};for(const k of ['objects','anchors','regions','occlusions'])if(a[k])scene[k]=a[k];
  doc=validateDocument({...doc,scene});
 }
 if(name==='paint_set_layers'){
  for(const p of a.layers)Object.assign(doc.layers.find(l=>l.id===p.id),p);
  doc=validateDocument(doc);
 }
 if(name==='paint_set_phase')doc.workflow={enabled:a.enabled??true,phase:a.phase};
 if(name==='paint_submit')doc.commands.push(...validateBatch(a.commands,doc,a));
 if(name==='paint_revise'){
  const replacements=new Map((a.replace||[]).map(p=>[p.id,p]));
  doc.commands=doc.commands.filter(c=>!(a.remove||[]).includes(c.id)).map(c=>replacements.has(c.id)?geometryPatch(c,replacements.get(c.id)):c);
  for(const ins of a.insert||[])doc.commands.splice(doc.commands.findIndex(c=>c.id===ins.beforeId),0,...ins.commands);
  doc=validateDocument(doc);
 }
 if(name==='paint_edit_pressure'){
  doc.commands=doc.commands.map(c=>a.ids.includes(c.id)?geometryPatch(c,{id:c.id,...localWidthProfile(c,a)}):c);
  doc=validateDocument(doc);
 }
 const revision=event.after?.revision??doc.revision;
 if(revision!==doc.revision){doc.reviews=doc.reviews.map(r=>({...r,stale:true}));doc.revision=revision;}
 if(name==='paint_record_review')doc.reviews.push(structuredClone(event.result));
 if(name==='paint_checkpoint'&&a.action==='save'){
  const {checkpoints,...snapshot}=structuredClone(doc);
  const {localFeedback,...metadata}=event.result;
  doc.checkpoints.push({...metadata,doc:{...snapshot,checkpoints:[]}});
 }
}
const exported=exportDocumentData(doc,{compact:true,includeCheckpoints:true});
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const signature=v=>{const s=JSON.stringify(canonical(v));let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return {length:s.length,fnv:(h>>>0).toString(16)};};
const check=signature(exported.commands);
console.log(JSON.stringify({commands:exported.commands.length,signature:check,checkpoints:exported.checkpoints.map(c=>({name:c.name,signature:signature(c.doc.commands)}))},null,2));
if(check.length!==94321||check.fnv!=='9d39388b')throw Error('Export differs from the actual browser tool export');
fs.writeFileSync(new URL('seated-lineart.line.json',import.meta.url),JSON.stringify(exported));
const png=session.images.find(i=>i.id.endsWith('-image-67'));
if(!png)throw Error('Missing final high resolution snapshot');
fs.writeFileSync(new URL('seated-lineart-1200x1698.png',import.meta.url),Buffer.from(png.dataUrl.split(',')[1],'base64'));
fs.writeFileSync(new URL('verification.json',import.meta.url),JSON.stringify({sessionId:session.id,revision:doc.revision,commands:doc.commands.length,signature:check,imageSha256:png.sha256,source:'Saved WebMCP calls; geometry checked against paint_export_document; PNG is the actual paint_snapshot_region result.'},null,2));
