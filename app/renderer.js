import {pressureWidth} from './pressure.js';
import {renderPoints,PIXELS_PER_UNIT} from './model.js';
import {throughGeometry} from './geometry.js';
export function regionCanvas(region,scale,mirror=false){
  const canvas=document.createElement('canvas');canvas.width=Math.round(region[2]*scale);canvas.height=Math.round(region[3]*scale);
  const ctx=canvas.getContext('2d');ctx.setTransform(mirror?-scale:scale,0,0,scale,mirror?canvas.width+region[0]*scale:-region[0]*scale,-region[1]*scale);return canvas;
}
export function regionPath(region,scene){
  const p=new Path2D(),ps=throughGeometry({...region,closed:true},scene).points;ps.forEach((v,i)=>i?p.lineTo(v[0],v[1]):p.moveTo(v[0],v[1]));p.closePath();return p;
}
export function strokeRaster(ctx,c,points,maxDistance=Infinity){
  ctx.strokeStyle=c.color;ctx.fillStyle=c.color;ctx.lineJoin=ctx.lineCap='round';
  if(c.type==='fill'){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();return;}
  const floor=c.pressureFloor??.2,ps=c.closed?[...points,points[0]]:points;let remaining=maxDistance,travelled=0;const total=ps.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-ps[i][0],p[1]-ps[i][1]),0)||1;
  if(ps.length===1){ctx.beginPath();ctx.arc(ps[0][0],ps[0][1],pressureWidth(c,ps[0][2]??1)/2,0,Math.PI*2);ctx.fill();return;}
  for(let i=1;i<ps.length&&remaining>0;i++){
    const a=ps[i-1],next=ps[i],length=Math.hypot(next[0]-a[0],next[1]-a[1]),t=length?Math.min(1,remaining/length):1,b=[a[0]+(next[0]-a[0])*t,a[1]+(next[1]-a[1])*t,(a[2]??1)+((next[2]??1)-(a[2]??1))*t];
    const count=Math.max(1,Math.ceil(length*t/2));let prev=a;
    for(let j=1;j<=count;j++){const f=j/count,q=[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,(a[2]??1)+(b[2]-(a[2]??1))*f];
      const width=pressureWidth(c,((prev[2]??1)+q[2])/2,(travelled+length*t*(j-.5)/count)/total);
      if(width>0){ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(prev[0],prev[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();}prev=q;
    }remaining-=length;travelled+=length;
  }
}
// Re-rasterize retained geometry at target resolution without touching engine caches/playhead.
export function renderRegion(engine,{region,scale=1,mirror=false,document:doc=engine.doc}){
  const out=regionCanvas(region,scale,mirror),ctx=out.getContext('2d');ctx.fillStyle=doc.background;ctx.fillRect(...region);
  const visibleLayers=doc.layers.filter(l=>engine.layerVisible(l)),needed=new Set(visibleLayers.map(l=>l.id));for(const l of visibleLayers)if(l.clipTo)needed.add(l.clipTo);
  const surfaces=new Map(),ink=regionCanvas(region,scale,mirror),ix=ink.getContext('2d');
  const occlusions=new Map((doc.scene?.regions||[]).map(r=>[r.id,regionPath(r,doc.scene)]));
  for(const layer of doc.layers){if(!needed.has(layer.id))continue;const s=regionCanvas(region,scale,mirror),sx=s.getContext('2d');
    for(let i=0;i<doc.commands.length;i++){
      const c=doc.commands[i];if(c.layer!==layer.id||i>engine.commandIndex||i===engine.commandIndex&&!engine.unitIndex)continue;
      const [x,y,w,h]=engine.geometry[i]?.bounds||[0,0,doc.width,doc.height];if(x+w<region[0]||x>region[0]+region[2]||y+h<region[1]||y>region[1]+region[3])continue;
      ix.clearRect(...region);ix.save();if(c.mask&&engine.maskPaths.has(c.mask))ix.clip(engine.maskPaths.get(c.mask),'evenodd');
      strokeRaster(ix,c,renderPoints(c,doc,Math.max(1,scale)),i===engine.commandIndex?engine.unitIndex*PIXELS_PER_UNIT:Infinity);ix.restore();
      for(const rel of doc.scene?.occlusions||[])if(rel.back===c.objectId){ix.save();ix.globalCompositeOperation='destination-out';ix.fill(occlusions.get(rel.regionId));ix.restore();}
      sx.save();sx.setTransform(1,0,0,1,0,0);sx.globalAlpha=c.opacity;sx.globalCompositeOperation=c.type==='erase'?'destination-out':'source-over';sx.drawImage(ink,0,0);sx.restore();
    }surfaces.set(layer.id,s);
  }
  ctx.setTransform(1,0,0,1,0,0);
  for(const layer of visibleLayers){let s=surfaces.get(layer.id);if(layer.clipTo){const clip=regionCanvas(region,scale,mirror),cx=clip.getContext('2d');cx.setTransform(1,0,0,1,0,0);cx.drawImage(s,0,0);cx.globalCompositeOperation='destination-in';cx.drawImage(surfaces.get(layer.clipTo),0,0);s=clip;}ctx.globalAlpha=layer.opacity;ctx.globalCompositeOperation=layer.blend||'source-over';ctx.drawImage(s,0,0);}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';return out;
}

// Actual visible ink only: exclude reference, background and color fills. Existing
// masks erase ink; their invisible outlines never become artificial barriers.
export function renderLineMask(engine,{subphases=['clean'],scale=1}={}) {
  const d=engine.doc;if(scale!==1&&scale!==2)throw Error('检查分辨率支持 1× 或 2×');
  scale=Math.min(scale,2048/Math.max(d.width,d.height));
  const region=[0,0,d.width,d.height],bounds=new Map(d.commands.map((c,i)=>[c.id,engine.geometry[i].bounds])),out=regionCanvas(region,scale,false),ctx=out.getContext('2d'),ink=regionCanvas(region,scale,false),ix=ink.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);let dirtyRect=null;
  for(const layer of d.layers){if(!engine.layerVisible(layer)||layer.opacity<=0)continue;
    const surface=regionCanvas(region,scale,false),sx=surface.getContext('2d');sx.setTransform(1,0,0,1,0,0);
    const commands=d.commands.filter(c=>c.layer===layer.id),eligible=c=>c.type!=='fill'&&(c.type==='erase'||!subphases.length||subphases.includes(c.subphase));
    if(!commands.some(c=>c.type==='stroke'&&eligible(c)))continue;
    const cached=scale===1&&commands.every(eligible);
    if(cached)sx.drawImage(engine.surfaces.get(layer.id),0,0);
    else for(const c of commands){if(!eligible(c))continue;
      if(dirtyRect)ix.clearRect(...dirtyRect);dirtyRect=bounds.get(c.id);ix.save();if(c.mask)ix.clip(engine.maskPaths.get(c.mask),'evenodd');
      strokeRaster(ix,{...c,color:'#000000'},renderPoints(c,d,scale));ix.restore();
      ix.save();ix.globalCompositeOperation='destination-out';for(const rel of d.scene.occlusions)if(rel.back===c.objectId)ix.fill(engine.occlusionPaths.get(rel.regionId));ix.restore();
      sx.globalAlpha=c.opacity;sx.globalCompositeOperation=c.type==='erase'?'destination-out':'source-over';const [bx,by,bw,bh]=dirtyRect;const sx0=Math.max(0,Math.floor(bx*scale)),sy0=Math.max(0,Math.floor(by*scale)),sw=Math.min(ink.width-sx0,Math.ceil(bw*scale)+1),sh=Math.min(ink.height-sy0,Math.ceil(bh*scale)+1);if(sw>0&&sh>0)sx.drawImage(ink,sx0,sy0,sw,sh,sx0,sy0,sw,sh);
    }
    if(layer.clipTo){const clip=regionCanvas(region,scale,false),cx=clip.getContext('2d');cx.setTransform(1,0,0,1,0,0);let id=layer.clipTo,first=true;
      while(id){cx.globalCompositeOperation=first?'source-over':'destination-in';cx.drawImage(engine.surfaces.get(id),0,0,clip.width,clip.height);first=false;id=d.layers.find(l=>l.id===id).clipTo;}
      sx.globalAlpha=1;sx.globalCompositeOperation='destination-in';sx.drawImage(clip,0,0);
    }
    ctx.globalAlpha=layer.opacity;ctx.globalCompositeOperation='source-over';ctx.drawImage(surface,0,0);
  }
  const rgba=ctx.getImageData(0,0,out.width,out.height).data,alpha=new Uint8Array(out.width*out.height);for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
  return {canvas:out,alpha,width:out.width,height:out.height,scaleX:out.width/d.width,scaleY:out.height/d.height};
}
