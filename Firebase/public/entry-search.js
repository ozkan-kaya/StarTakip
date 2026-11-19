(() => {
  const selector = '#txParty,#txProduct,select[data-line-field="urunId"]';
  const entries = new Map();
  let opened = null;
  const normalize = value => String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  const style = document.createElement('style');
  style.textContent = `
.entry-search{position:relative;min-width:0}
.entry-search>select{position:absolute!important;width:1px!important;height:1px!important;opacity:0;pointer-events:none;padding:0;margin:0}
.entry-search-trigger{width:100%;min-height:44px;margin-top:7px;padding:10px 12px;justify-content:space-between;text-align:left;background:var(--surface-soft);border-color:var(--line-strong);border-radius:14px;font-weight:400}
.entry-search-trigger span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.entry-search-trigger::after{content:'⌄';color:var(--muted);flex:none}
.entry-search-panel{position:fixed;inset:auto;margin:0;padding:10px;border:1px solid var(--line-strong);border-radius:16px;background:var(--surface);color:var(--text);box-shadow:0 12px 36px #173c3526;max-width:calc(100vw - 24px);z-index:1000}
.entry-search-panel:not(:popover-open){display:none}
.entry-search-panel[data-fallback-open]{display:block}
.entry-search-panel input{margin:0 0 8px;font-size:16px}
.entry-search-results{overflow:auto;max-height:220px;overscroll-behavior:contain}
.entry-search-option{padding:10px 12px;border-radius:10px;cursor:pointer;font-size:14px;overflow-wrap:anywhere}
.entry-search-option:hover,.entry-search-option[data-active]{background:var(--surface-tint)}
.entry-search-option[aria-selected=true]{font-weight:600}
.entry-search-empty{padding:12px;color:var(--muted);font-size:13px}
`;
  document.head.append(style);
  function close(restore = false) {
    if (!opened) return;
    const entry = opened; opened = null;
    if (entry.panel.matches(':popover-open')) entry.panel.hidePopover();
    entry.panel.removeAttribute('data-fallback-open');
    entry.trigger.setAttribute('aria-expanded', 'false');
    if (restore && entry.trigger.isConnected) entry.trigger.focus({preventScroll:true});
  }
  function position(entry) {
    const rect = entry.trigger.getBoundingClientRect();
    const below = innerHeight - rect.bottom - 12, above = rect.top - 12;
    const height = Math.min(290, Math.max(below, above), Math.max(110, entry.results.scrollHeight + 68));
    entry.panel.style.width = Math.min(rect.width, innerWidth - 24) + 'px';
    entry.panel.style.left = Math.max(12, Math.min(rect.left, innerWidth - rect.width - 12)) + 'px';
    entry.panel.style.top = (below >= Math.min(290, above) ? rect.bottom + 4 : Math.max(12, rect.top - height - 4)) + 'px';
    entry.results.style.maxHeight = Math.max(60, height - 68) + 'px';
  }
  function choose(entry, option) {
    if (entry.select.disabled || option.disabled) return;
    entry.select.value = option.value;
    syncEntry(entry); close(true);
    entry.select.dispatchEvent(new Event('input', {bubbles:true}));
    entry.select.dispatchEvent(new Event('change', {bubbles:true}));
  }
  function highlight(entry, index) {
    const rows = [...entry.results.querySelectorAll('[role=option]')];
    entry.index = Math.max(0, Math.min(index, rows.length - 1));
    rows.forEach((row, i) => row.toggleAttribute('data-active', i === entry.index));
    const row = rows[entry.index];
    if (row) { entry.search.setAttribute('aria-activedescendant', row.id); row.scrollIntoView?.({block:'nearest'}); }
    else entry.search.removeAttribute('aria-activedescendant');
  }
  function filter(entry) {
    const words = normalize(entry.search.value).trim().split(/\s+/);
    entry.results.replaceChildren();
    for (const option of entry.select.options) {
      if (option.disabled || !words.every(word => normalize(option.textContent + ' ' + (option.dataset.search || '')).includes(word))) continue;
      const row = document.createElement('div');
      row.className = 'entry-search-option';row.id = entry.select.id + '-option-' + option.index;
      row.setAttribute('role', 'option');row.setAttribute('aria-selected', String(option.selected));row.textContent = option.textContent;
      row.addEventListener('pointerdown', event => event.preventDefault());
      row.addEventListener('click', () => choose(entry, option));
      entry.results.append(row);
    }
    if (!entry.results.children.length) { const empty = document.createElement('div');empty.className='entry-search-empty';empty.textContent='Sonuç bulunamadı.';entry.results.append(empty); }
    highlight(entry, 0);if(opened===entry)position(entry);
  }
  function open(entry, text = '') {
    if (entry.select.disabled) return;
    close();opened=entry;entry.search.value=text;filter(entry);position(entry);
    entry.trigger.setAttribute('aria-expanded','true');
    if (entry.panel.showPopover) entry.panel.showPopover();else entry.panel.setAttribute('data-fallback-open','');
    position(entry);
    entry.search.focus({preventScroll:true});
  }
  function syncEntry(entry) {
    const label = entry.select.selectedOptions[0]?.textContent || entry.select.options[0]?.textContent || 'Seçin';
    if (entry.caption.textContent !== label) entry.caption.textContent = label;
    if (entry.trigger.disabled !== entry.select.disabled) entry.trigger.disabled = entry.select.disabled;
    if (opened === entry && (entry.select.disabled || entry.select.closest('[hidden]') || !entry.select.closest('dialog')?.open)) close();
  }
  function enhance(select) {
    const root=document.createElement('div');root.className='entry-search';select.before(root);root.append(select);
    select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    const trigger=document.createElement('button');trigger.type='button';trigger.className='entry-search-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
    const label=document.querySelector('label[for="'+select.id+'"]');
    if(label){label.id ||= select.id+'-label';trigger.setAttribute('aria-labelledby',label.id+' '+select.id+'-caption');}
    const caption=document.createElement('span');caption.id=select.id+'-caption';trigger.append(caption);
    const panel=document.createElement('div');panel.className='entry-search-panel';panel.setAttribute('popover','manual');
    const search=document.createElement('input');search.type='search';search.autocomplete='off';search.placeholder=select.id==='txParty'?'Cari ara…':'Ürün adı veya kodu ara…';search.setAttribute('aria-label',search.placeholder);search.setAttribute('role','combobox');search.setAttribute('aria-expanded','true');search.setAttribute('aria-autocomplete','list');
    const results=document.createElement('div');results.className='entry-search-results';results.id=select.id+'-results';results.setAttribute('role','listbox');results.setAttribute('aria-label',select.id==='txParty'?'Cariler':'Ürünler');search.setAttribute('aria-controls',results.id);trigger.setAttribute('aria-controls',results.id);
    panel.append(search,results);root.append(trigger,panel);
    const entry={select,root,trigger,caption,panel,search,results,index:0};entries.set(select,entry);
    trigger.addEventListener('click',()=>opened===entry?close():open(entry));
    trigger.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();open(entry);}else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&event.key!==' '){event.preventDefault();open(entry,event.key);}});
    search.addEventListener('input',()=>filter(entry));
    search.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
      else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();highlight(entry,entry.index+(event.key==='ArrowDown'?1:-1));}
      else if(event.key==='Enter'){event.preventDefault();entry.results.querySelectorAll('[role=option]')[entry.index]?.click();}
    });
    select.addEventListener('focus',()=>trigger.focus({preventScroll:true}));
    select.addEventListener('invalid',event=>{event.preventDefault();open(entry);});
    select.addEventListener('change',()=>syncEntry(entry));
    root.addEventListener('focusout',()=>queueMicrotask(()=>{if(opened===entry&&!root.contains(document.activeElement))close();}));
    new MutationObserver(()=>{syncEntry(entry);if(opened===entry)filter(entry);}).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
    syncEntry(entry);
  }
  window.syncEntrySearch=()=>{
    for(const [select] of entries)if(!select.isConnected){if(opened?.select===select)close();entries.delete(select);}
    document.querySelectorAll(selector).forEach(select=>{if(!entries.has(select))enhance(select);syncEntry(entries.get(select));});
  };
  document.addEventListener('pointerdown',event=>{if(opened&&!opened.root.contains(event.target))close();},true);
  document.addEventListener('close',()=>{if(opened&&!opened.select.closest('dialog')?.open)close();},true);
  document.addEventListener('scroll',()=>{if(opened)position(opened);},true);
  window.addEventListener('resize',()=>{if(opened)position(opened);});
  window.syncEntrySearch();
})();
