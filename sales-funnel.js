import {marketRequest,readAllWBCards,redact} from './marketplace-api.js?v=0.2.405';
import {dayKey,validDay} from './ozon-analytics.js?v=0.2.392';

const platformNames={wb:'Wildberries',ozon:'Ozon'};
const figureLabels=[
 ['impressions','Показы в поиске и категории'],
 ['opens','Открыли карточку'],
 ['cart','Добавили в корзину'],
 ['ordered','Заказали, шт.'],
 ['bought','Выкупили, шт.'],
 ['delivered','Доставили, шт.'],
 ['returned','Вернули, шт.']
];
const wbMetrics={opens:'openCount',cart:'cartCount',ordered:'orderCount',bought:'buyoutCount'};
const ozonBasicMetrics={ordered:'ordered_units'};
const ozonExtendedMetrics={...ozonBasicMetrics,impressions:'hits_view_search',opens:'hits_view_pdp',
 cart:'hits_tocart',delivered:'delivered_units',returned:'returns'};
const format=new Intl.NumberFormat('ru-RU');
const dateLabel=day=>day.split('-').reverse().join('.');
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const numericId=value=>/^\d+$/.test(String(value??''))&&Number.isSafeInteger(Number(value))&&Number(value)>0?String(Number(value)):'';
const metric=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;

function waitForOzon(signal){
 return new Promise((resolve,reject)=>{
  signal.throwIfAborted();
  const abort=()=>{clearTimeout(timer);reject(signal.reason);};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},61000);
  signal.addEventListener('abort',abort,{once:true});
 });
}

export async function loadWbFunnel(filters,request){
 let id=numericId(filters.wbId);
 if(!id){
  if(!filters.sku)throw Error('Укажите артикул продавца или номер карточки WB.');
  const ids=new Set((await readAllWBCards(request,filters.sku))
   .filter(card=>card.vendorCode===filters.sku).map(card=>numericId(card.nmID)).filter(Boolean));
  if(ids.size!==1)throw Error(ids.size?'У артикула несколько карточек WB. Укажите нужный номер в «Номера карточек».':'Карточку WB по этому артикулу не нашли. Проверьте артикул или укажите номер карточки.');
  [id]=ids;
 }
 const response=await request('salesFunnel',{
  selectedPeriod:{start:filters.from,end:filters.to},nmIds:[Number(id)],limit:1,offset:0
 });
 const products=response.data?.products;
 if(!Array.isArray(products))throw Error('WB вернул отчёт в неожиданном формате.');
 const row=products.find(entry=>numericId(entry.product?.nmId??entry.product?.nmID)===id)?.statistic?.selected;
 if(row?.period&&(row.period.start!==filters.from||row.period.end!==filters.to)){
  throw Error('WB вернул данные за другие даты. Проверьте выбранный период.');
 }
 return {ids:[id],totals:row?Object.fromEntries(Object.entries(wbMetrics).map(([key,field])=>[key,metric(row[field])])):null,
  note:row?'Показы отсутствуют в стандартной воронке WB. Выкупы относятся к дате заказа.':'WB не вернул показатели для этой карточки за выбранный период.'};
}

async function ozonSkus(filters,request){
 if(filters.ozonIds.length)return filters.ozonIds;
 if(!filters.sku)throw Error('Укажите артикул продавца или SKU Ozon.');
 const result=await request('info',{offer_id:[filters.sku],product_id:[],sku:[]});
 const items=result.items??result.result?.items;
 if(!Array.isArray(items))throw Error('Ozon вернул карточку в неожиданном формате.');
 const ids=[...new Set(items.filter(item=>item.offer_id===filters.sku)
  .flatMap(item=>[item.sku,...(item.sources??[]).map(source=>source.sku)]).map(numericId).filter(Boolean))];
 if(!ids.length)throw Error('SKU Ozon по этому артикулу не нашли. Проверьте артикул или укажите SKU Ozon.');
 return ids;
}

