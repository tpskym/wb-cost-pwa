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
 if(validDay(value))return value;
 return typeof value==='string'&&Number.isFinite(Date.parse(value))?dayKey(new Date(value)):'';
}

export async function loadOzonQueries(ids,{from,to},request){
 const queries=new Map(),wanted=new Set(ids);
 let period;
 const pageSize=100,perSku=15;
 const maxPages=Math.ceil(ids.length*perSku/pageSize);
 for(let page=0;page<maxPages;page++){
  const result=await request('productQueries',{
   skus:ids, page, page_size:pageSize, limit_by_sku:perSku,
   date_from:from+'T00:00:00.000+03:00',
   ...(to?{date_to:to+'T23:59:59.999+03:00'}:{}),
   sort_by:'BY_SEARCHES',sort_dir:'DESCENDING'
  });
  if(!Array.isArray(result.queries))throw Error('Ozon вернул поисковые запросы в неожиданном формате.');
  const dates=result.analytics_period;
  const actualFrom=analyticsDay(dates?.date_from),actualTo=analyticsDay(dates?.date_to);
  if(actualFrom&&actualTo&&actualFrom<=actualTo)period={from:actualFrom,to:actualTo};
  for(const entry of result.queries){
   const sku=skuId(entry?.sku),query=typeof entry?.query==='string'?entry.query.trim():'';
   if(!wanted.has(sku)||!query)continue;
   queries.set(JSON.stringify([sku,query]),{
    sku,query,searches:numberValue(entry.unique_search_users),views:numberValue(entry.unique_view_users),
    position:numberValue(entry.position),orders:numberValue(entry.order_count),
    sales:numberValue(entry.gmv),currency:['RUB','RUR'].includes(entry.currency)?'₽':String(entry.currency??'')
   });
  }
  if(result.queries.length<pageSize||page+1>=Number(result.page_count))break;
 }
 const rows=[...queries.values()].sort((a,b)=>(b.searches??-1)-(a.searches??-1)||a.query.localeCompare(b.query,'ru'));
 return {period:period??{from,to},rows};
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

function sheetDate(value){
 if(value instanceof Date)return Number.isFinite(value.getTime())?value.toISOString().slice(0,10):'';
 if(Number.isInteger(value)&&value>=44562&&value<=2958465)return shiftDay('1899-12-30',value);
 const text=String(value??'').trim();
 const date=text.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/)?.[1]??text.match(/^\d{2}\.\d{2}\.\d{4}$/)?.[0].split('.').reverse().join('-');
 return validDay(date)?date:'';
}

function dayFromCell(value){
 const day=sheetDate(value);
 if(day)return day;
 const dates=(typeof value==='string'?value.match(datePattern):null)?.map(sheetDate);
 return dates?.length&&dates[0]&&dates.every(day=>day===dates[0])?dates[0]:'';
}

function sumMetrics(entries){
 return Object.fromEntries(fieldKeys.map(key=>[key,entries.every(row=>row[key]!==null)?
  entries.reduce((sum,row)=>sum+row[key],0):null]));
}

