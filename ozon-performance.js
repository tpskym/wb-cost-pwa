import {dateRange,validDay} from './ozon-analytics.js?v=0.2.392';
import {parseOzonPerformanceRows} from './ozon-promotion.js?v=0.2.422';

const extensionId='fboekfplfoifkgjkninefbfiffngmfdl';
const storageKey='workshop-ozon-performance-v1';
const idPattern=/^\d{1,20}$/;
const uuidPattern=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const archiveLimit=64*1024*1024;
export const performanceStart='2025-02-01';

export function performanceCredentials(window){
 try{
  const saved=JSON.parse(window.localStorage.getItem(storageKey));
  if(typeof saved?.id==='string'&&typeof saved?.secret==='string')return saved;
 }catch{}
 return {id:'',secret:''};
}

export function savePerformanceCredentials(window,credentials){
 if(credentials.id&&credentials.secret)window.localStorage.setItem(storageKey,JSON.stringify(credentials));
 else window.localStorage.removeItem(storageKey);
}

export function performanceRequest(window,operation,body,token,signal){
 return new Promise((resolve,reject)=>{
  signal?.throwIfAborted();
  const unavailable='Установите расширение «Мастерская — Ozon Performance API» в Chrome или Edge и обновите страницу.';
  const runtime=window?.chrome?.runtime;
  if(!runtime?.sendMessage){reject(Object.assign(Error(unavailable),{code:'EXTENSION_REQUIRED'}));return;}
  const abort=()=>reject(signal.reason);
  signal?.addEventListener('abort',abort,{once:true});
  runtime.sendMessage(extensionId,{type:'workshop-ozon-performance',operation,body,token},response=>{
   signal?.removeEventListener('abort',abort);
   if(runtime.lastError||!response){
    reject(Object.assign(Error(unavailable),{code:'EXTENSION_REQUIRED'}));return;
   }
   if(!response.ok){
    const status=response.status;
    const denied=status===401||status===403||operation==='token'&&status===400;
    const message=denied?'Ozon отклонил доступ. Проверьте Client ID и Client Secret в разделе Performance API.':
     status===429?'Достигнут лимит отчётов Ozon Performance API. Повторите позже.':
     response.error||'Ошибка Ozon Performance API'+(status?' (HTTP '+status+')':'')+'.';
    reject(Object.assign(Error(message),{status,code:denied?'PERFORMANCE_ACCESS_DENIED':undefined}));return;
   }
   resolve(response.data);
  });
 });
}

function pause(ms,signal){
 return new Promise((resolve,reject)=>{
  signal?.throwIfAborted();
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  const abort=()=>{clearTimeout(timer);reject(signal.reason);};
  signal?.addEventListener('abort',abort,{once:true});
 });
}

async function listCampaigns(request){
 const all=new Map();
 for(let page=1;;page++){
  const {list}=await request('campaigns',{page});
  if(!Array.isArray(list))throw Error('Ozon вернул неизвестный формат списка кампаний.');
  const count=all.size;
  for(const campaign of list){
   const id=String(campaign?.id??'');
   if(!idPattern.test(id)||typeof campaign.id==='number'&&!Number.isSafeInteger(campaign.id))throw Error('Ozon вернул неверный номер кампании.');
   all.set(id,{...campaign,id});
  }
  if(list.length<100)return [...all.values()].filter(c=>c.paymentType==='CPC'&&c.advObjectType==='SKU');
  if(all.size===count)throw Error('Ozon повторил страницу списка кампаний.');
 }
}

function csvRows(bytes){
 let text=new TextDecoder().decode(bytes);
 if(text.includes('\uFFFD'))text=new TextDecoder('windows-1251').decode(bytes);
 return parseCsv(text);
}

function parseCsv(text,unwrap=true){
 const rows=[];
 let row=[],field='',quoted=false;
 const endField=()=>{row.push(field);field='';};
 const endLine=()=>{
  endField();
  rows.push(unwrap&&row.length===1&&row[0].includes(';')?parseCsv(row[0],false)[0]:row);
  row=[];
 };
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++;}
   else if(quoted||field==='')quoted=!quoted;
   else field+=char;
  }else if(!quoted&&char===';')endField();
  else if(!quoted&&(char==='\r'||char==='\n')){
   if(char==='\r'&&text[i+1]==='\n')i++;
   endLine();
  }else field+=char;
 }
 if(quoted)throw Error('Ozon вернул повреждённый отчёт по кампании.');
 if(field||row.length)endLine();
 return rows;
}

