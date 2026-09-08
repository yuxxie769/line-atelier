import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export async function syncDrawingProtocol({check=false}={}){
  const root=new URL('../',import.meta.url);
  const source='docs/WORKFLOW_PRINCIPLES.md';
  const text=(await readFile(new URL(source,root),'utf8')).replace(/\r\n/g,'\n');
  if(!text.trim())throw new Error('Drawing protocol must not be empty.');
  const protocol={source,sha256:createHash('sha256').update(text).digest('hex'),text};
  const stages={};
  const reviewSource='docs/workflow-actions/agent-review.md';
  const reviewText=(await readFile(new URL(reviewSource,root),'utf8')).replace(/\r\n/g,'\n');
  if(!reviewText.trim())throw new Error('Empty agent review guide');
  const reviewGuide={source:reviewSource,sha256:createHash('sha256').update(reviewText).digest('hex'),text:reviewText};
  for(const phase of ['layout','rough','structure_review','refine','clean','lineart_review']){
    const source='docs/workflow-stages/'+phase+'.md';
    const text=(await readFile(new URL(source,root),'utf8')).replace(/\r\n/g,'\n');
    if(!text.trim())throw new Error('Empty stage requirements: '+source);
    stages[phase]={phase,source,sha256:createHash('sha256').update(text).digest('hex'),text};
    if(['layout','structure_review','lineart_review'].includes(phase))stages[phase].agentReview={
      ...reviewGuide,required:true,trigger:phase==='lineart_review'?'before-lineart-checkpoint':'before-stage-advance',
      formalReviewRound:phase==='lineart_review'?2:null,maxAgentCalls:2,freshAgentForFinalReview:true,
      execution:'host-agent-tools',dispatchAutomatic:false,reviewerIdentityVerified:false,
      acceptance:{maxMajorIssues:0,minorIssuesBlock:false,suggestedMajorConfidence:0.8,confidenceIsCalibrated:false},
      instruction:phase==='lineart_review'?'第一轮仍按原流程执行；只在第二轮清线审核开子 agent 初审，修订后新开子 agent 最终复核。':'本阶段完成后开子 agent 初审，修订后新开子 agent 最终复核，再决定是否推进。'
    };
  }
  const actionSource='docs/workflow-actions/local-revision.md';
  const actionText=(await readFile(new URL(actionSource,root),'utf8')).replace(/\r\n/g,'\n');
  if(!actionText.trim())throw new Error('Empty operation guide: '+actionSource);
  const operationGuide={source:actionSource,sha256:createHash('sha256').update(actionText).digest('hex'),text:actionText};
  const compoundSource='docs/drawing-methods/COMPOUND_V1.md';
  const compoundText=(await readFile(new URL(compoundSource,root),'utf8')).replace(/\r\n/g,'\n');
  if(!compoundText.trim())throw new Error('Empty compound drawing method');
  const compoundMethod={id:'compound-v1',version:'3.1.0',source:compoundSource,sha256:createHash('sha256').update(compoundText).digest('hex'),text:compoundText,requiredPhases:['refine','clean','lineart_review']};
  const cardsBase='docs/anatomy-card-assets-clipstudio-11661';
  const cardsManifestSource=cardsBase+'/manifest.json';
  const cardsManifest=JSON.parse(await readFile(new URL(cardsManifestSource,root),'utf8'));
  const imageSource=cardsBase+'/v1-source-mirror';
  const imageNames=(await readdir(new URL(imageSource+'/',root))).filter(name=>/^\d{3}-body-\d+\.jpg$/.test(name)).sort();
  const cards={source:cardsManifestSource,sourceArticle:cardsManifest.sourceArticle,requiredCardsByPhase:cardsManifest.requiredCardsByPhase||{},cards:{}};
  for(const card of cardsManifest.cards){
    if(cards.cards[card.id])throw new Error('Duplicate reference card: '+card.id);
    const match=/^(\d{3})-(\d{3})$/.exec(card.files);
    if(!match)throw new Error('Invalid image range for '+card.id+': '+card.files);
    const start=Number(match[1]),end=Number(match[2]);
    const images=imageNames.filter(name=>{const index=Number(name.slice(0,3));return index>=start&&index<=end;}).map(name=>({name,source:imageSource+'/'+name,publicPath:'/'+imageSource+'/'+name}));
    if(images.length!==end-start+1)throw new Error('Missing reference images for '+card.id);
    const chapterSource=cardsBase+'/'+card.chapterFile;
    const chapterText=(await readFile(new URL(chapterSource,root),'utf8')).replace(/\r\n/g,'\n');
    if(!chapterText.trim())throw new Error('Empty reference card chapter: '+chapterSource);
    cards.cards[card.id]={id:card.id,title:card.title,purpose:card.purpose,phases:card.phases,source:chapterSource,sha256:createHash('sha256').update(chapterText).digest('hex'),text:chapterText,images};
  }
  for(const [phase,ids] of Object.entries(cards.requiredCardsByPhase)){
    if(!Object.hasOwn(stages,phase)||!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!cards.cards[id]||!cards.cards[id].phases.includes(phase)))throw new Error('Invalid required reference cards for '+phase);
  }
  const outputs=[
    ['app/'+compoundSource,compoundText],
    ['app/'+reviewSource,reviewText],
    ['app/'+actionSource,actionText],
    ['app/docs/workflow-principles.md',text],
    ...Object.values(stages).map(s=>['app/'+s.source,s.text]),
    ...Object.values(cards.cards).map(card=>['app/'+card.source,card.text]),
    ['app/drawing-protocol.generated.js','// Generated by scripts/sync-drawing-protocol.mjs; edit docs/WORKFLOW_PRINCIPLES.md, docs/workflow-stages/ and the active reference-card chapters instead.\nexport const DRAWING_PROTOCOL=Object.freeze('+JSON.stringify(protocol).replace(/</g,'\\u003c')+');\nexport const DRAWING_STAGE_PROTOCOLS=Object.freeze('+JSON.stringify(stages).replace(/</g,'\\u003c')+');\n']
  ];
  outputs.find(([path])=>path==='app/drawing-protocol.generated.js')[1]+='export const DRAWING_OPERATION_GUIDE=Object.freeze('+JSON.stringify(operationGuide).replace(/</g,'\\u003c')+');\n';
  outputs.find(([path])=>path==='app/drawing-protocol.generated.js')[1]+='export const DRAWING_COMPOUND_METHOD=Object.freeze('+JSON.stringify(compoundMethod).replace(/</g,'\\u003c')+');\n';
  outputs.find(([path])=>path==='app/drawing-protocol.generated.js')[1]+='export const DRAWING_REFERENCE_CARDS=Object.freeze('+JSON.stringify(cards).replace(/</g,'\\u003c')+');\n';
  for(const [path,content] of outputs){
    const url=new URL(path,root);
    let current;try{current=(await readFile(url,'utf8')).replace(/\r\n/g,'\n');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(current===content)continue;
    if(check)throw new Error(path+' is stale; run npm run sync:protocol.');
    await mkdir(new URL('./',url),{recursive:true});
    await writeFile(url,content);
  }
  for(const name of imageNames){
    const sourceUrl=new URL(imageSource+'/'+name,root);
    const outputUrl=new URL('app/'+imageSource+'/'+name,root);
    const content=await readFile(sourceUrl);
    let current;try{current=await readFile(outputUrl);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(current?.equals(content))continue;
    if(check)throw new Error('app/'+imageSource+'/'+name+' is stale; run npm run sync:protocol.');
    await mkdir(new URL('./',outputUrl),{recursive:true});
    await writeFile(outputUrl,content);
  }
  return protocol;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const protocol=await syncDrawingProtocol({check:process.argv.includes('--check')});
  console.log('Drawing protocol '+protocol.sha256);
}
