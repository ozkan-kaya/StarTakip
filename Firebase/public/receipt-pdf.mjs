// Local-only PDF export. No customer/transaction data leaves the browser.
let libraries;
function abortable(task,signal){
  if(!signal)return task;
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
    task.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
function loadScript(path,ready,signal){
  if(ready())return Promise.resolve();
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(signal.reason);return;}
    const script=document.createElement('script');script.src=new URL(path,import.meta.url).href;
    const finish=error=>{
      signal.removeEventListener('abort',abort);
      script.onload=script.onerror=null;
      if(error){script.remove();reject(error);}else resolve();
    };
    const abort=()=>finish(signal.reason);
    script.onload=()=>finish(ready()?null:new Error('PDF bileşeni yüklenemedi.'));
    script.onerror=()=>finish(new Error('PDF bileşeni yüklenemedi. Bağlantınızı kontrol edin.'));
    signal.addEventListener('abort',abort,{once:true});
    document.head.appendChild(script);
  });
}
export function preloadReceiptPdf(signal){
  if(!libraries){
    const controller=new AbortController();
    const abort=()=>controller.abort(signal.reason);
    if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
    libraries=Promise.all([
      loadScript('./vendor/html2canvas.min.js',()=>typeof window.html2canvas==='function',controller.signal),
      loadScript('./vendor/jspdf.umd.min.js',()=>typeof window.jspdf?.jsPDF==='function',controller.signal)
    ]).catch(error=>{controller.abort(error);libraries=null;throw error;})
      .finally(()=>signal?.removeEventListener('abort',abort));
  }
  return abortable(libraries,signal);
}
export async function createReceiptPdf(html,title,format='a5',{signal,deadline=Infinity,previews}={}){
  const check=()=>{
    if(signal?.aborted)throw signal.reason;
    if(performance.now()>=deadline)throw new Error('PDF hazırlama süresi aşıldı.');
  };
  const layout=window.starReceiptLayout, paper=layout.paper(format);
  await preloadReceiptPdf(signal);
  check();
  const frame=document.createElement('iframe');
  frame.title='PDF hazırlama';
  frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;left:-10000px;top:0;width:'+paper.width+'mm;height:'+paper.height+'mm;border:0;pointer-events:none';
  try{
    const loaded=new Promise(resolve=>{frame.onload=resolve;});
    frame.srcdoc=html;
    document.body.append(frame);
    await abortable(loaded,signal);
    check();
    const doc=frame.contentDocument, root=doc.querySelector('.receipt-offer');
    if(!root)throw new Error('İşlem dökümü bulunamadı.');
    const author=doc.querySelector('meta[name="author"]')?.content||'Star Takip';
    if(doc.fonts)await abortable(doc.fonts.ready,signal);
    check();
    const pages=layout.paginate(root,paper.format);
    check();
    const pdf=new window.jspdf.jsPDF({orientation:paper.orientation,unit:'mm',format:paper.format,compress:true});
    pdf.setProperties({title,author,subject:'İşlem dökümü',creator:'Star Takip'});
    const sheets=pages.querySelectorAll('.receipt-sheet');
    for(const [index,sheet] of [...sheets].entries()){
      if(index)pdf.addPage(paper.format,paper.orientation);
      const rendered=window.html2canvas(sheet,{scale:3,backgroundColor:'#ffffff',logging:false,windowWidth:frame.clientWidth,scrollX:0,scrollY:0}).then(canvas=>{
        if(signal?.aborted)canvas.width=canvas.height=0;
        return canvas;
      });
      const canvas=await abortable(rendered,signal);
      try{
        check();
        pdf.addImage(canvas,'PNG',0,0,paper.width,paper.height,'page-'+index,'FAST');
        if(previews){
          const image=await abortable(new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85)),signal);
          if(!image)throw new Error('PDF önizlemesi hazırlanamadı.');
          previews.push(image);
        }
      }finally{canvas.width=canvas.height=0;}
    }
    check();
    return pdf;
  }finally{frame.remove();}
}
