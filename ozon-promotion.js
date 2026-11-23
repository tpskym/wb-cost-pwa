import {dateRange,dayKey,validDay} from './ozon-analytics.js?v=0.2.392';

const dayMs=86400000;
export const shiftDay=(day,days)=>new Date(Date.parse(day)+days*dayMs).toISOString().slice(0,10);
const skuId=value=>(typeof value!=='number'||Number.isSafeInteger(value))&&/^\d{1,20}$/.test(String(value??'').trim())?String(value).trim():'';
const noteTime=value=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export const promotionNoteLimit=1200;
export const queryTextLimit=20000;

export function readQueryPhrases(text){
 if(text.length>queryTextLimit)throw Error('Список фраз слишком длинный.');
 const phrases=new Map();
 for(const line of text.split(/\r?\n/)){
  const phrase=line.trim();
  const normalized=phrase.toLocaleLowerCase('ru-RU');
  if(phrase&&!phrases.has(normalized))phrases.set(normalized,phrase);
 }
 if(!phrases.size)throw Error('Вставьте хотя бы одну поисковую фразу.');
 return [...phrases.values()];
}

function numberValue(value){
 const text=String(value??'').trim().replace(/[\s\u00a0\u202f₽]/g,'').replace(',','.');
 if(!/^\d+(?:\.\d+)?$/.test(text))return null;
 const result=Number(text);
 return Number.isFinite(result)?result:null;
}

