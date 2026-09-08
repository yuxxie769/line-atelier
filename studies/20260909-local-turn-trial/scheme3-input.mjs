import {pathPoints} from '../../app/model.js';

// Model-authored input: one complete local contour, two lift locations,
// one global pressure plan. No individual overlap endpoints are authored.
export const contour='M 246 474 C 207 487 175 507 163 527 C 160.5 534 158.5 541 159.5 547 C 160.5 554 165 561 171 566 C 176.6 569.7 181.2 573.6 187.2 577.8 C 213 594.4 241 616 266 630 C 275 635.1 283 639.8 290 644';
export const liftLocations=[
  {point:[163,527],reason:'膝前由斜向长扫转入较直的短面；保留小折向'},
  {point:[171,566],reason:'膝下由回转接入小腿长线；保留出笔方向变化'}
];

export function makeSpec(doc,{weighted=true}={}){
  // Resolve explicitly selected existing path vertices to the compiler's
  // arc-length fractions. This performs no image analysis or shape inference.
  const points=pathPoints(contour,2),lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  const breaks=liftLocations.map(({point,reason})=>{
    const i=points.findIndex(p=>Math.hypot(p[0]-point[0],p[1]-point[1])<1e-9);
    if(i<0)throw Error('指定接点不在源轮廓顶点上');
    return {at:lengths[i]/lengths.at(-1),reason};
  });
  const a=breaks[0].at,b=breaks[1].at;
  const pressureProfile=weighted?[[0,.58],[a*.7,.69],[a,.84],[(a+b)/2,1],[b,.91],[b+.09,.81],[.78,.58],[.92,.70],[1,1.5/1.8]]:[[0,1],[1,1]];
  return {
    stroke:{id:weighted?'knee-auto-weighted':'knee-auto-uniform',type:'stroke',layer:'ink',stage:'lineart',subphase:'clean',part:'body',path:contour,color:'#37323f',opacity:1,width:weighted?1.8:1.5,pressureFloor:0,smoothing:0,pressureProfile,endpoints:['occluded','joined'],intent:'保留上轮局部折向；程序分笔并沿同一轨迹搭接，膝部较重，小腿长线较轻'},
    breaks,overlapPx:5,roles:['silhouette','turn','silhouette']
  };
}
