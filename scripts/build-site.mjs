import {cp,mkdir,rm} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const output=new URL('dist/',root);

await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(new URL('app/',root),output,{recursive:true});
await cp(new URL('releases/',root),new URL('releases/',output),{recursive:true});

console.log('Staged app/ and releases/ into dist/.');
