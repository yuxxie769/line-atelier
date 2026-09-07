import {DRAWING_PROTOCOL} from './drawing-protocol.generated.js';

export function drawingProtocol({includeProtocol=true}={}){
  if(typeof includeProtocol!=='boolean')throw new Error('includeProtocol must be a boolean');
  const {source,sha256,text}=DRAWING_PROTOCOL;
  return {source,sha256,...(includeProtocol?{text}:{})};
}
