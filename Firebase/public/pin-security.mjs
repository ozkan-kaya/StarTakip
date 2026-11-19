const ITERATIONS=600000;
export const defaultPinSettings=()=>({enabled:false,length:4,salt:'',version:0,create:false,edit:false,remove:false,interval:0,daily:false});
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
export const sha256=async text=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
export async function pinKey(pin,config){
  if(!new RegExp('^\\d{'+config.length+'}$').test(pin))throw new Error(config.length+' haneli PIN girin.');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(config.salt),iterations:ITERATIONS},key,256));
}
export const pinProof=(key,purpose,version,uid)=>sha256(key+':'+purpose+':'+version+':'+uid);
export function pinGroup(action,input,raw){
  if(action==='regenerateCompanyDocument')return 'edit';
  if(['deleteMaster','setMasterArchived','voidTransaction'].includes(action))return 'remove';
  if(action==='saveMaster')return raw[input.type==='product'?'Urunler':'Cariler'].some(r=>r.id===input.id)?'edit':'create';
  if(action==='saveUnit')return raw.Birimler.some(r=>r.id===input.id)?'edit':'create';
  if(action==='saveNote')return raw.Notlar.some(r=>r.id===input.id)?'edit':'create';
  return 'create';
}
export function changeGroup(change,before){
  if(!change.path.startsWith('tables/'))return null;
  const table=change.path.split('/')[1],old=before.get(change.path);
  if(change.value===null||table==='IslemIptalleri')return 'remove';
  if(!old)return table==='Kullanicilar'?null:'create';
  if(['Urunler','Cariler'].includes(table)&&old.arsivlendiMi!==change.value.arsivlendiMi)return 'remove';
  return 'edit';
}
export function createPinSecurity(api,db,getUser,{storage}={}){
  if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
  const {doc,getDocFromServer,runTransaction,writeBatch,serverTimestamp}=api;
  const configRef=doc(db,'security/pin'),secretRef=doc(db,'security/pin-secret');
  const security={requestPin:null};
  const cacheName=()=> 'star-pin-lease:'+getUser().uid;
  const clearLease=()=>{try{storage?.removeItem(cacheName());}catch{}};
  function readLease(config){try{const value=JSON.parse(storage?.getItem(cacheName())||'null');return value&&value.version===config.version&&value.salt===config.salt&&value.until>Date.now()?value:null;}catch{return null;}}
  security.clearCache=clearLease;
  security.settings=async()=>{getUser();const s=await getDocFromServer(configRef);return s.exists()?s.data():defaultPinSettings();};
  security.check=async(pin,config)=>{
    const u=getUser(),current=config||await security.settings();if(!current.enabled)throw new Error('Önce PIN oluşturun.');
    const key=await pinKey(pin,current),nonce=crypto.randomUUID(),batch=writeBatch(db);
    batch.set(doc(db,'pinChecks/'+u.uid),{nonce,version:current.version,proof:await pinProof(key,'check:'+nonce,current.version,u.uid),updatedAt:serverTimestamp()});
    batch.set(doc(db,'dailyPin/'+u.uid),{version:current.version,salt:current.salt,updatedAt:serverTimestamp()});
    const lease=current.interval>0?{id:crypto.randomUUID(),key:hex(crypto.getRandomValues(new Uint8Array(32))),version:current.version,salt:current.salt,until:Date.now()+current.interval*1000}:null;
    if(lease){
      const data={key:lease.key,version:current.version,salt:current.salt,interval:current.interval,createdAt:serverTimestamp()};
      batch.set(doc(db,'pinLeases/'+u.uid+'/devices/'+lease.id),data);
      const {key:ignored,...publicData}=data;batch.set(doc(db,'pinLeaseInfo/'+u.uid+'/devices/'+lease.id),publicData);
    }
    try{await batch.commit();if(lease){try{storage?.setItem(cacheName(),JSON.stringify(lease));}catch{}}else clearLease();}
    catch(e){if(e.code==='permission-denied')throw new Error('PIN hatalı veya başka bir cihazda değiştirilmiş.');throw e;}
    return key;
  };
  security.authorize=async(groups)=>{
    const config=await security.settings();if(!config.enabled||!groups.some(g=>config[g]))return {config,key:null};
    if(!security.requestPin)throw new Error('PIN penceresi hazırlanamadı. Sayfayı yenileyin.');
    const freshRemoval=config.remove&&groups.includes('remove');
    const cached=freshRemoval?null:readLease(config);if(cached)return {config,key:cached.key,leaseId:cached.id};
    const key=await security.requestPin(config,pin=>security.check(pin,config));
    if(freshRemoval)return {config,key};
    const lease=readLease(config);return lease?{config,key:lease.key,leaseId:lease.id}:{config,key};
  };
  security.proofs=async(grant,revision)=>{
    if(!grant.key)return {};
    return Object.fromEntries(await Promise.all(['create','edit','remove'].map(async g=>[g,await pinProof(grant.key,'write:'+g,revision,getUser().uid)])));
  };
  async function write(mode,options){
    const u=getUser(),base=options.base||await security.settings();
    if(mode==='settings'){
      const changes=options.changes||Object.fromEntries(['create','edit','remove','daily','interval'].map(g=>[g,options[g]]));
      await runTransaction(db,async tx=>{
        const snap=await tx.get(configRef),current=snap.exists()?snap.data():defaultPinSettings();
        if(!current.enabled||current.salt!==base.salt)throw new Error('PIN değişti. Ayarları yeniden açıp mevcut PIN’i girin.');
        const next={...current,version:current.version+1,mode,updatedAt:serverTimestamp()};
        for(const g of ['create','edit','remove','daily'])if(g in changes)next[g]=changes[g]===true;
        if('interval' in changes){next.interval=Number(changes.interval);if(![0,300,600,900,3600,10800].includes(next.interval))throw new Error('PIN sıklığı geçersiz.');}
        next.proof=await pinProof(options.oldKey,'settings',current.version,u.uid);
        tx.set(configRef,next);
      });
      clearLease();return security.settings();
    }
    const length=Number(options.length??base.length);if(![4,6].includes(length))throw new Error('4 veya 6 hane seçin.');
    let next={...base,version:base.version+1,updatedAt:serverTimestamp()};
    if(mode==='setup'||mode==='change'||mode==='reset'){
      if(options.pin!==options.confirm)throw new Error('Yeni PIN girişleri eşleşmiyor.');
      next={...next,enabled:true,length,salt:hex(crypto.getRandomValues(new Uint8Array(16)))};
    }
    if(mode==='setup'||mode==='settings'){
      for(const g of ['create','edit','remove','daily'])next[g]=options[g]===true;
      next.interval=Number(options.interval??0);if(![0,300,600,900,3600,10800].includes(next.interval))throw new Error('PIN sıklığı geçersiz.');
    }
    const key=mode==='setup'||mode==='change'||mode==='reset'?await pinKey(options.pin,next):null;
    const settingsProof=options.oldKey?await pinProof(options.oldKey,'settings',base.version,u.uid):'';
    await runTransaction(db,async tx=>{
      const snap=await tx.get(configRef),current=snap.exists()?snap.data():defaultPinSettings();
      if(current.version!==base.version)throw new Error('PIN ayarları başka bir cihazda değişti. Ayarları yeniden açın.');
      if(mode==='setup'&&current.enabled)throw new Error('PIN zaten oluşturulmuş.');
      next={...next,mode,proof:settingsProof};
      tx.set(configRef,next);
      if(key)tx.set(secretRef,{verifier:key,version:next.version});
    });
    clearLease();return security.settings();
  }
  security.dailyUnlock=async()=>{
    const config=await security.settings();if(!config.enabled||!config.daily)return;
    const uid=getUser().uid,snap=await getDocFromServer(doc(db,'dailyPin/'+uid));
    const day=date=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
    if(snap.exists()&&snap.data().salt===config.salt&&snap.data().updatedAt?.toDate&&day(snap.data().updatedAt.toDate())===day(new Date()))return;
    await security.requestPin(config,pin=>security.check(pin,config));
  };
  security.remove=async({base,oldKey})=>{
    const uid=getUser().uid,proof=await pinProof(oldKey,'remove-pin',base.version,uid);
    await runTransaction(db,async tx=>{
      const snap=await tx.get(configRef);if(!snap.exists()||snap.data().version!==base.version)throw new Error('PIN ayarları değişti. Ayarları yeniden açın.');
      tx.set(doc(db,'security/pin-removal'),{version:base.version,proof,updatedAt:serverTimestamp()});tx.delete(configRef);tx.delete(secretRef);
    });clearLease();return defaultPinSettings();
  };
  security.setup=options=>write('setup',options);
  security.save=options=>write('settings',options);
  security.change=async options=>{const base=await security.settings(),oldKey=await security.check(options.oldPin,base);return write('change',{...options,base,oldKey});};
  security.reset=options=>write('reset',options);
  return security;
}
export function createDemoPinSecurity({storage}={}){
  if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
  const name='star-demo-pin-v1';let saved;try{saved=JSON.parse(storage?.getItem(name)||'null');}catch{}
  let config=saved?.config||defaultPinSettings(),verifier=saved?.verifier||'',remembered=saved?.remembered||null,lastDay=saved?.lastDay||'';
  const persist=()=>{try{storage?.setItem(name,JSON.stringify({config,verifier,remembered,lastDay}));}catch{}};
  const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const security={requestPin:null,settings:async()=>({...config})};
  security.check=async(pin,c=config)=>{const key=await pinKey(pin,c);if(key!==verifier||c.version!==config.version||c.salt!==config.salt)throw new Error('PIN hatalı.');lastDay=day();remembered=config.interval>0?{version:config.version,salt:config.salt,until:Date.now()+config.interval*1000}:null;persist();return key;};
  async function save(mode,o){
    if(mode==='settings'&&o.oldKey!==verifier)throw new Error('PIN hatalı.');
    if(mode==='change')await security.check(o.oldPin);
    if(mode!=='settings'){
      if(o.pin!==o.confirm)throw new Error('Yeni PIN girişleri eşleşmiyor.');
      const next={...config,enabled:true,length:Number(o.length),salt:hex(crypto.getRandomValues(new Uint8Array(16)))};
      if(![4,6].includes(next.length))throw new Error('4 veya 6 hane seçin.');
      const key=await pinKey(o.pin,next);config=next;verifier=key;
    }
    if(['settings','setup'].includes(mode)){const changes=o.changes||o;for(const g of ['create','edit','remove','daily'])if(g in changes||mode==='setup')config[g]=changes[g]===true;if('interval' in changes||mode==='setup')config.interval=Number(changes.interval??0);}
    config.version++;remembered=null;if(mode!=='settings')lastDay='';persist();return {...config};
  }
  security.remove=async({oldKey})=>{if(oldKey!==verifier)throw new Error('PIN hatalı.');config=defaultPinSettings();verifier='';remembered=null;lastDay='';persist();return {...config};};
  for(const [name,mode] of [['setup','setup'],['save','settings'],['change','change'],['reset','reset']])security[name]=o=>save(mode,o);
  security.dailyUnlock=async()=>{if(config.enabled&&config.daily&&lastDay!==day())await security.requestPin({...config},pin=>security.check(pin));};
  security.authorize=async(action,input,state)=>{
    const raw={Urunler:state.products,Cariler:state.parties,Birimler:state.units||[],Notlar:state.notes||[]},group=pinGroup(action,input,raw);
    if(config.enabled&&config[group]){
      if(group!=='remove'&&remembered&&remembered.version===config.version&&remembered.salt===config.salt&&Date.now()<remembered.until)return;
      await security.requestPin({...config},pin=>security.check(pin));
    }
  };
  return security;
}
