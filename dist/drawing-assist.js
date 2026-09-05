import {scanLineGaps,floodLineRegion} from './diagnostics.js';
import {renderLineMask,strokeRaster,renderRegion} from './renderer.js';
import {validatePressureProfile,pressureAt,applyPressureProfile} from './pressure.js';

export function createDrawingAssist(engine,{save,record,toast,review,objectId,brush}) {
  const el=id=>document.getElementById(id),overlay=el('diagnostic-overlay'),ox=overlay.getContext('2d');
  let cache=null,gaps=null,leak=null,picking=false,focused=null,lastDoc=engine.doc,lastSignature='',applying=false;
  const signature=()=>engine.doc.revision+'|'+engine.cursor+'|'+engine.doc.layers.map(l=>[l.id,l.visible,l.opacity,l.clipTo,l.hideAtCommand,l.hideAtStage].join(':')).join('|');
  const phaseOptions=()=>el('audit-phase').value==='all'?[]:[el('audit-phase').value];
  const safeTask=fn=>async()=>{try{await fn();}catch(e){toast(e.message);el('audit-status').textContent=e.message;}};
  const waitPaint=()=>new Promise(resolve=>setTimeout(resolve,0));
  function mask(subphases){if(!Array.isArray(subphases)||subphases.some(p=>!['layout','rough','structure_review','refine','clean','lineart_review'].includes(p)))throw Error('线稿子阶段无效');if(engine.playing||engine.cursor<engine.index.total)throw Error('请先显示完成作品，再检查线稿');const key=signature()+'|'+subphases.join(',');if(cache?.key!==key)cache={key,...renderLineMask(engine,{subphases})};return cache;}
  function drawOverlay(){
    if(overlay.width!==engine.doc.width||overlay.height!==engine.doc.height){overlay.width=engine.doc.width;overlay.height=engine.doc.height;}
    ox.clearRect(0,0,overlay.width,overlay.height);if(!el('audit-overlay').checked)return;
    if(leak?.canvas){ox.save();ox.globalAlpha=.38;ox.drawImage(leak.canvas,0,0,overlay.width,overlay.height);ox.restore();}
    const z=overlay.getBoundingClientRect().width/engine.doc.width||1;
    for(const issue of gaps?.issues||[]){const active=focused===issue.id;ox.strokeStyle=issue.kind==='gap'?'#dc298b':'#bd7400';ox.lineWidth=(active?2.5:1.3)/z;ox.beginPath();ox.arc(...issue.point,(active?7:4)/z,0,Math.PI*2);ox.stroke();if(issue.target){ox.setLineDash([3/z,3/z]);ox.beginPath();ox.moveTo(...issue.point);ox.lineTo(...issue.target);ox.stroke();ox.setLineDash([]);}}
    if(leak?.seed){ox.fillStyle='#007485';ox.beginPath();ox.arc(...leak.seed,4/z,0,Math.PI*2);ox.fill();}
  }
  function clear(reason=''){cache=null;gaps=null;leak=null;focused=null;drawOverlay();el('audit-list').replaceChildren();if(reason)el('audit-status').textContent=reason;el('leak-status').textContent='';}
  function focusIssue(issue){focused=issue.id;drawOverlay();const size=Math.min(140,engine.doc.width,engine.doc.height),x=Math.max(0,Math.min(engine.doc.width-size,issue.point[0]-size/2)),y=Math.max(0,Math.min(engine.doc.height-size,issue.point[1]-size/2));review([x,y,size,size]);}
  const names={gap:'疑似缺口',dangling:'开放线端','short-stroke':'短小笔迹'};
  async function scan({maxGap=10,angle=65,limit=120,objectId:selection,subphases=['clean']}={}) {
    el('audit-status').textContent='正在扫描可见线稿…';await waitPaint();const m=mask(subphases),sig=signature();
    const inkAt=p=>{const x=Math.round(p[0]*m.scaleX),y=Math.round(p[1]*m.scaleY);for(let a=Math.max(0,x-2);a<=Math.min(m.width-1,x+2);a++)for(let b=Math.max(0,y-2);b<=Math.min(m.height-1,y+2);b++)if(m.alpha[b*m.width+a]>8)return true;return false;};
    gaps=scanLineGaps(engine.doc,{maxGap,angle,limit,objectId:selection,subphases,layerIds:engine.doc.layers.filter(l=>engine.layerVisible(l)&&l.opacity>0).map(l=>l.id),inkAt});
    el('audit-overlay').checked=true;lastSignature=sig;
    el('audit-status').textContent=`${gaps.counts.gap} 处疑似缺口 · ${gaps.counts.dangling} 个开放线端 · ${gaps.counts['short-stroke']} 条短笔迹。${gaps.truncated?'仅显示前 '+limit+' 项。':''}需逐项判断，不代表结构错误。`;
    el('audit-list').replaceChildren(...gaps.issues.map(issue=>{const button=document.createElement('button');button.className='audit-issue';button.textContent=`${names[issue.kind]} · ${issue.gap!==undefined?issue.gap+' px · ':''}${engine.doc.scene.objects.find(o=>o.id===issue.objectId)?.name||issue.strokeId}`;button.title=issue.strokeId;button.onclick=()=>focusIssue(issue);return button;}));drawOverlay();return {...gaps,overlay:true,documentChanged:false};
  }
  async function previewLeak({seed,targets=[],threshold=24,subphases=['clean']}={}) {
    if(!Array.isArray(seed)||seed.length!==2||seed.some((v,i)=>!Number.isFinite(v)||v<0||v>=(i?engine.doc.height:engine.doc.width)))throw Error('请选择画布内的区域种子点');
    if(!Array.isArray(targets)||targets.length>16||targets.some(p=>!Array.isArray(p)||p.length!==2||p.some((v,i)=>!Number.isFinite(v)||v<0||v>=(i?engine.doc.height:engine.doc.width))))throw Error('比较点须位于画布内，最多 16 个');
    el('leak-status').textContent='正在检查区域连通性…';await waitPaint();const m=mask(subphases),pixel=p=>[Math.floor(p[0]*m.scaleX),Math.floor(p[1]*m.scaleY)];
    const result=floodLineRegion({...m,seed:pixel(seed),targets:targets.map(pixel),threshold});
    const c=document.createElement('canvas');c.width=m.width;c.height=m.height;const cx=c.getContext('2d'),im=cx.createImageData(c.width,c.height),color=result.reachesBorder?[237,124,46]:[15,163,180];
    for(let i=0;i<result.visited.length;i++)if(result.visited[i]){im.data.set(color,i*4);im.data[i*4+3]=255;}cx.putImageData(im,0,0);
    const summary={revision:engine.doc.revision,status:result.status,reachesBorder:result.reachesBorder,pixels:result.pixels,areaInDocumentPixels:Math.round(result.pixels/m.scaleX/m.scaleY),targets:targets.map((p,i)=>({point:p,connected:result.targets[i]})),seed:[...seed],threshold,resolution:[m.width,m.height],scale:[m.scaleX,m.scaleY],documentChanged:false,limitation:'连通性基于可见线稿的透明度与分辨率；开放背景不等于漏画。结合物体语义与比较点判断，未自动封口。'};
    leak={...summary,canvas:c};el('audit-overlay').checked=true;
    el('leak-status').textContent=result.status==='on-line'?'种子点落在线上，请点区域内部。':result.reachesBorder?'橙色：这个区域通到画布边缘。若本应封闭，请复查缺口。':'青色：这个区域在当前阈值下封闭。仍需确认它属于正确物体。';lastSignature=signature();drawOverlay();return summary;
  }
  const responsePresets={linear:[[0,0],[1,1]],firm:[[0,0],[.25,.08],[.5,.25],[.75,.56],[1,1]],soft:[[0,0],[.25,.5],[.5,.72],[.75,.88],[1,1]]};
  function curveFromUI(){return responsePresets[el('pressure-response').value]||validatePressureProfile(JSON.parse(el('pressure-response-json').value),'压感响应');}
  function profileFromUI(){return el('pressure-use-profile').checked?validatePressureProfile(JSON.parse(el('pressure-profile-json').value)):null;}
  function pressureSettings(){return {pressureFloor:Number(el('pressure-min').value)/100,pressureCurve:curveFromUI(),pressureProfile:profileFromUI()};}
  function previewPressure(){try{const c={...brush(),...pressureSettings()},canvas=el('pressure-preview'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);const points=Array.from({length:101},(_,i)=>[10+i*2.5,45-18*Math.sin(i/100*Math.PI),.15+.85*Math.sin(i/100*Math.PI)]);strokeRaster(ctx,c,applyPressureProfile(points,c.pressureProfile));el('pressure-min-value').textContent=el('pressure-min').value+'%';el('pressure-response-json').hidden=el('pressure-response').value!=='custom';el('pressure-profile-json').disabled=!el('pressure-use-profile').checked;}catch(e){el('pressure-status').textContent=e.message;}}
  function selectedStroke(){return engine.doc.commands.find(c=>c.id===el('pressure-stroke').value);}
  function loadPressure(){const c=selectedStroke();if(!c)return;el('pressure-min').value=(c.pressureFloor??.2)*100;const curve=c.pressureCurve||responsePresets.linear,key=Object.keys(responsePresets).find(k=>JSON.stringify(responsePresets[k])===JSON.stringify(curve));el('pressure-response').value=key||'custom';el('pressure-response-json').value=JSON.stringify(curve);el('pressure-use-profile').checked=!!c.pressureProfile;
    // Sample actual retained pressure for a useful starting curve, not a generic taper.
    if(c.pressureProfile)el('pressure-profile-json').value=JSON.stringify(c.pressureProfile);else{const ps=c.points,ls=[0];for(let i=1;i<ps.length;i++)ls.push(ls.at(-1)+Math.hypot(ps[i][0]-ps[i-1][0],ps[i][1]-ps[i-1][1]));const total=ls.at(-1)||1;el('pressure-profile-json').value=JSON.stringify([0,.25,.5,.75,1].map(t=>{let i=ls.findIndex(d=>d>=t*total);if(i<0)i=ps.length-1;return [t,+(ps[i][2]??1).toFixed(3)];}));}
    previewPressure();el('pressure-status').textContent='已读取所选笔迹；应用后可撤销。';
  }
  function updateStrokeOptions(){const id=el('pressure-stroke').value,object=objectId(),rows=engine.doc.commands.filter(c=>c.type==='stroke'&&(!object||object==='figure'||c.objectId===object)).sort((a,b)=>(a.subphase==='clean'?0:1)-(b.subphase==='clean'?0:1));el('pressure-stroke').replaceChildren(...rows.map(c=>new Option((c.part||c.subphase)+' · '+c.id,c.id)));if(rows.some(c=>c.id===id))el('pressure-stroke').value=id;el('pressure-apply').disabled=el('width-apply').disabled=!rows.length;}
  async function editPressure(options){const result=engine.editPressure(options);save();record('调整笔迹轻重：'+options.note);return result;}
  el('scan-gaps').onclick=safeTask(()=>scan({maxGap:Number(el('audit-distance').value),angle:Number(el('audit-angle').value),subphases:phaseOptions(),...(el('audit-scope').value==='object'&&objectId()?{objectId:objectId()}:{})}));
  el('audit-overlay').onchange=drawOverlay;el('audit-clear').onclick=()=>clear('已清除检查覆盖层');
  el('audit-phase').onchange=()=>clear('检查阶段已更换，请重新扫描');
  el('leak-pick').onclick=()=>{picking=!picking;el('leak-pick').textContent=picking?'取消取点':'在画布上选择区域';el('leak-pick').setAttribute('aria-pressed',String(picking));el('leak-status').textContent=picking?'点击需要检查的区域内部，不会落笔。':'';};
  el('leak-run').onclick=safeTask(()=>previewLeak({seed:[Number(el('leak-x').value),Number(el('leak-y').value)],threshold:Number(el('leak-threshold').value),subphases:phaseOptions()}));
  el('pressure-response').onchange=previewPressure;el('pressure-min').oninput=previewPressure;el('pressure-use-profile').onchange=previewPressure;el('pressure-profile-json').oninput=previewPressure;el('pressure-response-json').oninput=previewPressure;
  el('pressure-load').onclick=loadPressure;
  el('pressure-apply').onclick=safeTask(async()=>{const c=selectedStroke();if(!c)throw Error('请选择笔迹');applying=true;try{await editPressure({ids:[c.id],...pressureSettings(),note:'调整所选线条的压力响应与提按'});el('pressure-status').textContent='已应用压力，可撤销；请重新复核接头与轻重。';}finally{applying=false;}});
  el('width-apply').onclick=safeTask(async()=>{const c=selectedStroke();if(!c)throw Error('请选择笔迹');applying=true;try{await editPressure({ids:[c.id],range:[Number(el('width-start').value)/100,Number(el('width-end').value)/100],factor:Number(el('width-factor').value),feather:Number(el('width-feather').value)/100,note:'局部调整线宽，保持笔迹中心线位置'});loadPressure();el('pressure-status').textContent='已修改局部线宽，中心线位置不变。';}finally{applying=false;}});
  el('pressure-stroke').onchange=loadPressure;
  el('pressure-stop-add').onclick=safeTask(()=>{const t=Number(el('pressure-stop-position').value)/100,p=Number(el('pressure-stop-value').value)/100;if(!Number.isFinite(t)||!Number.isFinite(p)||t<0||t>1||p<0||p>1)throw Error('位置和压力需要 0–100%');const nodes=validatePressureProfile(JSON.parse(el('pressure-profile-json').value)).filter(v=>Math.abs(v[0]-t)>1e-6);nodes.push([t,p]);nodes.sort((a,b)=>a[0]-b[0]);el('pressure-profile-json').value=JSON.stringify(validatePressureProfile(nodes));el('pressure-use-profile').checked=true;previewPressure();});
  el('pressure-stroke-view').onclick=safeTask(()=>{const c=selectedStroke();if(!c)throw Error('请选择笔迹');const g=engine.geometry[engine.doc.commands.indexOf(c)],pad=15,[x,y,w,h]=g.bounds,r=[Math.max(0,x-pad),Math.max(0,y-pad),0,0];r[2]=Math.min(engine.doc.width,x+w+pad)-r[0];r[3]=Math.min(engine.doc.height,y+h+pad)-r[1];review(r);});
  function refresh(){const sig=signature();if(engine.doc!==lastDoc||lastSignature&&sig!==lastSignature){clear('画布、播放位置或图层已改变，请重新检查');lastDoc=engine.doc;lastSignature='';}if(!applying)updateStrokeOptions();drawOverlay();}
  engine.addEventListener('change',refresh);engine.addEventListener('layers',refresh);engine.addEventListener('frame',()=>{if(lastSignature&&signature()!==lastSignature){clear('播放位置已改变，请显示完成作品后重新检查');lastSignature='';}});
  el('layer-opacity').addEventListener('input',()=>{clear('图层透明度已改变，请重新检查');lastSignature='';});el('object-select').addEventListener('change',updateStrokeOptions);
  new ResizeObserver(drawOverlay).observe(overlay);updateStrokeOptions();previewPressure();
  return {scan,previewLeak,editPressure,clear:()=>{clear('已清除检查覆盖层');return {cleared:true,documentChanged:false};},pressureSettings,previewPressure,
    pick(point){if(!picking)return false;picking=false;el('leak-pick').textContent='在画布上选择区域';el('leak-pick').setAttribute('aria-pressed','false');el('leak-x').value=point[0].toFixed(2);el('leak-y').value=point[1].toFixed(2);safeTask(()=>previewLeak({seed:point.slice(0,2),threshold:Number(el('leak-threshold').value),subphases:phaseOptions()}))();return true;},
    getDiagnostics({includeImage=false,region=[0,0,engine.doc.width,engine.doc.height],scale=1}={}){const result={revision:engine.doc.revision,gaps,leak:leak?Object.fromEntries(Object.entries(leak).filter(([k])=>k!=='canvas')):null};
      if(includeImage){if(!Array.isArray(region)||region.length!==4||region.some(v=>!Number.isFinite(v))||region[0]<0||region[1]<0||region[2]<=0||region[3]<=0||region[0]+region[2]>engine.doc.width||region[1]+region[3]>engine.doc.height||!Number.isFinite(scale)||scale<.25||scale>4||Math.max(region[2],region[3])*scale>2048)throw Error('标注截图区域无效，最长边最多 2048 px');
        const c=renderRegion(engine,{region,scale,mirror:false}),x=c.getContext('2d');x.setTransform(1,0,0,1,0,0);x.drawImage(overlay,...region,0,0,c.width,c.height);result.image={dataUrl:c.toDataURL('image/png'),region,scale,width:c.width,height:c.height,overlayVisible:el('audit-overlay').checked};}
      return result;}

  };
}
