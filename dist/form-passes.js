// Reference-assisted brushwork. Seeds are ordered by missing paint, never scanline order.
// The agent supplies semantic regions and curved flow guides. Each returned command is
// one continuous, pressure-varying path; no image compositing or polygon fill is used.
export function formPass(source, painted, options={}) {
  const {width:w,height:h,data:src}=source;
  const {region=[0,0,w,h],guides=[],brush=8,tolerance=24,minError=12,minLength=6,stage='base',layer='paper',maxStrokes=7000,seed=71}=options;
  if(!Number.isFinite(brush)||brush<1||brush>40)throw Error('brush 需要在 1–40 px 之间');
  if(!Number.isFinite(tolerance)||tolerance<1||tolerance>100)throw Error('tolerance 需要在 1–100 之间');
  if(!Number.isFinite(minError)||minError<1||minError>100)throw Error('minError 需要在 1–100 之间');
  if(!Number.isFinite(minLength)||minLength<3||minLength>80)throw Error('minLength 需要在 3–80 px 之间');
  if(!Array.isArray(region)||region.length!==4||region.some(v=>!Number.isFinite(v))||region[0]<0||region[1]<0||region[2]<=0||region[3]<=0||region[0]+region[2]>w||region[1]+region[3]>h)throw Error('region 必须在画布内');
  if(!Array.isArray(guides)||guides.length>40||guides.some(g=>!Array.isArray(g)||g.length<2||g.length>300||g.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)))))throw Error('guides 需要二维路径坐标');
  const dst=new Uint8ClampedArray(painted.data),commands=[];let rng=seed>>>0;
  const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  const [rx,ry,rw,rh]=region;
  const inside=(x,y)=>x>=rx&&x<rx+rw&&y>=ry&&y<ry+rh;
  const idx=(x,y)=>(Math.max(0,Math.min(h-1,Math.round(y)))*w+Math.max(0,Math.min(w-1,Math.round(x))))*4;
  const paintable=(x,y)=>{if(!inside(x,y))return false;const i=idx(x,y);return src[i]<252||src[i+1]<252||src[i+2]<252;};
  const diff=(data,i,c)=>Math.hypot(data[i]-c[0],data[i+1]-c[1],data[i+2]-c[2]);
  const error=i=>Math.hypot(src[i]-dst[i],src[i+1]-dst[i+1],src[i+2]-dst[i+2]);
  const segments=guides.flatMap(g=>g.slice(1).map((p,i)=>{const a=g[i],dx=p[0]-a[0],dy=p[1]-a[1],l=Math.hypot(dx,dy)||1;return {a,dx,dy,l,v:[dx/l,dy/l]};}));
  function field(x,y,previous){
    let v=[0,1],best=Infinity;
    for(const s of segments){const t=Math.max(0,Math.min(1,((x-s.a[0])*s.dx+(y-s.a[1])*s.dy)/(s.l*s.l))),dx=x-s.a[0]-t*s.dx,dy=y-s.a[1]-t*s.dy,d=dx*dx+dy*dy;if(d<best){best=d;v=s.v;}}
    // Strong image edges gently steer a stroke along the boundary, while the model's
    // guides determine direction inside flat shapes (hair, legs, sleeves, tail).
    const q=Math.max(1,Math.min(3,brush*.45)),l=idx(x-q,y),r=idx(x+q,y),t=idx(x,y-q),b=idx(x,y+q);
    let gx=0,gy=0;for(let k=0;k<3;k++){gx+=src[r+k]-src[l+k];gy+=src[b+k]-src[t+k];}
    const strength=Math.hypot(gx,gy);if(strength>35){let e=[-gy/strength,gx/strength];if(e[0]*v[0]+e[1]*v[1]<0)e=e.map(n=>-n);const weight=Math.min(.85,strength/180);v=[v[0]*(1-weight)+e[0]*weight,v[1]*(1-weight)+e[1]*weight];}
    if(previous){if(v[0]*previous[0]+v[1]*previous[1]<0)v=v.map(n=>-n);v=[v[0]*.45+previous[0]*.55,v[1]*.45+previous[1]*.55];}
    const length=Math.hypot(...v)||1;return v.map(n=>n/length);
  }
  function radiusAt(x,y,color,v){
    let radius=brush/2;
    for(let n=0;n<7;n++){
      let good=true;for(const [a,b] of [[v[1],-v[0]],[-v[1],v[0]],[v[0],v[1]],[-v[0],-v[1]],[.707,.707],[-.707,.707],[.707,-.707],[-.707,-.707]]){const xx=x+a*radius,yy=y+b*radius;if(!paintable(xx,yy)||diff(src,idx(xx,yy),color)>tolerance*1.25){good=false;break;}}
      if(good||radius<.55)break;radius*=.72;
    }
    return Math.max(.35,radius*.94);
  }
  function mark(points,color,width){
    function disc(x,y,r){for(let yy=Math.max(0,Math.ceil(y-r));yy<=Math.min(h-1,Math.floor(y+r));yy++)for(let xx=Math.max(0,Math.ceil(x-r));xx<=Math.min(w-1,Math.floor(x+r));xx++){if((xx-x)**2+(yy-y)**2>r*r)continue;const i=(yy*w+xx)*4;dst[i]=color[0];dst[i+1]=color[1];dst[i+2]=color[2];dst[i+3]=255;}}
    for(let k=0;k<points.length;k++){const a=points[Math.max(0,k-1)],b=points[k],n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])));for(let j=0;j<=n;j++){const t=j/n;disc(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,width*(.2+.8*(a[2]+(b[2]-a[2])*t))/2);}}
  }
  const candidates=[],spacing=Math.max(1.1,brush*.55);
  for(let y=ry+spacing/2;y<ry+rh;y+=spacing)for(let x=rx+spacing/2;x<rx+rw;x+=spacing){const xx=Math.min(rx+rw-.51,x+(random()-.5)*spacing*.65),yy=Math.min(ry+rh-.51,y+(random()-.5)*spacing*.65),i=idx(xx,yy);if(src[i]>251&&src[i+1]>251&&src[i+2]>251)continue;const e=error(i);if(e>=minError)candidates.push({x:xx,y:yy,priority:e*(.75+random()*.5)});}
  candidates.sort((a,b)=>b.priority-a.priority);
  for(const candidate of candidates){
    if(commands.length>=Math.min(10000,maxStrokes))break;
    const {x,y}=candidate,i=idx(x,y);if(error(i)<minError)continue;
    const color=[src[i],src[i+1],src[i+2]],v=field(x,y),step=Math.max(.85,Math.min(3,brush*.35));
    function walk(sign){let p=[x,y],dir=v.map(n=>n*sign),out=[],length=0,quiet=0;const maxLength=Math.min(180,30+brush*14)*(.8+random()*.4);
      while(length<maxLength/2){dir=field(p[0],p[1],dir);const q=[p[0]+dir[0]*step,p[1]+dir[1]*step];if(!paintable(...q)||diff(src,idx(...q),color)>tolerance)break;
        quiet=error(idx(...q))<minError*.65?quiet+1:0;if(quiet>5)break;
        const r=radiusAt(q[0],q[1],color,dir);out.push([q[0],q[1],r]);p=q;length+=step;
      }return out;}
    let points=[...walk(-1).reverse(),[x,y,radiusAt(x,y,color,v)],...walk(1)];
    const pathLength=points.reduce((n,p,k)=>k?n+Math.hypot(p[0]-points[k-1][0],p[1]-points[k-1][1]):0,0);
    if(pathLength<minLength)continue;
    const width=Math.max(1,...points.map(p=>p[2]*2));
    points=points.map((p,k)=>[+p[0].toFixed(2),+p[1].toFixed(2),+Math.max(0,Math.min(1,(p[2]*2/width-.2)/.8)).toFixed(3)]);
    // Restrained taper on coherent long strokes; small boundary repairs keep coverage.
    if(points.length>8){for(const k of [0,points.length-1])points[k][2]*=.76;}
    mark(points,color,width);
    commands.push({type:'stroke',stage,layer,color:'#'+color.map(n=>n.toString(16).padStart(2,'0')).join(''),width:+width.toFixed(2),opacity:1,points});
  }
  return {commands,method:'model-guided curved brush paths',region,brush};
}
