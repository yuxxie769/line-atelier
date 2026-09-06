import {throughGeometry} from './geometry.js';
import {pressureWidth} from './pressure.js';
const diagnosticDistance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/n)):0,q=[a[0]+dx*t,a[1]+dy*t];return {point:q,t,distance:Math.hypot(p[0]-q[0],p[1]-q[1])};};
const diagnosticInside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
export function diagnosticStrokes(doc,{layerIds,subphases=['clean']}={}) {
  const visible=new Set(layerIds||doc.layers.filter(l=>l.visible&&l.opacity>0&&l.role!=='construction'&&l.role!=='rough').map(l=>l.id));
  return doc.commands.filter(c=>c.type==='stroke'&&visible.has(c.layer)&&c.opacity>0&&(!subphases.length||subphases.includes(c.subphase)));
}
// No reference data or auto repair. Distances and angles propose inspection targets.
export function scanLineGaps(doc,{layerIds,subphases=['clean'],objectId,maxGap=10,angle=65,limit=120,inkAt}={}) {
  if(!Number.isFinite(maxGap)||maxGap<1||maxGap>40||!Number.isFinite(angle)||angle<0||angle>180||!Number.isInteger(limit)||limit<1||limit>500)throw Error('缺口距离 1–40 px，角度 0–180°，上限 1–500');
  if(!Array.isArray(subphases)||subphases.some(p=>!['layout','rough','structure_review','refine','clean','lineart_review'].includes(p)))throw Error('线稿子阶段无效');
  if(objectId&&!doc.scene.objects.some(o=>o.id===objectId))throw Error('检查对象不存在');
  const cs=diagnosticStrokes(doc,{layerIds,subphases}),regions=new Map(doc.scene.regions.map(r=>[r.id,throughGeometry({...r,closed:true},doc.scene).points]));
  const hidden=(p,c)=>doc.scene.occlusions.some(o=>o.back===c.objectId&&diagnosticInside(p,regions.get(o.regionId)));
  const nearCover=(p,c)=>doc.scene.occlusions.some(o=>{if(o.back!==c.objectId)return false;const ps=regions.get(o.regionId);return ps.some((a,i)=>diagnosticDistance(p,a,ps[(i+1)%ps.length]).distance<=1);});
  const selected=new Set(objectId?[objectId]:cs.map(c=>c.objectId));if(objectId){let changed=true;while(changed){changed=false;for(const o of doc.scene.objects)if(selected.has(o.parent)&&!selected.has(o.id)){selected.add(o.id);changed=true;}}}
  const cell=32,grid=new Map(),lengths=new Map(),segments=[];
  for(const c of cs){const ls=[0],ps=c.closed?[...c.points,c.points[0]]:c.points;for(let i=1;i<ps.length;i++)ls.push(ls.at(-1)+Math.hypot(ps[i][0]-ps[i-1][0],ps[i][1]-ps[i-1][1]));lengths.set(c.id,ls);
    for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i],seg={c,a,b,i,start:ls[i-1],length:ls[i]-ls[i-1]},id=segments.push(seg)-1;
      for(let x=Math.floor(Math.min(a[0],b[0])/cell);x<=Math.floor(Math.max(a[0],b[0])/cell);x++)for(let y=Math.floor(Math.min(a[1],b[1])/cell);y<=Math.floor(Math.max(a[1],b[1])/cell);y++){const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(id);}}
  }
  const nearby=p=>{const ids=new Set();for(let x=Math.floor((p[0]-maxGap)/cell);x<=Math.floor((p[0]+maxGap)/cell);x++)for(let y=Math.floor((p[1]-maxGap)/cell);y<=Math.floor((p[1]+maxGap)/cell);y++)for(const id of grid.get(x+','+y)||[])ids.add(id);return [...ids].map(i=>segments[i]);};
  const issues=[],pairs=new Set();let checked=0,occluded=0,connected=0;const cos=Math.cos(angle*Math.PI/180);
  for(const c of cs){if(!selected.has(c.objectId))continue;const ps=c.points,ls=lengths.get(c.id),total=ls.at(-1);
    if(total<2&&ps.length){if(!hidden(ps[0],c)&&(!inkAt||inkAt(ps[0])))issues.push({kind:'short-stroke',strokeId:c.id,objectId:c.objectId,point:ps[0].slice(0,2),length:total,severity:'inspect'});}
    if(c.closed||ps.length<2)continue;
    for(const end of ['start','end']){const first=end==='start',p=first?ps[0]:ps.at(-1);if(hidden(p,c)||nearCover(p,c)||inkAt&&!inkAt(p)){occluded++;continue;}checked++;
      let j=first?1:ps.length-2;while(first?j<ps.length-1:j>0){if(Math.hypot(ps[j][0]-p[0],ps[j][1]-p[1])>=2)break;j+=first?1:-1;}
      const direction=[p[0]-ps[j][0],p[1]-ps[j][1]],mag=Math.hypot(...direction)||1,radius=pressureWidth(c,p[2]??1,first?0:1)/2;let contact=false,best=null;
      for(const seg of nearby(p)){const d=diagnosticDistance(p,seg.a,seg.b),along=seg.start+d.t*seg.length;
        if(seg.c.id===c.id&&(first?along:total-along)<Math.max(maxGap*2,c.width*2))continue;
        if(d.distance>maxGap||hidden(d.point,seg.c)||inkAt&&!inkAt(d.point))continue;
        const pr=(seg.a[2]??1)+( (seg.b[2]??1)-(seg.a[2]??1))*d.t,gap=Math.max(0,d.distance-radius-pressureWidth(seg.c,pr,along/(lengths.get(seg.c.id).at(-1)||1))/2);
        if(gap<=.35){contact=true;break;}
        const alignment=((d.point[0]-p[0])*direction[0]+(d.point[1]-p[1])*direction[1])/(mag*d.distance||1);
        if(alignment<cos)continue;
        const score=gap+(1-alignment)*maxGap*.4+(seg.c.objectId===c.objectId?0:1);
        if(!best||score<best.score)best={...d,score,gap,strokeId:seg.c.id,objectId:seg.c.objectId};
      }
      if(contact){connected++;continue;}
      if(best){const midpoint=[(p[0]+best.point[0])/2,(p[1]+best.point[1])/2],key=[c.id,best.strokeId].sort().join('|')+'|'+midpoint.map(v=>Math.round(v/2)).join(',');if(pairs.has(key))continue;pairs.add(key);}
      issues.push({kind:best?'gap':'dangling',severity:best?'candidate':'inspect',strokeId:c.id,objectId:c.objectId,end,claim:c.endpoints?.[first?0:1]||'unspecified',point:p.slice(0,2),...(best?{target:best.point,targetStrokeId:best.strokeId,targetObjectId:best.objectId,distance:+best.distance.toFixed(2),gap:+best.gap.toFixed(2)}:{})});
    }
  }
  issues.sort((a,b)=>(a.kind==='gap'?0:1)-(b.kind==='gap'?0:1));
  return {revision:doc.revision,checked,connected,occluded,total:issues.length,counts:Object.fromEntries(['gap','dangling','short-stroke'].map(k=>[k,issues.filter(x=>x.kind===k).length])),issues:issues.slice(0,limit).map((x,i)=>({id:'issue-'+i,...x})),truncated:issues.length>limit,settings:{maxGap,angle,subphases},limitation:'疑点不是错误判定。开放发丝、衣褶与留白须目视判断；不会自动补线或批准线稿。'};
}
// Four-connected flood on the rendered ink alpha. No dilation/virtual closure.
export function floodLineRegion({alpha,width,height,seed,threshold=24,targets=[]}) {
  if(!(alpha instanceof Uint8Array||alpha instanceof Uint8ClampedArray)||alpha.length!==width*height||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4500000)throw Error('检查图尺寸无效或过大');
  if(!Number.isFinite(threshold)||threshold<1||threshold>255||!Array.isArray(seed)||seed.length!==2||seed.some(v=>!Number.isInteger(v))||seed[0]<0||seed[1]<0||seed[0]>=width||seed[1]>=height)throw Error('种子点或透明度阈值无效');
  if(!Array.isArray(targets)||targets.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isInteger(v))||p[0]<0||p[1]<0||p[0]>=width||p[1]>=height))throw Error('比较点超出检查图');
  const start=seed[1]*width+seed[0],visited=new Uint8Array(alpha.length);if(alpha[start]>=threshold)return {status:'on-line',visited,pixels:0,reachesBorder:false,targets:targets.map(()=>false)};
  const queue=new Int32Array(alpha.length);let head=0,tail=1;queue[0]=start;visited[start]=1;let border=false,xmin=width,ymin=height,xmax=0,ymax=0;
  while(head<tail){const id=queue[head++],x=id%width,y=Math.floor(id/width);xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);if(!x||!y||x===width-1||y===height-1)border=true;
    const add=n=>{if(!visited[n]&&alpha[n]<threshold){visited[n]=1;queue[tail++]=n;}};
    if(x) add(id-1);if(x+1<width)add(id+1);if(y)add(id-width);if(y+1<height)add(id+width);
  }
  return {status:border?'open':'enclosed',visited,pixels:tail,reachesBorder:border,bounds:[xmin,ymin,xmax-xmin+1,ymax-ymin+1],targets:targets.map(p=>!!visited[p[1]*width+p[0]])};
}
