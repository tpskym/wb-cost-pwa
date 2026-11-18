import {validDay} from './ozon-analytics.js?v=0.2.392';
import {redact} from './marketplace-api.js?v=0.2.392';

export const wbAnalyticsGroups=[
 ['sales','Продажи за вычетом возвратов'],
 ['settlement','Расчёт с WB за товары'],
 ['delivery','Доставка'],
 ['services','Хранение и приёмка'],
 ['deductions','Штрафы и удержания'],
 ['loyalty','Программа лояльности'],
 ['adjustments','Другие начисления']
];

const reportFields=[
 ['delivery','Доставка','deliveryServiceSum'],
 ['services','Хранение','paidStorageSum'],
 ['services','Приёмка','paidAcceptanceSum'],
 ['deductions','Прочие удержания и выплаты','deductionSum'],
 ['deductions','Штрафы','penaltySum'],
 ['deductions','Корректировка вознаграждения WB','additionalPaymentSum'],
 ['loyalty','Списание за баллы','cashbackAmountSum'],
 ['loyalty','Стоимость участия','cashbackCommissionChangeSum']
];
const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const endpoint='https://finance-api.wildberries.ru/api/finance/v1/sales-reports/list';

export function wbSellerId(token){
 if(!token)return '';
 try{
  const payload=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  const {sid}=JSON.parse(atob(payload));
  return typeof sid==='string'&&uuid.test(sid)?sid.toLowerCase():'';
 }catch{return '';}
}

export function wbAccrualDays(state,sellerId){
 const days=state?.accounts?.[sellerId];
 if(!sellerId||!Array.isArray(days))return [];
 const dateSet=new Set();
 return days.filter(day=>{
  if(!day||!validDay(day.date)||dateSet.has(day.date)||!Number.isSafeInteger(day.total)||
   !Number.isSafeInteger(day.count)||day.count<1||!Array.isArray(day.rows)||day.rows.length>30)return false;
  if(day.rows.some(row=>!row||!wbAnalyticsGroups.some(([group])=>group===row.group)||
   typeof row.label!=='string'||!Number.isSafeInteger(row.amount))||
   day.rows.reduce((total,row)=>total+row.amount,0)!==day.total)return false;
  dateSet.add(day.date);
  return true;
 });
}

function cents(value){
 const parts=/^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(value));
 if(!parts)throw Error('WB вернул сумму в неизвестном формате.');
 const [,sign,whole,fraction='']=parts;
 const minor=Number(fraction.slice(0,2).padEnd(2,'0'))+Number(Number(fraction[2])>=5);
 const result=(sign==='-'?-1:1)*(Number(whole)*100+minor);
 if(!Number.isSafeInteger(result))throw Error('Сумма в отчёте WB выходит за допустимые границы.');
 return result;
}

export const wbReportWait=(ms,signal)=>new Promise((resolve,reject)=>{
 signal?.throwIfAborted();
 const abort=()=>{clearTimeout(timer);reject(signal.reason);};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 signal?.addEventListener('abort',abort,{once:true});
});

export async function requestWbFinanceReport(token,body,signal,fetcher=fetch){
 let response;
 try{
  response=await fetcher(endpoint,{
   method:'POST',headers:{Authorization:token,'Content-Type':'application/json'},
   body:JSON.stringify(body),credentials:'omit',redirect:'error',cache:'no-store',
   signal:AbortSignal.any([signal,AbortSignal.timeout(45000)].filter(Boolean))
  });
 }catch(error){
  signal?.throwIfAborted();
  throw Error('Не удалось загрузить финансовые отчёты WB. Проверьте сеть и доступ токена.');
 }
 if(response.status===204)return [];
 const raw=redact(await response.text(),{wbToken:token});
 if(!response.ok){
  let detail='';
  try{const data=JSON.parse(raw);detail=String(data.detail||data.title||'').slice(0,300);}catch{}
  const access=[401,403].includes(response.status)?' Проверьте персональный или сервисный токен WB с категорией «Финансы».':'';
  const error=Error(`API WB · HTTP ${response.status}.${access}${detail?' '+detail:''}`);
  error.status=response.status;
  error.retryAfterMs=1000*Number(response.headers.get('X-Ratelimit-Retry')||response.headers.get('Retry-After'));
  throw error;
 }
 try{
  // Daily report IDs are int64. Keep every digit before JSON.parse converts integers to numbers.
  const reportIdOrString=/"reportId"(\s*:\s*)(-?\d+)(?=\s*[,}])|"(?:[^"\\]|\\[\s\S])*"/g;
  const json=raw.replace(reportIdOrString,(match,separator,digits)=>
   digits===undefined?match:'"reportId"'+separator+'"'+digits+'"'
  );
  return JSON.parse(json);
 }
 catch{throw Error('Не удалось прочитать финансовые отчёты WB.');}
}

