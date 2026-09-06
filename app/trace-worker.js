// Reference reconstruction only: deterministic image analysis, not a model call.
// The target canvas receives ONLY stroke commands. Pixels are sampled here.
self.onmessage=({data})=>{
  try {
    const {pixels,width:w,height:h,canvasWidth:W,canvasHeight:H,detail=2}=data;
    const sx=W/w,sy=H/h;
    const commands=[];
    const rgb=(x,y)=>{const i=(Math.min(h-1,Math.max(0,y))*w+Math.min(w-1,Math.max(0,x)))*4,a=pixels[i+3]/255;return [0,1,2].map(k=>Math.round(pixels[i+k]*a+255*(1-a)));};
    const hex=c=>'#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
    const avg=(x,y,size)=>{const sum=[0,0,0];let n=0;for(let j=y;j<Math.min(h,y+size);j++)for(let i=x;i<Math.min(w,x+size);i++){const c=rgb(i,j);for(let k=0;k<3;k++)sum[k]+=c[k];n++;}return sum.map(v=>v/n);};
    const passes=[{size:8,stage:'base',filter:()=>true},{size:4,stage:'shape',filter:()=>true},{size:detail,stage:'shadow',filter:c=>c[0]*.2126+c[1]*.7152+c[2]*.0722<150},{size:detail,stage:'light',filter:c=>c[0]*.2126+c[1]*.7152+c[2]*.0722>=150}];
    for(let p=0;p<passes.length;p++){
      const {size,stage,filter}=passes[p];
      for(let y=0;y<h;y+=size){
        let run=null;const flush=()=>{if(run){commands.push({type:'stroke',stage,layer:'paper',color:hex(run.color),width:Math.min(180,size*sy*1.04),opacity:1,points:[[run.x*sx,(y+size/2)*sy],[(run.end)*sx,(y+size/2)*sy]]});run=null;}};
        for(let x=0;x<w;x+=size){const c=avg(x,y,size);if(!filter(c)){flush();continue;}const near=run&&c.reduce((v,n,i)=>v+Math.abs(n-run.color[i]),0)<(size===8?45:20)&&x-run.x<size*12;
          if(near){run.end=Math.min(w,x+size);run.color=run.color.map((v,i)=>(v*run.n+c[i])/(run.n+1));run.n++;}else{flush();run={x,end:Math.min(w,x+size),color:c,n:1};}}
        flush();
      }
      self.postMessage({progress:(p+1)/5});
    }
    // Sparse edge finishing: draw short tangents to strong local gradients.
    const lum=(x,y)=>{const c=rgb(x,y);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
    for(let y=2;y<h-2;y+=2)for(let x=2;x<w-2;x+=2){const gx=lum(x+1,y)-lum(x-1,y),gy=lum(x,y+1)-lum(x,y-1),g=Math.hypot(gx,gy);if(g>95&&lum(x,y)<180){const dx=-gy/g*.6*sx,dy=gx/g*.6*sy;commands.push({type:'stroke',stage:'edge',layer:'paper',color:hex(rgb(x,y)),width:Math.max(.6,sx*.5),opacity:.65,points:[[x*sx-dx,y*sy-dy],[x*sx+dx,y*sy+dy]]});}}
    self.postMessage({done:true,commands,stages:[{id:'base',name:'色彩底层',description:'粗笔触覆盖主要色块'},{id:'shape',name:'形状细化',description:'缩小笔刷，明确区域边界'},{id:'shadow',name:'暗部重绘',description:'补充暗色与局部细节'},{id:'light',name:'亮部重绘',description:'逐笔还原明亮区域'},{id:'edge',name:'边缘收尾',description:'沿强边缘补充短线'}]});
  }catch(e){self.postMessage({error:e.message});}
};
