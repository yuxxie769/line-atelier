// Deterministic post-stroke smoothing in document pixels. No reference-image input.
// The original geometry is retained by model.js; setting strength to zero restores it.
export function smoothStrokePoints(points,strength,protectedPoints=[]){
  if(!Number.isFinite(strength)||strength<0||strength>1)throw Error('smoothing 必须在 0–1 之间');
  if(!strength)return points;
  if(!Array.isArray(points)||!points.length||points.some(p=>!Array.isArray(p)||p.length<2||!p.every(Number.isFinite)))throw Error('平滑需要有效的笔迹坐标');
  if(points.length<3)return points;
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  const total=lengths.at(-1);if(!total)return points;
  const locks=new Set([0,points.length-1]);
  for(const p of protectedPoints){let best=-1,d=1e-6;points.forEach((q,i)=>{const v=Math.hypot(q[0]-p[0],q[1]-p[1]);if(v<d){best=i;d=v;}});if(best>=0)locks.add(best);}
  // Preserve hard turns in sampled/path input too, without interpreting their meaning.
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],b=points[i],c=points[i+1],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],m=Math.hypot(...u)*Math.hypot(...v);
    if(m&&((u[0]*v[0]+u[1]*v[1])/m)<Math.cos(Math.PI/4))locks.add(i);
  }
  const indices=[...locks].sort((a,b)=>a-b),out=[];
  const radius=Math.min(32,Math.max(4,total*.06))*Math.sqrt(strength),limit=Math.min(4,total*.01)*strength;
  // Sample uniformly by arc length, so point density does not change the effect.
  // Bound total work and output size even for long strokes with many fixed corners.
  const spacing=Math.max(.75,total/Math.max(1,3900-indices.length));
  for(let k=1;k<indices.length;k++){
    const lo=indices[k-1],hi=indices[k],length=lengths[hi]-lengths[lo];
    if(!length){if(!out.length)out.push([...points[lo]]);out.push([...points[hi]]);continue;}
    const n=Math.max(1,Math.ceil(length/spacing)),step=length/n,ps=[];let j=lo+1;
    for(let i=0;i<=n;i++){
      if(i===0){ps.push([...points[lo]]);continue;}if(i===n){ps.push([...points[hi]]);continue;}
      const s=lengths[lo]+i*step;while(j<hi&&lengths[j]<s)j++;
      const a=points[j-1],b=points[j],t=(s-lengths[j-1])/(lengths[j]-lengths[j-1]||1);
      ps.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,...(a.length>2||b.length>2?[(a[2]??1)+((b[2]??1)-(a[2]??1))*t]:[])]);
    }
    let filtered=ps.map(p=>p.slice(0,2));
    const window=Math.max(1,Math.round(radius/step/2));
    // Three symmetric box passes approximate a smooth kernel in linear time.
    for(let pass=0;pass<3;pass++){
      const sums=[[0,0]];for(const p of filtered)sums.push([sums.at(-1)[0]+p[0],sums.at(-1)[1]+p[1]]);
      filtered=filtered.map((p,i)=>{const a=Math.max(0,i-window),b=Math.min(n,i+window),count=b-a+1;return [(sums[b+1][0]-sums[a][0])/count,(sums[b+1][1]-sums[a][1])/count];});
    }
    for(let i=out.length?1:0;i<=n;i++){
      const p=ps[i];if(!i||i===n){out.push(p);continue;}
      // Fade displacement quadratically near fixed points to retain their direction.
      const t=Math.min(1,Math.min(i,n-i)*step/(radius*2)),fade=t*t*(3-2*t);
      const dx=filtered[i][0]-p[0],dy=filtered[i][1]-p[1],d=Math.hypot(dx,dy),factor=fade*limit/(limit+d);
      out.push([p[0]+dx*factor,p[1]+dy*factor,...p.slice(2)]);
    }
  }
  return out;
}