export async function loadOzonFunnel(filters,request,{signal,onProgress=()=>{},pause=waitForOzon}={}){
 const [ids,account]=await Promise.all([ozonSkus(filters,request),request('sellerInfo',{}).catch(()=>null)]);
 signal?.throwIfAborted();
 const tier=account?.subscription?.type??account?.result?.subscription?.type;
 let fields=/^PREMIUM_(PLUS|PRO)$/i.test(tier??'')?ozonExtendedMetrics:ozonBasicMetrics;
 const wanted=new Set(ids),rows=new Map();
 const limit=1000;
 let offset=0, previousPage='';
 while(true){
  signal?.throwIfAborted();
  const metrics=Object.values(fields);
  let data;
  try{
   const response=await request('salesFunnel',{
    date_from:filters.from,date_to:filters.to,dimension:['sku'],metrics,
    filters:ids.length===1?[{key:'sku',op:'EQ',value:ids[0]}]:[],
    sort:[{key:'ordered_units',order:'DESC'}],limit,offset
   });
   data=response.result?.data;
  }catch(error){
   if(fields!==ozonExtendedMetrics||!/deprecated metrics|premium|подписк/i.test(error.message)||
    ![400,403].includes(error.status))throw error;
   fields=ozonBasicMetrics;
   rows.clear();
   offset=0;
   previousPage='';
   onProgress('Ozon запросил другой набор метрик. Загружаем базовые данные с учётом лимита API.');
   await pause(signal);
   continue;
  }
  if(!Array.isArray(data))throw Error('Ozon вернул отчёт в неожиданном формате.');
  for(const entry of data){
   const id=numericId(entry.dimensions?.[0]?.id);
   if(wanted.has(id))rows.set(id,entry.metrics);
  }
  if(data.length<limit||rows.size===wanted.size)break;
  const signature=data.map(entry=>entry.dimensions?.[0]?.id).join(',');
  if(signature===previousPage)throw Error('Ozon повторил страницу. Загрузите отчёт ещё раз.');
  previousPage=signature;
  offset+=limit;
  onProgress('Ожидаем следующую страницу Ozon. API разрешает один запрос в минуту.');
  await pause(signal);
 }
 const totals=rows.size?Object.fromEntries(Object.keys(fields).map((key,index)=>{
  const values=[...rows.values()].map(values=>metric(values?.[index]));
  return [key,values.includes(null)?null:values.reduce((sum,value)=>sum+value,0)];
 })):null;
 const note=fields===ozonExtendedMetrics?'Открытия — просмотры внутри карточки. Доставленные товары показаны отдельно от выкупов WB.':
  account?'Показаны базовые данные. Для показов, просмотров, корзины и доставок нужен Premium Plus или Premium Pro.':
   'Не удалось определить подписку Ozon. Показаны базовые данные.';
 return {ids,totals,note:totals?note:'Ozon не вернул показатели по выбранным SKU за этот период. '+note};
}

function reportMarkup(filters,results){
 const statuses=Object.entries(platformNames).map(([market,name])=>{
  const result=results[market];
  const ids=result.data?.ids;
  return `<div><strong>${name}${ids?.length?'<small> · '+escape(ids.join(', '))+'</small>':''}</strong>
   <p data-funnel-status="${market}">${escape(result.message||result.data?.note||'Получаем данные…')}</p></div>`;
 }).join('');
 return `<p class="analytics-coverage">${filters.sku?`${escape(filters.sku)} · `:''}${dateLabel(filters.from)} — ${dateLabel(filters.to)}</p>
  <div class="funnel-sources" role="status">${statuses}</div>
  <div class="analytics-cluster-results" role="region" aria-label="Воронка товара WB и Ozon" tabindex="0">
   <table class="analytics-cluster-table funnel-table">
    <thead><tr><th scope="col">Показатель</th><th scope="col">WB</th><th scope="col">Ozon</th></tr></thead>
    <tbody>${figureLabels.map(([key,label])=>`<tr><th scope="row">${label}</th>${Object.keys(platformNames).map(market=>{
     const value=results[market].data?.totals?.[key];
     return value==null?'<td><span aria-label="Нет данных">—</span></td>':`<td>${format.format(value)}</td>`;
    }).join('')}</tr>`).join('')}</tbody>
   </table>
  </div>`;
}

