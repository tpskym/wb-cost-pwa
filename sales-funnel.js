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

function sumMetrics(values){
 const counts=values.map(metric);
 return counts.includes(null)?null:counts.reduce((sum,value)=>sum+value,0);
}

export async function loadWbFunnel(filters,request,{onCards=()=>{}}={}){
 const ids=[...new Set((await readAllWBCards(request,filters.sku))
  .filter(card=>card.vendorCode===filters.sku).map(card=>numericId(card.nmID)).filter(Boolean))];
 if(!ids.length)throw Error('Карточку WB по артикулу «'+filters.sku+'» не нашли.');
 onCards(ids);
 const response=await request('salesFunnel',{
  selectedPeriod:{start:filters.from,end:filters.to},nmIds:ids.map(Number),limit:ids.length,offset:0
 });
 const products=response.data?.products;
 if(!Array.isArray(products))throw Error('WB вернул отчёт в неожиданном формате.');
 const byId=new Map(products.map(entry=>[numericId(entry.product?.nmId??entry.product?.nmID),entry.statistic?.selected]));
 const rows=ids.map(id=>byId.get(id));
 if(rows.some(row=>row?.period&&(row.period.start!==filters.from||row.period.end!==filters.to))){
  throw Error('WB вернул данные за другие даты. Проверьте выбранный период.');
 }
 const totals=rows.every(Boolean)?Object.fromEntries(Object.entries(wbMetrics)
  .map(([key,field])=>[key,sumMetrics(rows.map(row=>row[field]))])):null;
 return {ids,totals,note:totals?'Стандартная воронка WB начинается с открытий. Выкупы относятся к дате заказа.':
  'WB не вернул полный отчёт по найденным карточкам за выбранный период.'};
}

async function ozonSkus(sku,request){
 const result=await request('info',{offer_id:[sku],product_id:[],sku:[]});
 const items=result.items??result.result?.items;
 if(!Array.isArray(items))throw Error('Ozon вернул карточку в неожиданном формате.');
 const ids=[...new Set(items.filter(item=>item.offer_id===sku)
  .flatMap(item=>[item.sku,...(item.sources??[]).map(source=>source.sku)]).map(numericId).filter(Boolean))];
 if(!ids.length)throw Error('Карточку Ozon по артикулу «'+sku+'» не нашли.');
 return ids;
}

export async function loadOzonFunnel(filters,request,{signal,onCards=()=>{},onProgress=()=>{},pause=waitForOzon}={}){
 const cards=ozonSkus(filters.sku,request).then(ids=>{signal?.throwIfAborted();onCards(ids);return ids;});
 const [ids,account]=await Promise.all([cards,request('sellerInfo',{}).catch(()=>null)]);
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
 const totals=rows.size?Object.fromEntries(Object.keys(fields).map((key,index)=>
  [key,sumMetrics([...rows.values()].map(values=>values?.[index]))])):null;
 const note=fields===ozonExtendedMetrics?'Открытия — просмотры внутри карточки. Доставленные товары показаны отдельно от выкупов WB.':
  account?'Показаны базовые данные. Для показов, просмотров, корзины и доставок нужен Premium Plus или Premium Pro.':
   'Не удалось определить подписку Ozon. Показаны базовые данные.';
 return {ids,totals,note:totals?note:'Ozon не вернул показатели по выбранным SKU за этот период. '+note};
}

