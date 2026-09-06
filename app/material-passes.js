// Reference-assisted material painting. Masks contain only vector selections;
// every visible mark is a recorded, continuously replayable brush trajectory.
// The model chooses the object, flow guides, pass order and layer. Local image
// analysis chooses the palette and boundaries, not semantic understanding.
const sq=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const hex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
function paletteOf(samples,k){
  const hist=new Map();for(const c of samples){const key=(c[0]>>3)*1024+(c[1]>>3)*32+(c[2]>>3);let v=hist.get(key);if(!v){v={n:0,sum:[0,0,0]};hist.set(key,v);}v.n++;c.forEach((n,i)=>v.sum[i]+=n);}
  const bins=[...hist.values()].map(v=>({n:v.n,c:v.sum.map(n=>n/v.n)}));if(!bins.length)return [];
  bins.sort((a,b)=>b.n-a.n);const centers=[bins[0].c];
  while(centers.length<Math.min(k,bins.length)){let best=-1,chosen;for(const b of bins){const d=Math.min(...centers.map(c=>sq(c,b.c)))*Math.sqrt(b.n);if(d>best){best=d;chosen=b.c;}}if(best<1)break;centers.push(chosen);}
  for(let round=0;round<9;round++){const sums=centers.map(()=>[0,0,0,0]);for(const b of bins){let best=0,d=Infinity;centers.forEach((c,i)=>{const e=sq(c,b.c);if(e<d){d=e;best=i;}});const s=sums[best];b.c.forEach((n,i)=>s[i]+=n*b.n);s[3]+=b.n;}sums.forEach((s,i)=>{if(s[3])centers[i]=s.slice(0,3).map(v=>v/s[3]);});}
  return centers.map(c=>c.map(Math.round));
}
function simplify(points,epsilon=.45){
  if(points.length<5)return points;
  const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]];
  while(stack.length){const [a,b]=stack.pop(),p=points[a],q=points[b],dx=q[0]-p[0],dy=q[1]-p[1],l=dx*dx+dy*dy;let max=epsilon*epsilon,at=-1;for(let i=a+1;i<b;i++){const r=points[i],t=l?Math.max(0,Math.min(1,((r[0]-p[0])*dx+(r[1]-p[1])*dy)/l)):0,d=(r[0]-p[0]-t*dx)**2+(r[1]-p[1]-t*dy)**2;if(d>max){max=d;at=i;}}if(at>=0){keep[at]=1;stack.push([a,at],[at,b]);}}
  return points.filter((_,i)=>keep[i]);
}
// Directed pixel edges produce outer contours and holes with opposite winding.
// Even-odd clipping preserves holes without raster data in the saved document.
export function labelContours(labels,w,h,count){
  const edges=Array.from({length:count},()=>new Map()),stride=w+1;
  const edge=(label,a,b)=>{const map=edges[label];if(!map.has(a))map.set(a,[]);map.get(a).push(b);};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,l=labels[i];if(l<0)continue;const a=y*stride+x;
    if(!y||labels[i-w]!==l)edge(l,a,a+1);if(x===w-1||labels[i+1]!==l)edge(l,a+1,a+stride+1);
    if(y===h-1||labels[i+w]!==l)edge(l,a+stride+1,a+stride);if(!x||labels[i-1]!==l)edge(l,a+stride,a);
  }
  return edges.map(map=>{const polygons=[];while(map.size){const start=map.keys().next().value;let v=start,loop=[],guard=0;do{loop.push([v%stride,Math.floor(v/stride)]);const next=map.get(v);if(!next?.length)break;const n=next.pop();if(!next.length)map.delete(v);v=n;}while(v!==start&&++guard<1000000);if(loop.length>=3){loop.push(loop[0]);const p=simplify(loop);p.pop();if(p.length>=3)polygons.push(p);}}return polygons;});
}
export function materialPass(source,painted,options={}){
  const {width:w,height:h,data:src}=source;
  const {region=[0,0,w,h],guides=[],brush=18,colors=16,mode='base',minError=8,maxLength=120,stage='base',layer='paper',prefix='material',minArea=3}=options;
  if(!['base','shade','light'].includes(mode))throw Error('mode 需要 base、shade 或 light');
  if(!Number.isFinite(brush)||brush<2||brush>80)throw Error('brush 需要在 2–80 px 之间');
  if(!Number.isInteger(colors)||colors<2||colors>48)throw Error('colors 需要在 2–48 之间');
  if(!Number.isFinite(minError)||minError<0||minError>100)throw Error('minError 需要在 0–100 之间');
  if(!Number.isFinite(maxLength)||maxLength<12||maxLength>300)throw Error('maxLength 需要在 12–300 px 之间');
  if(!Number.isInteger(minArea)||minArea<1||minArea>100)throw Error('minArea 需要在 1–100 之间');
  if(!/^[a-zA-Z0-9_-]{1,45}$/.test(prefix))throw Error('选区前缀格式错误');
  if(!Array.isArray(region)||region.length!==4||region.some(v=>!Number.isFinite(v))||region[0]<0||region[1]<0||region[2]<=0||region[3]<=0||region[0]+region[2]>w||region[1]+region[3]>h)throw Error('region 必须在画布内');
  if(!Array.isArray(guides)||guides.length>40||guides.some(g=>!Array.isArray(g)||g.length<2||g.length>300||g.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)))))throw Error('guides 需要二维路径坐标');
  const [rx,ry,rw,rh]=region,labels=new Int16Array(w*h).fill(-1),values=new Uint8Array(w*h*3),samples=[];
  for(let y=Math.ceil(ry);y<ry+rh;y++)for(let x=Math.ceil(rx);x<rx+rw;x++){
    const i=y*w+x,p=i*4;if(src[p+3]<128)continue;let c=[src[p],src[p+1],src[p+2]];
    if(mode!=='base'){const before=[painted.data[p],painted.data[p+1],painted.data[p+2]];let error=0;c=c.map((v,k)=>{if(mode==='shade'){error=Math.max(error,before[k]-v);return Math.min(255,255*v/Math.max(1,before[k]));}error=Math.max(error,v-before[k]);return Math.max(0,255*(v-before[k])/Math.max(1,255-before[k]));});if(error<minError)continue;}
    labels[i]=0;c=c.map(Math.round);values.set(c,i*3);samples.push(c);
  }
  if(options.palette&&(!Array.isArray(options.palette)||!options.palette.length||options.palette.length>48||options.palette.some(c=>!/^#[0-9a-f]{6}$/i.test(c))))throw Error('palette 需要 1–48 个 #RRGGBB 颜色');const palette=options.palette?options.palette.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16))):paletteOf(samples,colors);if(!samples.length||!palette.length)return {commands:[],masks:[],palette:[],mode,coverage:1};
  for(let i=0;i<labels.length;i++)if(labels[i]>=0){let best=0,d=Infinity;const c=[values[i*3],values[i*3+1],values[i*3+2]];palette.forEach((p,k)=>{const e=sq(c,p);if(e<d){d=e;best=k;}});labels[i]=best;}
  const visited=new Uint8Array(w*h),components=[];
  for(let i=0;i<labels.length;i++){if(labels[i]<0||visited[i])continue;const label=labels[i],pixels=[i];visited[i]=1;let sx=0,sy=0;
    for(let at=0;at<pixels.length;at++){const p=pixels[at],x=p%w,y=Math.floor(p/w);sx+=x;sy+=y;const neighbors=[];if(x)neighbors.push(p-1);if(x<w-1)neighbors.push(p+1);if(y)neighbors.push(p-w);if(y<h-1)neighbors.push(p+w);for(const n of neighbors)if(!visited[n]&&labels[n]===label){visited[n]=1;pixels.push(n);}}
    if(pixels.length<minArea){pixels.forEach(p=>labels[p]=-1);continue;}components.push({label,pixels,cx:sx/pixels.length,cy:sy/pixels.length});
  }
  const contours=labelContours(labels,w,h,palette.length),masks=contours.flatMap((polygons,i)=>polygons.length?[{id:`${prefix}-${i}`,name:`${mode} ${hex(palette[i])}`,polygons}]:[]);
  const segs=guides.flatMap(g=>g.slice(1).map((p,i)=>{const a=g[i],dx=p[0]-a[0],dy=p[1]-a[1],l=dx*dx+dy*dy||1;return {a,dx,dy,l};}));
  function flow(x,y,prev){let vx=0,vy=1,best=Infinity;for(const s of segs){const t=Math.max(0,Math.min(1,((x-s.a[0])*s.dx+(y-s.a[1])*s.dy)/s.l)),d=(x-s.a[0]-t*s.dx)**2+(y-s.a[1]-t*s.dy)**2;if(d<best){best=d;vx=s.dx/Math.sqrt(s.l);vy=s.dy/Math.sqrt(s.l);}}if(prev){if(vx*prev[0]+vy*prev[1]<0){vx=-vx;vy=-vy;}vx=vx*.3+prev[0]*.7;vy=vy*.3+prev[1]*.7;}const l=Math.hypot(vx,vy)||1;return [vx/l,vy/l];}
  const covered=new Uint8Array(w*h),commands=[];
  function mark(points,width,label){const r=width*.46;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/Math.max(1,r*.35)));for(let j=0;j<=n;j++){const x=a[0]+(b[0]-a[0])*j/n,y=a[1]+(b[1]-a[1])*j/n;for(let yy=Math.max(0,Math.floor(y-r));yy<Math.min(h,Math.ceil(y+r));yy++)for(let xx=Math.max(0,Math.floor(x-r));xx<Math.min(w,Math.ceil(x+r));xx++){const p=yy*w+xx;if(labels[p]===label&&(xx+.5-x)**2+(yy+.5-y)**2<=r*r)covered[p]=1;}}}}
  // Large connected shapes first. Within a shape work outwards from its center,
  // following model-supplied form guides. Tiny islands receive a short gesture.
  components.sort((a,b)=>b.pixels.length-a.pixels.length);
  for(const comp of components){const {label,pixels,cx,cy}=comp;pixels.sort((a,b)=>(a%w-cx)**2+(Math.floor(a/w)-cy)**2-(b%w-cx)**2-(Math.floor(b/w)-cy)**2);
    for(const p of pixels){if(covered[p])continue;const x=p%w+.5,y=Math.floor(p/w)+.5,v=flow(x,y),width=Math.max(2,Math.min(brush,Math.sqrt(pixels.length)*1.15));
      function walk(sign){let q=[x,y],dir=v.map(n=>n*sign),out=[],gap=0;const step=Math.min(4,width*.32),length=Math.max(12,Math.min(maxLength,Math.sqrt(pixels.length)*3));for(let d=0;d<length/2;d+=step){dir=flow(...q,dir);q=[q[0]+dir[0]*step,q[1]+dir[1]*step];if(q[0]<rx-width/2||q[0]>rx+rw+width/2||q[1]<ry-width/2||q[1]>ry+rh+width/2)break;const xx=Math.floor(q[0]),yy=Math.floor(q[1]);const inside=xx>=0&&xx<w&&yy>=0&&yy<h&&labels[yy*w+xx]===label;gap=inside?0:gap+step;out.push(q);if(gap>Math.max(3,width*.45))break;}return out;}
      let points=[...walk(-1).reverse(),[x,y],...walk(1)];if(points.length<2)points=[[x-v[0]*3,y-v[1]*3],[x+v[0]*3,y+v[1]*3]];
      points=simplify(points,.25).map((p,i,all)=>[+p[0].toFixed(2),+p[1].toFixed(2),i===0||i===all.length-1?.85:1]);
      mark(points,width,label);covered[p]=1;
      commands.push({type:'stroke',layer,stage,mask:`${prefix}-${label}`,color:hex(palette[label]),width:+width.toFixed(2),opacity:1,pressureFloor:.8,points});
      if(commands.length>10000)throw Error('该区域超过 10000 笔，请缩小区域或增大笔刷');
    }
  }
  return {commands,masks,palette:palette.map(hex),mode,region,coverage:1,method:'reference palette + vector selections + model-guided brush coverage'};
}