export function parseOzonPromotion(sheets,{article,ids=[],campaignOverride='',filename=''}){
 const reportCampaigns=new Set();
 const rows=new Map(),reportedDays=new Set();
 let hasHeader=false,hasDailyData=false;
 for(const sheet of sheets){
  const sheetRows=sheet.rows;
  const headerRow=sheetRows.findIndex(row=>{
   const headers=row.map(headerKey);
   return headers.some(key=>/^(?:sku|sku ozon|ozon id|артикул ozon|артикул|артикул продавца)$/.test(key))&&
    headers.some(key=>fields.views.test(key)||fields.clicks.test(key))&&headers.some(key=>fields.expense.test(key));
  });
  if(headerRow<0)continue;
  hasHeader=true;
  const metadata=sheetRows.slice(0,headerRow).flat().filter(value=>typeof value==='string').join(' ');
  const campaign=(metadata+' '+filename).match(/(?:кампани[^\d№]{0,45}(?:№|#)?\s*|(?:^|\s)№\s*)(\d{3,20})/i)?.[1];
  if(campaign)reportCampaigns.add(campaign);
  const periodText=metadata.match(/(?:период|дата отч[её]та)\s*[:с]?\s*(.*)/i)?.[1]??'';
  const period=(periodText.match(datePattern)||[]).map(sheetDate).filter(Boolean);
  const singleDay=period.length&&period.every(day=>day===period[0])?period[0]:'';
  const headers=sheetRows[headerRow].map(headerKey);
  const skuIndex=headerIndex(headers,/^(?:sku(?: ozon)?|ozon id|артикул ozon)$/);
  const articleIndex=headerIndex(headers,/^артикул(?: продавца)?$/);
  const dateIndex=headerIndex(headers,/^(?:дата|день|период|дата статистики|дата отчета)$/);
  const columns=Object.fromEntries(fieldKeys.map(key=>[key,headerIndex(headers,fields[key])]));
  for(const row of sheetRows.slice(headerRow+1)){
   const sku=skuId(row[skuIndex]);
   const rowArticle=String(row[articleIndex]??'').trim();
   if(!sku&&(!rowArticle||/^(?:итого|всего|total)(?:\s|$)/i.test(rowArticle)))continue;
   const day=dayFromCell(row[dateIndex])||singleDay||sheetDate(sheet.name);
   if(!day)continue;
   hasDailyData=true;
   reportedDays.add(day);
   if(!ids.includes(sku)&&rowArticle!==article)continue;
   const metrics=Object.fromEntries(fieldKeys.map(key=>{
    const value=numberValue(row[columns[key]]);
    return [key,countFields.has(key)&&!Number.isSafeInteger(value)?null:value];
   }));
   if(!Object.values(metrics).some(value=>value!==null))continue;
   if(!rows.has(day))rows.set(day,[]);
   rows.get(day).push(metrics);
  }
 }
 if(!hasHeader)throw Error('В файле нет статистики товара из отчёта «Оплата за клик».');
 if(!hasDailyData)throw Error('В файле не нашлись даты статистики. При скачивании отчёта Ozon выберите группировку «По дням».');
 if(!rows.size){
  const error=Error('В отчёте нет строк по артикулу или SKU выбранного товара.');
  error.code='OZON_PRODUCT_NOT_FOUND';
  throw error;
 }
 if(reportCampaigns.size>1)throw Error('Загрузите отдельный XLSX для каждой кампании.');
 const campaign=[...reportCampaigns][0];
 if(campaign&&campaignOverride&&campaign!==campaignOverride)throw Error('Номер кампании в файле отличается от введённого номера.');
 const campaignId=campaign||campaignOverride;
 if(!skuId(campaignId))throw Error('Укажите номер кампании Ozon, чтобы повторный импорт не задвоил показатели.');
 return {campaignId,reportedDays,rows:[...rows].map(([day,entries])=>({campaignId,day,...sumMetrics(entries)}))};
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
  const days=new Set(),campaignDays=new Set();
  for(const note of product.notes){
   if(!note||!validDay(note.day)||days.has(note.day)||typeof note.text!=='string'||!note.text.trim()||
    note.text.length>promotionNoteLimit||!(note.time===''||typeof note.time==='string'&&noteTime(note.time)))invalid();
   days.add(note.day);
  }
  for(const row of product.rows){
   if(!row||typeof row.campaignId!=='string'||!skuId(row.campaignId)||!validDay(row.day)||
    !fieldKeys.every(key=>row[key]===null||Number.isFinite(row[key])&&row[key]>=0))invalid();
   const key=JSON.stringify([row.campaignId,row.day]);
   if(campaignDays.has(key))invalid();
   campaignDays.add(key);
  }
 }
}
