const fs=require('fs'),path=require('path');
const session=JSON.parse(fs.readFileSync('logs/sessions/fe8b29de-1ad7-4a0a-a742-f7c8648c40f6.json','utf8'));
const events=session.events.filter(e=>e.tool==='paint_observe_review'&&e.result?.observation?.revision===112);
const out='outputs/full-revision/review-r112';fs.mkdirSync(out,{recursive:true});
const names={'0,0,600,849':'full','129,79,308,755':'body','93,231,495,438':'costume','267,176,141,113':'face','133,707,91,127':'shoe','363,606,72,68':'wrist'};
const manifest={revision:112,workflowPhase:'refine',context:'1F round-two corrective revision, awaiting final independent review',images:[]};
function save(info,file){const image=session.images.find(i=>i.id===info.imageId);fs.writeFileSync(file,Buffer.from(image.dataUrl.split(',')[1],'base64'));}
const latest=new Map();for(const e of events){const name=e.result.observation.mirror?'mirror':names[e.result.observation.region.join()];if(name)latest.set(name,e.result);}
for(const [name,pair] of latest)for(const role of ['reference','drawing']){const file=path.join(out,`${name}-${role}.png`);save(pair[role],file);manifest.images.push({name,role,file:path.resolve(file),...pair[role]});}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
for(const [suffix,name] of [['1','before-test.png'],['70','refined-r90.png']]){const im=session.images.find(i=>i.id.endsWith('-image-'+suffix));fs.writeFileSync(path.join('outputs/full-revision',name),Buffer.from(im.dataUrl.split(',')[1],'base64'));}
console.log(JSON.stringify({directory:path.resolve(out),images:manifest.images.length}));
