import {pinGroup,changeGroup} from './pin-security.mjs?v=app-20261119-1';
export function revisionConflict(){const error=new Error('Veriler başka bir cihazdan güncellendi, yenilendi. Lütfen kontrol edip tekrar kaydedin.');error.code='STALE_REVISION';error.stale=true;return error;}
// The same domain rules power Sheets and Firestore. Revision checking serializes
// writes across clients without Cloud Functions or background polling.
export function createStore(api,db,domain,security=null) {
  const {doc,collection,getDocFromServer,getDocsFromServer,runTransaction,serverTimestamp}=api;
  const metaRef=doc(db,'system/state');
  let cached=null;
  const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
  const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
  const rowKey=(table,row)=>row[domain.headers[table][0]];
  const revision=snap=>snap.exists()?snap.data().revision:0;
  const tablePath=table=>table==='FirmaSurumleri'?'companyVersions':`tables/${table}/rows`;
  const rowPath=(table,row)=>`${tablePath(table)}/${rowKey(table,row)}`;
  const viewPath=(scope,row)=>`views/${scope}/rows/${row.id}`;
  function cleanRows(raw){
    // Never discard a historical manual total that would change the accounts.
    for(const row of raw.UrunHareketleri||[]){
      if(row.elleTutar!==''&&row.elleTutar!=null&&Number(row.elleTutar)!==Math.round(Number(row.adet)*Number(row.birimFiyat)*100)/100)throw new Error('Yedekte hesaplanan tutardan farklı eski bir elle tutar var. Dönüşüm için destek alın.');
    }
    if((raw.Islemler||[]).some(row=>row.indirimDegeri||row.indirimTutari))throw new Error('Eski indirimli kayıt otomatik dönüştürülemez.');
    const transactions=new Map((raw.Islemler||[]).map(row=>[row.id,row]));
    for(const row of raw.OdemeBelgeleri||[]){
      const parent=transactions.get(row.islemId);
      if((row.tamamlanmaTarihi&&row.tamamlanmaTarihi!==parent?.tarih)||(row.tamamlayanId&&row.tamamlayanId!==parent?.olusturanId))throw new Error('Yedekte ayrı çek/senet tamamlama bilgisi var. Dönüşüm için destek alın.');
    }
    // Convert old separate count rows into the product line they describe.
    const migratedLines=(raw.UrunHareketleri||[]).map(row=>({...row}));
    const seenCounts=new Set();
    for(const count of raw.StokSayimlari||[]){
      if(seenCounts.has(count.islemId))throw new Error('Yinelenmiş eski sayım kaydı.');
      seenCounts.add(count.islemId);
      const lines=migratedLines.filter(row=>row.islemId===count.islemId);
      if(lines.length!==1)throw new Error('Eski sayım tek ürün satırına bağlı olmalı.');
      const line=lines[0];
      for(const [key,value] of [['sayimOncekiMiktar',count.oncekiMiktar],['sayilanMiktar',count.sayilanMiktar]]){
        if(line[key]!==''&&line[key]!=null&&line[key]!==value)throw new Error('Eski ve yeni sayım bilgileri çelişiyor.');
        line[key]=value;
      }
    }
    raw={...raw,FirmaSurumleri:raw.FirmaSurumleri||[],UrunHareketleri:migratedLines};
    const result=domain.blank();
    for(const [table,fields] of Object.entries(domain.headers)){
      if(!Array.isArray(raw[table]))throw new Error('Eksik tablo: '+table);
      result[table]=raw[table].map((row,i)=>Object.assign(Object.fromEntries(fields.map(key=>[key,row[key]??(key==='firmaGecmisi'?[]:key==='arsivlendiMi'?false:key==='ondalikliMi'?domain.unitFractionsDefault(row.ad):'')])),{_row:Number.isInteger(row._row)&&row._row>=2?row._row:i+2}));
      if(new Set(result[table].map(r=>r._row)).size!==result[table].length)throw new Error(table+': satır sırası yinelenmiş.');
    }
    // Old backups may use a separate UUID; product code is the canonical identity.
    const productIds=new Map(result.Urunler.map(row=>[row.id,row.kod]));
    result.Urunler=result.Urunler.map(row=>({...row,id:row.kod}));
    result.UrunHareketleri=result.UrunHareketleri.map(row=>({...row,urunId:productIds.get(row.urunId)||row.urunId}));
    domain.validate(result);return result;
  }
  function entries(raw,view){
    const rows=new Map();
    for(const [table,list] of Object.entries(raw))for(const row of list)rows.set(rowPath(table,row),row);
    for(const scope of ['products','parties','transactions','notes'])for(const row of view[scope])rows.set(viewPath(scope,row),row);
    return rows;
  }
  function diff(before,after){
    const changes=[];
    for(const [key,value] of after)if(!equal(value,before.get(key)))changes.push({path:key,value});
    for(const key of before.keys())if(!after.has(key))changes.push({path:key,value:null});
    // Keep below Firestore's write/request limits and fail before writing anything.
    if(changes.length>450||new TextEncoder().encode(JSON.stringify(changes)).length>8_000_000)throw new Error('Bu kayıt tek seferde işlenemeyecek kadar büyük. Aktarımı bölmek için destek alın.');
    for(const c of changes)if(c.value&&new TextEncoder().encode(JSON.stringify(c.value)).length>900_000)throw new Error('Kayıt boyutu sınırı aşıldı.');
    return changes;
  }
  async function load(force=false){
    if(cached&&!force)return cached;
    for(let attempt=0;attempt<4;attempt++){
      const before=await getDocFromServer(metaRef);
      const raw=domain.blank();
      await Promise.all(Object.keys(raw).map(async table=>{
        const snapshot=await getDocsFromServer(collection(db,tablePath(table)));
        raw[table]=snapshot.docs.map(doc=>doc.data()).sort((a,b)=>a._row-b._row);
      }));
      const after=await getDocFromServer(metaRef);
      if(revision(before)!==revision(after))continue;
      if(!after.exists()&&Object.values(raw).some(rows=>rows.length))throw new Error('Veritabanı sürüm kaydı eksik.');
      if(after.exists()&&after.data().schemaVersion!==9)throw new Error('Veritabanı şeması güncellenmeli.');
      const cleaned=cleanRows(raw);cached={raw:cleaned,revision:revision(after)};return cached;
    }
    throw new Error('Kayıtlar başka bir cihazda değişiyor. Yeniden deneyin.');
  }
  async function commit(base,raw,view,operation='create'){
    const before=entries(base.raw,domain.views(base.raw)),after=entries(raw,view);
    const changes=diff(before,after);
    if(changes.some(change=>change.path.startsWith('companyVersions/')&&(change.value===null||before.has(change.path))))throw new Error('Eski firma sürümleri değiştirilemez veya silinemez.');
    const groups=[...new Set([operation,...changes.map(c=>changeGroup(c,before)).filter(Boolean)])];
    const grant=security?await security.authorize(groups):null;
    const pinProofs=security?await security.proofs(grant,base.revision+1):{};
    await runTransaction(db,async transaction=>{
      const current=await transaction.get(metaRef);
      if(security){const pinSnap=await transaction.get(security.configRef());if((pinSnap.exists()?pinSnap.data().version:0)!==grant.config.version)throw new Error('PIN ayarları değişti. İşlemi yeniden kaydedin.');}
      if(revision(current)!==base.revision)throw revisionConflict();
      for(const change of changes){const ref=doc(db,change.path);if(change.value===null)transaction.delete(ref);else transaction.set(ref,change.value);}
      if(changes.length)transaction.set(metaRef,{schemaVersion:9,companyVersion:view.companyVersions.at(-1).surum,revision:base.revision+1,expectedRevision:base.revision,updatedAt:serverTimestamp(),operation,pinProofs,pinLeaseId:grant?.leaseId||''});
    });
    const committedRevision=base.revision+(changes.length?1:0);
    cached={raw,revision:committedRevision};
    return committedRevision;
  }
  return {
    invalidate(){cached=null;},cleanRows,
    async execute(action,input){
      for(let attempt=0;attempt<4;attempt++){
        const lastSnapshot=cached;
        const needsReload=lastSnapshot&&revision(await getDocFromServer(metaRef))!==lastSnapshot.revision;
        const base=await load(needsReload);
        let result;
        try{
          result=domain.execute(action,input,base.raw);
        }catch(error){
          if(revision(await getDocFromServer(metaRef))===base.revision)throw error;
          cached=null;
          continue;
        }
        try{
          const committedRevision=await commit(base,result.raw,result.view,pinGroup(action,input,base.raw));
          return {...result,revision:committedRevision};
        }catch(error){
          cached=null;
          if(error.stale)continue;
          // Rules can report a revision race before the SDK reports a retry.
          if(['permission-denied','aborted'].includes(error.code)
            &&revision(await getDocFromServer(metaRef))!==base.revision)continue;
          throw error;
        }
      }
      throw new Error('Kayıtlar aynı anda güncelleniyor. Lütfen işlemi tekrar deneyin.');
    },
    async export(){const current=await load(true);return {format:'STAR_FIREBASE_V1',schemaVersion:9,revision:current.revision,exportedAt:new Date().toISOString(),tables:current.raw};},
    inspectImport(payload){
      if(![7,8,9].includes(payload.schemaVersion)||!payload.tables)throw new Error('Star Takip şema 7, 8 veya 9 yedeği seçin.');
      const raw=cleanRows(payload.tables),view=domain.views(raw);
      diff(new Map(),entries(raw,view));
      return {raw,view,counts:Object.fromEntries(Object.entries(raw).map(([name,rows])=>[name,rows.length]))};
    },
    async importEmpty(payload){
      const plan=this.inspectImport(payload),base=await load(true);
      if(base.revision||Object.values(base.raw).some(rows=>rows.length))throw new Error('Aktarım yalnızca boş Firebase veritabanına yapılabilir. Mevcut kayıtlar korunuyor.');
      await commit(base,plan.raw,plan.view);
      const verified=await load(true);
      if(!equal(entries(verified.raw,domain.views(verified.raw)).size,entries(plan.raw,plan.view).size))throw new Error('Aktarım sonrası kayıt sayısı doğrulanamadı.');
      for(const table of Object.keys(plan.raw)){
        const byId=rows=>rows.slice().sort((a,b)=>String(rowKey(table,a)).localeCompare(String(rowKey(table,b))));
        if(!equal(byId(verified.raw[table]),byId(plan.raw[table])))throw new Error('Aktarım doğrulanamadı: '+table);
      }
      return plan.counts;
    }
  };
}