async function readReport(encoded,campaigns,ids,period){
 if(typeof encoded!=='string'||!encoded)throw Error('Ozon вернул пустой файл отчёта.');
 const bytes=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
 const campaignFiles=new Map(campaigns.map(id=>[id+'.csv',id]));
 const parse=(campaignId,data)=>parseOzonPerformanceRows(csvRows(data),{...period,ids,campaignId});
 if(bytes[0]!==0x50||bytes[1]!==0x4b){
  if(campaigns.length!==1)throw Error('Ozon не вернул архив с отчётами кампаний.');
  return parse(campaigns[0],bytes);
 }
 const {unzipSync}=await import('./ozon-report-zip.js?v=0.2.422');
 let size=0;
 const archive=unzipSync(bytes,{filter:file=>{
  if(!campaignFiles.has(file.name))return false;
  size+=file.originalSize;
  if(size>archiveLimit)throw Error('Отчёт Ozon слишком большой. Выберите более короткий период.');
  return true;
 }});
 return campaigns.flatMap(id=>{
  const data=archive[id+'.csv'];
  if(!data)throw Error('Ozon не вернул отчёт для кампании № '+id+'.');
  return parse(id,data);
 });
}

export async function loadOzonPerformance(ids,period,credentials,request,{signal,onProgress=()=>{},wait=pause}={}){
 const {from,to}=period;
 const days=dateRange(from,to);
 if(from<performanceStart)throw Error('Статистика Performance API доступна с 1 февраля 2025 года.');
 if(!credentials.id||!credentials.secret)throw Error('Введите Client ID и Client Secret из настроек Ozon Performance API.');
 const auth=await request('token',credentials);
 if(typeof auth?.access_token!=='string'||!auth.access_token)throw Error('Ozon не вернул токен Performance API.');
 const call=(operation,body)=>{
  signal?.throwIfAborted();
  return request(operation,body,auth.access_token);
 };
 const all=await listCampaigns(call);
 const candidates=all.filter(c=>{
  const created=String(c.createdAt??'').slice(0,10);
  return (!validDay(created)||created<=to)&&
   (c.state!=='CAMPAIGN_STATE_FINISHED'||!validDay(c.toDate)||c.toDate>=from);
 });
 const available=candidates.filter(c=>c.state!=='CAMPAIGN_STATE_ARCHIVED');
 const jobs=[];
 for(let i=0;i<days.length;i+=62){
  for(let j=0;j<available.length;j+=10){
   jobs.push({from:days[i],to:days[Math.min(i+61,days.length-1)],campaigns:available.slice(j,j+10).map(c=>c.id)});
  }
 }
 const rows=[];
 for(const [index,job] of jobs.entries()){
  onProgress(index+1,jobs.length);
  const {campaigns}=job;
  const {UUID:uuid}=await call('submit',{campaigns,dateFrom:job.from,dateTo:job.to});
  if(!uuidPattern.test(uuid))throw Error('Ozon не вернул номер отчёта по кампаниям.');
  let ready=false;
  for(let attempt=0;attempt<60;attempt++){
   if(attempt)await wait(2000,signal);
   const {state}=await call('status',{uuid});
   if(state==='OK'){ready=true;break;}
   if(state==='ERROR')throw Error('Ozon не смог сформировать отчёт по кампаниям. Повторите загрузку или сократите период.');
   if(state!=='IN_PROGRESS'&&state!=='NOT_STARTED')throw Error('Ozon вернул неизвестный статус отчёта.');
  }
  if(!ready)throw Error('Ozon ещё формирует отчёт. Попробуйте загрузить его позже.');
  rows.push(...await readReport(await call('report',{uuid}),campaigns,ids,job));
 }
 const used=new Set(rows.map(row=>row.campaignId));
 return {
  from,to,client:credentials.id,rows,
  campaigns:available.filter(c=>used.has(c.id)).map(c=>({id:c.id,title:typeof c.title==='string'?c.title:''})),
  archived:candidates.length-available.length
 };
}
