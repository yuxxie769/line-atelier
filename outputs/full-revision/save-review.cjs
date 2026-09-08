const fs=require('fs');
const path=require('path');
const session=JSON.parse(fs.readFileSync('logs/sessions/fe8b29de-1ad7-4a0a-a742-f7c8648c40f6.json','utf8'));
const event=session.events.findLast(e=>e.tool==='paint_prepare_review');
const out=path.join('outputs/full-revision',`review-r${event.after.revision ?? event.result.full.observation.revision}`);
fs.mkdirSync(out,{recursive:true});
const manifest={revision:event.result.full.observation.revision,images:[]};
function savePair(pair,name){
  for(const role of ['drawing','reference']){
    const info=pair[role];const data=session.images.find(i=>i.id===info.imageId);
    const file=path.join(out,`${name}-${role}.png`);
    fs.writeFileSync(file,Buffer.from(data.dataUrl.split(',')[1],'base64'));
    manifest.images.push({name,role,file:path.resolve(file),...info});
  }
}
savePair(event.result.full,'full');
savePair(event.result.mirrored,'mirror');
event.result.locals.forEach((p,i)=>savePair(p,`local-${i}`));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({out:path.resolve(out),revision:manifest.revision,images:manifest.images.length}));
