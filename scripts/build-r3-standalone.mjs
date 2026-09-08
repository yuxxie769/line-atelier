import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {syncDrawingProtocol} from './sync-drawing-protocol.mjs';
await syncDrawingProtocol();
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const doc=JSON.parse(await read('app/data/r3-study.line.json'));
const reference='data:image/jpeg;base64,'+(await readFile(new URL('app/assets/reference-r3.jpg',root))).toString('base64');
const cardImageBase='app/docs/anatomy-card-assets-clipstudio-11661/v1-source-mirror/';
const cardImages={};
for(const name of (await readdir(new URL(cardImageBase,root))).filter(name=>/^\d{3}-body-\d+\.jpg$/.test(name)).sort())cardImages['/docs/anatomy-card-assets-clipstudio-11661/v1-source-mirror/'+name]='data:image/jpeg;base64,'+(await readFile(new URL(cardImageBase+name,root))).toString('base64');
let script='const EMBEDDED_STUDY='+JSON.stringify(doc).replace(/</g,'\\u003c')+';\nconst EMBEDDED_REFERENCE='+JSON.stringify(reference)+';\nglobalThis.EMBEDDED_REFERENCE_CARD_IMAGES=Object.freeze('+JSON.stringify(cardImages)+');\n';
for(const file of ['drawing-protocol.generated.js','drawing-protocol.js','session-evidence.js','local-evidence.js','local-feedback.js','visual-inspection.js','review-evidence.js','smoothing.js','geometry.js','pressure.js','model.js','renderer.js','reference.js','document-export.js','connections.js','diagnostics.js','engine.js','drawing-assist.js','drawing-context.js','viewport-renderer.js','app.js']){
  const source=await read('app/'+file);
  const names=[...source.matchAll(/^export (?:async )?(?:function|class|const|let) (\w+)/gm)].map(m=>m[1]);
  const body=source.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'');
  // Retain module-local scopes: helpers like bounds/copy can share names safely.
  script+=names.length?`const {${names.join(',')}}=(()=>{\n${body}\nreturn {${names.join(',')}};})();\n`:`await (async()=>{\n${body}\n})();\n`;
}
script=script.replaceAll("fetch('./data/r3-study.line.json')","Promise.resolve({ok:true,json:async()=>structuredClone(EMBEDDED_STUDY)})")
  .replaceAll("'./assets/reference-r3.jpg'",'EMBEDDED_REFERENCE')
  .replaceAll("'line-atelier-v4-r3'","'line-atelier-v4-r3-standalone'");
const css=await read('app/styles.css');
const syntax=spawnSync(process.execPath,['--input-type=module','--check'],{input:script,encoding:'utf8'});
if(syntax.status!==0)throw Error('Standalone JavaScript syntax failed: '+syntax.stderr);
let html=(await read('app/index.html'))
  .replace('<link rel="icon" href="./favicon.svg" type="image/svg+xml">','')
  .replace('<link rel="stylesheet" href="./styles.css">',()=>'<style>'+css+'</style>')
  .replace('<script type="module" src="./app.js"></script>',()=>'<script type="module">'+script.replace(/<\/script/gi,'<\\/script')+'</script>')
  .replace('href="./releases/line-atelier-v4-r3-standalone.html"','href=""')
  .replace('href="./" aria-label="Line Atelier 首页"','href="https://line-atelier.yuxxie.chatgpt.site" aria-label="Line Atelier 首页"');
for(const name of ['agent-guide.md','workflow-principles.md','drawing-tools.md','r3-drawing-notes.md']){
  const body=await read('app/docs/'+name);
  html=html.replaceAll('href="./docs/'+name+'"','download="'+name+'" href="data:text/markdown;charset=utf-8,'+encodeURIComponent(body)+'"');
}
await mkdir(new URL('downloads/',root),{recursive:true});
for(const folder of ['downloads','releases'])await writeFile(new URL(folder+'/line-atelier-v4-r3-standalone.html',root),html);
console.log('R3 standalone: '+doc.commands.length+' strokes; '+doc.checkpoints.length+' checkpoints.');
