import partyLocations from './locations.mjs';
import {validateTransactionTime,operationOrder} from './transaction-time.mjs?v=app-20261124-1';
import {companyVersions,currentCompany,appendCompanyVersion,regenerateCompany} from './company.mjs?v=app-20261119-1';
// Generated from AileTakip/Code.gs. Edit the original business rules, then rebuild.
export function createDomain(email) {
const actorEmail=()=>typeof email==='function'?email():email;
const copy=value=>JSON.parse(JSON.stringify(value));
let database;
const Utilities={getUuid:()=>crypto.randomUUID(),formatDate:(date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)};
const HEADERS = {
  FirmaSurumleri: ['id','surum','firmaAdi','yetkiliAdi','adres','telefon','eposta','il','ilce','olusturan','olusturmaZamani'],
  Birimler: ['id','ad','ondalikliMi'],
  Urunler: ['id','kod','ad','birimId','satisFiyati','kritikStok','paraBirimi','arsivlendiMi','arsivlenmeZamani','arsivleyenId'],
  Cariler: ['id','ad','kisiAdi','telefon','not','adres','eposta','il','ilce','arsivlendiMi','arsivlenmeZamani','arsivleyenId'],
  Kullanicilar: ['id','eposta'],
  Islemler: ['id','tarih','tur','cariId','aciklama','olusturanId','olusturmaZamani','paraBirimi','islemNo','fisGrupId','firmaSurumu','firmaGecmisi','islemSaati'],
  UrunHareketleri: ['id','islemId','sira','urunId','adet','birimFiyat','sayimOncekiMiktar','sayilanMiktar'],
  CariAcilislari: ['islemId','tutar'],
  Odemeler: ['islemId','yontem','tutar','urunIslemId'],
  OdemeBelgeleri: ['islemId','belgeNo','vade'],
  IslemIptalleri: ['islemId','neden','kullaniciId','zaman'],
  Notlar: ['id','baslik','icerik','olusturanId','olusturmaZamani','guncelleyenId','guncellemeZamani','surum']
};
const RULES = {
  SATIS: { label:'Satış', stock:-1, balance:1, item:true, party:true },
  ALIS: { label:'Alış', stock:1, balance:-1, item:true, party:true },
  TAHSILAT: { label:'Tahsilat', stock:0, balance:-1, party:true },
  ODEME: { label:'Ödeme', stock:0, balance:1, party:true },
  SATIS_IADE: { label:'Satış iadesi', stock:1, balance:-1, item:true, party:true },
  ALIS_IADE: { label:'Alış iadesi', stock:-1, balance:1, item:true, party:true },
  CARI_DEVIR: { label:'Cari açılış bakiyesi', stock:0, balance:1, party:true, signed:true },
  STOK_GIRIS: { label:'Stok girişi', stock:1, balance:0, item:true },
  STOK_CIKIS: { label:'Stok çıkışı', stock:-1, balance:0, item:true }
};
const PAYMENT_METHODS = ['NAKIT','KREDI_KARTI','CEK','SENET'];
const CURRENCIES=['TRY','USD'];
function currency_(v){const code=v==null||v===''?'TRY':String(v);if(!CURRENCIES.includes(code))throw new Error('Para birimi TL veya USD olmalı.');return code;}

function unitFractionsDefault(unit){
  const name=String(unit||'').trim().toLocaleLowerCase('tr');
  return ['m','mt','metre','cm','santimetre','mm','milimetre','m2','m²','metrekare','m3','m³','metreküp','kg','kilogram','g','gr','gram','mg','miligram','ton','t','l','lt','litre','ml','mililitre'].includes(name);
}
function isWholeUnit(unit){return ['adet','ad','tane','kutu','takım','takim','set','paket','çift','cift','koli'].includes(String(unit||'').trim().toLocaleLowerCase('tr'));}
function quantity_(value,label,product){
  const n=number_(value,label,false,3);
  if(!product.ondalikliMi&&!Number.isInteger(value))throw new Error(label+': '+product.birim+' biriminde yalnız tam sayı girilebilir.');
  return n;
}
function unitPolicy_(unit){
  const flag=unit.ondalikliMi??unitFractionsDefault(unit.ad);
  if(typeof flag!=='boolean')throw new Error('Birim miktar kuralı geçersiz.');
  return flag;
}
function masterTable_(input) {
  if (!input || !['product','party'].includes(input.type)) throw new Error('Kayıt türü geçersiz.');
  return input.type==='product'?'Urunler':'Cariler';
}
// Stage an insert in both the in-memory model and the atomic write batch.
function stageInsert_(db,changes,name,row) {
  db[name].push(row);
  changes.push({name:name,obj:row});
  return row;
}
function creationMetadata_(db,changes,email) {
  return {
    olusturanId:ensureReference_(db,'Kullanicilar','eposta',email,changes),
    olusturmaZamani:new Date().toISOString()
  };
}
function text_(v,max) {
  const s=String(v==null?'':v).trim();
  if (s.length>(max||200)) throw new Error('Metin çok uzun.');
  return s;
}
// CSV/uyumluluk için kaçış. Sheets API yazmalarında stringValue doğrudan düz metindir.
function cell_(v) {return typeof v==='string' && /^[=+\-@]/.test(v)?"'"+v:v;}
function number_(v,name,signed,decimals) {
  if (typeof v!=='number' || !Number.isFinite(v) || Math.abs(v)>1e10 || (!signed && v<0)) throw new Error(name+': geçerli bir sayı girin.');
  const factor=Math.pow(10,decimals==null?2:decimals);
  return Math.round((v+Math.sign(v)*Number.EPSILON)*factor)/factor;
}
function id_(v) {
  const s=text_(v,80);
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(s)) throw new Error('Kayıt kimliği geçersiz. Sayfayı yenileyin.');
  return s;
}
function date_(v,futureAllowed) {
  const s=text_(v,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s+'T00:00:00Z')) || new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s) throw new Error('Tarih geçersiz.');
  if (!futureAllowed && s>Utilities.formatDate(new Date(),'Europe/Istanbul','yyyy-MM-dd')) throw new Error('Gelecek tarihli işlem kaydedilemez.');
  return s;
}
function round_(x,n) {return Math.round(x*Math.pow(10,n))/Math.pow(10,n);}
function primaryKey_(name) {return HEADERS[name][0];}
function assertHeaders_(sheet,headers) {
  const actual=sheet.getRange(1,1,1,headers.length).getValues()[0];
  if (JSON.stringify(actual)!==JSON.stringify(headers) || sheet.getLastColumn()>headers.length) throw new Error(sheet.getName()+' başlıkları beklenen şemaya uymuyor. Sütunları elle değiştirmeyin.');
}
function readSheet_(sheet,headers) {
  assertHeaders_(sheet,headers);
  if (sheet.getLastRow()<2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues().map((r,i)=>{
    const o={_row:i+2};headers.forEach((h,j)=>o[h]=r[j]);return o;
  }).filter(o=>{
    if (!headers.some(h=>o[h]!=='' && o[h]!=null)) return false;
    if (!o[headers[0]]) throw new Error(sheet.getName()+': kimliği olmayan kayıt var.');
    return true;
  });
}
function rows_(name,book) {
  const sheet=(book||book_()).getSheetByName(name);
  if (!sheet) throw new Error('Eksik sayfa: '+name+'. Güncel kodla kurulum işlevini çalıştırın.');
  return readSheet_(sheet,HEADERS[name]);
}
// One Sheets API read for all requested tables; preserve physical row numbers.
function batchReadModel_(names){
  const db=blankModel_(),book=book_();
  const response=Sheets.Spreadsheets.Values.batchGet(book.getId(),{ranges:names.map(name=>"'"+name+"'"),majorDimension:'ROWS',valueRenderOption:'UNFORMATTED_VALUE'});
  if(!response.valueRanges||response.valueRanges.length!==names.length)throw new Error('Tablo verileri eksik döndü.');
  names.forEach((name,index)=>{
    const values=response.valueRanges[index].values||[],headers=HEADERS[name];
    if(JSON.stringify(values[0]||[])!==JSON.stringify(headers)||values.some(row=>row.length>headers.length))throw new Error(name+' başlıkları beklenen şemaya uymuyor. Sütunları elle değiştirmeyin.');
    db[name]=values.slice(1).map((row,i)=>Object.assign({_row:i+2},Object.fromEntries(headers.map((field,j)=>[field,row[j]??''])))).filter(row=>{
      if(!headers.some(field=>row[field]!==''&&row[field]!=null))return false;
      if(!row[headers[0]])throw new Error(name+': kimliği olmayan kayıt var.');return true;
    });
  });if(requestContext_)names.forEach(name=>requestContext_.validated.add(name));return db;
}
function model_(){
  const db=batchReadModel_(Object.keys(HEADERS));
  if(requestContext_&&writeResponseScopes_!==null)requestContext_.db=JSON.parse(JSON.stringify(db));
  return db;
}

function applyCommittedChanges_(db,changes){
  changes.forEach(change=>{
    const list=db[change.name],key=primaryKey_(change.name);
    if(change.deleteRow){
      db[change.name]=list.filter(row=>row._row!==change.deleteRow).map(row=>Object.assign({},row,{_row:row._row>change.deleteRow?row._row-1:row._row}));return;
    }
    const old=list.find(row=>change.row?row._row===change.row:row[key]===change.obj[key]);
    const row=Object.assign({},change.obj,{_row:change.row||old?._row||Math.max(1,...list.map(item=>item._row||1))+1});
    if(old)list[list.indexOf(old)]=row;else list.push(row);
  });
}
function index_(rows,key,label) {
  const result=Object.create(null);
  rows.forEach(r=>{const id=r[key];if (!id || result[id]) throw new Error(label+': eksik/yinelenen anahtar.');result[id]=r;});
  return result;
}
function ref_(map,id,label) {
  if (!id || !map[id]) throw new Error('Veri bütünlüğü: '+label+' bağlantısı bulunamadı.');
  return map[id];
}
function unique_(rows,key,label) {
  const seen=new Set();rows.forEach(r=>{const k=String(r[key]||'').trim().toLocaleLowerCase('tr');if (!k || seen.has(k)) throw new Error(label+': boş/yinelenen değer.');seen.add(k);});
}
// Fiziksel 3NF tablolarından ekranlar için düz bir okuma modeli oluşturur; tabloya yazılmaz.
// ── Normalized tables → read model ──
function projectModel_(db) {
  const versions=companyVersions(db.FirmaSurumleri||[]);
  const m={};Object.keys(HEADERS).forEach(n=>m[n]=index_(db[n]||[],primaryKey_(n),n));
  const numbers=new Map();
  for(const t of db.Islemler){
    const linked=db.Odemeler.find(p=>p.islemId===t.id&&p.urunIslemId),parent=linked&&m.Islemler[linked.urunIslemId],root=parent&&parent.islemNo===t.islemNo?parent:t;
    const number=String(t.islemNo||'').trim().toLocaleLowerCase('tr'),owner=root.fisGrupId?'group:'+root.fisGrupId:'row:'+root.id;
    if(!number||(numbers.has(number)&&numbers.get(number)!==owner))throw new Error('İşlem numarası: boş/yinelenen değer.');
    numbers.set(number,owner);
  }
  unique_(db.Birimler,'ad','Birim');unique_(db.Kullanicilar,'eposta','Kullanıcı');unique_(db.Urunler,'kod','Ürün kodu');unique_(db.Cariler,'ad','Cari adı');
  const archiveFields=p=>{
    const flag=p.arsivlendiMi??false;
    if(typeof flag!=='boolean')throw new Error('Kartın arşiv durumu geçersiz.');
    if(p.arsivleyenId)ref_(m.Kullanicilar,p.arsivleyenId,'arşivleyen');
    if((p.arsivlenmeZamani&&isNaN(Date.parse(p.arsivlenmeZamani)))||(flag&&(!p.arsivleyenId||!p.arsivlenmeZamani)))throw new Error('Kartın arşiv bilgileri eksik.');
    return {arsivlendiMi:flag,arsivlenmeZamani:p.arsivlenmeZamani||'',arsivleyenId:p.arsivleyenId||''};
  };
  const groupedItems=Object.create(null),lineOrders=new Set();
  db.UrunHareketleri.forEach(item=>{ref_(m.Islemler,item.islemId,'işlem');const order=item.islemId+':'+item.sira;if(!Number.isInteger(item.sira)||item.sira<1||lineOrders.has(order))throw new Error('Veri bütünlüğü: ürün satır sırası geçersiz/yinelenmiş.');lineOrders.add(order);(groupedItems[item.islemId]||(groupedItems[item.islemId]=[])).push(item);});
  const products=db.Urunler.map(p=>Object.assign({},p,{...archiveFields(p),ondalikliMi:unitPolicy_(ref_(m.Birimler,p.birimId,'birim')),birim:ref_(m.Birimler,p.birimId,'birim').ad,paraBirimi:currency_(p.paraBirimi)}));
  const productById=new Map(products.map(p=>[p.id,p]));
  products.forEach(p=>quantity_(p.kritikStok,'Kritik stok',p));
  const transactions=db.Islemler.map(t=>{
    if(t.firmaSurumu&&!versions.some(row=>row.surum===t.firmaSurumu))throw new Error('Belgenin firma sürümü bulunamadı.');
    const rule=RULES[t.tur];if (!rule) throw new Error('Veri bütünlüğü: işlem türü geçersiz.');
    if (rule.party) ref_(m.Cariler,t.cariId,'cari');else if (t.cariId) throw new Error('Stok işleminde cari bulunamaz.');
    const x=Object.assign({},t,{paraBirimi:currency_(t.paraBirimi),urunId:'',adet:0,birimFiyat:0,tutar:0,stokEtki:0,cariEtki:0,durum:'AKTIF',olusturan:ref_(m.Kullanicilar,t.olusturanId,'oluşturan').eposta,iptalEden:'',iptalZamani:'',iptalNedeni:'',odemeYontemi:'',vade:'',belgeNo:''});
    const items=(groupedItems[t.id]||[]).slice().sort((a,b)=>a.sira-b.sira),payment=m.Odemeler[t.id],opening=m.CariAcilislari[t.id],doc=m.OdemeBelgeleri[t.id],cancel=m.IslemIptalleri[t.id];
    if (!!items.length!==!!rule.item || !!payment!==['TAHSILAT','ODEME'].includes(t.tur) || !!opening!==(t.tur==='CARI_DEVIR')) throw new Error('Veri bütünlüğü: işlem alt kaydı eksik veya türüyle uyumsuz.');
    x.items=items.map(item=>{
      ref_(m.Urunler,item.urunId,'ürün');const line={id:item.id,sira:item.sira,urunId:item.urunId,adet:quantity_(item.adet,'Adet',productById.get(item.urunId)),birimFiyat:0,tutar:0,stokEtki:0};
      if(line.adet<=0)throw new Error('Veri bütünlüğü: adet sıfırdan büyük olmalı.');
      line.stokEtki=round_(line.adet*rule.stock,3);
      if(rule.balance){line.birimFiyat=number_(item.birimFiyat,'Birim fiyat');line.tutar=number_(round_(line.adet*line.birimFiyat,2),'Hesaplanan tutar');}
      else if(item.birimFiyat!==''&&item.birimFiyat!=null)throw new Error('Stok sayımında parasal tutar bulunamaz.');
      return line;
    });
    if(t.indirimDegeri||t.indirimTutari)throw new Error('Eski indirimli kayıt otomatik dönüştürülemez.');
    if(x.items.length){
      const gross=number_(round_(x.items.reduce((sum,line)=>sum+line.tutar,0),2),'İşlem toplamı');
      x.tutar=gross;
      if(x.items.length===1){const line=x.items[0];['urunId','adet','birimFiyat','stokEtki'].forEach(k=>x[k]=line[k]);}
    }
    if (payment) {
      if (!PAYMENT_METHODS.includes(payment.yontem)) throw new Error('Veri bütünlüğü: ödeme yöntemi geçersiz.');
      x.urunIslemId=payment.urunIslemId||'';x.odemeYontemi=payment.yontem;x.tutar=number_(payment.tutar,'Tutar');
      if (!x.tutar) throw new Error('Tutar sıfır olamaz.');
    }
    if (opening) {x.tutar=number_(opening.tutar,'Tutar',true);if (!x.tutar) throw new Error('Tutar sıfır olamaz.');}
    if (!!doc!==['CEK','SENET'].includes(x.odemeYontemi)) throw new Error('Veri bütünlüğü: çek/senet alt kaydı eksik veya ödeme yöntemiyle uyumsuz.');
    if (doc) {
      x.belgeNo=text_(doc.belgeNo,80);x.vade=date_(doc.vade,true);
      if (!x.belgeNo || x.vade<t.tarih) throw new Error('Veri bütünlüğü: belge bilgileri geçersiz.');
    }
    if (cancel) {x.durum='IPTAL';x.iptalNedeni=text_(cancel.neden,300);x.iptalZamani=cancel.zaman;x.iptalEden=ref_(m.Kullanicilar,cancel.kullaniciId,'iptal eden').eposta;if (!x.iptalNedeni || !x.iptalZamani) throw new Error('İptal bilgileri eksik.');}
    const counts=items.filter(item=>[item.sayimOncekiMiktar,item.sayilanMiktar].some(v=>v!==''&&v!=null));
    const count=counts[0];
    if(count){
      if(counts.length!==1||[count.sayimOncekiMiktar,count.sayilanMiktar].some(v=>v===''||v==null))throw new Error('Sayım bilgileri eksik veya birden fazla satırda.');
      if(!['STOK_GIRIS','STOK_CIKIS'].includes(t.tur)||x.items.length!==1)throw new Error('Sayım kaydı stok düzeltmesine bağlı olmalı.');
      x.sayim={oncekiMiktar:quantity_(count.sayimOncekiMiktar,'Önceki miktar',productById.get(x.items[0].urunId)),sayilanMiktar:quantity_(count.sayilanMiktar,'Sayılan miktar',productById.get(x.items[0].urunId))};
      if(round_(x.sayim.sayilanMiktar-x.sayim.oncekiMiktar,3)!==x.items[0].stokEtki)throw new Error('Sayım farkı stok hareketiyle uyuşmuyor.');
    }
    x.cariEtki=round_(x.tutar*rule.balance,2);return x;
  });
  ['UrunHareketleri','Odemeler','CariAcilislari','OdemeBelgeleri','IslemIptalleri'].forEach(n=>db[n].forEach(r=>ref_(m.Islemler,r.islemId,n)));
  const receiptGroups=new Map();
  for(const t of transactions){
    if(!t.fisGrupId)continue;
    id_(t.fisGrupId);
    if(!['SATIS','ALIS','SATIS_IADE','ALIS_IADE'].includes(t.tur))throw new Error('Fiş grubu işlem türü geçersiz.');
    let group=receiptGroups.get(t.fisGrupId);
    if(!group){group={party:t.cariId,date:t.tarih,kind:t.tur,number:t.islemNo,currencies:new Set()};receiptGroups.set(t.fisGrupId,group);}
    if(group.party!==t.cariId||group.date!==t.tarih||group.kind!==t.tur||group.number!==t.islemNo||group.currencies.has(t.paraBirimi))throw new Error('Fiş grubunda cari, tarih, tür veya para birimi uyumsuz.');
    group.currencies.add(t.paraBirimi);
  }
  const linkedParents=new Set();
  transactions.filter(t=>t.urunIslemId).forEach(t=>{
    const parent=transactions.find(p=>p.id===t.urunIslemId);
    if(!parent||!['SATIS','ALIS'].includes(parent.tur)||t.tur!==(parent.tur==='SATIS'?'TAHSILAT':'ODEME')||t.cariId!==parent.cariId||t.tarih!==parent.tarih||t.tutar!==parent.tutar||t.paraBirimi!==parent.paraBirimi||linkedParents.has(parent.id)||(parent.durum==='IPTAL'&&t.durum!=='IPTAL'))throw new Error('Veri bütünlüğü: bağlı ödeme geçersiz.');
    linkedParents.add(parent.id);parent.odemeIslemId=t.id;
  });
  const notes=db.Notlar.map(n=>{
    if(!text_(n.baslik,120)||!text_(n.icerik,10000)||!n.surum)throw new Error('Not bilgileri eksik.');
    return Object.assign({},n,{olusturan:ref_(m.Kullanicilar,n.olusturanId,'notu oluşturan').eposta,guncelleyen:ref_(m.Kullanicilar,n.guncelleyenId,'notu düzenleyen').eposta});
  });
  return {units:db.Birimler.map(u=>({...u,ondalikliMi:unitPolicy_(u)})),products:products,parties:db.Cariler.map(p=>Object.assign({},p,archiveFields(p))),transactions:transactions,notes:notes};
}
function snapshot_() {return projectModel_(model_());}
function totals_(s) {
  const stock={},balances={};s.products.forEach(p=>stock[p.id]=0);s.parties.forEach(p=>balances[p.id]={TRY:0,USD:0});
  s.transactions.filter(t=>t.durum==='AKTIF').forEach(t=>{
    t.items.forEach(line=>stock[line.urunId]=round_((stock[line.urunId]||0)+line.stokEtki,3));
    if(t.cariId){const code=t.paraBirimi;balances[t.cariId][code]=round_(balances[t.cariId][code]+t.cariEtki,2);}
  });return {stock:stock,balances:balances};
}
function checkStock_(transactions,products) {
  const stock={},names={};(products||[]).forEach(p=>names[p.id]=p.ad);
  transactions.filter(t=>t.durum==='AKTIF'&&t.items.length).slice().sort((a,b)=>operationOrder(a,b,Number.MAX_SAFE_INTEGER)).forEach(t=>{
    t.items.forEach(line=>{stock[line.urunId]=round_((stock[line.urunId]||0)+line.stokEtki,3);if(stock[line.urunId]<0)throw new Error('Yetersiz stok: '+(names[line.urunId]||'ürün')+' için '+t.tarih+' tarihinde eksi stok oluşuyor. Önce alış veya açılış stoku girin.');});
  });
}
function ensureReference_(db,name,key,value,changes) {
  const clean=text_(value,name==='Kullanicilar'?254:20),found=db[name].find(r=>String(r[key]).toLocaleLowerCase('tr')===clean.toLocaleLowerCase('tr'));
  if (found) return found.id;
  if (!clean) throw new Error('Referans değeri boş olamaz.');
  const row={id:Utilities.getUuid()};row[key]=clean;stageInsert_(db,changes,name,row);return row.id;
}
// ── Public data operations ──
function masterHasHistory_(db,name,id){return name==='Urunler'?db.UrunHareketleri.some(row=>row.urunId===id):db.Islemler.some(row=>row.cariId===id);}
function deleteMaster(input,token){
  return withSessionLock_(token,()=>{
    const name=masterTable_(input),id=name==='Urunler'?productId_(input.id):id_(input.id),db=model_(),changes=[];
    projectModel_(db);const old=db[name].find(row=>row.id===id);
    if(!old)throw new Error('Kart bulunamadı.');
    if(masterHasHistory_(db,name,id))throw new Error((name==='Urunler'?'Ürün':'Cari')+' işlem veya stok hareketlerinde kullanılmış; silinemez. Arşivleyin.');
    changes.push({name,deleteRow:old._row});commit_(changes);return {id};
  });
}
function setMasterArchived(input,token){
  return withSessionLock_(token,email=>{
    const name=masterTable_(input),id=name==='Urunler'?productId_(input.id):id_(input.id),db=model_(),changes=[];
    projectModel_(db);
    const old=db[name].find(row=>row.id===id);
    if(!old)throw new Error('Kart bulunamadı.');
    if(typeof input.arsivlendiMi!=='boolean'||typeof input.beklenenArsivDurumu!=='boolean')throw new Error('Arşiv durumu geçersiz.');
    if(input.arsivlendiMi&&!masterHasHistory_(db,name,id))throw new Error('Bu kart hiçbir işlemde kullanılmamış; arşivlemek yerine silebilirsiniz.');
    const current=old.arsivlendiMi===true;
    if(current===input.arsivlendiMi)return {id:id,duplicate:true};
    if(current!==input.beklenenArsivDurumu||(old.arsivlenmeZamani||'')!==(input.beklenenArsivZamani||''))throw new Error('Kartın arşiv durumu değişti. Listeyi yenileyip tekrar deneyin.');
    const row={...old,arsivlendiMi:input.arsivlendiMi,arsivlenmeZamani:old.arsivlenmeZamani||'',arsivleyenId:old.arsivleyenId||''};
    if(input.arsivlendiMi){row.arsivlenmeZamani=new Date().toISOString();row.arsivleyenId=ensureReference_(db,'Kullanicilar','eposta',email,changes);}
    changes.push({name:name,obj:row});commit_(changes);return {id:id};
  });
}
function productId_(v){const s=text_(v,40);if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(s))throw new Error('Ürün kodu geçersiz.');return s;}
function nextProductCode_(products){return 'STR-'+String(products.reduce((n,p)=>/^STR-\d+$/.test(p.kod)?Math.max(n,Number(p.kod.slice(4))):n,0)+1).padStart(3,'0');}
function ensureDefaultUnits_(db,changes,skipName=''){
  const names=['adet','takım','set','paket','koli','kutu','metre','kg','litre','m²','m³'];
  names.forEach((ad,i)=>{if(ad!==skipName&&!db.Birimler.some(u=>u.ad.toLocaleLowerCase('tr')===ad))stageInsert_(db,changes,'Birimler',{id:'unit-preset-'+String(i+1).padStart(4,'0'),ad,ondalikliMi:unitFractionsDefault(ad)});});
}
function saveUnit(input,token){return withSessionLock_(token,email=>{
  if(!input)throw new Error('Birim bilgileri eksik.');const db=model_(),changes=[],id=id_(input.id),name=text_(input.ad,20);ensureDefaultUnits_(db,changes,name.toLocaleLowerCase('tr'));const old=db.Birimler.find(u=>u.id===id);
  if(!name||typeof input.ondalikliMi!=='boolean')throw new Error('Birim adı ve ondalıklı miktar ayarını girin.');
  if(db.Birimler.some(u=>u.id!==id&&u.ad.toLocaleLowerCase('tr')===name.toLocaleLowerCase('tr')))throw new Error('Bu birim zaten tanımlı.');
  if(old&&old.ad!==name&&db.Urunler.some(p=>p.birimId===id))throw new Error('Ürünlerde kullanılan birimin adını değiştiremezsiniz.');
  const row={id,ad:name,ondalikliMi:input.ondalikliMi};if(old)db.Birimler[db.Birimler.indexOf(old)]=row;else db.Birimler.push(row);
  for(let i=changes.length-1;i>=0;i--)if(changes[i].name==='Birimler'&&changes[i].obj.id===id)changes.splice(i,1);changes.push({name:'Birimler',obj:row});projectModel_(db);commit_(changes);return {id};
});}
function saveMaster(input,token) {
  return withSessionLock_(token,email=>{
    const name=masterTable_(input);
    const db=model_(),s=projectModel_(db),id=name==='Urunler'?productId_(input.id):id_(input.id),records=db[name],old=records.find(r=>r.id===id),changes=[];
    ensureDefaultUnits_(db,changes);
    const o={id:id,ad:text_(input.ad,120),arsivlendiMi:old?.arsivlendiMi===true,arsivlenmeZamani:old?.arsivlenmeZamani||'',arsivleyenId:old?.arsivleyenId||''};
    if(o.arsivlendiMi&&(input.acilis||input.acilislar?.length||input.baslangicStogu))throw new Error('Arşivlenen karta yeni hareket eklenemez. Önce kartı geri açın.');if (!o.ad) throw new Error('Ad zorunlu.');
    if (name==='Urunler') {
      if(input.yeni&&old)throw new Error('Ürün kodu başka bir kayıtta kullanılmış. Yeni ürün kodunu güncelleyip tekrar kaydedin.');
      if(input.yeni&&id!==nextProductCode_(db.Urunler))throw new Error('Ürün kodu sırası değişti. Yeni ürün kodunu güncelleyip tekrar kaydedin.');
      o.paraBirimi=currency_(input.paraBirimi);o.kod=input.yeni?id:text_(input.kod,40);
      if(old&&old.id===old.kod&&o.kod!==id)throw new Error('Ürün kodu ürün kimliğidir ve değiştirilemez.');o.satisFiyati=number_(input.satisFiyati,'Satış fiyatı');o.kritikStok=number_(input.kritikStok,'Kritik stok',false,3);
      if (!o.kod) throw new Error('Ürün kodu zorunlu.');
      if (records.some(r=>r.id!==id && String(r.kod).toLocaleLowerCase('tr')===o.kod.toLocaleLowerCase('tr'))) throw new Error('Bu ürün kodu zaten var.');
      const unitName=text_(input.birim,20)||'adet',unit=db.Birimler.find(row=>row.ad.toLocaleLowerCase('tr')===unitName.toLocaleLowerCase('tr'));
      const decimals=input.ondalikliMi??(unit?unitPolicy_(unit):unitFractionsDefault(unitName));
      if(typeof decimals!=='boolean')throw new Error('Birim ile ondalıklı miktar kuralı uyuşmuyor.');
      if(unit&&unitPolicy_(unit)!==decimals)throw new Error('Aynı birimin miktar kuralı değiştirilemez. Farklı birim adı kullanın.');
      if(input.yeni&&!unit)throw new Error('Önce tanımlı bir birim seçin veya yeni birim ekleyin.');
      if(unit)o.birimId=unit.id;
      else o.birimId=stageInsert_(db,changes,'Birimler',{id:Utilities.getUuid(),ad:unitName,ondalikliMi:decimals}).id;
      o.kritikStok=quantity_(input.kritikStok,'Kritik stok',{birim:unitName,ondalikliMi:decimals});
      if (old && old.birimId!==o.birimId && s.transactions.some(t=>t.items.some(line=>line.urunId===id))) throw new Error('Hareketi olan ürünün birimi değiştirilemez. Farklı birim için yeni ürün kartı açın.');
    } else {
      o.kisiAdi=text_(input.kisiAdi,120);o.telefon=text_(input.telefon,40);o.not=text_(input.not,500);o.adres=text_(input.adres,1000);o.eposta=text_(input.eposta,254);o.il=text_(input.il??old?.il,80);o.ilce=text_(input.ilce??old?.ilce,80);
      if(o.il&&!Object.hasOwn(partyLocations,o.il))throw new Error('Geçerli bir il seçin.');if(o.ilce&&(!o.il||!partyLocations[o.il]?.includes(o.ilce)))throw new Error('İlçeyi seçilen ile göre seçin.');
      if (o.eposta && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.eposta)) throw new Error('Geçerli bir e-posta adresi girin.');
      if (records.some(r=>r.id!==id && String(r.ad).toLocaleLowerCase('tr')===o.ad.toLocaleLowerCase('tr'))) throw new Error('Bu cari adı zaten var.');
    }
    changes.push({name:name,obj:o,row:old&&old._row});
    if(input.baslangicStogu){
      if(name!=='Urunler')throw new Error('Başlangıç stoğu yalnızca ürün kartında girilebilir.');
      const a=input.baslangicStogu,openingId=id_(a.id),amount=quantity_(a.miktar,'Başlangıç stoğu',{birim:ref_(index_(db.Birimler,'id','Birim'),o.birimId,'birim').ad,ondalikliMi:unitPolicy_(db.Birimler.find(u=>u.id===o.birimId))}),date=date_(a.tarih);
      if(amount<=0)throw new Error('Başlangıç stoğu sıfırdan büyük olmalı.');
      const existing=s.transactions.find(t=>t.id===openingId);
      if(existing){
        if(existing.tur!=='STOK_GIRIS'||existing.durum!=='AKTIF'||existing.tarih!==date||existing.items.length!==1||existing.items[0].urunId!==id||existing.items[0].adet!==amount)throw new Error('Başlangıç stok kaydı değişmiş. Stok hareketlerini kontrol edin.');
      }else{
        if(old)throw new Error('Başlangıç stoğu yalnızca yeni ürün eklerken girilebilir. Stok işlemini kullanın.');
        db.Urunler.push(o);
        const transaction={id:openingId,tarih:date,paraBirimi:o.paraBirimi,tur:'STOK_GIRIS',cariId:'',aciklama:'Başlangıç stoğu',...creationMetadata_(db,changes,email)};
        appendTransaction_(db,changes,transaction);
        stageInsert_(db,changes,'UrunHareketleri',{id:Utilities.getUuid(),islemId:openingId,sira:1,urunId:id,adet:amount,birimFiyat:''});
        const view=projectModel_(db);checkStock_(view.transactions,view.products);
      }
    }
    const openings=input.acilislar??(input.acilis?[input.acilis]:[]);
    if(!Array.isArray(openings)||openings.length>2||new Set(openings.map(a=>a.paraBirimi||'TRY')).size!==openings.length||new Set(openings.map(a=>a.id)).size!==openings.length)throw new Error('Açılışta her para birimi yalnız bir kez girilebilir.');
    for(const opening of openings){
      if(input.type!=='party')throw new Error('Açılış bakiyesi yalnızca cari kartında girilebilir.');
      const a=opening,openingId=id_(a.id),amount=number_(a.tutar,'Açılış bakiyesi',true),date=date_(a.tarih),currency=currency_(a.paraBirimi);
      if(!amount)throw new Error('Açılış bakiyesi sıfır olamaz.');
      const existing=s.transactions.find(t=>t.id===openingId);
      if(existing){
        if(existing.tur!=='CARI_DEVIR'||existing.cariId!==id||existing.tutar!==amount||existing.paraBirimi!==currency||existing.tarih!==date||existing.durum!=='AKTIF')throw new Error('Açılış kaydı değişmiş. Cari ekstresini kontrol edin.');
      }else{
        if(s.transactions.some(t=>t.tur==='CARI_DEVIR'&&t.cariId===id&&t.paraBirimi===currency&&t.durum==='AKTIF'))throw new Error('Bu cari için açılış bakiyesi zaten kayıtlı.');
        const transaction={id:openingId,tarih:date,paraBirimi:currency,tur:'CARI_DEVIR',cariId:id,aciklama:'',...creationMetadata_(db,changes,email)};
        appendTransaction_(db,changes,transaction);changes.push({name:'CariAcilislari',obj:{islemId:openingId,tutar:amount}});
      }
    }
    commit_(changes);return {id:id};
  });
}
function appendPayment_(db,changes,transaction,input,parentId,existing) {
  if(!PAYMENT_METHODS.includes(input.odemeYontemi))throw new Error('Ödeme yöntemi seçin.');
  const p={islemId:transaction.id,yontem:input.odemeYontemi,tutar:number_(input.tutar,'Tutar'),urunIslemId:parentId};
  if(p.tutar<=0)throw new Error('Ödeme tutarı sıfırdan büyük olmalı.');
  stageInsert_(db,changes,'Odemeler',p);
  if(['CEK','SENET'].includes(p.yontem)){
    const doc={islemId:transaction.id,belgeNo:text_(input.belgeNo,80),vade:date_(input.vade,true)};
    if(doc.vade<transaction.tarih)throw new Error('Vade, işlem tarihinden önce olamaz.');
    if(!doc.belgeNo)throw new Error('Çek/senet numarası zorunlu.');
    if(existing.some(t=>t.durum!=='IPTAL'&&t.tur===transaction.tur&&t.odemeYontemi===p.yontem&&t.cariId===transaction.cariId&&String(t.belgeNo).toLocaleLowerCase('tr')===doc.belgeNo.toLocaleLowerCase('tr')))throw new Error('Bu cari için aynı belge numarası zaten kayıtlı.');
    stageInsert_(db,changes,'OdemeBelgeleri',doc);
  }
}
function transactionNumber_(db,date){
  const prefix='ST-'+date.replace(/-/g,'')+'-';
  const next=db.Islemler.reduce((max,t)=>String(t.islemNo||'').startsWith(prefix)?Math.max(max,Number(String(t.islemNo).slice(prefix.length))||0):max,0)+1;
  return prefix+String(next).padStart(5,'0');
}
function appendTransaction_(db,changes,transaction){
  // Aynı girişin para birimi kayıtları tek kalıcı işlem numarasını paylaşır.
  const sibling=transaction.fisGrupId&&db.Islemler.find(t=>t.fisGrupId===transaction.fisGrupId);
  transaction.islemNo=transaction.islemNo||(sibling?sibling.islemNo:transactionNumber_(db,transaction.tarih));
  transaction._row=db.Islemler.reduce((n,t)=>Math.max(n,t._row||1),1)+1;
  stageInsert_(db,changes,'Islemler',transaction);
}
function postStockCount(input,token){
  return withSessionLock_(token,email=>{
    if(!input)throw new Error('Sayım bilgileri eksik.');
    const rows=Array.isArray(input.items)?input.items:[input];
    if(!rows.length||rows.length>100)throw new Error('1–100 ürün satırı girin.');
    if(new Set(rows.map(r=>r.urunId)).size!==rows.length)throw new Error('Sayımda her ürün yalnızca bir satırda olmalı.');
    if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('Sayım kayıt kimlikleri yinelenemez.');
    const db=model_(),s=projectModel_(db),changes=[],results=[];
    const reason=text_(input.neden,500);if(!reason)throw new Error('Sayım düzeltmesinin nedenini yazın.');
    const date=date_(input.tarih||Utilities.formatDate(new Date(),'Europe/Istanbul','yyyy-MM-dd'));
    const islemSaati=validateTransactionTime(date,input.islemSaati);
    const stocks=totals_(s).stock;
    for(const row of rows){
      const id=id_(row.id),existing=s.transactions.find(t=>t.id===id);
      if(existing){if(!existing.sayim)throw new Error('Kayıt kimliği başka bir işleme ait.');results.push({id,duplicate:true});continue;}
      const product=s.products.find(p=>p.id===row.urunId);if(!product)throw new Error('Ürün seçin.');if(product.arsivlendiMi)throw new Error('Arşivlenen ürüne yeni işlem yapılamaz. Önce kartı geri açın.');
      const expected=quantity_(row.beklenenMiktar,'Sistemdeki miktar',product),counted=quantity_(row.sayilanMiktar,'Sayılan miktar',product),current=stocks[product.id]||0;
      if(current!==expected)throw new Error('STOCK_CHANGED: Stok siz sayımı açtıktan sonra değişti. Stoku güncelleyip sayımı kontrol edin.');
      const difference=round_(counted-current,3);if(!difference){results.push({unchanged:true,stock:current});continue;}
      appendTransaction_(db,changes,{id,tarih:date,...(islemSaati?{islemSaati}:{}),paraBirimi:'TRY',tur:difference>0?'STOK_GIRIS':'STOK_CIKIS',cariId:'',aciklama:reason,...creationMetadata_(db,changes,email)});
      stageInsert_(db,changes,'UrunHareketleri',{id:Utilities.getUuid(),islemId:id,sira:1,urunId:product.id,adet:Math.abs(difference),birimFiyat:'',sayimOncekiMiktar:current,sayilanMiktar:counted});
      results.push({id,stock:counted});
    }
    checkStock_(projectModel_(db).transactions,s.products);commit_(changes);
    return Array.isArray(input.items)?{items:results,unchanged:results.every(r=>r.unchanged)}:results[0];
  });
}
function postTransaction(input,token) {
  return withSessionLock_(token,email=>{
    if (!input) throw new Error('İşlem boş.');
    const id=id_(input.id),db=model_(),s=projectModel_(db),rule=RULES[input.tur],changes=[];
    if (s.transactions.some(t=>t.id===id)) return {id:id,duplicate:true};
    if (!rule) throw new Error('İşlem türü geçersiz.');
    const o={id:id,tarih:date_(input.tarih),paraBirimi:currency_(input.paraBirimi),tur:input.tur,cariId:'',aciklama:text_(input.aciklama,500),...creationMetadata_(db,changes,email)};
    const islemSaati=validateTransactionTime(o.tarih,input.islemSaati);
    if(islemSaati)o.islemSaati=islemSaati;
    if(input.indirimDegeri||input.indirimTutari)throw new Error('İndirim kullanılmıyor.');
    o.fisGrupId=input.fisGrupId?id_(input.fisGrupId):'';
    if(o.fisGrupId&&!(rule.item&&rule.balance))throw new Error('Fiş grubu yalnız alış, satış ve iadelerde kullanılabilir.');
    if (rule.party) {if (!s.parties.some(p=>p.id===input.cariId&&!p.arsivlendiMi)) throw new Error('Cari seçin.');o.cariId=input.cariId;}
    if (rule.item) {
      const lines=input.kalemler===undefined?[input]:input.kalemler;
      if(!Array.isArray(lines)||!lines.length||lines.length>100)throw new Error('1 ile 100 arasında ürün satırı girin.');
      lines.forEach((line,i)=>{
        if(!line||!s.products.some(p=>p.id===line.urunId&&!p.arsivlendiMi))throw new Error((i+1)+'. satır: ürün seçin.');
        const item={id:Utilities.getUuid(),islemId:id,sira:i+1,urunId:line.urunId,adet:quantity_(line.adet,(i+1)+'. satır adet',s.products.find(p=>p.id===line.urunId)),birimFiyat:''};
        if(item.adet<=0)throw new Error((i+1)+'. satır: adet sıfırdan büyük olmalı.');
        if(rule.balance)item.birimFiyat=number_(line.birimFiyat,(i+1)+'. satır birim fiyat');
        stageInsert_(db,changes,'UrunHareketleri',item);
      });
    } else if(input.kalemler!==undefined&&(!Array.isArray(input.kalemler)||input.kalemler.length))throw new Error('Bu işlem türünde ürün satırı bulunamaz.');
    if (input.tur==='CARI_DEVIR') {const r={islemId:id,tutar:number_(input.tutar,'Tutar',true)};db.CariAcilislari.push(r);changes.push({name:'CariAcilislari',obj:r});}
    if (['TAHSILAT','ODEME'].includes(input.tur)) appendPayment_(db,changes,o,input,'',s.transactions);
    appendTransaction_(db,changes,o);
    if(input.odemeYapildi!==undefined&&typeof input.odemeYapildi!=='boolean')throw new Error('Ödeme seçimi geçersiz.');
    if(input.odemeYapildi){
      if(!['SATIS','ALIS'].includes(o.tur))throw new Error('Birlikte ödeme yalnızca satış veya alışta kullanılabilir.');
      const total=projectModel_(db).transactions.find(t=>t.id===id).tutar;
      const payment={id:Utilities.getUuid(),islemNo:o.islemNo,tarih:o.tarih,...(islemSaati?{islemSaati}:{}),paraBirimi:o.paraBirimi,tur:o.tur==='SATIS'?'TAHSILAT':'ODEME',cariId:o.cariId,aciklama:'',olusturanId:o.olusturanId,olusturmaZamani:o.olusturmaZamani,_row:o._row+1};
      if(total<=0)throw new Error('Net tutarı sıfır olan işlemle birlikte ödeme kaydedilemez.');
      appendPayment_(db,changes,payment,Object.assign({},input,{tutar:total}),id,s.transactions);
      appendTransaction_(db,changes,payment);
      // Persist the linked payment immediately before the trade, in the same atomic batch.
      payment._row=o._row;o._row++;
      const paymentChange=changes.findIndex(c=>c.name==='Islemler'&&c.obj.id===payment.id);
      const staged=changes.splice(paymentChange,1)[0];
      changes.splice(changes.findIndex(c=>c.name==='Islemler'&&c.obj.id===o.id),0,staged);
    }
    checkStock_(projectModel_(db).transactions,s.products);commit_(changes);return {id:id};
  });
}
function voidTransaction(input,token) {
  return withSessionLock_(token,email=>{
    const id=id_(input&&input.id),reason=text_(input&&input.reason,300);if (!reason) throw new Error('İptal nedeni zorunlu.');
    const db=model_(),s=projectModel_(db),t=s.transactions.find(t=>t.id===id),changes=[];
    if (!t) throw new Error('Kayıt bulunamadı.');if (t.durum==='IPTAL') return {id:id};
    const roots=input.fisGrubu&&t.fisGrupId?s.transactions.filter(r=>r.fisGrupId===t.fisGrupId&&r.durum==='AKTIF').map(r=>r.id):[id];
    const ids=new Set([...roots,...s.transactions.filter(r=>roots.includes(r.urunIslemId)&&r.durum==='AKTIF').map(r=>r.id)]);
    checkStock_(s.transactions.map(r=>ids.has(r.id)?Object.assign({},r,{durum:'IPTAL'}):r),s.products);
    const userId=ensureReference_(db,'Kullanicilar','eposta',email,changes),time=new Date().toISOString();
    ids.forEach(cancelId=>changes.push({name:'IslemIptalleri',obj:{islemId:cancelId,neden:reason,kullaniciId:userId,zaman:time}}));
    commit_(changes);return {id:id};
  });
}
function saveNote(input,token){
  return withSessionLock_(token,email=>{
    if(!input)throw new Error('Not bilgileri eksik.');
    const id=id_(input.id),requestId=id_(input.istekId),title=text_(input.baslik,120),content=text_(input.icerik,10000);
    if(!title||!content)throw new Error('Not başlığı ve içeriği zorunlu.');
    const db=model_(),old=db.Notlar.find(n=>n.id===id),changes=[];
    if(old&&old.surum===requestId){if(old.baslik!==title||old.icerik!==content)throw new Error('İstek kimliği başka bir not değişikliğinde kullanıldı.');return {id:id,duplicate:true};}
    if((old&&old.surum!==input.beklenenSurum)||(!old&&input.beklenenSurum))throw new Error('NOTE_CHANGED: Not başka bir kullanıcı tarafından değiştirildi. Güncel notu açıp tekrar kontrol edin.');
    const userId=ensureReference_(db,'Kullanicilar','eposta',email,changes),now=new Date().toISOString();
    const note={id:id,baslik:title,icerik:content,olusturanId:old?old.olusturanId:userId,olusturmaZamani:old?old.olusturmaZamani:now,guncelleyenId:userId,guncellemeZamani:now,surum:requestId};
    changes.push({name:'Notlar',obj:note,row:old&&old._row});commit_(changes);return {id:id};
  });
}

