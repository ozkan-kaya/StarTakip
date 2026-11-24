import {installSettingsUI} from './settings-ui.mjs?v=app-20261124-3';
export function installPinUI(security,{demo=false,clearLoading=()=>{},notice=()=>{},company}={}){
  const make=(id,title,body)=>{
    const d=document.createElement('dialog');d.id=id;d.className='record-dialog compact-dialog pin-dialog'+(id==='pinRemoveDialog'?' dialog-compact':'');
    d.dataset.customBackdrop='';
    d.innerHTML='<div class="detail-header"><div><button type="button" class="detail-back" data-back>← Geri</button><div class="eyebrow">Güvenlik</div><h2>'+title+'</h2></div><button type="button" class="detail-close" aria-label="Kapat">×</button></div><div class="detail-body">'+body+'</div>';
    document.body.append(d);d.querySelector('.detail-close').onclick=()=>d.close();return d;
  };
  // Settings, PIN editing and its confirmation share one native dialog.
  const securityDialog=document.createElement('dialog');securityDialog.id='pinSecurityDialog';securityDialog.className='record-dialog compact-dialog pin-dialog';securityDialog.dataset.customBackdrop='';document.body.append(securityDialog);
  const securityScreens=[];let activeSecurityScreen=null;
  function activateSecurityScreen(screen){
    for(const other of securityScreens){other.hidden=other!==screen;other.toggleAttribute('open',other===screen);}
    activeSecurityScreen=screen;securityDialog.classList.toggle('dialog-compact',screen.id==='pinChangeConfirmDialog');securityDialog.setAttribute('aria-labelledby',screen.id+'Title');
    if(!securityDialog.open)securityDialog.showModal();
    screen.querySelector('.detail-body').scrollTop=0;
  }
  function makeSecurityScreen(id,title,body){
    const template=make(id,title,body),screen=document.createElement('section');screen.id=id;screen.className='pin-dialog pin-screen';screen.hidden=true;
    screen.append(...template.childNodes);template.remove();screen.querySelector('h2').id=id+'Title';
    Object.defineProperty(screen,'open',{get:()=>securityDialog.open&&activeSecurityScreen===screen});
    screen.showModal=()=>activateSecurityScreen(screen);
    screen.close=()=>{
      if(!screen.open)return;
      const parent=screen.id==='pinChangeConfirmDialog'?securityScreens.find(s=>s.id==='pinChangeDialog'):screen.id==='pinChangeDialog'?securityScreens[0]:null;
      if(parent){activateSecurityScreen(parent);screen.dispatchEvent(new Event('close'));parent.querySelector('.pin-dot-entry input:not([disabled]),button.primary:not([disabled])')?.focus({preventScroll:true});}
      else securityDialog.close();
    };
    screen.querySelector('.detail-close').onclick=()=>screen.close();securityScreens.push(screen);securityDialog.append(screen);return screen;
  }
  securityDialog.addEventListener('close',()=>{activeSecurityScreen=null;for(const screen of securityScreens){screen.hidden=true;screen.removeAttribute('open');screen.dispatchEvent(new Event('close'));}});
  securityDialog.addEventListener('cancel',event=>{if(activeSecurityScreen!==securityScreens[0]){event.preventDefault();activeSecurityScreen?.close();}});
  let securityOutsideStart=false;
  const outsideSecurity=event=>{const r=securityDialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
  securityDialog.addEventListener('pointerdown',event=>{securityOutsideStart=event.target===securityDialog&&outsideSecurity(event);});
  securityDialog.addEventListener('click',event=>{if(securityOutsideStart&&event.target===securityDialog&&outsideSecurity(event))activeSecurityScreen?.close();securityOutsideStart=false;});
  const qs=(d,selector)=>d.querySelector(selector);
  const errorBox='<p class="hint error" data-error hidden role="alert"></p>';
  const input=(name,label,hideLabel=false)=>'<label class="pin-field"><span class="pin-field-label"'+(hideLabel?' hidden':'')+'>'+label+'</span><span class="pin-dot-entry"><input name="'+name+'" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="'+label+'" maxlength="6" required><span class="pin-dots" aria-hidden="true"></span></span></label>';
  const fields='<label class="pin-length">PIN uzunluğu<select name="length"><option value="4" selected>4 hane</option><option value="6">6 hane</option></select></label><div class="pin-new-pair">'+input('pin','Yeni PIN')+input('confirm','Yeni PIN tekrar')+'</div><p class="hint error" data-match hidden role="status"></p>';
  const actions=text=>'<div class="actions modal-actions"><div class="modal-main-actions"><button type="button" data-cancel>Vazgeç</button><button class="primary" type="submit">'+text+'</button></div></div>';
  const settings=makeSecurityScreen('pinSettingsDialog','PIN ve işlem güvenliği','<p data-status></p><form><label>Yeni kayıt ve düzenlemeler için PIN sıklığı<select name="interval"><option value="0">Her işlemde</option><option value="300">5 dakika</option><option value="600">10 dakika</option><option value="900">15 dakika</option><option value="3600">1 saat</option><option value="10800">3 saat</option></select></label><label class="checkrow"><input type="checkbox" role="switch" class="entry-switch" name="create"><span>Yeni kayıtlarda PIN iste</span></label><label class="checkrow"><input type="checkbox" role="switch" class="entry-switch" name="edit"><span>Düzenlemelerde PIN iste</span></label><label class="checkrow"><input type="checkbox" role="switch" class="entry-switch" name="remove"><span>İptal, silme, arşivleme ve geri açmada her işlemde PIN iste</span></label><label class="checkrow"><input type="checkbox" role="switch" class="entry-switch" name="daily"><span>Her gün ilk girişte PIN iste</span></label>'+errorBox+'</form><div class="actions" data-pin-actions><button type="button" class="primary" data-change>PIN oluştur</button><button type="button" class="danger" data-remove>PIN’i kaldır</button></div>');
  const frequencyField=qs(settings,'[name=interval]').closest('label');
  frequencyField.before(qs(settings,'[name=daily]').closest('label'),qs(settings,'[name=remove]').closest('label'));
  const challenge=make('pinChallengeDialog','PIN gerekli','<p>Devam etmek için mevcut PIN’inizi girin.</p><form>'+input('pin','PIN',true)+errorBox+'</form><button type="button" data-forgot>PIN’i unuttum</button>');
  qs(challenge,'[data-back]').remove();
  qs(challenge,'.detail-header>div').append(qs(challenge,'.detail-body>p'));
  const change=makeSecurityScreen('pinChangeDialog','PIN’i değiştir','<form><div data-old>'+input('oldPin','Mevcut PIN')+'</div>'+fields+errorBox+actions('Yeni PIN’i kaydet')+'</form>');
  const changeConfirm=makeSecurityScreen('pinChangeConfirmDialog','Yeni PIN kaydedilsin mi?','<p data-description></p><form>'+errorBox+actions('Onayla ve kaydet')+'</form>');
  qs(changeConfirm,'[data-back]').remove();
  const reset=make('pinResetDialog','PIN’i unuttum','<p>Yetkili Google hesabınızla yeniden doğrulayın. Ardından yeni PIN belirleyebilirsiniz. Kayıtlarınız ve işlem koruma ayarlarınız korunur.</p><button type="button" class="primary" data-google>Google ile doğrula</button><p data-verified hidden role="status">Google hesabı doğrulandı.</p><form hidden>'+fields+errorBox+actions('Yeni PIN’i kaydet')+'</form><p class="hint error" data-google-error hidden role="alert"></p>');
  const removal=make('pinRemoveDialog','PIN kaldırılsın mı?','<p class="hint">PIN kaldırılınca yeni kayıt, düzenleme, iptal/silme/arşivleme ve günlük giriş korumaları kapanır. Daha sonra yeniden PIN oluşturabilirsiniz.</p><form>'+input('oldPin','Mevcut PIN')+errorBox+actions('Onayla ve PIN’i kaldır')+'</form>');
  qs(removal,'[data-back]').remove();
  removal.querySelector('button[type=submit]').classList.add('danger');
  const changeForm=qs(change,'form'),prerequisites=document.createElement('div'),feedback=document.createElement('div');
  prerequisites.className='pin-prerequisites';prerequisites.append(qs(change,'[data-old]'),qs(change,'.pin-length'));
  feedback.className='pin-feedback';feedback.append(qs(change,'[data-match]'),qs(change,'[data-error]'));
  changeForm.prepend(prerequisites);changeForm.append(feedback);
  const dialogs=[settings,challenge,change,changeConfirm,reset,removal];
  for(const d of dialogs){const body=qs(d,'.detail-body'),content=document.createElement('div');content.className='pin-content';content.append(...body.children);body.append(content);
    const form=qs(d,'form');form.id=d.id+'Form';
    for(const footer of d.querySelectorAll('.modal-actions')){
      footer.classList.add('pin-action-footer');
      for(const button of footer.querySelectorAll('button[type=submit]'))button.setAttribute('form',form.id);
      d.append(footer);
    }
  }
  const style=document.createElement('style');style.textContent=`
#pinSecurityDialog { height: min(620px, calc(100dvh - 32px)); }
#pinSecurityDialog:has(> #pinChangeConfirmDialog[open]) { height: auto; }
#pinSecurityDialog > .pin-screen[open] { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
#pinSecurityDialog > .pin-screen > .detail-body { flex: 1; min-height: 0; }
/* Preserve the existing profile layout; PIN rules below are scoped separately. */
.record-dialog.profile-dialog { height: min(620px, calc(100dvh - 32px)); max-height: calc(100dvh - 32px); overflow: hidden; }
.profile-dialog[open] { display: flex; flex-direction: column; }
.profile-dialog .detail-header { flex: none; }
.profile-dialog .detail-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
#profileDialog:has(> .profile-action-footer) .detail-body { padding-bottom: 0; }
#profileDialog > .profile-action-footer { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); flex: none; margin: 24px 0 0; padding: 20px var(--modal-space) var(--modal-space); border-top: 1px solid var(--line); gap: 10px; }
#profileDialog > .profile-action-footer > button { width: 100%; min-width: 0; min-height: 46px; margin: 0; border-radius: var(--radius-control); display: flex; align-items: center; justify-content: center; gap: 8px; }
#profileDialog > .profile-action-footer svg { width: 18px; height: 18px; flex: none; }

/* PIN modals use the existing compact modal, field and footer design. */
dialog.record-dialog.pin-dialog {
  width: min(var(--modal-width-compact), calc(100% - 24px));
  height: auto;
  align-self: center;
  justify-self: center;
  max-height: calc(100dvh - 32px);
  overflow: hidden;
}
.pin-dialog[open] { display: flex; flex-direction: column; }
.pin-dialog .detail-header { flex: none; }
.pin-dialog .detail-back { margin-bottom: 8px; }
.pin-dialog .detail-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.pin-dialog .pin-content { width: 100%; margin: 0; }
.pin-dialog .pin-content > p:not(.hint),
.pin-dialog form > p:not(.hint) {
  color: var(--text);
  font-size: 13px;
  line-height: 1.6;
  margin: 0 0 16px;
}
.pin-dialog form,
.pin-dialog .pin-new-pair,
.pin-dialog .pin-prerequisites,
.pin-dialog .pin-feedback { display: grid; gap: var(--space-field); margin: 0; }
.pin-dialog label { min-width: 0; margin: 0; }
.pin-dialog .pin-field-label { display: block; text-align: left; }
.pin-dialog .pin-dot-entry {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 52px;
  margin-top: 6px;
  border: 1px solid #d7e1d4;
  border-radius: var(--radius-control);
  background: #fcfdfb;
  cursor: text;
  transition: border-color .15s, box-shadow .15s;
}
.pin-dialog .pin-dot-entry:hover { border-color: var(--border-hover); }
.pin-dialog .pin-dot-entry:focus-within {
  border-color: #7d9e6d;
  box-shadow: 0 0 0 3px #a9c38b20;
}
.pin-dialog .pin-dot-entry input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  opacity: 0;
  cursor: text;
}
.pin-dialog .pin-dots { display: flex; justify-content: center; gap: 18px; pointer-events: none; }
.pin-dialog .pin-dots span {
  display: block;
  width: 17px;
  height: 17px;
  border: 2px solid var(--ink);
  border-radius: 50%;
  background: transparent;
  transition: background-color .12s;
}
.pin-dialog .pin-dots span.filled { background: var(--ink); }
.pin-dialog .hint { margin: 0; }
.pin-dialog [data-error]:empty,
.pin-dialog [data-match]:empty,
.pin-dialog [data-google-error]:empty,
.pin-dialog .pin-feedback:not(:has(> :not([hidden]):not(:empty))) { display: none; }
.pin-dialog .pin-content > .hint { margin-bottom: 16px; }
.pin-dialog button[data-forgot] {
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
  font-weight: 550;
  min-height: 32px;
  margin-top: 12px;
  padding: 4px 0;
  justify-content: flex-start;
  box-shadow: none;
}
.pin-dialog button[data-forgot]:hover { background: transparent; text-decoration: underline; }
.pin-dialog:has(> .pin-action-footer) .detail-body,
#pinSettingsDialog:has(> .pin-settings-footer) .detail-body { padding-bottom: 0; }
.pin-dialog > .pin-action-footer,
#pinSettingsDialog > .pin-settings-footer {
  flex: none;
  margin: 24px 0 0;
  padding: 20px var(--modal-space) var(--modal-space);
  border-top: 1px solid var(--line);
  gap: 10px;
}
.pin-dialog .pin-action-footer .modal-main-actions { margin-left: auto; gap: 10px; }
.pin-dialog .pin-action-footer button,
#pinSettingsDialog [data-pin-actions] button { min-height: 46px; border-radius: var(--radius-control); }
.pin-dialog:has(form[hidden]) > .pin-action-footer { display: none; }
.pin-dialog:has(form[hidden]) .detail-body { padding-bottom: var(--modal-space); }
#pinSettingsDialog .pin-content { display: grid; gap: 16px; }
#pinSettingsDialog [data-status] { margin: 0; }
#pinSettingsDialog form { gap: 12px; }
#pinSettingsDialog .checkrow { min-height: 32px; gap: 12px; }
#pinSettingsDialog .checkrow span { min-width: 0; }
#pinSettingsDialog [data-pin-actions] { gap: 10px; margin: 0; }
#pinSettingsDialog [data-pin-actions] button { margin: 0; min-width: 0; white-space: normal; }
#pinSettingsDialog > [data-pin-actions].pin-settings-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 24px;
}
.pin-dialog [hidden] { display: none !important; }
@media (max-width: 600px) {
  dialog.record-dialog.pin-dialog { width: calc(100% - 24px); }
  .pin-dialog > .pin-action-footer,
  #pinSettingsDialog > .pin-settings-footer { gap: 8px; }
  .pin-dialog .pin-action-footer .modal-main-actions { flex-wrap: wrap-reverse; gap: 8px; }
  .pin-dialog .pin-action-footer button { padding: 10px 12px; }
}
/* The change/create form has explicit save controls and compact fields. */
#pinChangeDialog .detail-body {
  position: relative;
  padding-top: var(--modal-gap);
  padding-bottom: var(--modal-space);
}
#pinChangeDialog form,
#pinChangeDialog .pin-prerequisites,
#pinChangeDialog .pin-new-pair,
#pinChangeDialog .pin-feedback { gap: var(--space-field); }
#pinChangeDialog .pin-dot-entry,
#pinChangeDialog .pin-length select {
  height: 44px;
  min-height: 44px;
  border-radius: var(--radius-control);
}
#pinChangeDialog > .pin-action-footer { margin-top: 0; }
#pinChangeDialog .pin-action-footer .modal-main-actions { gap: 10px; }
#pinChangeDialog .pin-action-footer button { min-height: 46px; }
@media (max-width: 600px) {
  #pinChangeDialog form,
  #pinChangeDialog .pin-prerequisites,
  #pinChangeDialog .pin-new-pair,
  #pinChangeDialog .pin-feedback { gap: 16px; }
  #pinChangeDialog .pin-action-footer .modal-main-actions { flex: 1; flex-wrap: nowrap; }
  #pinChangeDialog .pin-action-footer button { flex: 1; }
  #pinChangeDialog .detail-body::after {
    content: '';
    display: block;
    position: sticky;
    bottom: calc(-1 * var(--modal-space));
    height: 12px;
    margin-top: -12px;
    background: linear-gradient(transparent, var(--paper));
    pointer-events: none;
    opacity: 0;
  }
  #pinChangeDialog .detail-body[data-scroll-more=true]::after { opacity: 1; }
}
/* Keep all PIN fields stacked and fit them inside the shared modal height. */
#pinChangeDialog form,
#pinChangeDialog .pin-prerequisites,
#pinChangeDialog .pin-new-pair,
#pinChangeDialog .pin-feedback { gap: var(--s-4); }
#pinChangeDialog .pin-field-label,
#pinChangeDialog .pin-length { line-height: var(--space-field); }
@media (max-height: 650px) {
  #pinChangeDialog form,
  #pinChangeDialog .pin-prerequisites,
  #pinChangeDialog .pin-new-pair,
  #pinChangeDialog .pin-feedback { gap: var(--s-2); }
  #pinChangeDialog .pin-field-label,
  #pinChangeDialog .pin-length { line-height: var(--s-4); }
  #pinChangeDialog > .pin-action-footer { padding-top: var(--s-4); }
}
#pinRemoveDialog .pin-action-footer .modal-main-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  margin-left: 0;
  gap: 10px;
}
#pinRemoveDialog .pin-action-footer button {
  width: 100%;
  min-width: 0;
  white-space: normal;
  text-align: center;
}
`;document.head.append(style);
  let config=null,pending=null,settingsKey=null,pendingChange=null;
  const q=(d,s)=>d.querySelector(s);
  function values(d){return Object.fromEntries(new FormData(q(d,'form')));}
  function validPin(value,length){return new RegExp('^\\d{'+length+'}$').test(value||'');}
  function setPinLength(i,length){i.minLength=0;i.maxLength=Number(length);i.minLength=Number(length);i.pattern='[0-9]{'+length+'}';}
  function syncDots(d){
    for(const i of d.querySelectorAll('input[type=password]')){
      const dots=i.closest('.pin-dot-entry').querySelector('.pin-dots');
      if(dots.children.length!==i.maxLength)dots.replaceChildren(...Array.from({length:i.maxLength},()=>document.createElement('span')));
      [...dots.children].forEach((dot,index)=>dot.classList.toggle('filled',index<i.value.length));
    }
  }
  function validation(d){
    const button=q(d,'button[type=submit]'),length=q(d,'[name=length]');let valid=false;
    if(length){
      const pin=q(d,'[name=pin]'),confirm=q(d,'[name=confirm]'),old=q(d,'[name=oldPin]');
      for(const i of [pin,confirm])setPinLength(i,length.value);
      const mismatch=validPin(pin.value,length.value)&&validPin(confirm.value,length.value)&&pin.value!==confirm.value,match=q(d,'[data-match]');
      match.hidden=!mismatch;match.textContent=mismatch?'Yeni PIN girişleri eşleşmiyor.':'';
      valid=validPin(pin.value,length.value)&&pin.value===confirm.value&&(!old||old.disabled||validPin(old.value,config?.length));
    }else if(d===challenge||d===removal)valid=validPin(q(d,'input').value,q(d,'input').maxLength);
    syncDots(d);if(button&&(length||d===removal))button.disabled=!valid;return valid;
  }
  function show(d){
    clearLoading();for(const el of d.querySelectorAll('button,input,select'))el.disabled=false;
    if(d===change){const old=q(change,'[name=oldPin]');old.disabled=!config.enabled;old.required=config.enabled;}
    d.querySelectorAll('[data-error],[data-google-error]').forEach(e=>{e.hidden=true;e.textContent='';});validation(d);
    if(!d.open)d.showModal();d.scrollTop=0;
    const focus=[...d.querySelectorAll('.pin-dot-entry input:not([disabled]),button.primary:not([disabled])')].find(el=>!el.closest('[hidden]'));focus?.focus({preventScroll:true});
  }
  function error(d,e,selector='[data-error]'){const el=q(d,selector);el.textContent=String(e.message||e);el.hidden=false;}
  async function busy(d,task){const controls=[...d.querySelectorAll('button,input,select')],states=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);try{return await task();}finally{controls.forEach((el,i)=>el.disabled=states[i]);}}
  function validate(o){if(!validPin(o.pin,o.length))throw new Error(o.length+' haneli, yalnız rakamlardan oluşan PIN girin.');if(o.pin!==o.confirm)throw new Error('Yeni PIN girişleri eşleşmiyor.');}
  async function refresh(){
    config=await security.settings();settings.dataset.pinEnabled=String(config.enabled);q(settings,'[data-status]').textContent=config.enabled?config.length+' haneli PIN tanımlı.':'PIN tanımlı değil.';
    for(const group of ['create','edit','remove','daily']){const el=q(settings,'[name='+group+']');el.checked=config[group];el.disabled=!config.enabled;}
    q(settings,'[name=interval]').value=String(config.interval||0);q(settings,'[name=interval]').disabled=!config.enabled;
    const actionBar=q(settings,'[data-pin-actions]');actionBar.classList.toggle('pin-settings-footer',config.enabled);if(config.enabled)settings.append(actionBar);else q(settings,'.pin-content').insertBefore(actionBar,q(settings,'form'));
    q(settings,'[data-change]').textContent=config.enabled?'PIN’i değiştir':'PIN oluştur';q(settings,'[data-remove]').hidden=!config.enabled;
  }
  async function open(){try{config=await security.settings();settingsKey=null;if(config.enabled)settingsKey=await security.requestPin(config,pin=>security.check(pin,config));show(settings);await refresh();}catch(e){settingsMenu.show();if(!String(e.message||e).includes('PIN onayı iptal edildi'))notice(String(e.message||e));}}
  security.requestPin=(current,check)=>new Promise((resolve,reject)=>{
    if(pending){reject(new Error('Başka bir PIN onayı bekleniyor.'));return;}window.dispatchEvent(new Event('star-pin-wait'));
    q(challenge,'form').reset();const i=q(challenge,'input');setPinLength(i,current.length);q(challenge,'.pin-dots').replaceChildren(...Array.from({length:current.length},()=>document.createElement('span')));pending={resolve,reject,check};show(challenge);i.focus();
  }).finally(()=>window.dispatchEvent(new Event('star-pin-resume')));
  function verifyChallenge(){
    if(!pending)return;
    if(pending.verification)return pending.verification;
    const p=pending,i=q(challenge,'input'),pin=i.value;
    if(!validPin(pin,i.maxLength))return;
    p.verification=(async()=>{
      try{await busy(challenge,async()=>{const key=await p.check(pin);if(p!==pending)return;pending=null;challenge.close();p.resolve(key);});}
      catch(err){if(p===pending){i.value='';validation(challenge);error(challenge,err);i.focus();}}
      finally{p.verification=null;}
    })();
    return p.verification;
  }
  q(challenge,'form').onsubmit=e=>{e.preventDefault();return verifyChallenge();};
  challenge.addEventListener('close',()=>{if(pending){const p=pending;pending=null;p.reject(new Error('PIN onayı iptal edildi. Formdaki bilgiler korunuyor.'));}});
  q(settings,'form').onsubmit=e=>e.preventDefault();
  let settingsSaves=Promise.resolve();
  q(settings,'form').addEventListener('change',e=>{
    if(!config?.enabled||!['create','edit','remove','daily','interval'].includes(e.target.name))return;
    const o={base:config,oldKey:settingsKey,changes:{[e.target.name]:e.target.name==='interval'?Number(e.target.value):e.target.checked}};
    q(settings,'[data-error]').hidden=true;
    settingsSaves=settingsSaves.then(async()=>{
      try{if(!o.oldKey)throw new Error('Ayarları yeniden açıp PIN girin.');const saved=await security.save(o);if(settingsKey===o.oldKey){config=saved;notice('Ayar kaydedildi.');}}
      catch(err){if(settingsKey===o.oldKey){await refresh().catch(()=>{});error(settings,err);}}
    });
  });
  q(settings,'[data-change]').onclick=()=>{
    q(change,'form').reset();q(change,'h2').textContent=config.enabled?'PIN’i değiştir':'PIN oluştur';q(change,'[name=length]').value=String(config.enabled?config.length:4);
    q(change,'[data-old]').hidden=!config.enabled;const old=q(change,'[name=oldPin]');setPinLength(old,config.length);show(change);q(change,config.enabled?'[name=oldPin]':'[name=pin]').focus();
  };
  q(change,'form').onsubmit=e=>{
    e.preventDefault();try{const o=values(change);validate(o);if(config.enabled&&!validPin(o.oldPin,config.length))throw new Error('Mevcut PIN’inizi girin.');pendingChange={...o,setup:!config.enabled,base:config};q(changeConfirm,'[data-description]').textContent=config.enabled?'PIN’iniz '+o.length+' haneli yeni PIN ile değiştirilecek. İşlem koruma ayarlarınız ve kayıtlarınız korunur.':'Seçtiğiniz '+o.length+' haneli PIN oluşturulacak. İşlem korumalarını ardından ayarlardan açabilirsiniz.';show(changeConfirm);}catch(err){error(change,err);}
  };
  q(changeConfirm,'form').onsubmit=async e=>{
    e.preventDefault();if(!pendingChange)return;const o=pendingChange;
    try{await busy(changeConfirm,()=>o.setup?security.setup(o):security.change(o));pendingChange=null;changeConfirm.close();change.close();settings.close();settingsKey=null;notice(o.setup?'PIN oluşturuldu.':'PIN değiştirildi.');}
    catch(err){pendingChange=null;changeConfirm.close();error(change,err);}
  };
  changeConfirm.addEventListener('close',()=>{pendingChange=null;});
  function forgot(){q(reset,'form').reset();q(reset,'form').hidden=true;q(reset,'[data-verified]').hidden=true;q(reset,'[data-google]').hidden=false;show(reset);}
  q(reset,'[data-google]').onclick=async()=>{try{await busy(reset,async()=>{if(!demo)await security.reauthenticate();});q(reset,'[data-verified]').textContent=demo?'Demo doğrulaması tamamlandı. Canlıda Google hesabıyla doğrulama gerekir.':'Google hesabı doğrulandı.';q(reset,'[data-verified]').hidden=false;q(reset,'form').hidden=false;q(reset,'[data-google]').hidden=true;validation(reset);}catch(err){error(reset,err,'[data-google-error]');}};
  q(reset,'form').onsubmit=async e=>{e.preventDefault();try{const o=values(reset);validate(o);await busy(reset,()=>security.reset(o));reset.close();if(change.open)change.close();if(pending){const p=pending;pending=null;challenge.close();p.reject(new Error('PIN yenilendi. Formdaki bilgiler korunuyor; işlemi yeniden kaydedin.'));}if(settings.open)settings.close();settingsKey=null;notice('PIN yenilendi. İşlem koruma ayarlarınız korundu.');}catch(err){error(reset,err);}};
  q(settings,'[data-remove]').onclick=()=>{q(removal,'form').reset();setPinLength(q(removal,'input'),config.length);show(removal);};
  q(removal,'form').onsubmit=async e=>{e.preventDefault();const oldPin=values(removal).oldPin;try{await busy(removal,async()=>{const oldKey=await security.check(oldPin,config);await security.remove({base:config,oldKey});});settingsKey=null;removal.close();await refresh();notice('PIN kaldırıldı. Sistem PIN olmadan kullanılabilir.');}catch(err){error(removal,err);}};
  for(const d of dialogs){
    for(const i of d.querySelectorAll('input[type=password]'))i.addEventListener('input',()=>{i.value=i.value.replace(/[^0-9]/g,'').slice(0,i.maxLength);validation(d);if(d===challenge){q(d,'[data-error]').hidden=true;void verifyChallenge();}else if(d===change&&validPin(i.value,i.maxLength)&&i.name!=='confirm'){const next=[...d.querySelectorAll('input[type=password]')].filter(el=>!el.disabled);next[next.indexOf(i)+1]?.focus();}});
    q(d,'[name=length]')?.addEventListener('change',()=>{for(const i of d.querySelectorAll('[name=pin],[name=confirm]'))i.value='';validation(d);if(d===change)q(d,config.enabled?'[name=oldPin]':'[name=pin]').focus();});
    d.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>d.close());d.querySelectorAll('[data-forgot]').forEach(b=>b.onclick=forgot);
    const back=q(d,'[data-back]');if(back)back.onclick=()=>{d.close();if(d===settings)settingsMenu.show();};
    let outsideStart=false;const outside=e=>{const r=d.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
    d.addEventListener('pointerdown',e=>{outsideStart=e.target===d&&outside(e);});d.addEventListener('click',e=>{if(outsideStart&&e.target===d&&outside(e))d.close();outsideStart=false;});
    d.addEventListener('close',()=>{for(const i of d.querySelectorAll('input[type=password]'))i.value='';});
  }
  change.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||event.isComposing||event.repeat||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!event.target.matches('input[type=password]'))return;
    event.preventDefault();
    if(validation(change))q(change,'form').requestSubmit(q(change,'button[type=submit]'));
  });
  const changeBody=q(change,'.detail-body');
  const updateChangeScroll=()=>{changeBody.dataset.scrollMore=String(changeBody.scrollHeight>changeBody.clientHeight+1&&changeBody.scrollTop+changeBody.clientHeight<changeBody.scrollHeight-1);};
  changeBody.addEventListener('scroll',updateChangeScroll,{passive:true});
  if(typeof window.ResizeObserver==='function'){
    const changeResize=new window.ResizeObserver(updateChangeScroll);changeResize.observe(changeBody);changeResize.observe(q(change,'form'));
  }
  settings.addEventListener('close',()=>{settingsKey=null;});
  const settingsMenu=installSettingsUI({openSecurity:open,company,notice});
  const button=document.createElement('button');button.type='button';button.textContent='Ayarlar';button.onclick=settingsMenu.open;
  const profile=document.querySelector('#profileDialog'),footer=document.createElement('div'),logout=profile.querySelector('.profile-logout');
  const icon=paths=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
  button.innerHTML=icon('<path d="m9.5 3-.6 2.1-1.5.9-2.1-.5-2.5 4.3 1.5 1.6v1.7l-1.5 1.6 2.5 4.3 2.1-.5 1.5.9.6 2.1h5l.6-2.1 1.5-.9 2.1.5 2.5-4.3-1.5-1.6v-1.7l1.5-1.6-2.5-4.3-2.1.5-1.5-.9-.6-2.1Z"/><circle cx="12" cy="12" r="3"/>')+'<span>Ayarlar</span>';
  logout.innerHTML=icon('<path d="M9 5H4v14h5m5-12 5 5-5 5m-6-5h11"/>')+'<span>Çıkış yap</span>';
  footer.className='profile-action-footer';footer.append(button,logout);profile.append(footer);
  return {open:settingsMenu.open};
}