export function mountSalesFunnel({root,state={},getCredentials,getProducts=()=>[],onOpenApi,request=marketRequest,now=()=>new Date()}){
 const today=dayKey(now());
 const filters=state.filters??={from:today.slice(0,8)+'01',to:today,sku:'',wbId:'',ozonIds:''};
 const earliest=dayKey(new Date(Date.parse(today+'T12:00:00Z')-364*86400000));
 let controller,disposed=false;
 root.innerHTML=`<section class="panel ozon-analytics">
  <div class="analytics-heading"><h1>Воронка</h1><button type="button" data-funnel-access>Настроить доступ API</button></div>
  <form class="analytics-controls funnel-controls">
   <label class="funnel-sku">Артикул продавца<input name="sku" type="search" value="${escape(filters.sku)}" list="funnel-sku-options" placeholder="Найти товар по артикулу" autocomplete="off"></label>
   <datalist id="funnel-sku-options"></datalist>
   <label>С даты<input name="from" type="date" value="${escape(filters.from)}" min="${earliest}" max="${today}" required></label>
   <label>По дату<input name="to" type="date" value="${escape(filters.to)}" min="${earliest}" max="${today}" required></label>
   <div class="funnel-actions"><button type="submit" class="primary">Загрузить WB и Ozon</button><button type="button" data-funnel-stop hidden>Стоп</button></div>
   <details class="funnel-card-ids" ${filters.wbId||filters.ozonIds?'open':''}>
    <summary>Номера карточек</summary>
    <p class="analytics-coverage">Оставьте пустыми, чтобы найти карточки по артикулу продавца.</p>
    <div><label>Номер карточки WB<input name="wbId" inputmode="numeric" value="${escape(filters.wbId)}" placeholder="Артикул WB"></label>
     <label>SKU Ozon<input name="ozonIds" value="${escape(filters.ozonIds)}" placeholder="При необходимости через запятую"></label></div>
   </details>
  </form>
  <p class="analytics-status" role="status"></p>
  <div data-funnel-results></div>
 </section>`;
 const form=root.querySelector('form'),result=root.querySelector('[data-funnel-results]');
 const status=root.querySelector('.analytics-status'),stop=root.querySelector('[data-funnel-stop]');
 const controls=[...form.querySelectorAll('input,button[type="submit"]')];
 const filterNames=['from','to','sku','wbId','ozonIds'];
 const remember=()=>{for(const name of filterNames)filters[name]=form.elements.namedItem(name).value.trim();};
 const identity=credentials=>[credentials.wbToken,credentials.ozonClient,credentials.ozonKey].join('\u0000');
 const filterKey=()=>JSON.stringify(filters);
 const articles=new Map(getProducts().filter(product=>product.sku?.trim()).map(product=>[product.sku.trim(),product.name]));
 root.querySelector('datalist').innerHTML=[...articles].sort(([a],[b])=>a.localeCompare(b,'ru',{numeric:true}))
  .map(([sku,name])=>`<option value="${escape(sku)}" label="${escape(name)}"></option>`).join('');

 function draw(){
  const report=state.report;
  result.innerHTML=report?.key===filterKey()&&report.account===identity(getCredentials())?
   reportMarkup(filters,report.results):
   '<p class="analytics-empty">Выберите артикул и период, затем загрузите данные.</p>';
 }
 form.oninput=()=>{if(controller)return;remember();status.textContent='';draw();};
 root.querySelector('[data-funnel-access]').onclick=onOpenApi;
 stop.onclick=()=>controller?.abort();

 form.onsubmit=async event=>{
  event.preventDefault();
  if(controller)return;
  remember();
  const {from,to,sku,wbId,ozonIds}=filters;
  const ids=[...new Set(ozonIds.split(/[\s,]+/).filter(Boolean))];
  if(!validDay(from)||!validDay(to)||from>to||from<earliest||to>dayKey(now())){
   status.textContent='Укажите даты в пределах последних 365 дней.';return;
  }
  if((wbId&&!numericId(wbId))||ids.some(id=>!numericId(id))){
   status.textContent='Номер WB и SKU Ozon должны состоять из цифр.';return;
  }
  if(!sku&&!wbId&&!ids.length){status.textContent='Укажите артикул продавца или номер карточки.';return;}
  const selection={from,to,sku,wbId,ozonIds:[...new Set(ids.map(numericId))]};
  const credentials=getCredentials(),account=identity(credentials);
  controller=new AbortController();
  const {signal}=controller;
  const report={key:filterKey(),account,results:{wb:{},ozon:{}}};
  state.report=report;
  controls.forEach(control=>control.disabled=true);
  stop.hidden=false;
  status.textContent='';
  draw();
  const call=market=>(operation,body)=>{
   signal.throwIfAborted();
   return request(market,operation,credentials,body,(url,options)=>fetch(url,{
    ...options,signal:AbortSignal.any([signal,options.signal].filter(Boolean))
   }));
  };
  async function load(market,loader,enabled){
   const entry=report.results[market];
   try{
    if(!enabled)throw Error('Добавьте ключ в разделе «API и доступы».');
    entry.data=await loader(call(market),message=>{entry.message=message;if(!disposed&&!signal.aborted)draw();});
    signal.throwIfAborted();
    entry.message='';
   }catch(error){
    if(signal.aborted)delete entry.data;
    entry.message=signal.aborted?'Загрузка остановлена.':redact(error.message,credentials);
   }
   if(!disposed)draw();
  }
  try{
   await Promise.all([
    load('wb',request=>loadWbFunnel(selection,request),credentials.wbToken),
    load('ozon',(request,onProgress)=>loadOzonFunnel(selection,request,{signal,onProgress}),credentials.ozonClient&&credentials.ozonKey)
   ]);
  }finally{
   controller=null;
   if(!disposed){controls.forEach(control=>control.disabled=false);stop.hidden=true;}
  }
 };
 draw();
 return ()=>{disposed=true;controller?.abort();};
}
