import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const doc=JSON.parse(await read('dist/structure-repair-study.line.json'));
const reference='data:image/png;base64,'+(await readFile(new URL('dist/reference.png',root))).toString('base64');
const guide=await read('dist/agent-guide.md');
let script='const EMBEDDED_STUDY='+JSON.stringify(doc).replace(/</g,'\\u003c')+';\nconst EMBEDDED_REFERENCE='+JSON.stringify(reference)+';\n';
for(const file of ['geometry.js','pressure.js','model.js','renderer.js','reference.js','document-export.js','connections.js','diagnostics.js','engine.js','drawing-assist.js','app.js'])script+=(await read('dist/'+file)).replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')+'\n';
script=script.replaceAll("fetch('./structure-repair-study.line.json')","Promise.resolve({ok:true,json:async()=>structuredClone(EMBEDDED_STUDY)})").replaceAll("'./reference.png'",'EMBEDDED_REFERENCE');
let html=(await read('dist/index.html')).replace('<link rel="icon" href="./favicon.svg" type="image/svg+xml">','').replace('<link rel="stylesheet" href="./styles.css">','<style>'+await read('dist/styles.css')+'</style>');
html=html.replace('<script type="module" src="./app.js"></script>',()=>'<script type="module">'+script.replace(/<\/script/gi,'<\\/script')+'</script>');
html=html.replaceAll('href="./agent-guide.md"','download="line-atelier-agent-guide.md" href="data:text/markdown;charset=utf-8,'+encodeURIComponent(guide)+'"');
html=html.replace('href="./line-atelier-v4-line-tools.html"','href=""').replace('href="./structure-comparison.html"','href="https://line-atelier.yuxxie.chatgpt.site/structure-comparison.html"');
for(const name of ['workflow-principles.md','drawing-tools.md']){const body=await read('dist/'+name);html=html.replaceAll('href="./'+name+'"','download="'+name+'" href="data:text/markdown;charset=utf-8,'+encodeURIComponent(body)+'"');}
await mkdir(new URL('downloads/',root),{recursive:true});
await writeFile(new URL('downloads/line-atelier-v4-line-tools.html',root),html);
await writeFile(new URL('dist/line-atelier-v4-line-tools.html',root),html);
console.log('Standalone HTML written; '+doc.commands.length+' stroke records.');
