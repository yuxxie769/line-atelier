// Vectorizes the observation-only line image into compact horizontal SVG paths.
// The result is a visual aid and is never converted into artwork geometry.
export function traceImageDataToSvg(imageData,{threshold=196,maxSegments=30000,minNeighbors=1,minComponentPixels=8}={}){
  const {width,height,data}=imageData;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||!data)throw Error('SVG 轮廓提取需要有效图像数据');
  if(!Number.isFinite(threshold)||threshold<0||threshold>255)throw Error('SVG 轮廓阈值需要 0–255');
  if(!Number.isInteger(maxSegments)||maxSegments<100||maxSegments>100000)throw Error('SVG 轮廓片段上限需要 100–100000');
  if(!Number.isInteger(minNeighbors)||minNeighbors<0||minNeighbors>8)throw Error('SVG 轮廓邻域阈值需要 0–8');
  if(!Number.isInteger(minComponentPixels)||minComponentPixels<1||minComponentPixels>10000)throw Error('SVG 轮廓最小连通域需要 1–10000 像素');

  const step=Math.max(1,Math.ceil(Math.sqrt(width*height/1500000))),sampleWidth=Math.ceil(width/step),sampleHeight=Math.ceil(height/step),sampleCount=sampleWidth*sampleHeight;
  const sampled=new Uint8Array(sampleCount),supported=new Uint8Array(sampleCount),clean=new Uint8Array(sampleCount);
  let sourceDarkPixels=0;
  for(let sy=0;sy<sampleHeight;sy++)for(let sx=0;sx<sampleWidth;sx++){
    const x=Math.min(width-1,sx*step),y=Math.min(height-1,sy*step),i=(y*width+x)*4,a=data[i+3]/255,l=(data[i]*.299+data[i+1]*.587+data[i+2]*.114)*a+255*(1-a);
    if(l<threshold){sampled[sy*sampleWidth+sx]=1;sourceDarkPixels++;}
  }

  // A real one-pixel contour normally has a neighbour along its direction. This
  // removes isolated antialias/compression specks without thickening the line.
  for(let sy=0;sy<sampleHeight;sy++)for(let sx=0;sx<sampleWidth;sx++){
    const index=sy*sampleWidth+sx;if(!sampled[index])continue;let neighbors=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&sx+dx>=0&&sx+dx<sampleWidth&&sy+dy>=0&&sy+dy<sampleHeight)neighbors+=sampled[(sy+dy)*sampleWidth+sx+dx];
    if(neighbors>=minNeighbors)supported[index]=1;
  }

  // Remove tiny 8-connected islands. This is deliberately applied after the
  // neighbour pass so small freckles do not survive merely by touching once.
  const visited=new Uint8Array(sampleCount),queue=new Int32Array(sampleCount);let componentsKept=0,componentsRemoved=0,darkPixels=0;
  for(let seed=0;seed<sampleCount;seed++){
    if(!supported[seed]||visited[seed])continue;let head=0,tail=0;queue[tail++]=seed;visited[seed]=1;
    while(head<tail){const index=queue[head++],sx=index%sampleWidth,sy=(index/sampleWidth)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;const nx=sx+dx,ny=sy+dy;if(nx<0||nx>=sampleWidth||ny<0||ny>=sampleHeight)continue;const next=ny*sampleWidth+nx;
      if(supported[next]&&!visited[next]){visited[next]=1;queue[tail++]=next;}
    }}
    if(tail>=minComponentPixels){componentsKept++;darkPixels+=tail;for(let i=0;i<tail;i++)clean[queue[i]]=1;}else componentsRemoved++;
  }

  const commands=[];let truncated=false;
  outer:for(let sy=0;sy<sampleHeight;sy++){let sx=0;while(sx<sampleWidth){while(sx<sampleWidth&&!clean[sy*sampleWidth+sx])sx++;if(sx>=sampleWidth)break;const start=sx;while(sx<sampleWidth&&clean[sy*sampleWidth+sx])sx++;const x1=start*step,x2=Math.min(width,sx*step),y=Math.min(height,sy*step+step/2);commands.push(`M${x1} ${y}H${x2}`);if(commands.length>=maxSegments){truncated=true;break outer;}}}
  const stroke=Math.max(1,step),path=commands.join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="none" stroke="#102a33" stroke-width="${stroke}" stroke-linecap="round"/></svg>`;
  return {svg,dataUrl:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,width,height,method:'cleaned-luminance-edge-scanline-svg',threshold,step,segments:commands.length,darkPixels,sourceDarkPixels,removedPixels:sourceDarkPixels-darkPixels,componentsKept,componentsRemoved,minNeighbors,minComponentPixels,truncated};
}

export function traceReferenceSvg(canvas,options={}){
  if(!canvas?.getContext||!canvas.width||!canvas.height)throw Error('SVG 轮廓提取需要参考线稿画布');
  return traceImageDataToSvg(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height),options);
}
