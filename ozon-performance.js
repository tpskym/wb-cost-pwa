import {dateRange,validDay} from './ozon-analytics.js?v=0.2.392';
import {parseOzonPerformanceRows,parseOzonRecentPerformanceRows,shiftDay} from './ozon-promotion.js?v=0.2.430';

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

function isClickCampaign({paymentType,advObjectType}){
 const payment=String(paymentType??'').trim().toUpperCase().replace(/^CAMPAIGN_TYPE_/,'');
 const object=String(advObjectType??'').trim().toUpperCase();
 return (object==='SKU'&&['','INVALID','CPC'].includes(payment))||(!object&&payment==='CPC');
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
  if(list.length<100)return [...all.values()];
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

function campaignIdFromName(name){
 const filename=name.split('/').at(-1);
 return filename.match(/^(\d{1,20})(?=[\s_.-])/)?.[1];
}

async function readReport(encoded,campaigns,ids,period){
 if(typeof encoded!=='string')throw Error('Ozon вернул неизвестный формат файла отчёта.');
 if(!encoded)return {reports:[],missing:campaigns};
 const bytes=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
 const wanted=new Set(campaigns),byCampaign=new Map(),ambiguous=new Set();
 const accept=(data,idFromName)=>{
  const named=wanted.has(idFromName)?idFromName:undefined;
  const csv=csvRows(data);
  const meta=csv.slice(0,4).flat().find(value=>/^\s*кампания\s/i.test(value??''));
  const idFromMeta=meta?.match(/№\s*(\d{1,20})/)?.[1];
  if(named&&idFromMeta&&named!==idFromMeta)return;
  const id=idFromMeta??named;
  if(!wanted.has(id))return;
  if(byCampaign.has(id)){ambiguous.add(id);return;}
  byCampaign.set(id,csv);
 };
 if(bytes[0]===0x50&&bytes[1]===0x4b){
  const {unzipSync}=await import('./ozon-report-zip.js?v=0.2.422');
  let size=0;
  const archive=unzipSync(bytes,{filter:file=>{
   if(!/\.csv$/i.test(file.name)||file.name.startsWith('__MACOSX/'))return false;
   size+=file.originalSize;
   if(size>archiveLimit)throw Error('Отчёт Ozon слишком большой. Выберите более короткий период.');
   return true;
  }});
  for(const [name,data] of Object.entries(archive)){
   try{accept(data,campaignIdFromName(name));}
   catch{/* A malformed CSV must not hide the other campaigns in the archive. */}
  }
 }else if(campaigns.length===1)accept(bytes,campaigns[0]);
 else throw Error('Ozon не вернул архив с отчётами кампаний.');
 const reports=[],missing=[];
 for(const campaignId of campaigns){
  const csv=byCampaign.get(campaignId);
  if(!csv||ambiguous.has(campaignId)){missing.push(campaignId);continue;}
  try{reports.push(parseOzonPerformanceRows(csv,{...period,ids,campaignId}));}
  catch(error){
   if(campaigns.length===1)throw error;
   missing.push(campaignId);
  }
 }
 return {reports,missing};
}

async function readHistorical(call,job,ids,wait,signal){
 const {campaigns,from,to}=job;
 const {UUID:uuid}=await call('submit',{campaigns,dateFrom:from,dateTo:to});
 if(!uuidPattern.test(uuid))throw Error('Ozon не вернул номер отчёта по кампаниям.');
 for(let attempt=0;attempt<60;attempt++){
  if(attempt)await wait(2000,signal);
  const {state}=await call('status',{uuid});
  if(state==='OK')return readReport(await call('report',{uuid}),campaigns,ids,job);
  if(state==='ERROR')throw Error('Ozon не смог сформировать отчёт по кампаниям. Повторите загрузку или сократите период.');
  if(state!=='IN_PROGRESS'&&state!=='NOT_STARTED')throw Error('Ozon вернул неизвестный статус отчёта.');
 }
 throw Error('Ozon ещё формирует отчёт. Попробуйте загрузить его позже.');
}

async function readRecent(call,job,ids){
 const {campaigns,from,to}=job;
 const {rows}=await call('recent',{campaignIds:campaigns,dateFrom:from,dateTo:to});
 if(!Array.isArray(rows))throw Error('Ozon вернул неизвестный формат оперативной статистики.');
 const byCampaign=new Map(campaigns.map(id=>[id,[]]));
 for(const row of rows)byCampaign.get(String(row?.campaignId))?.push(row);
 return {
  reports:campaigns.map(campaignId=>parseOzonRecentPerformanceRows(byCampaign.get(campaignId),{...job,ids,campaignId})),
  missing:[]
 };
}

export async function loadOzonPerformance(ids,period,credentials,request,{signal,onProgress=()=>{},wait=pause,today}={}){
 const {from,to}=period;
 const days=dateRange(from,to);
 if(validDay(today)&&to>today)throw Error('Дата окончания не может быть позже сегодняшней.');
 if(from<performanceStart)throw Error('Статистика Performance API доступна с 1 февраля 2025 года.');
 if(!credentials.id||!credentials.secret)throw Error('Введите Client ID и Client Secret из настроек Ozon Performance API.');
 const auth=await request('token',credentials);
 if(typeof auth?.access_token!=='string'||!auth.access_token)throw Error('Ozon не вернул токен Performance API.');
 const call=(operation,body)=>{
  signal?.throwIfAborted();
  return request(operation,body,auth.access_token);
 };
 const all=await listCampaigns(call);
 const clickCampaigns=all.filter(isClickCampaign);
 const candidates=clickCampaigns.filter(c=>{
  const created=String(c.createdAt??'').slice(0,10);
  return (!validDay(created)||created<=to)&&
   (c.state!=='CAMPAIGN_STATE_FINISHED'||!validDay(c.toDate)||c.toDate>=from);
 });
 const available=candidates.filter(c=>c.state!=='CAMPAIGN_STATE_ARCHIVED');
 const recentFrom=validDay(today)?shiftDay(today,-1):null;
 const recentDays=recentFrom?days.filter(day=>day>=recentFrom&&day<=today):[];
 const historicalDays=recentFrom?days.filter(day=>day<recentFrom):days;
 const jobs=[];
 if(recentDays.length){
  for(let j=0;j<available.length;j+=10){
   jobs.push({from:recentDays[0],to:recentDays.at(-1),recent:true,campaigns:available.slice(j,j+10).map(c=>c.id)});
  }
 }
 for(let i=0;i<historicalDays.length;i+=62){
  for(let j=0;j<available.length;j+=10){
   jobs.push({from:historicalDays[i],to:historicalDays[Math.min(i+61,historicalDays.length-1)],campaigns:available.slice(j,j+10).map(c=>c.id)});
  }
 }
 const rows=[],unavailable=new Set();
 const lookup={skus:ids,listed:all.length,clickCampaigns:clickCampaigns.length,requested:available.length,productRows:0,matchedRows:0};
 let completed=0,firstError;
 for(const [index,job] of jobs.entries()){
  onProgress(index+1,jobs.length);
  let result;
  if(job.recent){
   try{result=await readRecent(call,job,ids);}
   catch{signal?.throwIfAborted();}
  }
  try{result??=await readHistorical(call,job,ids,wait,signal);}
  catch(error){
   signal?.throwIfAborted();
   firstError??=error;
   for(const id of job.campaigns)unavailable.add(id);
   if([401,403,429].includes(error.status)){
    for(const pending of jobs.slice(index+1))for(const id of pending.campaigns)unavailable.add(id);
    break;
   }
   continue;
  }
  completed++;
  if(result.missing.length&&result.missing.length<job.campaigns.length){
   try{
    const retried=await readHistorical(call,{...job,campaigns:result.missing},ids,wait,signal);
    result={reports:[...result.reports,...retried.reports],missing:retried.missing};
   }catch{signal?.throwIfAborted();}
  }
  for(const id of result.missing)unavailable.add(id);
  for(const report of result.reports){
   lookup.productRows+=report.productRows;
   lookup.matchedRows+=report.matchedRows;
   rows.push(...report.rows);
  }
 }
 if(!completed&&firstError)throw firstError;
 lookup.unavailable=[...unavailable];
 const used=new Set(rows.map(row=>row.campaignId));
 return {
  from,to,client:credentials.id,rows,lookup,
  campaigns:available.filter(c=>used.has(c.id)).map(c=>({id:c.id,title:typeof c.title==='string'?c.title:''})),
  archived:candidates.length-available.length
 };
}