export async function loadWbAccrualDays(dates,request,{signal,onProgress=()=>{},wait=wbReportWait}={}){
 const limit=1000;
 const reports=new Map();
 const selected=new Set(dates);
 const dateFrom=dates[0]+'T00:00:00+03:00',dateTo=dates.at(-1)+'T23:59:59+03:00';
 for(let offset=0;;offset+=limit){
  signal?.throwIfAborted();
  onProgress(`WB · получаем ежедневные отчёты, страница ${offset/limit+1}`);
  const body={dateFrom,dateTo,period:'daily',limit,offset};
  let page;
  try{page=await request(body);}
  catch(error){
   if(error.status!==429)throw error;
   const delay=error.retryAfterMs>0?error.retryAfterMs:60000;
   if(delay>65000)throw Error('WB ограничил частоту запросов. Повторите загрузку позже.');
   onProgress(`WB · повтор через ${Math.ceil(delay/1000)} сек.`);
   await wait(delay,signal);
   signal?.throwIfAborted();
   page=await request(body);
  }
  signal?.throwIfAborted();
  if(!Array.isArray(page)||page.length>limit)throw Error('WB вернул неизвестный формат списка отчётов.');
  const before=reports.size;
  for(const report of page){
   const date=report?.dateFrom?.slice?.(0,10);
   const through=report?.dateTo?.slice?.(0,10);
   const id=report?.reportId;
   if(!validDay(date)||date!==through||!(typeof id==='string'&&id.trim()||Number.isSafeInteger(id)&&id>0)){
    throw Error('WB вернул отчёт с неизвестным номером или периодом.');
   }
   reports.set(String(id),{report,date});
  }
  if(page.length<limit)break;
  if(before===reports.size||offset>=99000)throw Error('WB не завершил выдачу отчётов. Выберите меньший период.');
  await wait(60000,signal);
 }
 const days=new Map();
 for(const {report,date} of reports.values()){
  if(!selected.has(date))continue;
  if(!['RUB','RUR'].includes(report.currency))throw Error('В отчётах WB есть суммы в валюте, отличной от рублей.');
  if(!days.has(date))days.set(date,{date,count:0,total:0,rows:new Map()});
  const day=days.get(date);
  const sales=cents(report.retailAmountSum),settlement=cents(report.forPaySum),total=cents(report.bankPaymentSum);
  day.count++;
  day.total+=total;
  const rows=[
   ['sales','Реализовано WB',sales],
   ['settlement','Разница до суммы к перечислению за товар',settlement-sales],
   ...reportFields.map(([group,label,field])=>[group,label,-cents(report[field]??0)])
  ];
  // BankPaymentSum is the official total. Differences include any remaining report adjustments.
  const difference=total-rows.reduce((sum,[,,amount])=>sum+amount,0);
  if(difference)rows.push(['adjustments','Разница до официального итога WB',difference]);
  for(const [group,label,amount] of rows){
   const row=day.rows.get(label)??{group,label,amount:0};
   row.amount+=amount;
   day.rows.set(label,row);
  }
 }
 return [...days.values()].map(day=>({...day,rows:[...day.rows.values()]})).sort((a,b)=>a.date.localeCompare(b.date));
}
