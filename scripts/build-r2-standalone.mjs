import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {syncDrawingProtocol} from './sync-drawing-protocol.mjs';
await syncDrawingProtocol();
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const doc=JSON.parse(await read('archive/data/line-atelier-v4-r2.line.json'));
const reference='data:image/png;base64,'+(await readFile(new URL('archive/images/reference.png',root))).toString('base64');
let script='const EMBEDDED_STUDY='+JSON.stringify(doc).replace(/</g,'\\u003c')+';\nconst EMBEDDED_REFERENCE='+JSON.stringify(reference)+';\n';
for(const file of ['drawing-protocol.generated.js','drawing-protocol.js','session-evidence.js','smoothing.js','geometry.js','pressure.js','model.js','renderer.js','reference.js','document-export.js','connections.js','diagnostics.js','engine.js','drawing-assist.js','drawing-context.js','viewport-renderer.js','app.js']){
  script+=(await read('app/'+file)).replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')+'\n';
}
script=script.replaceAll("fetch('./data/r3-study.line.json')","Promise.resolve({ok:true,json:async()=>structuredClone(EMBEDDED_STUDY)})")
  .replaceAll("'./assets/reference-r3.jpg'",'EMBEDDED_REFERENCE')
  .replaceAll("'line-atelier-v4-r3'","'line-atelier-v4-r2-standalone'");
const css=await read('app/styles.css');
let html=(await read('app/index.html'))
  .replace('<link rel="icon" href="./favicon.svg" type="image/svg+xml">','')
  .replace('<link rel="stylesheet" href="./styles.css">',()=>'<style>'+css+'</style>')
  .replace('<script type="module" src="./app.js"></script>',()=>'<script type="module">'+script.replace(/<\/script/gi,'<\\/script')+'</script>')
  .replace('href="./releases/line-atelier-v4-r3-standalone.html"','href=""')
  .replace('href="./" aria-label="Line Atelier 首页"','href="https://line-atelier.yuxxie.chatgpt.site" aria-label="Line Atelier 首页"');
for(const name of ['agent-guide.md','workflow-principles.md','drawing-tools.md','r2-drawing-notes.md']){
  const body=await read(name==='r2-drawing-notes.md'?'archive/docs/'+name:'app/docs/'+name);
  html=html.replaceAll('href="./docs/'+name+'"','download="'+name+'" href="data:text/markdown;charset=utf-8,'+encodeURIComponent(body)+'"');
}
await mkdir(new URL('downloads/',root),{recursive:true});
for(const folder of ['downloads','releases'])await writeFile(new URL(folder+'/line-atelier-v4-r2-standalone.html',root),html);
console.log('R2 standalone: '+doc.commands.length+' strokes; '+doc.checkpoints.length+' checkpoints.');
