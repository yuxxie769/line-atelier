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
  const floor=c.pressureFloor??.2,ps=c.closed?[...points,points[0]]:points;let remaining=maxDistance;
  if(ps.length===1){ctx.beginPath();ctx.arc(ps[0][0],ps[0][1],c.width*(floor+(1-floor)*(ps[0][2]??1))/2,0,Math.PI*2);ctx.fill();return;}
  for(let i=1;i<ps.length&&remaining>0;i++){
    const a=ps[i-1],next=ps[i],length=Math.hypot(next[0]-a[0],next[1]-a[1]),t=length?Math.min(1,remaining/length):1,b=[a[0]+(next[0]-a[0])*t,a[1]+(next[1]-a[1])*t,(a[2]??1)+((next[2]??1)-(a[2]??1))*t];
    ctx.lineWidth=c.width*(floor+(1-floor)*((a[2]??1)+b[2])/2);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();remaining-=length;
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
