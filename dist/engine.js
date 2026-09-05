import {commandUnits,planIndex,validateBatch,validateDocument} from './model.js';
export class PaintEngine extends EventTarget {
  constructor(canvas,document){super();this.canvas=canvas;this.ctx=canvas.getContext('2d');this.speed=1;this.playing=false;this.generation=0;this.undoStack=[];this.redoStack=[];this.load(document);}
  load(doc){this.pause();this.doc=validateDocument(doc);this.canvas.width=doc.width;this.canvas.height=doc.height;this.reindex();this.resetLayers();this.cursor=0;this.renderTo(this.index.total);this.emit('change');}
  reindex(){this.index=planIndex(this.doc.commands);}
  resetLayers(){this.surfaces=new Map(this.doc.layers.map(l=>{const c=document.createElement('canvas');c.width=this.doc.width;c.height=this.doc.height;return [l.id,c];}));this.rendered=0;this.commandIndex=0;this.unitIndex=0;}
  emit(type){this.dispatchEvent(new CustomEvent(type,{detail:this.state()}));}
  state(){const i=this.commandIndex;return {width:this.doc.width,height:this.doc.height,title:this.doc.title,commands:this.doc.commands.length,completed:Math.min(i,this.doc.commands.length),cursor:this.cursor,total:this.index.total,progress:this.index.total?this.cursor/this.index.total:0,playing:this.playing,stage:this.doc.commands[Math.min(i,this.doc.commands.length-1)]?.stage||this.doc.stages[0].id,current:this.doc.commands[Math.min(i,this.doc.commands.length-1)]||null,layers:this.doc.layers,stages:this.doc.stages};}
  remember(){this.undoStack.push(structuredClone(this.doc));if(this.undoStack.length>20)this.undoStack.shift();this.redoStack=[];}
  undo(){if(!this.undoStack.length)return false;const d=this.undoStack.pop();this.redoStack.push(structuredClone(this.doc));this.load(d);return true;}
  redo(){if(!this.redoStack.length)return false;const d=this.redoStack.pop();this.undoStack.push(structuredClone(this.doc));this.load(d);return true;}
  async submit(commands,opts={}){const cs=validateBatch(commands,this.doc,opts);if(opts.history!==false)this.remember();this.pause();this.renderTo(this.index.total);const before=this.index.total;this.doc.commands.push(...cs);this.reindex();this.cursor=before;this.emit('change');if(opts.animate===false)this.renderTo(this.index.total);else this.play();return {accepted:cs.length,commandIds:cs.map(c=>c.id),...this.state()};}
  drawUnit(c,u){const x=this.surfaces.get(c.layer).getContext('2d');x.globalCompositeOperation=c.type==='erase'?'destination-out':'source-over';x.globalAlpha=c.opacity;x.strokeStyle=c.color;x.fillStyle=c.color;x.lineCap='round';x.lineJoin='round';
    if(c.type==='fill'){x.beginPath();c.points.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.closePath();x.fill();return;}
    const a=c.points[Math.min(u,c.points.length-1)],b=c.points[(u+1)%c.points.length]||a;x.lineWidth=c.width*(.2+.8*((a[2]??1)+(b[2]??1))/2);
    if(c.points.length===1){x.beginPath();x.arc(a[0],a[1],x.lineWidth/2,0,Math.PI*2);x.fill();}else{x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke();}
  }
  composite(){const x=this.ctx;x.globalAlpha=1;x.globalCompositeOperation='source-over';x.fillStyle=this.doc.background;x.fillRect(0,0,this.doc.width,this.doc.height);for(const l of this.doc.layers){if(l.visible){x.globalAlpha=l.opacity;x.drawImage(this.surfaces.get(l.id),0,0);}}x.globalAlpha=1;}
  renderTo(target){target=Math.max(0,Math.min(this.index.total,Math.floor(target)));if(target<this.rendered)this.resetLayers();while(this.rendered<target&&this.commandIndex<this.doc.commands.length){const c=this.doc.commands[this.commandIndex];this.drawUnit(c,this.unitIndex);this.unitIndex++;this.rendered++;if(this.unitIndex>=commandUnits(c)){this.unitIndex=0;this.commandIndex++;}}this.cursor=target;this.composite();this.emit('frame');}
  play(){if(!this.index.total)return;if(this.playing)return;if(this.cursor>=this.index.total)this.renderTo(0);this.playing=true;this.emit('change');let last=performance.now(),fraction=0;const token=++this.generation;const tick=now=>{if(!this.playing||token!==this.generation)return;fraction+=Math.min(now-last,80)*this.speed*1.6;last=now;const n=Math.floor(fraction);fraction-=n;this.renderTo(this.cursor+n);if(this.cursor>=this.index.total){this.pause();this.emit('complete');return;}this.raf=requestAnimationFrame(tick);};this.raf=requestAnimationFrame(tick);}
  pause(){this.playing=false;this.generation++;cancelAnimationFrame(this.raf);if(this.doc)this.emit('change');}
  seek(progress){this.pause();this.renderTo(progress*this.index.total);}
  finish(){this.pause();this.renderTo(this.index.total);}
  getTip(){if(!this.playing)return null;const c=this.doc.commands[this.commandIndex];if(!c)return null;const p=c.points[Math.min(this.unitIndex,c.points.length-1)];return {x:p[0],y:p[1],width:c.width,color:c.color};}
  mutate(fn){this.remember();this.pause();fn(this.doc);this.load(this.doc);}
  snapshot(maxSize=768){const s=Math.min(1,maxSize/Math.max(this.doc.width,this.doc.height));const c=document.createElement('canvas');c.width=Math.round(this.doc.width*s);c.height=Math.round(this.doc.height*s);c.getContext('2d').drawImage(this.canvas,0,0,c.width,c.height);return {dataUrl:c.toDataURL('image/png'),width:c.width,height:c.height,documentWidth:this.doc.width,documentHeight:this.doc.height,progress:this.state().progress};}
}
