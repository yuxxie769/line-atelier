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
export function referenceCrop(reference,{region,scale=1,mirror=false,lines=false,documentWidth,documentHeight}){
  const [x,y,w,h]=region;if(!region.every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>documentWidth||y+h>documentHeight||!Number.isFinite(scale)||scale<.25||scale>4||w*scale>4096||h*scale>4096)throw Error('参考裁切范围错误');
  const source=lines?reference.lineCanvas:reference.original;if(!source)throw Error('请先提取参考线稿');
  const c=document.createElement('canvas');c.width=Math.round(w*scale);c.height=Math.round(h*scale);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
  const [ox,oy,s]=reference.placement;ctx.setTransform(mirror?-scale:scale,0,0,scale,mirror?c.width+x*scale:-x*scale,-y*scale);ctx.drawImage(source,ox,oy,source.width*s,source.height*s);
  return {dataUrl:c.toDataURL('image/png'),width:c.width,height:c.height,region,scale,mirror,rendering:lines?'reference-local-contrast':'original-reference',sourceWidth:source.width,sourceHeight:source.height,documentWidth,documentHeight,placement:{x:ox,y:oy,scale:s},coordinates:mirror?'documentX = region[0] + region[2] - imageX / scale; documentY = region[1] + imageY / scale':'documentX = region[0] + imageX / scale; documentY = region[1] + imageY / scale'};
}
