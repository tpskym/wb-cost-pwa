import {dayKey,validDay} from './ozon-analytics.js?v=0.2.392';
import {orderRequest,readOzonPostingPages} from './marketplace-orders.js?v=0.2.395';

const sourcesByScheme={all:['ozon-fbs','ozon-fbo'],fbs:['ozon-fbs'],fbo:['ozon-fbo']};
const text=value=>typeof value==='string'?value.trim():'';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const integers=new Intl.NumberFormat('ru-RU');
const dateLabel=date=>date.split('-').reverse().join('.');

export function clusterOrdersPeriod(from,to,today){
 if(!validDay(from)||!validDay(to)||from>to||to>today)throw Error('Укажите корректный период до сегодняшнего дня включительно.');
 const start=Date.parse(from+'T00:00:00+03:00');
 const end=Date.parse(to+'T23:59:59.999+03:00');
 return {start,end,since:new Date(start).toISOString(),to:new Date(end).toISOString()};
}

export async function loadOzonClusterOrders(period,scheme,request,{onProgress,signal,pause}={}){
 const sources=sourcesByScheme[scheme];
 if(!Array.isArray(sources))throw Error('Выберите схему Ozon.');
 const postings=new Map();
 for(const source of sources){
  for await(const page of readOzonPostingPages(source,period,request,{financialData:true,onProgress,signal,pause})){
   for(const posting of page){
    const orderedAt=Date.parse(posting?.created_at||posting?.in_process_at);
    if(!Number.isFinite(orderedAt))throw Error('Ozon вернул отправление без даты заказа.');
    if(orderedAt<period.start||orderedAt>period.end)continue;
    const number=text(posting.posting_number);
    const orderNumber=text(posting.order_number)||text(posting.order_id)||
     (Number.isSafeInteger(posting.order_id)&&posting.order_id>0?String(posting.order_id):'');
    if(!number||!orderNumber||!Array.isArray(posting.products))throw Error('Ozon вернул неполные сведения об отправлении.');
    const products=posting.products.map(product=>{
     const quantity=Number(product?.quantity);
     if(product?.quantity==null||product.quantity===''||!Number.isSafeInteger(quantity)||quantity<0)throw Error('Ozon вернул некорректное количество товара.');
     return {sku:text(product.offer_id),quantity};
    });
    postings.set(source+':'+number,{source,orderNumber,cluster:text(posting.financial_data?.cluster_to)||null,products});
   }
  }
 }
 signal?.throwIfAborted();
 return [...postings.values()];
}

export function summarizeOzonClusters(postings,{sku='',scheme='all'}={}){
 const clusters=new Map(),uniqueOrders=new Set();
 let units=0;
 for(const posting of postings){
  if(!sourcesByScheme[scheme]?.includes(posting.source))continue;
  const products=sku?posting.products.filter(product=>product.sku===sku):posting.products;
  if(!products.length)continue;
  const quantity=products.reduce((sum,product)=>sum+product.quantity,0);
  if(!clusters.has(posting.cluster))clusters.set(posting.cluster,{orders:new Set(),units:0});
  const group=clusters.get(posting.cluster);
  group.orders.add(posting.orderNumber);
  group.units+=quantity;
  uniqueOrders.add(posting.orderNumber);
  units+=quantity;
 }
 const rows=[...clusters].map(([cluster,group])=>({cluster,orders:group.orders.size,units:group.units}));
 rows.sort((a,b)=>Number(a.cluster===null)-Number(b.cluster===null)||b.orders-a.orders||
  (a.cluster??'').localeCompare(b.cluster??'','ru'));
 return {rows,orders:uniqueOrders.size,units};
}

