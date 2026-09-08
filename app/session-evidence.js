// Call evidence lives beside the artwork, never in its undo/history model.
const copy=value=>structuredClone(value);
const intersects=(a,b)=>!a||!b||a[0]<=b[0]+b[2]&&b[0]<=a[0]+a[2]&&a[1]<=b[1]+b[3]&&b[1]<=a[1]+a[3];
function bounds(strokes){
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for(const c of strokes)for(const p of c.points||[]){x=Math.min(x,p[0]);y=Math.min(y,p[1]);right=Math.max(right,p[0]);bottom=Math.max(bottom,p[1]);}
  return Number.isFinite(x)?[x,y,right-x,bottom-y]:null;
}
function basisValue(value){
  if(value===undefined)return null;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('basis 必须是对象');
  if(value.guideIds!==undefined&&(!Array.isArray(value.guideIds)||value.guideIds.length>200||value.guideIds.some(id=>typeof id!=='string')))throw Error('basis.guideIds 需要最多 200 个笔迹 ID');
  if(value.note!==undefined&&(typeof value.note!=='string'||value.note.length>1000))throw Error('basis.note 需要最多 1000 字的简短说明');
  return {guideIds:[...new Set(value.guideIds||[])],note:value.note||''};
}
function referenceCardValue(value){
  if(!value||typeof value!=='object'||typeof value.id!=='string')return null;
  return {id:value.id,title:value.title,purpose:value.purpose,source:value.source,sha256:value.sha256,phases:copy(value.phases||[]),totalImages:value.totalImages,images:(value.images||[]).map(image=>({index:image.index,name:image.name,source:image.source,publicPath:image.publicPath}))};
}
async function pngHash(dataUrl){
  const bytes=Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',')+1)),c=>c.charCodeAt(0));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
}
export function createSessionEvidence(engine,{save=async()=>{},now=()=>new Date().toISOString()}={}){
  const session={version:1,id:crypto.randomUUID(),startedAt:now(),events:[],images:[],persistence:'memory'};
  let queue=Promise.resolve(),epoch=0;
  const state=()=>({revision:engine.doc.revision,cursor:engine.cursor,total:engine.index.total,playing:engine.playing,title:engine.doc.title,width:engine.doc.width,height:engine.doc.height});
  async function summarize(value,event,path='result'){
    if(!value||typeof value!=='object')return value;
    if(Array.isArray(value))return Promise.all(value.map((v,i)=>summarize(v,event,path+'.'+i)));
    const result={};
    for(const [key,item] of Object.entries(value)){
      if(key==='dataUrl'&&typeof item==='string'&&item.startsWith('data:image/png;base64,')){
        const sha256=await pngHash(item);
        let image=session.images.find(i=>i.sha256===sha256);
        if(!image){image={id:session.id+'-image-'+(session.images.length+1),sha256,mimeType:'image/png',dataUrl:item};session.images.push(image);}
        const region=value.region||event.resultRegion||null;
        const imageRevision=value.evidenceRole==='before-drawing'&&Number.isInteger(value.revision)?value.revision:event.before.revision;
        const referenceOnly=['paint_get_reference','paint_prepare_reference','paint_preview_revision'].includes(event.tool)||event.arguments.source&&event.arguments.source!=='drawing'||/\.reference(?:\.|$)/.test(path);
        const groupIds=referenceOnly?[]:session.events.filter(e=>e.groupId&&e.status==='succeeded'&&e.epoch===epoch&&e.after.revision<=imageRevision&&intersects(region,e.strokeBounds)).map(e=>e.groupId);
        const ref={id:image.id,sha256,path,region,width:value.width,height:value.height,scale:value.scale,mirror:value.mirror,panels:value.panels,imageToDocument:value.imageToDocument,
          revision:imageRevision,playback:value.evidenceRole==='before-drawing'?null:copy(event.before),evidenceRole:value.evidenceRole||'current',groupIds,association:'revision-and-region-candidate',visualObservation:'requires-conversation-image-evidence'};
        event.images.push(ref);result.imageId=image.id;result.sha256=sha256;
      }else result[key]=await summarize(item,event,path+'.'+key);
    }
    return result;
  }
  async function invoke(tool,args,execute,entryPoint){
    const grouped=['paint_submit','paint_revise'].includes(tool);
    const startedAt=now();
    const event={id:session.id+'-call-'+(session.events.length+1),tool,entryPoint,startedAt,epoch,before:state(),status:'running',arguments:copy(args||{}),images:[]};
    const previousImageRead=[...session.events].reverse().find(candidate=>candidate.imageRead&&!candidate.nextAction);
    if(previousImageRead){
      const delayMs=Math.max(0,Date.parse(startedAt)-Date.parse(previousImageRead.imageRead.completedAt));
      previousImageRead.nextAction={callId:event.id,tool,entryPoint,startedAt,delayMs};
      event.sinceImageRead={callId:previousImageRead.id,tool:previousImageRead.tool,completedAt:previousImageRead.imageRead.completedAt,delayMs};
    }
    if(grouped)event.groupId=session.id+'-group-'+(session.events.filter(e=>e.groupId).length+1);
    session.events.push(event);
    let result,error;
    const oldCommands=grouped?new Map(engine.doc.commands.map(c=>[c.id,copy(c)])):null;
    try{
      if(grouped){
        event.basis=basisValue(args?.basis);event.basisStatus=event.basis?'provided':'not-provided';
        event.basisReads=(event.basis?.guideIds||[]).map(id=>({id,callIds:session.events.filter(e=>e.id!==event.id&&e.epoch===epoch&&e.returnedStrokeIds?.includes(id)).map(e=>e.id)}));
      }
      result=await execute(args||{});
      event.status='succeeded';event.after=state();
      if(tool==='paint_get_reference_card')event.referenceCard=referenceCardValue(result);
      if(grouped){
        event.acceptedStrokes=engine.doc.commands.filter(c=>!oldCommands.has(c.id)||JSON.stringify(c)!==JSON.stringify(oldCommands.get(c.id))).map(copy);
        event.strokeIds=event.acceptedStrokes.map(c=>c.id);
        event.removedStrokeIds=[...oldCommands.keys()].filter(id=>!engine.doc.commands.some(c=>c.id===id));
        event.strokeBounds=bounds([...event.acceptedStrokes,...event.removedStrokeIds.map(id=>oldCommands.get(id))]);
      }
      const returnedStrokes=result?.strokes||result?.commands;
      event.returnedStrokeIds=Array.isArray(returnedStrokes)?returnedStrokes.filter(c=>c&&typeof c==='object').map(c=>c.id):[];
      event.returnedAnchorIds=(result?.anchors||[]).map(a=>a.id);
      event.resultRegion=result?.region||args?.region||null;
      event.referenceStatus=result?.referenceStatus;
      event.result=await summarize(event.referenceCard?{referenceCard:event.referenceCard}:result,event);
    }catch(e){
      if(event.status==='succeeded'){event.evidenceError=e.message;}
      else {error=e;event.status='failed';event.error=e.message;event.after=state();}
    }
    event.finishedAt=now();
    const referenceImages=event.referenceCard?.images||[];
    if(event.status==='succeeded'&&(event.images.length||referenceImages.length))event.imageRead={
      completedAt:event.finishedAt,
      imageCount:event.images.length+referenceImages.length,
      imageIds:event.images.map(image=>image.id),
      referenceCardImages:referenceImages.map(image=>({index:image.index,name:image.name,source:image.source,publicPath:image.publicPath}))
    };
    // A restored/changed document starts another association epoch, even if revisions repeat.
    if(tool==='paint_new_document'||tool==='paint_undo'||tool==='paint_checkpoint'&&args?.action==='restore')epoch++;
    try{session.persistence='saved';await save(copy(session));}catch(e){session.persistence='memory';event.persistenceError=e.message;}
    if(error)throw error;
    return result&&typeof result==='object'&&!Array.isArray(result)?{...result,callEvidence:{sessionId:session.id,callId:event.id,...(event.groupId?{groupId:event.groupId,strokeIds:event.strokeIds,removedStrokeIds:event.removedStrokeIds}:{}),...(event.referenceCard?{referenceCard:copy(event.referenceCard)}:{}),revisionBefore:event.before.revision,revisionAfter:event.after.revision,imageIds:event.images.map(i=>i.id),persistence:session.persistence}}:result;
  }
  return {
    run(tool,args,execute,entryPoint='page-api'){
      const pending=queue.then(()=>invoke(tool,args,execute,entryPoint));queue=pending.catch(()=>{});return pending;
    },
    export:options=>exportEvidenceSnapshot(session,options),
    snapshot:()=>copy(session)
  };
}
function compactEvidence(value){
  if(!value||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(compactEvidence);
  const result={};
  for(const [key,item] of Object.entries(value)){
    if(key==='points'&&value.geometry&&Array.isArray(item))result.sampledPointCount=item.length;
    else result[key]=compactEvidence(item);
  }
  return result;
}
export function exportEvidenceSnapshot(session,{offset=0,limit=24,includeImages=false,imageIds,compact=false}={}){
  if(!session)throw Error('会话记录不存在');
  if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('会话分页 offset/limit 错误');
  if(typeof compact!=='boolean'||typeof includeImages!=='boolean'||imageIds!==undefined&&(!Array.isArray(imageIds)||imageIds.some(id=>typeof id!=='string')))throw Error('会话图片导出参数错误');
  const events=session.events.slice(offset,offset+limit),ids=new Set(imageIds||events.flatMap(e=>e.images.map(i=>i.id)));
  return copy({version:session.version,id:session.id,startedAt:session.startedAt,persistence:session.persistence,compact,offset,total:session.events.length,nextOffset:offset+limit<session.events.length?offset+limit:null,events:compact?compactEvidence(events):events,
    images:session.images.filter(i=>ids.has(i.id)).map(({dataUrl,...i})=>({...i,...(includeImages?{dataUrl}:{})}))});
}
