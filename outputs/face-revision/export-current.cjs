const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = id => JSON.parse(fs.readFileSync(path.join(root, 'logs/sessions', id + '.json'), 'utf8'));
const now = read('cee24cf3-bd4e-49b6-85f8-46fb704c98bf');
const old = read('fe8b29de-1ad7-4a0a-a742-f7c8648c40f6');
const state = now.events.findLast(e => e.tool === 'paint_get_state').result;
const strokes = now.events.findLast(e => e.tool === 'paint_get_strokes').result.commands;
if (state.revision !== 115 || strokes.length !== 217) throw Error('Unexpected revision');
function png(session, id, name) {
  const image = session.images.find(i => i.id === id);
  if (!image) throw Error('Missing image ' + id);
  fs.writeFileSync(path.join(__dirname, name), Buffer.from(image.dataUrl.split(',')[1], 'base64'));
}
png(now, now.events.find(e => e.tool === 'paint_snapshot_region').result.imageId, 'face-after.png');
png(now, now.events.find(e => e.tool === 'paint_snapshot').result.imageId, 'drawing-after.png');
png(old, old.events.find(e => e.id.endsWith('-call-416')).result.drawing.imageId, 'face-before.png');
const document = {
  version: 1, title: state.title, width: state.width, height: state.height,
  background: '#ffffff', revision: state.revision,
  layers: state.layers.map(({effectiveVisible, ...layer}) => layer),
  stages: state.stages, masks: state.masks,
  scene: {objects: state.objects, anchors: state.anchors, regions: [], occlusions: []},
  workflow: state.workflow, reviews: state.reviews, partIssues: state.partIssues,
  commands: strokes.map(command => { const c = {...command}; if(c.geometry) delete c.points; return c; })
};
fs.writeFileSync(path.join(__dirname, 'face-revision.line-atelier.json'), JSON.stringify(document));
fs.writeFileSync(path.join(__dirname, 'comparison.html'), `<!doctype html><meta charset="utf-8"><title>脸部修订 · 115</title><style>body{font:16px system-ui;margin:36px;background:#f3f3f5;color:#28252d}main{display:flex;gap:24px;flex-wrap:wrap}figure{margin:0}img{width:512px;max-width:100%;background:white}figcaption{margin:10px 0}p{max-width:900px;line-height:1.7}</style><h1>脸部修订 · 第115版</h1><p>已经实际修改眼睑、虹膜、鼻口和下颌。贴脸发束尚未修订；页面重载后恢复参考图访问被自动审批拒绝，最终局部复核尚未完成。</p><main><figure><figcaption>修改前 · 第112版</figcaption><img src="face-before.png"></figure><figure><figcaption>当前实际画布 · 第115版</figcaption><img src="face-after.png"></figure></main><p><a href="drawing-after.png">查看整图</a> · <a href="face-revision.line-atelier.json">可编辑工程</a></p>`);
console.log(JSON.stringify({revision:state.revision,commands:strokes.length,output:__dirname}));
