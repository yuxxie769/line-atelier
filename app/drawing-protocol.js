import {DRAWING_PROTOCOL,DRAWING_STAGE_PROTOCOLS,DRAWING_OPERATION_GUIDE,DRAWING_COMPOUND_METHOD,DRAWING_REFERENCE_CARDS} from './drawing-protocol.generated.js';

export function drawingOperationGuide(){return {...DRAWING_OPERATION_GUIDE};}
export function drawingCompoundMethod(){return structuredClone(DRAWING_COMPOUND_METHOD);}

export function drawingReferenceCardCatalog({phase}={}){
  if(phase!==undefined&&!Object.hasOwn(DRAWING_STAGE_PROTOCOLS,phase))throw new Error('Unknown drawing phase: '+phase);
  const requiredCardIds=phase===undefined?[]:[...(DRAWING_REFERENCE_CARDS.requiredCardsByPhase?.[phase]||[])];
  return {source:DRAWING_REFERENCE_CARDS.source,sourceArticle:DRAWING_REFERENCE_CARDS.sourceArticle,requiredCardIds,cards:Object.values(DRAWING_REFERENCE_CARDS.cards).filter(card=>phase===undefined||card.phases.includes(phase)).map(({id,title,purpose,phases,source,sha256,images})=>({id,title,purpose,phases,source,sha256,imageCount:images.length,required:requiredCardIds.includes(id)}))};
}

export function drawingReferenceCard(id){
  if(typeof id!=='string'||!Object.hasOwn(DRAWING_REFERENCE_CARDS.cards,id))throw new Error('Unknown reference card: '+id);
  return structuredClone(DRAWING_REFERENCE_CARDS.cards[id]);
}

export function drawingProtocol({includeProtocol=true,phase}={}){
  if(typeof includeProtocol!=='boolean')throw new Error('includeProtocol must be a boolean');
  if(phase!==undefined&&!Object.hasOwn(DRAWING_STAGE_PROTOCOLS,phase))throw new Error('Unknown drawing phase: '+phase);
  const {source,sha256,text}=DRAWING_PROTOCOL;
  const compoundMethod=phase!==undefined&&DRAWING_COMPOUND_METHOD.requiredPhases.includes(phase)?drawingCompoundMethod():undefined;
  return {source,sha256,...(includeProtocol?{text}:{}),...(phase!==undefined?{stage:structuredClone(DRAWING_STAGE_PROTOCOLS[phase]),...(compoundMethod?{compoundMethod}:{}),referenceCards:drawingReferenceCardCatalog({phase})}:{referenceCards:drawingReferenceCardCatalog()})};
}
