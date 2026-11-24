import locations from './locations.mjs?v=app-20261119-1';
import {companyFields,currentCompany,initialCompany,normalizeCompany,sameCompany} from './company.mjs?v=app-20261119-1';
export function installSettingsUI({openSecurity,prepareSecurity,company,notice=()=>{}}){
  function make(id,title,body){
    const dialog=document.createElement('dialog');dialog.id=id;dialog.className='record-dialog compact-dialog settings-menu-dialog'+(id==='companyRegenerateDialog'?' dialog-compact':'');dialog.setAttribute('aria-labelledby',id+'Title');
    dialog.dataset.customBackdrop='';
    dialog.innerHTML='<div class="detail-header"><div><button type="button" class="detail-back" data-back>← Geri</button><div class="eyebrow">Ayarlar</div><h2 id="'+id+'Title">'+title+'</h2></div><button type="button" class="detail-close" aria-label="Kapat">×</button></div><div class="detail-body">'+body+'</div>';
    dialog.querySelector('.detail-close').onclick=()=>dialog.close();
    let outsideStart=false;
    const outside=event=>{const rect=dialog.getBoundingClientRect();return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;};
    dialog.addEventListener('pointerdown',event=>{outsideStart=event.target===dialog&&outside(event);});
    dialog.addEventListener('pointercancel',()=>{outsideStart=false;});
    dialog.addEventListener('click',event=>{const dismiss=outsideStart&&event.target===dialog&&outside(event);outsideStart=false;if(dismiss&&dialog.dispatchEvent(new Event('cancel',{cancelable:true})))dialog.close();});
    document.body.append(dialog);return dialog;
  }
  const menu=make('settingsDialog','Ayarlar','<div class="actions" style="display:grid;gap:12px"><button type="button" data-company>Firma bilgileri</button><button type="button" data-security>PIN ve işlem güvenliği</button></div>');
  const style=document.createElement('style');
  style.textContent='dialog.settings-menu-dialog{height:min(620px,calc(100dvh - 32px));max-height:calc(100dvh - 32px);overflow:hidden}dialog.settings-menu-dialog[open]{display:flex;flex-direction:column}.settings-menu-dialog>.detail-header{flex:none}.settings-menu-dialog>.detail-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}#companyDialog .modal-actions .modal-main-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;gap:10px;margin-left:0}#companyDialog .modal-actions .modal-main-actions>button{width:100%;min-width:0;margin:0}';document.head.append(style);
  const input=(name,label,type='text',autocomplete='')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" maxlength="200"'+(name==='firmaAdi'?' required':'')+(autocomplete?' autocomplete="'+autocomplete+'"':'')+'></label>';
  const fields='<div class="fields party-identity-fields">'+input('firmaAdi','Firma adı','text','organization')+input('yetkiliAdi','Yetkili adı','text','name')+input('telefon','Telefon','tel')+input('eposta','E-posta adresi','email','email')+'<label>İl<select name="il" autocomplete="address-level1"><option value="">İl seçin</option></select></label><label>İlçe<select name="ilce" autocomplete="address-level2" disabled><option value="">İlçe seçin</option></select></label></div><label>Adres<textarea rows="3" maxlength="1000" name="adres" autocomplete="street-address"></textarea></label>';
  const formDialog=make('companyDialog','Firma bilgileri','<form>'+fields+'<p class="hint">Bu değişiklik yalnızca bundan sonra oluşturulacak belgelere uygulanır.</p><p data-error class="hint error" role="status" hidden></p><div class="actions modal-actions"><div class="modal-main-actions"><button type="button" data-cancel>Vazgeç</button><button type="submit" class="primary" disabled>Kaydet</button></div></div></form>');
  const form=formDialog.querySelector('form'),save=form.querySelector('[type=submit]'),error=form.querySelector('[data-error]');
  const confirmation=make('companyRegenerateDialog','Belgeyi yeniden oluştur','<p>Bu belgenin kayıtlı firma sürümü güncel firma sürümüyle değiştirilecek. Sonraki yazdırma ve PDF işlemleri yeni sürümü kullanacak. Devam edilsin mi?</p><p data-error class="hint error" role="status" hidden></p><div class="actions modal-actions"><div class="modal-main-actions"><button type="button" data-cancel>Vazgeç</button><button type="button" class="primary" data-confirm>Onayla ve yeniden oluştur</button></div></div>');
  confirmation.querySelector('[data-back]').hidden=true;confirmation.querySelector('[data-cancel]').onclick=()=>confirmation.close();
  let baseline=null,revision=null,saving=false,loading=false,loadTicket=0;
  const province=form.elements.namedItem('il'),district=form.elements.namedItem('ilce');
  for(const name of Object.keys(locations).sort((a,b)=>a.localeCompare(b,'tr')))province.add(new Option(name,name));
  function districts(selected=''){district.replaceChildren(new Option('İlçe seçin',''));for(const name of (locations[province.value]||[]).slice().sort((a,b)=>a.localeCompare(b,'tr')))district.add(new Option(name,name));district.disabled=!province.value;district.value=selected;}
  province.addEventListener('change',()=>{districts();dirty();});district.addEventListener('change',dirty);
  const values=()=>Object.fromEntries(companyFields.map(key=>[key,form.elements.namedItem(key).value]));
  function dirty(){try{save.disabled=saving||!baseline||sameCompany(normalizeCompany(values()),baseline);}catch{save.disabled=true;}}
  let menuGeneration=0;
  function showMenu(){
    if(menu.open)return;
    menu.showModal();menuGeneration++;
    prepareSecurity();
  }
  function back(){if(saving)return;formDialog.close();showMenu();}
  menu.querySelector('[data-back]').onclick=()=>{menu.close();document.querySelector('#profileDialog').showModal();};
  const securityButton=menu.querySelector('[data-security]');
  securityButton.onclick=async()=>{
    if(loading||securityButton.disabled||!menu.open)return;
    const generation=menuGeneration;
    securityButton.disabled=true;
    try{
      await openSecurity(()=>{
        if(!menu.open||generation!==menuGeneration)return false;
        menu.close();
        return true;
      });
    }finally{securityButton.disabled=false;}
  };
  formDialog.querySelector('[data-back]').onclick=back;form.querySelector('[data-cancel]').onclick=back;
  form.addEventListener('input',dirty);
  menu.querySelector('[data-company]').onclick=async()=>{
    if(loading||securityButton.disabled)return;loading=true;const ticket=++loadTicket,button=menu.querySelector('[data-company]');button.disabled=true;
    try{
      const result=await company.read();if(ticket!==loadTicket||!menu.open)return;
      const current=currentCompany(result.companyVersions);baseline={...current,...normalizeCompany(current)};revision=result.dataRevision;
      if(!baseline.il&&!baseline.ilce&&baseline.adres===initialCompany.adres){baseline.il='Ankara';baseline.ilce='Çankaya';}
      province.value=baseline.il;districts(baseline.ilce);
      for(const key of companyFields)form.elements.namedItem(key).value=baseline[key];
      error.hidden=true;dirty();menu.close();formDialog.showModal();
    }catch(e){notice(String(e.message||e));}finally{loading=false;button.disabled=false;}
  };
  menu.addEventListener('close',()=>{loadTicket++;});
  form.onsubmit=async event=>{
    event.preventDefault();if(saving||save.disabled)return;saving=true;save.disabled=true;error.hidden=true;
    for(const button of formDialog.querySelectorAll('button:not([type=submit])'))button.disabled=true;
    try{await company.save({...normalizeCompany(values()),baseVersion:baseline.surum},revision);formDialog.close();showMenu();notice('Firma bilgileri yeni sürüm olarak kaydedildi.');}
    catch(e){error.textContent=String(e.message||e);error.hidden=false;}
    finally{saving=false;for(const button of formDialog.querySelectorAll('button'))button.disabled=false;dirty();}
  };
  formDialog.addEventListener('cancel',event=>{event.preventDefault();back();});
  document.addEventListener('click',async event=>{
    const trigger=event.target.closest('[data-regenerate-company]');if(!trigger||trigger.disabled)return;
    const id=trigger.dataset.regenerateCompany;trigger.disabled=true;
    try{
      const snapshot=await company.read();const button=confirmation.querySelector('[data-confirm]'),message=confirmation.querySelector('[data-error]');message.hidden=true;button.disabled=false;
      button.onclick=async()=>{
        if(button.disabled)return;button.disabled=true;message.hidden=true;
        try{await company.regenerate({id,confirmed:true},snapshot.dataRevision);confirmation.close();notice('Belge güncel firma bilgileriyle yeniden oluşturuldu.');}
        catch(e){message.textContent=String(e.message||e);message.hidden=false;button.disabled=false;}
      };
      confirmation.showModal();
    }catch(e){notice(String(e.message||e));}finally{if(trigger.isConnected)trigger.disabled=false;}
  });
  return {open:()=>{document.querySelector('#profileDialog').close();showMenu();},show:showMenu};
}
