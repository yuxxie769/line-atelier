// Deterministic reference analysis. The agent chooses the region, order and
// sampling settings. This returns brush trajectories, never an image command.
export function referencePass(image, options) {
  const {width:W,height:H,data}=image;
  const {mode='color',spacing=3,tolerance=18,region=[0,0,W,H],stage='base',layer='paper',includePaper=false}=options;
  if(!['color','outline'].includes(mode))throw Error('mode 必须为 color 或 outline');
  if(!Number.isFinite(spacing)||spacing<1||spacing>24)throw Error('spacing 必须在 1–24 之间');
  if(!Number.isFinite(tolerance)||tolerance<0||tolerance>80)throw Error('tolerance 必须在 0–80 之间');
  if(!Array.isArray(region)||region.length!==4||region.some(v=>!Number.isFinite(v)))throw Error('region 需要 [x,y,width,height]');
  const [rx,ry,rw,rh]=region;
  if(rx<0||ry<0||rw<=0||rh<=0||rx+rw>W||ry+rh>H)throw Error('region 必须位于画布内');
  const x0=Math.ceil(rx),y0=Math.ceil(ry),x1=Math.min(W,Math.floor(rx+rw)),y1=Math.min(H,Math.floor(ry+rh));
  const at=(x,y)=>{const i=(Math.min(H-1,Math.max(0,Math.round(y)))*W+Math.min(W-1,Math.max(0,Math.round(x))))*4;return [data[i],data[i+1],data[i+2]];};
  const hex=c=>'#'+c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
  const lum=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
  const commands=[];
  const emit=(points,c,width)=>{commands.push({type:'stroke',layer,stage,color:hex(c),width,opacity:1,points});if(commands.length>22000)throw Error('该区域笔迹过多，请分区或增大 spacing');};
  if(mode==='color') {
    // Serpentine scanline brush paths. The run average never includes pixels
    // outside its region. Segmenting long runs makes the tip visibly travel.
    for(let y=y0+spacing/2;y<y1;y+=spacing){
      let start=null,end=0,col=null,n=0,reverse=Math.floor((y-y0)/spacing)%2;
      const flush=()=>{if(start===null)return;let left=start+.15*spacing,right=Math.max(left,end-.15*spacing),pts=[];for(let x=left;x<right;x+=Math.max(2,spacing*2))pts.push([x,y]);pts.push([right,y]);if(reverse)pts.reverse();emit(pts,col,spacing*1.07);start=null;};
      for(let x=x0+spacing/2;x<x1;x+=spacing){const c=at(x,y);const isPaper=c.every(v=>v>=251);const delta=col?Math.max(...c.map((v,k)=>Math.abs(v-col[k]))):Infinity;
        if(isPaper&&!includePaper){flush();continue;}
        if(start!==null&&delta<=tolerance&&x-start<100){end=Math.min(x1,x+spacing/2);col=col.map((v,k)=>(v*n+c[k])/(n+1));n++;}
        else{flush();start=Math.max(x0,x-spacing/2);end=Math.min(x1,x+spacing/2);col=c;n=1;}}
      flush();
    }
  } else {
    // Connect dark local ridges into contour paths. Outline extraction is an
    // algorithmic guide, not evidence that a model invented the line drawing.
    const step=Math.max(1,Math.round(spacing));const nx=Math.ceil((x1-x0)/step),ny=Math.ceil((y1-y0)/step);
    const mask=new Uint8Array(nx*ny),used=new Uint8Array(nx*ny);
    for(let j=1;j<ny-1;j++)for(let i=1;i<nx-1;i++){
      const x=x0+i*step,y=y0+j*step,L=lum(at(x,y));
      const gx=lum(at(x+step,y))-lum(at(x-step,y)),gy=lum(at(x,y+step))-lum(at(x,y-step));
      if(L<215&&Math.hypot(gx,gy)>12)mask[j*nx+i]=1;
    }
    const neighbors=k=>{const i=k%nx,j=Math.floor(k/nx),a=[];for(let v=-1;v<=1;v++)for(let u=-1;u<=1;u++){const xx=i+u,yy=j+v;if((u||v)&&xx>=0&&xx<nx&&yy>=0&&yy<ny){const z=yy*nx+xx;if(mask[z]&&!used[z])a.push(z);}}return a;};
    for(let k=0;k<mask.length;k++){if(!mask[k]||used[k])continue;let current=k,pts=[];while(current!==undefined&&pts.length<160){used[current]=1;pts.push([x0+(current%nx)*step,y0+Math.floor(current/nx)*step]);current=neighbors(current)[0];}if(pts.length>2)emit(pts,[193,145,135],Math.max(.55,step*.6));}
  }
  return {commands,method:'reference-analysis-brush-paths',mode,region,spacing};
}
