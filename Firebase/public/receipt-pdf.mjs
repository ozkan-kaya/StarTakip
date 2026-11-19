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
export function receiptPageSlices(height,pageHeight,blocks,header){
  const pages=[];let start=0;
  while(start<height){
    const repeatHeader=!!header&&start>=header.tableStart&&start<header.tableEnd;
    const headerHeight=repeatHeader?header.height:0;
    let end=Math.min(height,start+pageHeight-headerHeight);
    for(const block of blocks)if(block.top>start&&block.top<end&&block.bottom>end)end=block.top;
    end=Math.max(start+1,Math.floor(end));
    pages.push({start,end,repeatHeader});start=end;
  }
  return pages;
}
export function receiptPaperLayout(format='a5'){
  const key=String(format).toLowerCase();
  if(!['a5','a4'].includes(key))throw new Error('Kağıt boyutu A5 veya A4 olmalı.');
  const width=key==='a4'?210:148,height=key==='a4'?297:210;
  const scale=Math.min(width/148,height/210),contentWidth=134*scale,contentHeight=196*scale;
  return {format:key,width,height,scale,contentWidth,contentHeight,marginX:(width-contentWidth)/2,marginY:7*scale};
}
export async function createReceiptPdf(html,title,format='a5'){
  const paper=receiptPaperLayout(format);
  await loadLibraries();
  const frame=document.createElement('iframe');frame.title='PDF hazırlama';frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;left:-10000px;top:0;width:148mm;height:210mm;border:0;pointer-events:none';
  try{
    const loaded=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('PDF belgesi hazırlanamadı.')),15000);frame.onload=()=>{clearTimeout(timer);resolve();};});
    frame.srcdoc=html;document.body.appendChild(frame);await loaded;
    const doc=frame.contentDocument,style=doc.createElement('style');
    style.textContent='.print-tools{display:none!important}body{padding:7mm;width:148mm}main{overflow:visible!important}.receipt-offer{width:134mm!important;max-width:134mm!important;margin:0!important}';doc.head.appendChild(style);
    if(doc.fonts)await doc.fonts.ready;
    const root=doc.querySelector('.receipt-offer');if(!root)throw new Error('İşlem dökümü bulunamadı.');
    const bounds=root.getBoundingClientRect();
    const rect=el=>{const r=el.getBoundingClientRect();return {top:r.top-bounds.top,bottom:r.bottom-bounds.top};};
    const blocks=[...root.querySelectorAll('.receipt-items tr,.receipt-summary-area,.receipt-note,.receipt-words')].map(rect);
    const head=root.querySelector('.receipt-items thead'),table=root.querySelector('.receipt-items');
    const header=head&&table?{...rect(head),height:head.getBoundingClientRect().height,tableStart:rect(head).bottom,tableEnd:rect(table).bottom}:null;
    const canvas=await window.html2canvas(root,{scale:3,backgroundColor:'#ffffff',logging:false,windowWidth:Math.ceil(148*96/25.4),scrollX:0,scrollY:0});
    const scale=canvas.width/bounds.width,pixelsPerMM=canvas.width/paper.contentWidth;
    const pxBlocks=blocks.map(r=>({top:Math.floor(r.top*scale),bottom:Math.ceil(r.bottom*scale)}));
    const pxHeader=header?Object.fromEntries(Object.entries(header).map(([k,v])=>[k,Math.round(v*scale)])):null;
    const pages=receiptPageSlices(canvas.height,Math.floor(paper.contentHeight*pixelsPerMM),pxBlocks,pxHeader);
    const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:paper.format,compress:true});
    pdf.setProperties({title,author:root.querySelector('.receipt-seller h2')?.textContent||'Star Takip',subject:'İşlem dökümü',creator:'Star Takip'});
    function image(start,height,y,alias){
      const crop=document.createElement('canvas');crop.width=canvas.width;crop.height=height;
      crop.getContext('2d').drawImage(canvas,0,start,canvas.width,height,0,0,canvas.width,height);
      pdf.addImage(crop,'PNG',paper.marginX,y,paper.contentWidth,height/pixelsPerMM,alias,'FAST');crop.width=0;crop.height=0;
    }
    pages.forEach((page,index)=>{
      if(index)pdf.addPage(paper.format,'portrait');let y=paper.marginY;
      if(page.repeatHeader){image(pxHeader.top,pxHeader.height,y,'header');y+=pxHeader.height/pixelsPerMM;}
      image(page.start,page.end-page.start,y,'page-'+index);
    });
    canvas.width=0;canvas.height=0;return pdf;
  }finally{frame.remove();}
}
