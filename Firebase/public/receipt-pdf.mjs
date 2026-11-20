// Local-only PDF export. No customer/transaction data leaves the browser.
let libraries;
function loadScript(path,ready){
  if(ready())return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL(path,import.meta.url).href;
    script.onload=()=>ready()?resolve():reject(new Error('PDF bileşeni yüklenemedi.'));
    script.onerror=()=>{script.remove();reject(new Error('PDF bileşeni yüklenemedi. Bağlantınızı kontrol edin.'));};
    document.head.appendChild(script);
  });
}
async function loadLibraries(){
  if(!libraries)libraries=Promise.all([
    loadScript('./vendor/html2canvas.min.js',()=>typeof window.html2canvas==='function'),
    loadScript('./vendor/jspdf.umd.min.js',()=>typeof window.jspdf?.jsPDF==='function')
  ]).catch(error=>{libraries=null;throw error;});
  return libraries;
}
export async function createReceiptPdf(html,title,format='a5'){
  const layout=window.starReceiptLayout, paper=layout.paper(format);
  await loadLibraries();
  const frame=document.createElement('iframe');
  frame.title='PDF hazırlama';
  frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;left:-10000px;top:0;width:'+paper.width+'mm;height:'+paper.height+'mm;border:0;pointer-events:none';
  try{
    const loaded=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('PDF belgesi hazırlanamadı.')),15000);
      frame.onload=()=>{clearTimeout(timer);resolve();};
    });
    frame.srcdoc=html;
    document.body.append(frame);
    await loaded;
    const doc=frame.contentDocument, root=doc.querySelector('.receipt-offer');
    if(!root)throw new Error('İşlem dökümü bulunamadı.');
    const author=root.querySelector('.receipt-seller h2')?.textContent||'Star Takip';
    if(doc.fonts)await doc.fonts.ready;
    const pages=layout.paginate(root,paper.format);
    const pdf=new window.jspdf.jsPDF({orientation:paper.orientation,unit:'mm',format:paper.format,compress:true});
    pdf.setProperties({title,author,subject:'İşlem dökümü',creator:'Star Takip'});
    const sheets=pages.querySelectorAll('.receipt-sheet');
    for(const [index,sheet] of [...sheets].entries()){
      if(index)pdf.addPage(paper.format,paper.orientation);
      const canvas=await window.html2canvas(sheet,{scale:3,backgroundColor:'#ffffff',logging:false,windowWidth:frame.clientWidth,scrollX:0,scrollY:0});
      pdf.addImage(canvas,'PNG',0,0,paper.width,paper.height,'page-'+index,'FAST');
      canvas.width=0;
      canvas.height=0;
    }
    return pdf;
  }finally{frame.remove();}
}
