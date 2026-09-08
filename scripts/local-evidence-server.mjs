import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
export function localEvidencePlugin({directory=path.resolve('logs/sessions')}={}){
  let queue=Promise.resolve();
  const install=server=>{server.middlewares.use('/__local-evidence',async(req,res)=>{
    res.setHeader('Content-Type','application/json');
    const reply=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
    // A local-only fixed destination, never a caller-supplied filesystem path.
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return reply(403,{error:'Local same-origin requests only'});
    if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json'))return reply(405,{error:'JSON POST required'});
    try{
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>512*1024*1024)throw Error('Session exceeds 512 MiB');chunks.push(chunk);}
      const body=Buffer.concat(chunks).toString('utf8'),value=JSON.parse(body);
      if(!/^[a-f0-9-]{36}$/i.test(value.id)||value.version!==1||!Array.isArray(value.events)||!Array.isArray(value.images))throw Error('Invalid session');
      const file=path.join(directory,value.id+'.json');
      const pending=queue.then(async()=>{
        await mkdir(directory,{recursive:true});
        let old;try{old=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
        if(old&&old.events.length>value.events.length)return {path:file,status:'newer-file-retained'};
        const temporary=file+'.tmp';
        try{await writeFile(temporary,body,'utf8');await rename(temporary,file);}finally{await unlink(temporary).catch(()=>{});}
        return {path:file,status:'saved',events:value.events.length,images:value.images.length};
      });queue=pending.catch(()=>{});reply(200,await pending);
    }catch(e){reply(400,{error:e.message});}
  });};
  return {name:'local-session-evidence',configureServer:install,configurePreviewServer:install};
}
