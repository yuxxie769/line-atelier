// Transport only: the original complete session (including PNGs) is unchanged.
export function createLocalEvidenceWriter({fetcher=fetch,onStatus=()=>{}}={}){
  const pending=new Map();let running=null;
  let status={status:'pending',pending:0};
  const publish=value=>{status={...value,pending:pending.size};onStatus(status);};
  async function flush(){
    if(running)return running;
    running=(async()=>{
      while(pending.size){
        const [id,value]=pending.entries().next().value;
        try{
          const response=await fetcher('/__local-evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
          if(!response.ok)throw Error('Local log HTTP '+response.status);
          const result=await response.json();
          if(!result.path)throw Error('Local log server unavailable');
          if(pending.get(id)===value)pending.delete(id);
          publish({...result,status:'saved'});
        }catch(error){publish({status:'pending',error:error.message});break;}
      }
    })().finally(()=>{running=null;});return running;
  }
  return {enqueue(value){const old=pending.get(value.id);if(!old||old.events.length<=value.events.length)pending.set(value.id,structuredClone(value));return flush();},flush,state:()=>({...status,pending:pending.size})};
}