function analyticsDay(value){
 if(typeof value!=='string')return null;
 const text=value.trim().replace(/^(\d{2})\.(\d{2})\.(\d{4})$/,'$3-$2-$1');
 const match=text.match(/^(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/i);
 const date=match?.[1];
 if(!validDay(date)||date<'2022-01-01')return null;
 if(!match[2])return date;
 return Number.isFinite(Date.parse(text))?dayKey(new Date(text)):null;
}

export async function loadOzonQueries(ids,{from,to},request,{sortBy='BY_SEARCHES'}={}){
 const queries=new Map(),wanted=new Set(ids);
 const period={from:null,to:null};
 const pageSize=100,perSku=15;
 const maxPages=Math.ceil(ids.length*perSku/pageSize);
 for(let page=0;page<maxPages;page++){
  const result=await request('productQueries',{
   skus:ids, page, page_size:pageSize, limit_by_sku:perSku,
   date_from:from+'T00:00:00.000+03:00',
   ...(to?{date_to:to+'T23:59:59.999+03:00'}:{}),
   sort_by:sortBy,sort_dir:'DESCENDING'
  });
  if(!Array.isArray(result.queries))throw Error('Ozon вернул поисковые запросы в неожиданном формате.');
  const dates=result.analytics_period??result.analyticsPeriod;
  const actualFrom=analyticsDay(dates?.date_from??dates?.dateFrom),actualTo=analyticsDay(dates?.date_to??dates?.dateTo);
  if((actualFrom&&period.from&&actualFrom!==period.from)||(actualTo&&period.to&&actualTo!==period.to)){
   throw Error('Ozon вернул разные периоды на страницах отчёта.');
  }
  period.from??=actualFrom;
  period.to??=actualTo;
  if(period.from&&period.to&&period.from>period.to)throw Error('Ozon вернул некорректные даты отчёта.');
  for(const entry of result.queries){
   const sku=skuId(entry?.sku),query=typeof entry?.query==='string'?entry.query.trim():'';
   if(!wanted.has(sku)||!query)continue;
   const sales=numberValue(entry.gmv),count=numberValue(entry.order_count);
   const orders=Number.isSafeInteger(count)?count:null;
   queries.set(JSON.stringify([sku,query]),{
    sku,query,searches:numberValue(entry.unique_search_users),views:numberValue(entry.unique_view_users),
    position:numberValue(entry.position),orders:orders===0&&sales>0?null:orders,
    sales,currency:['RUB','RUR'].includes(entry.currency)?'₽':String(entry.currency??'')
   });
  }
  if(result.queries.length<pageSize||page+1>=Number(result.page_count))break;
 }
 const rows=[...queries.values()].sort((a,b)=>(b.searches??-1)-(a.searches??-1)||a.query.localeCompare(b.query,'ru'));
 return {period,requestedPeriod:{from,to},ids,rows};
}

export const recentQueryPeriod=today=>({from:shiftDay(today,-7),to:shiftDay(today,-1)});
const subscriptionError=error=>error.status===403&&/premium subscription|подписк[а-яё]*\s+premium/i.test(error.message);

export async function loadRecentOzonQueries(ids,today,request){
 let interval=recentQueryPeriod(today),result;
 try{result=await loadOzonQueries(ids,interval,request);}
 catch(error){
  if(!subscriptionError(error))throw error;
  // Give Ozon the start day and let the API choose its weekly interval.
  interval={from:interval.from};
  try{result=await loadOzonQueries(ids,interval,request);}
  catch(weeklyError){
   if(subscriptionError(weeklyError)||weeklyError.status===400)return null;
   throw weeklyError;
  }
 }
 const unresolved=result.rows.filter(row=>row.orders===null&&row.sales>0);
 if(!unresolved.length)return result;
 // Recheck positive sales in Ozon's report sorted by revenue. Keep the original
 // period, SKU and query together when recovering a count.
 const skus=[...new Set(unresolved.map(row=>row.sku))];
 const bySales=await loadOzonQueries(skus,interval,request,{sortBy:'BY_GMV'}).catch(()=>null);
 if(!bySales||bySales.period.from!==result.period.from||bySales.period.to!==result.period.to)return result;
 const byQuery=new Map(bySales.rows.map(row=>[JSON.stringify([row.sku,row.query]),row]));
 for(const row of unresolved){
  const match=byQuery.get(JSON.stringify([row.sku,row.query]));
  if(match?.orders>0&&match.sales===row.sales&&match.currency===row.currency)row.orders=match.orders;
 }
 return result;
}

const fields={
 views:/^показы(?: |$)/,clicks:/^клики(?: |$)/,cart:/^(?:в корзину|добавления? в корзину)(?: |$)/,
 expense:/^(?:расход(?:ы)?|затраты)(?: |$)/,orders:/^заказы(?: шт)?$/,
 sales:/^(?:продажи|выручка)(?: (?:₽|руб|р|с рекламы))*$/,
 modelOrders:/^заказы модел[ьи](?: шт)?$/,modelSales:/^(?:продажи с заказов модели|выручка с заказов модели|продажи модели)(?: |$)/,
 totalSales:/^(?:заказано на сумму|общие продажи)(?: |$)/
};
const fieldKeys=Object.keys(fields);
const countFields=new Set(['views','clicks','cart','orders','modelOrders']);
const headerKey=value=>String(value??'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^а-яa-z0-9₽]+/g,' ').trim();
const headerIndex=(headers,pattern)=>headers.findIndex(value=>pattern.test(value));
const datePattern=/\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}/g;
const skuHeader=/^(?:sku(?: ozon| товара)?|ozon id|артикул ozon)$/;

function dayFromCell(value){
 const text=String(value??'').trim();
 const day=analyticsDay(text);
 if(day)return day;
 const dates=text.match(datePattern)?.map(analyticsDay);
 return dates?.length&&dates[0]&&dates.every(date=>date===dates[0])?dates[0]:null;
}

function sumMetrics(entries){
 return Object.fromEntries(fieldKeys.map(key=>[key,entries.every(row=>row[key]!==null)?
  entries.reduce((sum,row)=>sum+row[key],0):null]));
}

export function parseOzonPerformanceRows(report,{ids,campaignId,from,to}){
 const wanted=new Set(ids),rows=new Map();
 let productRows=0,matchedRows=0;
 const headerRow=report.findIndex(row=>{
  const headers=row.map(headerKey);
  return headers.some(key=>skuHeader.test(key))&&
   headers.some(key=>fields.views.test(key)||fields.clicks.test(key))&&headers.some(key=>fields.expense.test(key));
 });
 if(headerRow<0)throw Error('Ozon вернул неизвестный формат статистики «Оплата за клик».');
 const headers=report[headerRow].map(headerKey);
 const skuIndex=headerIndex(headers,skuHeader);
 const dateIndex=headerIndex(headers,/^(?:дата|день|период|дата статистики|дата отчета|date)$/);
 const columns=Object.fromEntries(fieldKeys.map(key=>[key,headerIndex(headers,fields[key])]));
 for(const row of report.slice(headerRow+1)){
  const sku=skuId(row[skuIndex]);
  if(!sku)continue;
  productRows++;
  if(!wanted.has(sku))continue;
  matchedRows++;
  const day=dateIndex<0&&from===to?from:dayFromCell(row[dateIndex]);
  if(!day||day<from||day>to)throw Error('Даты в отчёте Ozon не совпали с запрошенным периодом.');
  const metrics=Object.fromEntries(fieldKeys.map(key=>{
   const value=numberValue(row[columns[key]]);
   return [key,countFields.has(key)&&!Number.isSafeInteger(value)?null:value];
  }));
  if(!Object.values(metrics).some(value=>value!==null))continue;
  if(!rows.has(day))rows.set(day,[]);
  rows.get(day).push(metrics);
 }
 return {productRows,matchedRows,rows:[...rows].map(([day,entries])=>({campaignId,day,...sumMetrics(entries)}))};
}

export function promotionDays(rows,from,to,campaign=''){
 const grouped=new Map();
 for(const row of rows){
  if(row.day<from||row.day>to||campaign&&row.campaignId!==campaign)continue;
  if(!grouped.has(row.day))grouped.set(row.day,[]);
  grouped.get(row.day).push(row);
 }
 return dateRange(from,to).map(day=>{
  const entries=grouped.get(day);
  return {day,metrics:entries?sumMetrics(entries):null};
 });
}

export function validateOzonPromotion(state){
 if(state===undefined)return;
 const invalid=()=>{throw Error('Повреждены данные отчёта «Поиск и продвижение Ozon».');};
 if(!state||!Array.isArray(state.products))invalid();
 const ids=new Set();
 for(const product of state.products){
  if(!product||typeof product.id!=='string'||!product.id||ids.has(product.id)||
   !Array.isArray(product.notes)||!Array.isArray(product.rows))invalid();
  ids.add(product.id);
  if(product.queryLists!==undefined){
   if(!Array.isArray(product.queryLists))invalid();
   const periods=new Set();
   for(const list of product.queryLists){
    if(!list||!validDay(list.from)||!validDay(list.to)||list.from>list.to||
     !Array.isArray(list.phrases)||!list.phrases.length||list.phrases.some(phrase=>typeof phrase!=='string'||!phrase.trim()||/[\r\n]/.test(phrase))||
     list.phrases.join('\n').length>queryTextLimit)invalid();
    const key=list.from+'/'+list.to;
    if(periods.has(key))invalid();
    periods.add(key);
   }
  }
  const days=new Set();
  for(const note of product.notes){
   if(!note||!validDay(note.day)||days.has(note.day)||typeof note.text!=='string'||!note.text.trim()||
    note.text.length>promotionNoteLimit||!(note.time===''||typeof note.time==='string'&&noteTime(note.time)))invalid();
   days.add(note.day);
  }
  validateRows(product.rows);
  if(product.performance!==undefined){
   const report=product.performance;
   if(!report||!validDay(report.from)||!validDay(report.to)||report.from>report.to||
    typeof report.client!=='string'||!report.client||!Array.isArray(report.rows)||!Array.isArray(report.campaigns)||
    !Number.isSafeInteger(report.archived)||report.archived<0||
    report.campaigns.some(c=>!c||typeof c.id!=='string'||!skuId(c.id)||typeof c.title!=='string'))invalid();
   if(report.lookup!==undefined){
    const lookup=report.lookup;
    if(!lookup||!Array.isArray(lookup.skus)||!lookup.skus.length||lookup.skus.some(sku=>typeof sku!=='string'||!skuId(sku))||
     ['listed','clickCampaigns','requested','productRows','matchedRows'].some(key=>!Number.isSafeInteger(lookup[key])||lookup[key]<0))invalid();
   }
   validateRows(report.rows,report);
  }
 }
 function validateRows(rows,period){
  const campaignDays=new Set();
  for(const row of rows){
   if(!row||typeof row.campaignId!=='string'||!skuId(row.campaignId)||!validDay(row.day)||
    (period&&(row.day<period.from||row.day>period.to))||
    !fieldKeys.every(key=>row[key]===null||Number.isFinite(row[key])&&row[key]>=0))invalid();
   const key=JSON.stringify([row.campaignId,row.day]);
   if(campaignDays.has(key))invalid();
   campaignDays.add(key);
  }
 }
}
