import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const doc=JSON.parse(await read('dist/line-atelier-v4-r3.line.json'));
const reference='data:image/jpeg;base64,'+(await readFile(new URL('dist/reference-r3.jpg',root))).toString('base64');
let script='const EMBEDDED_STUDY='+JSON.stringify(doc).replace(/</g,'\\u003c')+';\nconst EMBEDDED_REFERENCE='+JSON.stringify(reference)+';\n';
for(const file of ['geometry.js','pressure.js','model.js','renderer.js','reference.js','document-export.js','connections.js','diagnostics.js','engine.js','drawing-assist.js','viewport-renderer.js','app.js']){
  script+=(await read('dist/'+file)).replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')+'\n';
}
script=script.replaceAll("fetch('./line-atelier-v4-r3.line.json')","Promise.resolve({ok:true,json:async()=>structuredClone(EMBEDDED_STUDY)})")
  .replaceAll("'./reference-r3.jpg'",'EMBEDDED_REFERENCE')
  .replaceAll("'line-atelier-v4-r3'","'line-atelier-v4-r3-standalone'");
const css=await read('dist/styles.css');
let html=(await read('dist/index.html'))
  .replace('<link rel="icon" href="./favicon.svg" type="image/svg+xml">','')
  .replace('<link rel="stylesheet" href="./styles.css">',()=>'<style>'+css+'</style>')
  .replace('<script type="module" src="./app.js"></script>',()=>'<script type="module">'+script.replace(/<\/script/gi,'<\\/script')+'</script>')
  .replace('href="./line-atelier-v4-r3.html"','href=""')
  .replace('href="./line-atelier-v4-r2.html"','href="https://line-atelier.yuxxie.chatgpt.site/line-atelier-v4-r2.html"')
  .replace('href="./line-atelier-v4-line-tools.html"','href="https://line-atelier.yuxxie.chatgpt.site/line-atelier-v4-line-tools.html"')
  .replace('href="./" aria-label="Line Atelier 首页"','href="https://line-atelier.yuxxie.chatgpt.site" aria-label="Line Atelier 首页"');
for(const name of ['agent-guide.md','workflow-principles.md','drawing-tools.md','r3-drawing-notes.md']){
  const body=await read('dist/'+name);
  html=html.replaceAll('href="./'+name+'"','download="'+name+'" href="data:text/markdown;charset=utf-8,'+encodeURIComponent(body)+'"');
}
await mkdir(new URL('downloads/',root),{recursive:true});
for(const folder of ['downloads','dist'])await writeFile(new URL(folder+'/line-atelier-v4-r3.html',root),html);
console.log('R3 standalone: '+doc.commands.length+' strokes; '+doc.checkpoints.length+' checkpoints.');
