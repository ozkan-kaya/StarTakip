// Session-only coherence. Revisions are server values; the clock only throttles reads.
export function createFreshness({readMeta,readScopes,loadedScopes,publish,invalidate,now=Date.now,ttl=5000}){
  let revision=null,meta=null,checkedAt=-Infinity,readPending=null,syncPending=null,epoch=0,observedRevision=0;
  const hydrated=new Set();
  function boundedRead(read){
    let timer;
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('Veriler alınamadı. İnternet bağlantınızı kontrol ediniz.')),12000);
    });
    return Promise.race([Promise.resolve().then(read),timeout]).finally(()=>clearTimeout(timer));
  }
  async function latest(force=false){
    if(!force&&meta&&now()-checkedAt<ttl)return meta;
    if(readPending)return readPending;
    const generation=epoch;
    readPending=boundedRead(readMeta).then(value=>{if(generation!==epoch)throw Error('CANCELLED: Oturum değişti.');meta=value;checkedAt=now();return value;}).finally(()=>{if(generation===epoch)readPending=null;});
    return readPending;
  }
  async function ensure({scopes=[],force=false}={}){
    const generation=epoch;
    if(syncPending){
      await syncPending;
      if(generation!==epoch)throw Error('CANCELLED: Oturum değişti.');
      return ensure({scopes,force:false});
    }
    syncPending=(async()=>{
      let server=await latest(force);
      const previous=revision,allNames=[...new Set([...loadedScopes(),...scopes])];
      let names=previous===server.revision?allNames.filter(name=>!hydrated.has(name)):allNames;
      if(previous===server.revision&&server.revision>=observedRevision&&!names.length)return {changed:false,revision,meta};
      if(server.revision<observedRevision)names=allNames;
      let data={};
      if(names.length){
        let stable=false;
        for(let attempt=0;attempt<3;attempt++){
          data=await boundedRead(()=>readScopes(names));const after=await latest(true);
          if(after.revision===server.revision&&after.revision>=Math.max(revision??0,observedRevision)){server=after;stable=true;break;}
          server=after;names=allNames;
        }
        if(!stable)throw Error('Veriler güncelleniyor. Lütfen yeniden deneyin.');
      }
      if(generation!==epoch)throw Error('CANCELLED: Oturum değişti.');
      if(server.revision<Math.max(revision??0,observedRevision))throw Error('Veriler güncelleniyor. Lütfen yeniden deneyin.');
      if(revision!==server.revision)invalidate();
      revision=server.revision;names.forEach(name=>hydrated.add(name));
      publish({...data,dataRevision:revision,lastOperationAt:server.updatedAt,updatedAt:new Date(now()).toISOString()},names);
      return {changed:previous!==null&&server.revision!==previous,revision,meta:server};
    })();
    try{return await syncPending;}finally{if(generation===epoch)syncPending=null;}
  }
  return {ensure,read:latest,get revision(){return revision;},
    observe(value){
      observedRevision=Math.max(observedRevision,value.revision);
      if(observedRevision>(revision??0))checkedAt=-Infinity;
    },
    committed(value,names=[]){
      if(value<(revision??0))return false;
      revision=value;meta=meta?{...meta,revision:value}:null;checkedAt=-Infinity;
      names.forEach(name=>hydrated.add(name));
      return true;
    },
    clear(){epoch++;revision=null;observedRevision=0;meta=null;checkedAt=-Infinity;readPending=null;syncPending=null;hydrated.clear();}
  };
}
