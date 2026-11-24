export function preserveForms(draw){
  const dialogs=[...document.querySelectorAll('dialog[open]')].filter(d=>!d.id.startsWith('pin'));
  const fields=dialogs.flatMap(dialog=>[...dialog.querySelectorAll('input,select,textarea')].map(el=>({el,value:el.value,checked:el.checked,option:el.tagName==='SELECT'?el.selectedOptions[0]?.textContent:null})));
  const positions=dialogs.flatMap(d=>[d,...d.querySelectorAll('.detail-body')]).map(el=>({el,top:el.scrollTop}));
  const active=document.activeElement,x=window.scrollX,y=window.scrollY;
  draw();
  for(const field of fields){const {el}=field;if(!el.isConnected)continue;
    if(el.tagName==='SELECT'&&field.value&&!Array.from(el.options).some(o=>o.value===field.value)){const option=document.createElement('option');option.value=field.value;option.textContent=field.option||field.value;option.disabled=true;el.append(option);}
    el.value=field.value;if(['checkbox','radio'].includes(el.type))el.checked=field.checked;
  }
  positions.forEach(({el,top})=>el.scrollTop=top);window.syncEntrySearch?.();
  if(active?.isConnected&&document.activeElement!==active)active.focus({preventScroll:true});
  window.scrollTo({left:x,top:y,behavior:'instant'});
}
export function installFreshnessUI({bridge,getState,getScopes,needsTableData,notice}){
  const bypass=new WeakSet();let ticket=0,resumePending=null;
  async function check(scopes,{notify=true}={}){
    if(!getState()||!navigator.onLine)return;
    const result=await bridge.ensureFresh({scopes});
    if(notify&&result.changed)notice('Veriler güncellendi.');return result;
  }
  function scopesFor(button){
    const page=button.dataset.tab||button.dataset.pageTarget||button.dataset.modulePage;
    if(page==='home')return [];
    if(page==='parties'&&!button.dataset.moduleKey)return ['parties'];
    if(page==='products'&&!button.dataset.moduleKey)return ['products'];
    if(page==='notes')return ['notes'];
    const action=button.getAttribute('onclick')||'';
    if(/openNote/.test(action))return ['notes'];
    if(/openPartyModal/.test(action))return ['parties'];
    if(/openProductModal|openUnit/.test(action))return ['products'];
    return ['ledger'];
  }
  function needsCheck(button){
    if(button.matches('header nav [data-tab],#brandHome,[data-page-target],[data-module-page],[data-detail-type],[data-edit-party],[data-edit-product],[data-product-tool],[data-party-payment],[data-statement],[data-quick-line]'))return true;
    return /\b(openUnifiedEntry|openTradeModal|openPaymentModal|openStockModal|openPartyModal|openProductModal|openNoteModal|editMaster|show)\s*\(/.test(button.getAttribute('onclick')||'');
  }
  function replacement(button){
    if(button.isConnected)return button;if(button.id)return document.getElementById(button.id);
    const attrs=[...button.attributes].filter(a=>a.name.startsWith('data-')&&a.name!=='data-freshness');
    if(!attrs.length)return null;
    return document.querySelector(button.tagName.toLowerCase()+attrs.map(a=>'['+a.name+'="'+CSS.escape(a.value)+'"]').join(''));
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button,a');
    if(!button||button.disabled||bypass.has(button)||!getState()||button.closest('.pin-dialog,#profileDialog')||!needsCheck(button))return;
    const intent=++ticket;
    if(needsTableData(button))return;
    event.preventDefault();event.stopImmediatePropagation();
    let waitTimer;
    const timeout=new Promise(resolve=>{waitTimer=setTimeout(resolve,5000);});
    Promise.race([check(scopesFor(button)),timeout]).catch(()=>{}).finally(()=>{
      clearTimeout(waitTimer);if(intent!==ticket)return;
      const target=replacement(button);if(!target||target.disabled)return;
      bypass.add(target);try{target.click();}finally{bypass.delete(target);}
    });
  },true);
  const resume=()=>{
    if(document.visibilityState==='hidden'||!getState()||resumePending)return;
    resumePending=check(getScopes()).catch(()=>{}).finally(()=>resumePending=null);
  };
  window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);
  return {clear(){ticket++;}};
}
