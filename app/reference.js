// Observation-only pixel processing. No import of the drawing engine or geometry module.
export async function extractReferenceLines(canvas){
  const w=canvas.width,h=canvas.height,src=canvas.getContext('2d').getImageData(0,0,w,h),gray=new Float32Array(w*h),blur=new Float32Array(w*h);
  for(let i=0;i<gray.length;i++){const a=src.data[i*4+3]/255;gray[i]=(src.data[i*4]*.299+src.data[i*4+1]*.587+src.data[i*4+2]*.114)*a+255*(1-a);}
  // Small local contrast filter plus luminance edges. It is an aid, not semantic line art.
  const radius=3,temp=new Float32Array(gray.length),yieldUI=()=>new Promise(r=>setTimeout(r,0));
  for(let y=0;y<h;y++){let sum=0;for(let k=-radius;k<=radius;k++)sum+=gray[y*w+Math.max(0,Math.min(w-1,k))];for(let x=0;x<w;x++){temp[y*w+x]=sum/(radius*2+1);sum+=gray[y*w+Math.min(w-1,x+radius+1)]-gray[y*w+Math.max(0,x-radius)];}if(y%96===0)await yieldUI();}
  for(let x=0;x<w;x++){let sum=0;for(let k=-radius;k<=radius;k++)sum+=temp[Math.max(0,Math.min(h-1,k))*w+x];for(let y=0;y<h;y++){blur[y*w+x]=sum/(radius*2+1);sum+=temp[Math.min(h-1,y+radius+1)*w+x]-temp[Math.max(0,y-radius)*w+x];}if(x%96===0)await yieldUI();}
  const result=document.createElement('canvas');result.width=w;result.height=h;const ctx=result.getContext('2d'),out=ctx.createImageData(w,h);
  for(let y=0;y<h;y++){for(let x=0;x<w;x++){const i=y*w+x,contrast=Math.max(0,blur[i]-gray[i]-1.3),dx=gray[y*w+Math.min(w-1,x+1)]-gray[y*w+Math.max(0,x-1)],dy=gray[Math.min(h-1,y+1)*w+x]-gray[Math.max(0,y-1)*w+x],edge=Math.max(0,Math.hypot(dx,dy)-12)*.42;const v=255-Math.min(238,contrast*7+edge);out.data.set([v,v,v,255],i*4);}if(y%96===0)await yieldUI();}
  ctx.putImageData(out,0,0);return result;
}
function hash32(value,seed=2166136261){let hash=seed>>>0;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}return hash>>>0;}
export function referenceIdentity(reference){
  if(!reference)return null;if(reference.identity)return reference.identity;
  const source=String(reference.sourceDataUrl||''),placement=(reference.placement||[]).map(n=>Number(n).toFixed(6)).join(','),first=hash32(source),second=hash32(source,3339675911);
  return reference.identity=`ref-${source.length.toString(36)}-${first.toString(16).padStart(8,'0')}${second.toString(16).padStart(8,'0')}@${placement}`;
}
function validateCrop({region,scale,documentWidth,documentHeight}){
  const [x,y,w,h]=region;if(!region.every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>documentWidth||y+h>documentHeight||!Number.isFinite(scale)||scale<.25||scale>4||w*scale>4096||h*scale>4096)throw Error('参考裁切范围错误');
}
function renderReference(reference,{region,scale=1,mirror=false,lines=false,sourceCanvas=null,documentWidth,documentHeight}){
  validateCrop({region,scale,documentWidth,documentHeight});
  const [x,y,w,h]=region;
  const source=sourceCanvas||lines?sourceCanvas||reference.lineCanvas:reference.original;if(!source)throw Error('请先提取参考线稿');
  const canvas=document.createElement('canvas');canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  const [ox,oy,s]=reference.placement;ctx.setTransform(mirror?-scale:scale,0,0,scale,mirror?canvas.width+x*scale:-x*scale,-y*scale);ctx.drawImage(source,ox,oy,source.width*s,source.height*s);
  return canvas;
}
function itemHue(id){return hash32(id)%360;}
export function referenceObjectMapCanvas(reference,{objectMap,itemIds,region,scale=1,mirror=false,documentWidth,documentHeight}){
  if(!objectMap?.items?.length)throw Error('尚未建立全局物体图');
  const canvas=renderReference(reference,{region,scale,mirror,documentWidth,documentHeight}),ctx=canvas.getContext('2d'),selected=itemIds?.length?new Set(itemIds):null,items=objectMap.items.filter(item=>!selected||selected.has(item.id));
  if(selected&&items.length!==selected.size)throw Error('观察遮罩对象不存在');
  const [x,,w]=region;ctx.save();ctx.setTransform(mirror?-scale:scale,0,0,scale,mirror?canvas.width+x*scale:-x*scale,-region[1]*scale);
  for(const item of items){const hue=itemHue(item.id);for(const mask of item.visibleMasks){ctx.beginPath();mask.polygon.forEach(([px,py],index)=>index?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fillStyle=`hsla(${hue},85%,52%,.28)`;ctx.strokeStyle=`hsla(${hue},88%,35%,.95)`;ctx.lineWidth=2/scale;ctx.fill();ctx.stroke();}}
  ctx.restore();return {canvas,items:items.map(item=>({id:item.id,name:item.name,hue:itemHue(item.id),maskIds:item.visibleMasks.map(mask=>mask.id)}))};
}
export function referenceObjectMapOverlay(reference,options){
  const {canvas,items}=referenceObjectMapCanvas(reference,options),{region,scale=1,mirror=false,documentWidth,documentHeight}=options;
  return {dataUrl:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,region:[...region],scale,mirror,rendering:'original-reference-with-object-map-observation-masks',items,documentWidth,documentHeight,coordinates:mirror?'documentX = region[0] + region[2] - imageX / scale; documentY = region[1] + imageY / scale':'documentX = region[0] + imageX / scale; documentY = region[1] + imageY / scale'};
}
export function referenceBundle(reference,{objectMap=null,itemIds,region,scale=1,mirror=false,documentWidth,documentHeight}){
  if(!reference?.svgContourCanvas||!reference?.svgContours)throw Error('SVG 轮廓尚未准备');
  validateCrop({region,scale,documentWidth,documentHeight});const [, ,w,h]=region;
  const bundleScale=Math.max(.25,Math.min(scale,1280/w,2048/h)),original=renderReference(reference,{region,scale:bundleScale,mirror,documentWidth,documentHeight}),contours=renderReference(reference,{region,scale:bundleScale,mirror,sourceCanvas:reference.svgContourCanvas,documentWidth,documentHeight});
  let masked,maskStatus='missing';
  if(objectMap?.items?.length){masked=referenceObjectMapCanvas(reference,{objectMap,itemIds,region,scale:bundleScale,mirror,documentWidth,documentHeight}).canvas;maskStatus='available';}
  else {masked=renderReference(reference,{region,scale:bundleScale,mirror,documentWidth,documentHeight});const q=masked.getContext('2d');q.fillStyle='rgba(255,255,255,.78)';q.fillRect(0,masked.height-32,masked.width,32);q.fillStyle='#8b3f2e';q.font='14px sans-serif';q.fillText('STRUCTURE MASK NOT RECORDED',8,masked.height-10);}
  const header=28,gap=10,panelWidth=original.width,panelHeight=original.height,sheet=document.createElement('canvas');sheet.width=panelWidth*3+gap*2;sheet.height=panelHeight+header;const ctx=sheet.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,sheet.width,sheet.height);const panels={};
  for(const [key,label,index,source] of [['original','ORIGINAL REFERENCE',0,original],['contours','SVG CONTOURS',1,contours],['mask','REFERENCE + STRUCTURE MASK',2,masked]]){const x=index*(panelWidth+gap);ctx.fillStyle='#182e38';ctx.font='14px sans-serif';ctx.fillText(label,x+5,19);ctx.drawImage(source,x,header);panels[key]={rect:[x,header,panelWidth,panelHeight],region:[...region],scale:bundleScale,imageToDocument:[1/bundleScale,0,0,1/bundleScale,region[0]-x/bundleScale,region[1]-header/bundleScale]};}
  const trace=reference.svgContours;
  return {dataUrl:sheet.toDataURL('image/png'),width:sheet.width,height:sheet.height,rendering:'reference-bundle-original-svg-contours-structure-mask',region:[...region],requestedScale:scale,scale:bundleScale,mirror,maskStatus,panels,svgContours:{dataUrl:trace.dataUrl,width:trace.width,height:trace.height,method:trace.method,threshold:trace.threshold,step:trace.step,segments:trace.segments,darkPixels:trace.darkPixels,sourceDarkPixels:trace.sourceDarkPixels,removedPixels:trace.removedPixels,componentsKept:trace.componentsKept,componentsRemoved:trace.componentsRemoved,minNeighbors:trace.minNeighbors,minComponentPixels:trace.minComponentPixels,truncated:trace.truncated},documentWidth,documentHeight,note:'All three reference views are returned in this single packet. SVG contours and structure masks are observation aids only; neither is artwork geometry.'};
}
export function referenceCrop(reference,{region,scale=1,mirror=false,lines=false,documentWidth,documentHeight}){
  const c=renderReference(reference,{region,scale,mirror,lines,documentWidth,documentHeight}),[ox,oy,s]=reference.placement,source=lines?reference.lineCanvas:reference.original;
  return {dataUrl:c.toDataURL('image/png'),width:c.width,height:c.height,region,scale,mirror,rendering:lines?'reference-local-contrast':'original-reference',sourceWidth:source.width,sourceHeight:source.height,documentWidth,documentHeight,placement:{x:ox,y:oy,scale:s},coordinates:mirror?'documentX = region[0] + region[2] - imageX / scale; documentY = region[1] + imageY / scale':'documentX = region[0] + imageX / scale; documentY = region[1] + imageY / scale'};
}
