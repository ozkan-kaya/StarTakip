// Session-only coherence. Revisions are server values; the clock only throttles reads.
export function createFreshness({readMeta,readScopes,loadedScopes,publish,invalidate,now=Date.now,ttl=5000}){
  let revision=null,meta=null,checkedAt=-Infinity,readPending=null,syncPending=null,epoch=0;
  const hydrated=new Set();
  async function latest(force=false){
    if(!force&&meta&&now()-checkedAt<ttl)return meta;
    if(readPending)return readPending;
    const generation=epoch;
    readPending=readMeta().then(value=>{if(generation!==epoch)throw Error('CANCELLED: Oturum değişti.');meta=value;checkedAt=now();return value;}).finally(()=>{if(generation===epoch)readPending=null;});
    return readPending;
  }
  async function ensure({scopes=[],force=false}={}){
    if(syncPending){await syncPending;return ensure({scopes,force:false});}
    const generation=epoch;
    syncPending=(async()=>{
      let server=await latest(force);
      const previous=revision,names=[...new Set([...loadedScopes(),...scopes])];
      const changed=previous!==null&&server.revision!==previous;
      if(previous===server.revision&&names.every(name=>hydrated.has(name)))return {changed:false,revision,meta};
      let data={};
      if(names.length){
        let stable=false;
        for(let attempt=0;attempt<3;attempt++){
          data=await readScopes(names);const after=await latest(true);
          if(after.revision===server.revision){server=after;stable=true;break;}server=after;
        }
        if(!stable)throw Error('Veriler güncelleniyor. Lütfen yeniden deneyin.');
      }
      if(generation!==epoch)throw Error('CANCELLED: Oturum değişti.');
      revision=server.revision;names.forEach(name=>hydrated.add(name));invalidate();
      publish({...data,dataRevision:revision,lastOperationAt:server.updatedAt,updatedAt:new Date(now()).toISOString()},names);
      return {changed,revision,meta:server};
    })();
    try{return await syncPending;}finally{if(generation===epoch)syncPending=null;}
  }
  return {ensure,read:latest,get revision(){return revision;},
    observe(value){if(value.revision!==revision)checkedAt=-Infinity;},
    committed(value){revision=value;meta=meta?{...meta,revision:value}:null;checkedAt=-Infinity;},
    clear(){epoch++;revision=null;meta=null;checkedAt=-Infinity;readPending=null;syncPending=null;hydrated.clear();}
  };
}
