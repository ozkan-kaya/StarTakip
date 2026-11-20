(()=>{
  const style=document.createElement('style');style.id='compactDialogLayoutStyles';style.textContent=String.raw`dialog.record-dialog.dialog-compact{position:fixed;inset:50% auto auto 50%;margin:0;transform:translate(-50%,-50%);width:min(var(--modal-width-compact,440px),calc(100% - 24px));max-width:calc(100% - 24px);height:auto!important;min-height:0!important;max-height:calc(100dvh - 32px)!important;overflow:hidden;align-self:center;justify-self:center}
dialog.record-dialog.dialog-compact[open]{display:flex;flex-direction:column}
dialog.record-dialog.dialog-compact>.detail-header,dialog.record-dialog.dialog-compact>.dialog-compact-footer,dialog.record-dialog.dialog-compact>.pin-action-footer{flex:0 0 auto}
dialog.record-dialog.dialog-compact>.detail-header{position:relative;top:auto}
dialog.record-dialog.dialog-compact>.detail-body,#pinSecurityDialog.dialog-compact>.pin-screen[open]>.detail-body{flex:0 1 auto;min-height:0;max-height:none;overflow-y:auto;overscroll-behavior:contain;padding-bottom:var(--modal-space)}
#pinSecurityDialog.dialog-compact>.pin-screen[open]{flex:0 1 auto;min-height:0;overflow:hidden}
#pinSecurityDialog.dialog-compact>.pin-screen[open]>.detail-header,#pinSecurityDialog.dialog-compact>.pin-screen[open]>.pin-action-footer{flex:0 0 auto}
dialog.record-dialog.dialog-compact>.dialog-compact-footer,dialog.record-dialog.dialog-compact>.pin-action-footer,#pinSecurityDialog.dialog-compact>.pin-screen[open]>.pin-action-footer{position:static;display:flex;justify-content:flex-end;align-items:center;flex-wrap:wrap;gap:10px;margin:0;padding:var(--s-5) var(--modal-space) var(--modal-space);border-top:1px solid var(--line);background:var(--surface)}
dialog.record-dialog.dialog-compact .modal-main-actions{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:10px;max-width:100%;margin-top:0;margin-left:auto}
dialog.record-dialog.dialog-compact .modal-actions button{min-height:46px;margin:0}
@media(max-width:600px){dialog.record-dialog.dialog-compact .modal-main-actions{flex-wrap:wrap-reverse}dialog.record-dialog.dialog-compact .modal-main-actions>button{flex:1 1 max-content;max-width:100%}}
`;document.head.append(style);
  function arrange(dialog){
    const body=dialog.querySelector(':scope > .detail-body');if(!body)return;
    const footer=body.querySelector('.modal-actions')||(dialog.id==='transactionSavedDialog'?body.querySelector('.actions:has([data-print-transactions])'):null);
    if(!footer)return;
    const form=footer.closest('form');
    if(form?.id)for(const button of footer.querySelectorAll('button[type=submit]'))button.setAttribute('form',form.id);
    const previous=dialog.querySelector(':scope > .dialog-compact-footer');if(previous&&previous!==footer)previous.remove();
    footer.classList.add('modal-actions','dialog-compact-footer');dialog.append(footer);
  }
  const scan=()=>document.querySelectorAll('dialog.dialog-compact').forEach(arrange);
  new MutationObserver(records=>{
    if(records.some(record=>record.type==='attributes'?record.target.matches('dialog'):Array.from(record.addedNodes).some(node=>node.nodeType===1&&(node.matches('dialog')||node.closest('dialog.dialog-compact')||node.querySelector('dialog.dialog-compact')))))scan();
  }).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  scan();
})();
