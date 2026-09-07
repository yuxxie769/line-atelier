import {cp,mkdir,rm} from 'node:fs/promises';
import {syncDrawingProtocol} from './sync-drawing-protocol.mjs';

const root=new URL('../',import.meta.url);
const output=new URL('dist/',root);

await syncDrawingProtocol();
// The downloadable R3 workbench must ship the same protocol as the live app.
await import('./build-r3-standalone.mjs');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(new URL('app/',root),output,{recursive:true});
await cp(new URL('releases/',root),new URL('releases/',output),{recursive:true});

console.log('Staged app/ and releases/ into dist/.');
