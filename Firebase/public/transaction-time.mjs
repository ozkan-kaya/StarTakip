const istanbulClock=new Intl.DateTimeFormat('sv-SE',{
  timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});
const clockPattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;

function istanbulDateTime(date){
  const parts=Object.fromEntries(istanbulClock.formatToParts(date).map(({type,value})=>[type,value]));
  return parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute;
}

export function istanbulTime(date=new Date()){
  return istanbulDateTime(date).slice(11);
}

export function validateTransactionTime(date,time,now=new Date()){
  if(time==null||time==='')return '';
  if(typeof time!=='string'||!clockPattern.test(time))throw new Error('Geçerli bir işlem saati girin.');
  if(date+'T'+time>istanbulDateTime(now))throw new Error('Gelecekteki bir işlem saati kaydedilemez.');
  return time;
}

function chronologicalTime(transaction){
  if(transaction.islemSaati)return transaction.tarih+'T'+transaction.islemSaati;
  const created=new Date(transaction.olusturmaZamani);
  return Number.isNaN(created.getTime())?'':istanbulDateTime(created);
}

export function operationOrder(a,b,missingRow=0){
  const day=String(a.tarih).localeCompare(String(b.tarih));
  if(day)return day;
  const time=a.islemSaati||b.islemSaati?chronologicalTime(a).localeCompare(chronologicalTime(b)):0;
  return time||String(a.olusturmaZamani).localeCompare(String(b.olusturmaZamani))
    ||(a._row||missingRow)-(b._row||missingRow)||String(a.id).localeCompare(String(b.id));
}
