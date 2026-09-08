const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const log = JSON.parse(fs.readFileSync('logs/sessions/fe8b29de-1ad7-4a0a-a742-f7c8648c40f6.json', 'utf8'));
const stateEvent = log.events.findLast(e => e.tool === 'paint_get_state');
const strokeEvent = log.events.findLast(e => e.tool === 'paint_get_strokes');
const s = stateEvent.result;
if (s.revision !== 112 || strokeEvent.after.revision !== 112) throw Error('Revision mismatch');
const commands = strokeEvent.result.commands.map(c => { const x = {...c}; if (x.geometry) delete x.points; return x; });
if (commands.length !== 214 || new Set(commands.map(c => c.id)).size !== 214) throw Error('Incomplete strokes');
const doc = {
  version: 1, title: s.title, width: s.width, height: s.height, background: '#ffffff',
  layers: s.layers.map(({effectiveVisible,...layer}) => layer), stages: s.stages, masks: s.masks,
  scene: {objects: s.objects, anchors: s.anchors, regions: [], occlusions: []},
  revision: s.revision, workflow: s.workflow, partIssues: s.partIssues,
  reviews: s.reviews, commands, checkpoints: []
};
const out = 'outputs/full-revision';
fs.writeFileSync(path.join(out, 'final-editable.line.json'), JSON.stringify(doc));
fs.copyFileSync(path.join(out, 'review-r112/full-drawing.png'), path.join(out, 'final-lineart.png'));
const review = s.reviews.slice(-2).map(({kind,status,stale,revision,note,observationIds}) => ({kind,status,stale,revision,note,observationIds}));
if (review.some(r => r.status !== 'pass' || r.stale || r.revision !== 112)) throw Error('Final review not current');
const diagnostic = log.events.filter(e => ['paint_scan_gaps','paint_preview_leak'].includes(e.tool) && e.after.revision === 112).map(e => ({tool:e.tool,args:e.arguments,result:e.result}));
fs.writeFileSync(path.join(out,'completion-record.json'),JSON.stringify({revision:112,phase:s.workflow.phase,review,diagnostic,files:['final-lineart.png','final-editable.line.json'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(out,file))).digest('hex')}))},null,2));
console.log(JSON.stringify({revision:112,commands:commands.length,layers:doc.layers.length,review,output:path.resolve(out)},null,2));
