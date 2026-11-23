import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {initializeAuth,GoogleAuthProvider,signInWithPopup,signOut,browserLocalPersistence,browserPopupRedirectResolver,connectAuthEmulator,onAuthStateChanged,reauthenticateWithPopup,getIdTokenResult} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import * as firestore from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';
import {createDomain} from './domain.mjs?v=app-20261119-1';
import {createStore} from './store.mjs?v=app-20261120-1';
import {createPinSecurity} from './pin-security.mjs?v=app-20261119-1';
import {createFreshness} from './freshness.mjs?v=app-20261123-3';
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
  const domain=createDomain(()=>user().email.toLowerCase()),security=createPinSecurity(firestore,db,user),store=createStore(firestore,db,domain,security),loadedViews=new Map();
  let identity=auth.currentUser?.uid||'',generation=0,stopLastOperation=null;
  const bridge={onPatch:null,onError:null,security};
  const scopeNames={products:['products','units'],parties:['parties'],ledger:['products','units','parties','transactions','companyVersions'],notes:['notes'],company:['companyVersions']};
  const stamp=value=>value?.toDate?value.toDate().toISOString():'';
  const metaRef=firestore.doc(db,'system/state');
  const freshness=createFreshness({
    readMeta:async()=>{user();const snapshot=await firestore.getDocFromServer(metaRef);const data=snapshot.exists()?snapshot.data():{};return {revision:data.revision||0,updatedAt:stamp(data.updatedAt)};},
    readScopes:async names=>Object.fromEntries(await Promise.all(names.map(async name=>{const result=await firestore.getDocsFromServer(firestore.collection(db,name==='units'?'tables/Birimler/rows':name==='companyVersions'?'companyVersions':`views/${name}/rows`));return [name,result.docs.map(doc=>doc.data()).sort((a,b)=>(a._row||0)-(b._row||0)||a.id.localeCompare(b.id))];}))),
    loadedScopes:()=>[...loadedViews.keys()],invalidate:()=>store.invalidate(),publish
  });
  function publish(patch,names){
    for(const name of names)loadedViews.set(name,patch[name]);
    bridge.onPatch?.(patch);
  }
  function viewPatch(names=[...loadedViews.keys()]){
    const data=Object.fromEntries(names.map(name=>[name,loadedViews.get(name)]));
    return {...data,updatedAt:new Date().toISOString(),dataRevision:freshness.revision};
  }
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
  function clear(){generation++;freshness.clear();stopLastOperation?.();stopLastOperation=null;loadedViews.clear();store.invalidate();}
  function user(){
    const current=auth.currentUser;
    if(!current)throw new Error('AUTH_REQUIRED: Google hesabınızla giriş yapın.');
    if(!current.emailVerified||!ALLOWED_EMAILS.has(current.email?.toLowerCase())||!current.providerData.some(p=>p.providerId==='google.com'))throw new Error('AUTH_DENIED: Bu Google hesabına erişim izni verilmemiş.');
    return current;
  }
  const profile=()=>{const u=user();return {email:u.email,name:u.displayName||'Google hesabı',picture:u.photoURL||''};};
  onAuthStateChanged(auth,current=>{if(identity!==(current?.uid||'')){identity=current?.uid||'';clear();if(!current)bridge.onError?.(new Error('AUTH_REQUIRED'));}});
  bridge.login=async()=>{const result=await signInWithPopup(auth,new GoogleAuthProvider(),browserPopupRedirectResolver);try{user();}catch(error){await signOut(auth);throw error;}return result.user;};
  function watchLastOperation(){
    if(stopLastOperation)return;const epoch=generation;
    stopLastOperation=firestore.onSnapshot(metaRef,{includeMetadataChanges:true},snapshot=>{
      if(epoch!==generation||snapshot.metadata.hasPendingWrites||snapshot.metadata.fromCache)return;
      const data=snapshot.exists()?snapshot.data():{};
      const revision=data.revision||0;
      if(revision<(freshness.revision??0))return;
      freshness.observe({revision});
      bridge.onPatch?.({lastOperationAt:stamp(data.updatedAt)});
      if(loadedViews.size&&revision>freshness.revision){
        void freshness.ensure().catch(error=>{if(epoch===generation)bridge.onError?.(error);});
      }
    },error=>{if(epoch!==generation)return;stopLastOperation=null;bridge.onError?.(error);});
  }
  bridge.prefetch=async()=>{user();watchLastOperation();return bridge.ensureFresh({scopes:['products','parties','company']});};
  async function execute(action,data,scopes=[]){
    if(!navigator.onLine)throw new Error('İnternet bağlantınızı kontrol ediniz.');
    const epoch=generation;
    const result=await store.execute(action,data);
    if(epoch!==generation)throw new Error('CANCELLED: Oturum değişti.');
    const names=[...new Set([...loadedViews.keys(),...scopes.flatMap(scope=>scopeNames[scope])])];
    if(freshness.committed(result.revision,names)){
      const data=Object.fromEntries(names.map(name=>[name,result.view[name]]));
      publish({...data,updatedAt:new Date().toISOString(),dataRevision:result.revision},names);
    }else if(names.some(name=>!loadedViews.has(name))){
      try{await bridge.ensureFresh({scopes});}
      catch(error){return {result:result.result,refreshError:String(error.message||error)};}
    }
    return {result:result.result,patch:viewPatch()};
  }
  bridge.call=async(name,arg)=>{
    if(name==='beginSession'){
      user();
      await security.dailyUnlock();
      const current=user();
      return {token:current.uid,profile:profile(),appState:{...domain.bootstrap(),companyVersions:loadedViews.get('companyVersions')||[],dataRevision:freshness.revision}};
    }
    if(name==='endSession'){clear();await signOut(auth);return true;}
    user();
    if(name==='getProfile')return profile();
    if(name==='getCompanyState'){await bridge.ensureFresh({scopes:['company'],force:true});return {companyVersions:loadedViews.get('companyVersions'),dataRevision:freshness.revision};}
    if(name==='getAppState')return domain.bootstrap();
    if(name==='getModuleState'){
      const names=scopeNames[arg?.scope];
      if(!names)throw new Error('Veri bölümü geçersiz.');
      await bridge.ensureFresh({scopes:[arg.scope]});
      return viewPatch(names);
    }
    if(name==='mutateAndRead'){
      if(!navigator.onLine)throw new Error('İnternet bağlantınızı kontrol ediniz.');
      if(!Array.isArray(arg.scopes)||arg.scopes.some(scope=>!['products','parties','ledger','notes','company'].includes(scope)))throw new Error('Veri bölümü geçersiz.');
      return execute(arg.action,arg.data,arg.scopes);
    }
    if(['saveUnit','saveMaster','deleteMaster','setMasterArchived','postTransaction','postStockCount','voidTransaction','saveNote','saveCompanyVersion','regenerateCompanyDocument'].includes(name))return (await execute(name,arg)).result;
    throw new Error('İşlem geçersiz.');
  };
  bridge.export=()=>{user();return store.export();};
  bridge.inspectImport=payload=>{user();return store.inspectImport(payload);};
  bridge.importEmpty=payload=>{user();return store.importEmpty(payload);};
  return bridge;
}
