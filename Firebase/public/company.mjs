import locations from './locations.mjs?v=app-20261119-1';
export const initialCompany=Object.freeze({id:'1',surum:1,firmaAdi:'Örnek Firma',yetkiliAdi:'Yetkili',adres:'Örnek adres',telefon:'0000 000 00 00',eposta:'company@example.invalid'});
export const companyFields=['firmaAdi','yetkiliAdi','adres','telefon','eposta','il','ilce'];
export function normalizeCompany(input){
  const result={};
  for(const key of companyFields){if(['il','ilce'].includes(key)&&input?.[key]==null){result[key]='';continue;}if(typeof input?.[key]!=='string')throw new Error('Firma bilgileri eksik.');result[key]=input[key].trim();if(result[key].length>(key==='adres'?1000:200))throw new Error('Firma bilgisi çok uzun.');}
  if(!result.firmaAdi)throw new Error('Firma adı zorunlu.');
  if(result.eposta&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.eposta))throw new Error('Geçerli bir e-posta girin.');
  if(result.il&&!Object.hasOwn(locations,result.il))throw new Error('Geçerli bir il seçin.');
  if(result.ilce&&!locations[result.il]?.includes(result.ilce))throw new Error('İl ve ilçe uyumsuz.');
  return result;
}
export const sameCompany=(a,b)=>companyFields.every(key=>(a[key]||'')===(b[key]||''));
export function companyVersions(rows=[]){
  if(!Array.isArray(rows))throw new Error('Firma sürümleri okunamadı.');
  const versions=rows.length?rows:[initialCompany];
  const sorted=versions.slice().sort((a,b)=>a.surum-b.surum);
  for(let i=0;i<sorted.length;i++){
    const row=sorted[i];normalizeCompany(row);
    if(row.surum!==i+1||row.id!==String(row.surum)||(i===0&&!sameCompany(row,initialCompany)))throw new Error('Firma sürüm geçmişi geçersiz.');
  }
  return sorted;
}
export const currentCompany=rows=>companyVersions(rows).at(-1);
export function companyForDocument(document,rows){
  const versions=companyVersions(rows),version=document?.taslak===true?versions.at(-1).surum:(document?.firmaSurumu||1);
  const company=versions.find(row=>row.surum===version);
  if(!company)throw new Error('Belgenin firma sürümü bulunamadı. Yeniden yükleyin.');
  return company;
}
export function appendCompanyVersion(rows,input,actor){
  const versions=companyVersions(rows),latest=versions.at(-1),fields=normalizeCompany(input);
  if(input.baseVersion!==latest.surum)throw new Error('Firma bilgileri başka bir cihazda değişti. Formu yeniden açın.');
  if(sameCompany(fields,latest))throw new Error('Firma bilgilerinde değişiklik yok.');
  const version={...fields,id:String(latest.surum+1),surum:latest.surum+1,olusturan:actor,olusturmaZamani:new Date().toISOString(),_row:latest.surum+2};
  return [...versions.map(row=>({...row,_row:row.surum+1})),version];
}
export function regenerateCompany(transactions,id,version,actor){
  const selected=transactions.find(row=>row.id===id);
  if(!selected)throw new Error('Belge bulunamadı.');
  if(!['SATIS','ALIS','SATIS_IADE','ALIS_IADE','CARI_DEVIR','TAHSILAT','ODEME'].includes(selected.tur))throw new Error('Bu işlem için belge oluşturulamaz.');
  // Receipt routes resolve linked payments to their trade and combine all currencies.
  const parent=transactions.find(row=>row.id===selected.urunIslemId)||selected;
  const roots=transactions.filter(row=>row.id===parent.id||(parent.fisGrupId&&row.fisGrupId===parent.fisGrupId&&row.islemNo===parent.islemNo));
  const ids=new Set(roots.map(row=>row.id));
  const time=new Date().toISOString();
  for(const row of transactions){
    if(!ids.has(row.id)&&!ids.has(row.urunIslemId))continue;
    if((row.firmaSurumu||1)===version)continue;
    row.firmaGecmisi=[...(row.firmaGecmisi||[]),{oncekiSurum:row.firmaSurumu||1,yeniSurum:version,zaman:time,kullanici:actor}];row.firmaSurumu=version;
  }
  return {id:parent.id,firmaSurumu:version};
}
