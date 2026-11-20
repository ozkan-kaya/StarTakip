import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {initializeAuth,GoogleAuthProvider,signInWithPopup,signOut,browserLocalPersistence,browserPopupRedirectResolver,connectAuthEmulator,onAuthStateChanged,reauthenticateWithPopup,getIdTokenResult} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import * as firestore from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';
import {createDomain} from './domain.mjs?v=app-20261119-1';
import {createStore} from './store.mjs?v=app-20261120-1';
import {createPinSecurity} from './pin-security.mjs?v=app-20261119-1';
import {createFreshness} from './freshness.mjs?v=app-20261119-1';
const ALLOWED_EMAILS=new Set(['company@example.invalid','authorized-user@example.invalid']);
export async function createFirebaseBridge(){
  const controller=new AbortController(),configTimer=setTimeout(()=>controller.abort(),12000);
  let config;
  try{const response=await fetch('/config.json',{signal:controller.signal});if(!response.ok)throw new Error('Firebase ayarları okunamadı.');config=await response.json();}finally{clearTimeout(configTimer);}
  // Restore the existing local session without eagerly opening the OAuth iframe
  // on Safari/iOS. The resolver is only needed after an explicit sign-in click.
  const app=initializeApp(config),auth=initializeAuth(app,{persistence:browserLocalPersistence}),db=firestore.getFirestore(app);
  if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('emulator')){
    connectAuthEmulator(auth,'http://127.0.0.1:9098',{disableWarnings:true});firestore.connectFirestoreEmulator(db,'127.0.0.1',8088);
  }
  let authTimer;
  try{await Promise.race([auth.authStateReady(),new Promise((_,reject)=>{authTimer=setTimeout(()=>reject(new Error('Oturum kontrolü tamamlanamadı. Lütfen yeniden deneyin.')),12000);})]);}finally{clearTimeout(authTimer);}
  const domain=createDomain(()=>user().email.toLowerCase()),security=createPinSecurity(firestore,db,user),store=createStore(firestore,db,domain,security),subscriptions=new Map();
  let identity=auth.currentUser?.uid||'',generation=0,stopLastOperation=null;
  const bridge={onPatch:null,onError:null,security};
  const scopeNames={products:['products','units'],parties:['parties'],ledger:['products','units','parties','transactions','companyVersions'],notes:['notes'],company:['companyVersions']};
  const stamp=value=>value?.toDate?value.toDate().toISOString():'';
  const metaRef=firestore.doc(db,'system/state');
  const freshness=createFreshness({
    readMeta:async()=>{user();const snapshot=await firestore.getDocFromServer(metaRef);const data=snapshot.exists()?snapshot.data():{};return {revision:data.revision||0,updatedAt:stamp(data.updatedAt)};},
    readScopes:async names=>Object.fromEntries(await Promise.all(names.map(async name=>{const result=await firestore.getDocsFromServer(firestore.collection(db,name==='units'?'tables/Birimler/rows':name==='companyVersions'?'companyVersions':`views/${name}/rows`));return [name,result.docs.map(doc=>doc.data()).sort((a,b)=>(a._row||0)-(b._row||0)||a.id.localeCompare(b.id))];}))),
    loadedScopes:()=>[...subscriptions.keys()],invalidate:()=>store.invalidate(),
    publish:(patch,names)=>{for(const name of names){const sub=subscriptions.get(name);if(sub)sub.data=patch[name];else void subscribe(name).catch(error=>bridge.onError?.(error));}bridge.onPatch?.(patch);}
  });
  bridge.revision=()=>freshness.revision;
  bridge.ensureFresh=({scopes=[],force=false}={})=>freshness.ensure({scopes:[...new Set(scopes.flatMap(scope=>scopeNames[scope]||[]))],force});
  let resetVerifiedUntil=0;
  security.reauthenticate=async()=>{
    const current=user(),provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
    const result=await reauthenticateWithPopup(current,provider,browserPopupRedirectResolver);
    if(result.user.uid!==current.uid)throw new Error('Yetkili Google hesabını seçin.');
    const token=await getIdTokenResult(current,true);
    if(Date.now()/1000-token.claims.auth_time>300)throw new Error('Google doğrulaması yenilenemedi. Tekrar deneyin.');
    resetVerifiedUntil=Date.now()+240000;return true;
  };
  const resetPin=security.reset;
  security.reset=async options=>{if(Date.now()>resetVerifiedUntil)throw new Error('Önce Google hesabınızla yeniden doğrulayın.');const result=await resetPin(options);resetVerifiedUntil=0;return result;};
  function clear(){generation++;freshness.clear();stopLastOperation?.();stopLastOperation=null;for(const sub of subscriptions.values())sub.cancel();subscriptions.clear();store.invalidate();}
  function user(){
    const current=auth.currentUser;
    if(!current)throw new Error('AUTH_REQUIRED: Google hesabınızla giriş yapın.');
    if(!current.emailVerified||!ALLOWED_EMAILS.has(current.email?.toLowerCase())||!current.providerData.some(p=>p.providerId==='google.com'))throw new Error('AUTH_DENIED: Bu Google hesabına erişim izni verilmemiş.');
    return current;
  }
  const profile=()=>{const u=user();return {email:u.email,name:u.displayName||'Google hesabı',picture:u.photoURL||''};};
  onAuthStateChanged(auth,current=>{if(identity!==(current?.uid||'')){identity=current?.uid||'';clear();if(!current)bridge.onError?.(new Error('AUTH_REQUIRED'));}});
  async function subscribe(scope){
    user();if(subscriptions.has(scope))return subscriptions.get(scope).ready;
    const epoch=generation;
    let resolve,reject,settled=false;
    const ready=new Promise((a,b)=>{resolve=a;reject=b;});
    const sub={ready,data:[],unsubscribe:null,cancel:null};
    // A bounded first read is not polling. A failed warmup can be retried on demand.
    const timer=setTimeout(()=>{if(!settled){settled=true;sub.unsubscribe?.();if(subscriptions.get(scope)===sub)subscriptions.delete(scope);reject(new Error('Veriler alınamadı. İnternet bağlantınızı kontrol ediniz.'));}},20000);
    sub.cancel=()=>{clearTimeout(timer);sub.unsubscribe?.();if(!settled){settled=true;reject(new Error('CANCELLED: Oturum değişti.'));}};
    sub.unsubscribe=firestore.onSnapshot(firestore.collection(db,scope==='units'?'tables/Birimler/rows':scope==='companyVersions'?'companyVersions':`views/${scope}/rows`),{includeMetadataChanges:true},snapshot=>{
      if(epoch!==generation)return;
      if(snapshot.metadata.hasPendingWrites)return;
      sub.data=snapshot.docs.map(doc=>doc.data()).sort((a,b)=>(a._row||0)-(b._row||0)||a.id.localeCompare(b.id));
      if(snapshot.metadata.fromCache&&!settled)return;
      if(!settled){settled=true;clearTimeout(timer);resolve(sub.data);}
      bridge.onPatch?.({[scope]:sub.data,updatedAt:new Date().toISOString()});
    },error=>{clearTimeout(timer);if(!settled){settled=true;reject(error);}if(epoch!==generation)return;if(subscriptions.get(scope)===sub)subscriptions.delete(scope);bridge.onError?.(error);});
    subscriptions.set(scope,sub);return ready;
  }
  bridge.login=async()=>{const result=await signInWithPopup(auth,new GoogleAuthProvider(),browserPopupRedirectResolver);try{user();}catch(error){await signOut(auth);throw error;}return result.user;};
  function watchLastOperation(){
    if(stopLastOperation)return;const epoch=generation;
    stopLastOperation=firestore.onSnapshot(firestore.doc(db,'system/state'),snapshot=>{
      if(epoch!==generation||snapshot.metadata.hasPendingWrites)return;
      const stamp=snapshot.exists()?snapshot.data().updatedAt:null;
      freshness.observe({revision:snapshot.exists()?snapshot.data().revision||0:0});
      bridge.onPatch?.({lastOperationAt:stamp?.toDate?stamp.toDate().toISOString():''});
    },error=>{if(epoch!==generation)return;stopLastOperation=null;bridge.onError?.(error);});
  }
  // Start after the UI unlocks. History and notes keep their on-demand subscriptions.
  bridge.prefetch=async()=>{user();watchLastOperation();return Promise.allSettled(['products','units','parties'].map(subscribe));};
  async function execute(action,data){
    if(!navigator.onLine)throw new Error('İnternet bağlantınızı kontrol ediniz.');
    const result=await store.execute(action,data),patch={updatedAt:new Date().toISOString(),dataRevision:result.revision};
    freshness.committed(result.revision);
    // Only publish committed data; direct legacy calls (delete/bulk rows) also
    // update the opened scope cache before their callers refresh the screen.
    for(const [scope,sub] of subscriptions){sub.data=result.view[scope];patch[scope]=sub.data;}
    bridge.onPatch?.(patch);return result;
  }
  bridge.call=async(name,arg)=>{
    if(name==='beginSession'){user();await security.dailyUnlock();try{await bridge.ensureFresh({scopes:['company']});}catch(error){if(/AUTH_/.test(error.message))throw error;}return {token:auth.currentUser.uid,profile:profile(),appState:{...domain.bootstrap(),companyVersions:subscriptions.get('companyVersions')?.data||[],dataRevision:freshness.revision}};}
    if(name==='endSession'){clear();await signOut(auth);return true;}
    user();
    if(name==='getProfile')return profile();
    if(name==='getCompanyState'){await bridge.ensureFresh({scopes:['company'],force:true});return {companyVersions:subscriptions.get('companyVersions').data,dataRevision:freshness.revision};}
    if(name==='getAppState')return domain.bootstrap();
    if(name==='getModuleState'){
      const names=scopeNames[arg?.scope];
      if(!names)throw new Error('Veri bölümü geçersiz.');
      await bridge.ensureFresh({scopes:[arg.scope]});
      await Promise.all(names.map(subscribe));
      return Object.assign({updatedAt:new Date().toISOString(),dataRevision:freshness.revision},Object.fromEntries(names.map(name=>[name,subscriptions.get(name).data])));
    }
    if(name==='mutateAndRead'){
      if(!navigator.onLine)throw new Error('İnternet bağlantınızı kontrol ediniz.');
      if(!Array.isArray(arg.scopes)||arg.scopes.some(scope=>!['products','parties','ledger','notes','company'].includes(scope)))throw new Error('Veri bölümü geçersiz.');
      const result=await execute(arg.action,arg.data),patch={updatedAt:new Date().toISOString(),dataRevision:result.revision};
      for(const scope of arg.scopes){const names={products:['products','units'],parties:['parties'],ledger:['products','units','parties','transactions','companyVersions'],notes:['notes'],company:['companyVersions']}[scope];for(const name of names)patch[name]=result.view[name];}
      return {result:result.result,patch};
    }
    if(['saveUnit','saveMaster','deleteMaster','setMasterArchived','postTransaction','postStockCount','voidTransaction','saveNote','saveCompanyVersion','regenerateCompanyDocument'].includes(name))return (await execute(name,arg)).result;
    throw new Error('İşlem geçersiz.');
  };
  bridge.export=()=>{user();return store.export();};
  bridge.inspectImport=payload=>{user();return store.inspectImport(payload);};
  bridge.importEmpty=payload=>{user();return store.importEmpty(payload);};
  return bridge;
}