function appState_(email){return {schemaVersion:9,email:email,rules:RULES,units:[],products:[],parties:[],transactions:[],notes:[],updatedAt:''};}

function moduleStateFromModel_(model,scope){
  const result={updatedAt:new Date().toISOString()};
  if(scope==='notes'){result.notes=model.notes;return result;}
  const sums=totals_(model);
  if(scope==='products'||scope==='ledger')result.units=model.units;
  if(scope==='products'||scope==='ledger')result.products=model.products.map(p=>Object.assign({},p,{stock:sums.stock[p.id]||0}));
  if(scope==='parties'||scope==='ledger')result.parties=model.parties.map(p=>Object.assign({},p,{balances:sums.balances[p.id],balance:sums.balances[p.id].TRY}));
  if(scope==='ledger')result.transactions=model.transactions;
  return result;
}

function blankModel_(){return Object.fromEntries(Object.keys(HEADERS).map(name=>[name,[]]));}
function withSessionLock_(token,action){return action(actorEmail());}
function model_(){return copy(database);}
function commit_(changes){
 for(const c of changes){
  const rows=database[c.name],key=primaryKey_(c.name);
  if(c.deleteRow){database[c.name]=rows.filter(r=>r._row!==c.deleteRow);continue;}
  const old=rows.find(r=>r[key]===c.obj[key]);
  const row=Object.assign({},c.obj,{_row:old?._row||Math.max(1,...rows.map(r=>r._row||1))+1});
  if(old)rows[rows.indexOf(old)]=row;else rows.push(row);
 }
}
const actions={saveUnit,saveMaster,deleteMaster,setMasterArchived,postTransaction,postStockCount,voidTransaction,saveNote};
return {unitFractionsDefault,headers:HEADERS,blank:blankModel_,bootstrap:()=>appState_(actorEmail()),
 validate(raw){const view=projectModel_(raw);checkStock_(view.transactions,view.products);return view;},
 views(raw){const view=this.validate(raw);return Object.assign({companyVersions:companyVersions(raw.FirmaSurumleri||[])},moduleStateFromModel_(view,'ledger'),moduleStateFromModel_(view,'notes'));},
 execute(action,input,raw){
   database=copy({...raw,FirmaSurumleri:raw.FirmaSurumleri||[]});
   const before=new Set(database.Islemler.map(row=>row.id));let result;
   if(action==='saveCompanyVersion'){
     database.FirmaSurumleri=appendCompanyVersion(database.FirmaSurumleri,input,actorEmail());
     result={firmaSurumu:currentCompany(database.FirmaSurumleri).surum};
   }else if(action==='regenerateCompanyDocument'){
     if(input.confirmed!==true)throw new Error('Belgeyi yeniden oluşturmak için onay gerekli.');
     const views=this.views(database),updates=copy(views.transactions);
     result=regenerateCompany(updates,input.id,currentCompany(database.FirmaSurumleri).surum,actorEmail());
     for(const row of database.Islemler){const updated=updates.find(t=>t.id===row.id);if(updated?.firmaSurumu){row.firmaSurumu=updated.firmaSurumu;row.firmaGecmisi=updated.firmaGecmisi||[];}}
   }else{
     if(!Object.hasOwn(actions,action))throw new Error('İşlem geçersiz.');
     result=actions[action](copy(input),'firebase');
     const version=currentCompany(database.FirmaSurumleri).surum;
     for(const row of database.Islemler){
       if(!before.has(row.id)){row.firmaSurumu=version;continue;}
       const previous=raw.Islemler.find(item=>item.id===row.id);
       if(previous.firmaSurumu&&!row.firmaSurumu)row.firmaSurumu=previous.firmaSurumu;
       if(previous.firmaGecmisi?.length&&!row.firmaGecmisi?.length)row.firmaGecmisi=copy(previous.firmaGecmisi);
     }
   }
   return {raw:copy(database),result,view:this.views(database)};
 }
};
}