function renderResults({rows,orders,units},filters){
 if(!rows.length)return '<p class="analytics-empty">Заказов за выбранный период и по этому фильтру нет.</p>';
 const format=value=>integers.format(value);
 return `<p class="analytics-coverage">${dateLabel(filters.from)} — ${dateLabel(filters.to)} · ${filters.scheme==='all'?'FBS и FBO':filters.scheme.toUpperCase()} · ${filters.sku?escape(filters.sku):'все артикулы'}</p>
  <div class="analytics-cluster-results" role="region" aria-label="Заказы по кластерам доставки" tabindex="0">
   <table class="analytics-cluster-table">
    <thead><tr><th scope="col">Кластер доставки</th><th scope="col">Заказы</th><th scope="col">Штук</th></tr></thead>
    <tbody>${rows.map(row=>`<tr ${row.cluster===null?'class="analytics-cluster-unknown"':''}><th scope="row">${escape(row.cluster??'Кластер не указан')}</th><td>${format(row.orders)}</td><td>${format(row.units)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><th scope="row">Всего</th><td>${format(orders)}</td><td>${format(units)}</td></tr></tfoot>
   </table>
  </div>
  <p class="analytics-coverage">Учитываются все статусы. Заказы считаются по уникальным номерам в каждом кластере и в общем итоге.</p>`;
}

export function mountOzonClusterOrders({root,state={},getCredentials,getProducts=()=>[],onOpenApi,request=orderRequest,now=()=>new Date()}){
 const today=dayKey(now());
 const filters=state.filters??={from:today.slice(0,8)+'01',to:today,sku:'',scheme:'all'};
 let controller=null,disposed=false;
 root.innerHTML=`<section class="panel ozon-analytics">
  <div class="analytics-heading"><h1>Заказы по кластерам Ozon</h1><button type="button" data-clusters-api>Настроить доступ Ozon</button></div>
  <form class="analytics-controls analytics-cluster-controls">
   <label>С даты<input type="date" name="from" value="${escape(filters.from)}" max="${today}" required></label>
   <label>По дату<input type="date" name="to" value="${escape(filters.to)}" max="${today}" required></label>
   <label>Схема<select name="scheme" class="ui-select"><option value="all">FBS и FBO</option><option value="fbs">Только FBS</option><option value="fbo">Только FBO</option></select></label>
   <label>Артикул продавца<input name="sku" type="search" value="${escape(filters.sku)}" list="ozon-cluster-skus" placeholder="Все артикулы" autocomplete="off"></label>
   <datalist id="ozon-cluster-skus"></datalist>
   <div class="analytics-cluster-actions"><button type="submit" class="primary" id="ozon-clusters-refresh">Загрузить из Ozon</button><button type="button" data-clusters-stop hidden>Стоп</button></div>
  </form>
  <p class="analytics-status" role="status"></p>
  <div data-cluster-results></div>
 </section>`;
 const form=root.querySelector('form'),status=root.querySelector('[role="status"]'),result=root.querySelector('[data-cluster-results]');
 const stop=root.querySelector('[data-clusters-stop]');
 const {from,to,sku,scheme}=form.elements;
 scheme.value=filters.scheme;

 const clientId=()=>String(getCredentials().ozonClient||'').trim();
 const remember=()=>Object.assign(filters,{from:from.value,to:to.value,sku:sku.value.trim(),scheme:scheme.value});
 function updateArticles(){
  const articles=new Set(getProducts().map(product=>text(product.sku)).filter(Boolean));
  if(state.report?.clientId===clientId()){
   for(const posting of state.report.postings)for(const product of posting.products)if(product.sku)articles.add(product.sku);
  }
  root.querySelector('datalist').innerHTML=[...articles].sort((a,b)=>a.localeCompare(b,'ru',{numeric:true}))
   .map(article=>`<option value="${escape(article)}"></option>`).join('');
 }
 function draw(){
  const report=state.report;
  const available=report?.clientId===clientId()&&report.from===filters.from&&report.to===filters.to&&
   (report.scheme==='all'||report.scheme===filters.scheme);
  result.innerHTML=available?renderResults(summarizeOzonClusters(report.postings,filters),filters):
   '<p class="analytics-empty">Выберите период и нажмите «Загрузить из Ozon». Артикул можно указать до или после загрузки.</p>';
 }
 function change(){
  remember();
  status.textContent='';
  draw();
 }
 from.onchange=to.onchange=scheme.onchange=sku.oninput=change;
 root.querySelector('[data-clusters-api]').onclick=onOpenApi;
 stop.onclick=()=>controller?.abort();

 form.onsubmit=async event=>{
  event.preventDefault();
  if(controller)return;
  remember();
  let period;
  try{period=clusterOrdersPeriod(filters.from,filters.to,dayKey(now()));}
  catch(error){status.textContent=error.message;return;}
  const credentials={...getCredentials()},account=clientId(),selection={...filters};
  if(!account||!credentials.ozonKey){status.textContent='Добавьте Client-Id и API-ключ Ozon в разделе «API и доступы».';return;}
  controller=new AbortController();
  const {signal}=controller,controls=[from,to,sku,scheme,form.querySelector('[type="submit"]')];
  controls.forEach(control=>control.disabled=true);
  stop.hidden=false;
  status.textContent='Получаем заказы Ozon…';
  const call=(operation,body)=>request(operation,credentials,body,(url,options)=>fetch(url,{
   ...options,signal:AbortSignal.any([signal,options.signal].filter(Boolean))
  }));
  try{
   const postings=await loadOzonClusterOrders(period,selection.scheme,call,{signal,onProgress:message=>status.textContent=message});
   signal.throwIfAborted();
   if(clientId()!==account)throw Error('Кабинет Ozon изменился. Загрузите отчёт ещё раз.');
   state.report={clientId:account,from:selection.from,to:selection.to,scheme:selection.scheme,postings};
   updateArticles();
   draw();
   status.textContent='Данные Ozon обновлены.';
  }catch(error){
   if(!disposed)status.textContent=signal.aborted?'Загрузка остановлена.':error.message;
  }finally{
   controller=null;
   if(!disposed){controls.forEach(control=>control.disabled=false);stop.hidden=true;}
  }
 };
 updateArticles();
 draw();
 return ()=>{disposed=true;controller?.abort();};
}