function reportMarkup(filters,results){
 const statuses=Object.entries(platformNames).map(([market,name])=>{
  const result=results[market];
  const ids=result.ids;
  return `<div><strong>${name}${ids?.length?'<small data-funnel-ids="'+market+'"> · '+(market==='wb'?'№ ':'SKU ')+escape(ids.join(', '))+'</small>':''}</strong>
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

function openFunnelProductPicker({button,products,selectedId,hydrateProductImages,onSelect}){
 const doc=button.ownerDocument;
 const groups=new Map();
 for(const product of products){
  const group=product.productGroup?.trim()||'';
  if(!groups.has(group))groups.set(group,[]);
  groups.get(group).push(product);
 }
 const dialog=doc.createElement('dialog');
 dialog.className='marketplace-profit-picker funnel-product-picker';
 dialog.setAttribute('aria-labelledby','funnel-product-picker-title');
 dialog.innerHTML=`<form method="dialog">
  <div class="modal-head"><h2 id="funnel-product-picker-title">Выберите товар</h2></div>
  <input type="search" aria-label="Найти товар" placeholder="Название, артикул, вариант или группа" autofocus>
  <div class="marketplace-profit-targets">${[...groups].map(([group,items])=>`<fieldset>
   <legend>${escape(group||'Без группы')} · ${items.length}</legend>
   ${items.map(product=>`<label>
    <input type="radio" name="target" value="${escape(product.id)}" ${product.id===selectedId?'checked':''}>
    <img data-product-image="${escape(product.id)}" alt="" hidden>
    <span><strong>${escape(product.sku)}</strong><small>${escape([product.name,product.variantNote].filter(Boolean).join(' · '))}</small></span>
   </label>`).join('')}
  </fieldset>`).join('')}</div>
  <p data-funnel-product-empty role="status" hidden>Товары не найдены.</p>
  <div class="sync-actions"><button type="submit" class="primary">Выбрать товар</button><button type="button">Отмена</button></div>
 </form>`;
 const form=dialog.querySelector('form');
 const search=form.querySelector('input[type="search"]');
 const apply=form.querySelector('button[type="submit"]');
 const empty=form.querySelector('[data-funnel-product-empty]');
 const groupFields=[...form.querySelectorAll('fieldset')];
 const selected=()=>form.querySelector('label:not([hidden]) input[name="target"]:checked');
 const updateSelection=()=>{apply.disabled=!selected();};
 search.oninput=()=>{
  const terms=search.value.trim().toLocaleLowerCase('ru-RU').split(/\s+/).filter(Boolean);
  for(const group of groupFields){
   const groupName=group.querySelector('legend').textContent.toLocaleLowerCase('ru-RU');
   const rows=[...group.querySelectorAll('label')];
   for(const row of rows){
    const text=(row.textContent+' '+groupName).toLocaleLowerCase('ru-RU');
    row.hidden=!terms.every(term=>text.includes(term));
   }
   group.hidden=rows.every(row=>row.hidden);
  }
  empty.hidden=groupFields.some(group=>!group.hidden);
  updateSelection();
 };
 form.onchange=updateSelection;
 form.onsubmit=event=>{
  event.preventDefault();
  const choice=selected();
  if(!choice)return;
  onSelect(choice.value);
  dialog.close();
 };
 form.querySelector('button[type="button"]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{dialog.remove();if(button.isConnected)button.focus();},{once:true});
 updateSelection();
 doc.body.append(dialog);
 dialog.showModal();
 hydrateProductImages(dialog);
 return dialog;
}

export function mountSalesFunnel({root,state={},getCredentials,getProducts=()=>[],getSelectedProductId=()=>'',hydrateProductImages=()=>{},onOpenApi,request=marketRequest,now=()=>new Date()}){
 const today=dayKey(now());
 const filters=state.filters??={from:today.slice(0,8)+'01',to:today,productId:''};
 const products=getProducts().filter(product=>product.sku?.trim());
 const byId=new Map(products.map(product=>[product.id,product]));
 const selectedId=getSelectedProductId();
 if(!byId.has(filters.productId))filters.productId=byId.has(selectedId)?selectedId:'';
 const title=product=>[product.name,product.variantNote,product.sku.trim()].filter(Boolean).join(' · ');
 const earliest=dayKey(new Date(Date.parse(today+'T12:00:00Z')-364*86400000));
 let controller,productDialog,disposed=false;
 root.innerHTML=`<section class="panel ozon-analytics">
  <div class="analytics-heading"><h1>Воронка</h1><button type="button" data-funnel-access>Настроить доступ API</button></div>
  <form class="analytics-controls funnel-controls">
   <div class="funnel-product"><span id="funnel-product-label">Товар из «Себестоимости»</span>
    <button type="button" class="ui-select" aria-haspopup="dialog" aria-labelledby="funnel-product-label funnel-product-name" data-funnel-product ${products.length?'':'disabled'}><span id="funnel-product-name"></span></button>
   </div>
   <label>С даты<input name="from" type="date" value="${escape(filters.from)}" min="${earliest}" max="${today}" required></label>
   <label>По дату<input name="to" type="date" value="${escape(filters.to)}" min="${earliest}" max="${today}" required></label>
   <div class="funnel-actions"><button type="submit" class="primary" ${products.length?'':'disabled'}>Загрузить WB и Ozon</button><button type="button" data-funnel-stop hidden>Стоп</button></div>
  </form>
  <p class="analytics-status" role="status"></p>
  <div data-funnel-results></div>
 </section>`;
 const form=root.querySelector('form'),result=root.querySelector('[data-funnel-results]');
 const status=root.querySelector('.analytics-status'),stop=root.querySelector('[data-funnel-stop]');
 const productButton=form.querySelector('[data-funnel-product]');
 const productName=productButton.querySelector('span');
 const controls=[...form.querySelectorAll('input,button[type="submit"]'),productButton];
 const filterNames=['from','to'];
 const remember=()=>{for(const name of filterNames)filters[name]=form.elements.namedItem(name).value;};
 const identity=credentials=>[credentials.wbToken,credentials.ozonClient,credentials.ozonKey].join('\u0000');
 const selectedSku=()=>byId.get(filters.productId)?.sku.trim()||'';
 const filterKey=()=>JSON.stringify([filters.productId,selectedSku(),filters.from,filters.to]);

 function draw(){
  const product=byId.get(filters.productId);
  productName.textContent=product?title(product):'Выбрать товар';
  productButton.title=product?title(product):'';
  const report=state.report;
  result.innerHTML=report?.key===filterKey()&&report.account===identity(getCredentials())?
   reportMarkup({...filters,sku:selectedSku()},report.results):
   `<p class="analytics-empty">${products.length?'Выберите товар и период. Найдём карточки WB и Ozon по его артикулу.':
    'Добавьте артикул хотя бы одному товару в «Себестоимости».'}</p>`;
 }
 form.oninput=()=>{if(controller)return;remember();status.textContent='';draw();};
 productButton.onclick=()=>{
  if(productDialog?.open)return;
  productDialog=openFunnelProductPicker({button:productButton,products,selectedId:filters.productId,hydrateProductImages,onSelect:id=>{
   filters.productId=id;
   status.textContent='';
   draw();
  }});
 };
 root.querySelector('[data-funnel-access]').onclick=onOpenApi;
 stop.onclick=()=>controller?.abort();

 form.onsubmit=async event=>{
  event.preventDefault();
  if(controller)return;
  remember();
  const {from,to}=filters,sku=selectedSku();
  if(!validDay(from)||!validDay(to)||from>to||from<earliest||to>dayKey(now())){
   status.textContent='Укажите даты в пределах последних 365 дней.';return;
  }
  if(!sku){status.textContent='Выберите товар из «Себестоимости».';return;}
  const selection={from,to,sku};
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
    const onCards=ids=>{
     signal.throwIfAborted();
     entry.ids=ids;
     if(!disposed)draw();
    };
    const onProgress=message=>{entry.message=message;if(!disposed&&!signal.aborted)draw();};
    entry.data=await loader(selection,call(market),{signal,onCards,onProgress});
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
    load('wb',loadWbFunnel,credentials.wbToken),
    load('ozon',loadOzonFunnel,credentials.ozonClient&&credentials.ozonKey)
   ]);
  }finally{
   controller=null;
   if(!disposed){controls.forEach(control=>control.disabled=false);stop.hidden=true;}
  }
 };
 draw();
 return ()=>{disposed=true;controller?.abort();productDialog?.remove();};
}
