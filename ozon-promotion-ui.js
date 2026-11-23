import {marketRequest,redact} from './marketplace-api.js?v=0.2.418';
import {dayKey} from './ozon-analytics.js?v=0.2.392';
import {openFunnelProductPicker,resolveOzonSkus} from './sales-funnel.js?v=0.2.418';
import {confirmAction} from './listing-fields.js?v=0.2.392';
import {loadRecentOzonQueries,promotionDays,promotionNoteLimit,queryTextLimit,readQueryPhrases,recentQueryPeriod,shiftDay} from './ozon-promotion.js?v=0.2.422';
import {loadOzonPerformance,performanceCredentials,performanceRequest,performanceStart,savePerformanceCredentials} from './ozon-performance.js?v=0.2.422';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatNumber=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const dateLabel=day=>day.split('-').reverse().join('.');
const display=(value,unit='')=>value==null?'—':formatNumber.format(value)+(unit?' '+unit:'');
const ratio=(a,b,scale=1)=>a!=null&&b>0?a/b*scale:null;
const tabLabels={queries:'Поисковые запросы',daily:'Оплата за клик по дням'};
const queryRange=({from,to})=>to&&to!==from?dateLabel(from)+' — '+dateLabel(to):dateLabel(from);
const sellerSearchUrl='https://seller.ozon.ru/app/analytics-search/search-results/apz';

const dailyMetrics=[
 ['Показы',m=>m.views],['Клики',m=>m.clicks],['CTR',m=>ratio(m.clicks,m.views,100),'%'],
 ['Добавили в корзину',m=>m.cart],['Расход с НДС',m=>m.expense,'₽'],
 ['Средняя цена клика',m=>ratio(m.expense,m.clicks),'₽'],
 ['Цена добавления в корзину',m=>ratio(m.expense,m.cart),'₽'],
 ['Заказы из рекламы',m=>m.orders],['Цена заказа',m=>ratio(m.expense,m.orders),'₽'],
 ['Продажи из рекламы',m=>m.sales,'₽'],['ДРР по продажам товара',m=>ratio(m.expense,m.sales,100),'%'],
 ['Заказы других вариантов',m=>m.modelOrders],['Продажи других вариантов',m=>m.modelSales,'₽'],
 ['Заказано на сумму',m=>m.totalSales,'₽'],['Общий ДРР',m=>ratio(m.expense,m.totalSales,100),'%']
];

function queryMarkup(report){
 const {period,requestedPeriod,ids,rows}=report;
 const requested=requestedPeriod.to?'за '+queryRange(requestedPeriod):'с '+dateLabel(requestedPeriod.from);
 const sameDates=period.from===requestedPeriod.from&&period.to===requestedPeriod.to;
 let dates;
 if(period.from&&period.to){
  dates='Seller API вернул данные за '+queryRange(period)+(!sameDates?'. Запрос '+requested:'');
 }else{
  const response=period.from?'В ответе Ozon указал только начало '+dateLabel(period.from):
   period.to?'В ответе Ozon указал только окончание '+dateLabel(period.to):'Ozon вернул данные без дат периода';
  dates='Запрос в Seller API '+requested+'. '+response;
 }
 const summary=`<p class="promotion-caption">${dates} · SKU Ozon ${esc(ids.join(', '))}</p>`;
 if(!rows.length)return summary+'<p class="analytics-empty">Ozon не вернул поисковые запросы за этот период.</p>';
 const columns=[
  ['SKU Ozon',row=>row.sku,new Set(rows.map(row=>row.sku)).size>1],
  ['Покупателей искало',row=>display(row.searches),true],
  ['Покупателей увидело',row=>display(row.views),rows.some(row=>row.views!==null)],
  ['Позиция в поиске',row=>display(row.position),rows.some(row=>row.position!==null)],
  ['Заказы по запросу',row=>display(row.orders),true],
  ['Заказано на сумму',row=>esc(display(row.sales,row.currency)),true]
 ].filter(([, ,visible])=>visible);
 const notice=rows.some(row=>row.orders===null&&row.sales>0)?
  `<p class="promotion-caption">У строк с суммой и прочерком Seller API не подтвердил количество заказов.
   <a href="${sellerSearchUrl}" target="_blank" rel="noopener noreferrer">Сверить с кабинетом Ozon ↗</a></p>`:'';
 return summary+notice+`<div class="analytics-cluster-results" role="region" aria-label="Поисковые запросы Ozon" tabindex="0">
  <table class="analytics-cluster-table promotion-query-table">
   <thead><tr><th scope="col">Запрос</th>${columns.map(([label])=>`<th scope="col">${label}</th>`).join('')}</tr></thead>
   <tbody>${rows.map(row=>`<tr><th scope="row">${esc(row.query)}</th>${columns.map(([,value])=>`<td>${value(row)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
 </div>`;
}

function dailyMarkup(days,notes,source){
 const byDay=new Map(notes.map(note=>[note.day,note]));
 const count=days.filter(day=>day.metrics).length;
 return `<p class="promotion-caption">${source?esc(source)+' · ':''}Данные за ${count} из ${days.length} дней · «—» означает, что показателя нет</p>
 <div class="analytics-cluster-results promotion-daily-scroll" role="region" aria-label="Оплата за клик по дням" tabindex="0">
  <table class="analytics-cluster-table promotion-daily-table">
   <thead><tr><th scope="col">Показатель</th>${days.map(({day})=>{
    const note=byDay.get(day);
    return `<th scope="col"><time datetime="${day}">${dateLabel(day)}</time>
     <button type="button" class="promotion-note${note?' has-note':''}" data-promotion-note="${day}"
      aria-label="${note?'Редактировать':'Добавить'} заметку за ${dateLabel(day)}" ${note?`aria-describedby="promotion-note-${day}" title="${esc(note.text)}"`:''}>
      ${note?`${note.time?`<small>${note.time} МСК</small>`:''}<span id="promotion-note-${day}">${esc(note.text)}</span>`:'＋ Заметка'}
     </button></th>`;
   }).join('')}</tr></thead>
   <tbody>${dailyMetrics.map(([label,measure,unit])=>`<tr><th scope="row">${label}</th>
    ${days.map(({metrics})=>`<td>${display(metrics?measure(metrics):null,unit)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
 </div>`;
}

export function mountOzonPromotion({root,state,getProducts,getSelectedProductId,hydrateProductImages,getCredentials,
 getPromotion,savePromotion,onOpenApi,request=marketRequest,requestPerformance=performanceRequest,now=()=>new Date()}){
 const doc=root.ownerDocument,window=doc.defaultView;
 const today=dayKey(now());
 const latestQueries=recentQueryPeriod(today);
 const products=getProducts().filter(product=>product.sku?.trim());
 const byId=new Map(products.map(product=>[product.id,product]));
 const filters=state.filters??={productId:'',from:shiftDay(today,-13),to:today};
 const selectedId=getSelectedProductId();
 if(!byId.has(filters.productId))filters.productId=byId.has(selectedId)?selectedId:'';
 let active=state.tab??'queries',campaign='',pending,dialog,disposed=false,manualKey;
 let performanceAccess=performanceCredentials(window);
 const attemptedDaily=new Set();
 root.innerHTML=`<section class="panel ozon-analytics promotion-report">
  <div class="analytics-heading"><h1>Поиск и продвижение Ozon</h1>
   <button type="button" data-promotion-api>Настроить доступ Ozon</button></div>
  <form class="analytics-controls funnel-controls" data-promotion-filters>
   <div class="funnel-product"><span id="promotion-product-label">Товар из «Себестоимости»</span>
    <button type="button" class="ui-select" aria-haspopup="dialog" aria-labelledby="promotion-product-label promotion-product-name"
     data-promotion-product><span id="promotion-product-name"></span></button>
   </div>
   <label data-promotion-dates>С даты<input name="from" type="date" value="${esc(filters.from)}" min="${performanceStart}" max="${today}" required></label>
   <label data-promotion-dates>По дату<input name="to" type="date" value="${esc(filters.to)}" min="${performanceStart}" max="${today}" required></label>
  </form>
  <div class="analytics-view" role="group" aria-label="Данные отчёта">
   ${Object.entries(tabLabels).map(([id,label])=>`<button type="button" data-promotion-tab="${id}" aria-pressed="false">${label}</button>`).join('')}
  </div>
  <p class="analytics-status promotion-status" data-promotion-status role="status" hidden></p>
  <div data-promotion-section="queries">
   <p class="analytics-status promotion-status promotion-access-note" data-query-access-note role="status" hidden>
    Ozon ограничил выгрузку поисковых запросов через API. Доступные фразы и цифры можно посмотреть в отчёте Ozon Seller.
   </p>
   <div class="promotion-actions">
    <button type="button" class="primary" data-load-queries>Загрузить за последние 7 дней</button>
    <a class="promotion-open-seller" data-query-open-seller href="${sellerSearchUrl}" target="_blank" rel="noopener noreferrer" hidden>Открыть отчёт в Ozon ↗</a>
   </div>
   <div data-query-results></div>
   <details class="analytics-help promotion-import-help promotion-query-entry" data-manual-queries hidden>
    <summary>Вставить фразы из кабинета Ozon</summary>
    <p>Скопируйте фразы своего товара из отчёта Ozon за ${queryRange(latestQueries)}.</p>
    <form data-manual-query-form>
     <label>Поисковые фразы<textarea name="phrases" rows="4" maxlength="${queryTextLimit}" required placeholder="Одна фраза на строку"></textarea></label>
     <button type="submit">Сохранить фразы</button>
    </form>
   </details>
   <div data-manual-query-results></div>
  </div>
  <div data-promotion-section="daily" hidden>
   <div class="promotion-actions">
    <button type="button" class="primary" data-load-performance>Загрузить из Ozon</button>
    <label>Кампания<select class="ui-select" data-promotion-campaign></select></label>
   </div>
   <details class="analytics-help promotion-import-help" data-performance-setup ${performanceAccess.id?'':'open'}><summary>Доступ к Ozon Performance API</summary>
    <p>Установите <a href="./workshop-ozon-performance.zip" download>расширение «Мастерская — Ozon Performance API»</a> для Chrome или Edge.</p>
    <p>Распакуйте архив. На странице расширений браузера включите «Режим разработчика», нажмите «Загрузить распакованное расширение» и выберите папку из архива. Затем обновите «Мастерскую».</p>
    <p>В Ozon Seller откройте «Настройки → API-интеграции → Performance API» и укажите данные оттуда.</p>
    <form data-performance-credentials>
     <div class="promotion-credentials">
      <label>Client ID<input name="id" maxlength="2048" autocomplete="off" spellcheck="false" required></label>
      <label>Client Secret<input name="secret" type="password" maxlength="2048" autocomplete="off" required></label>
     </div>
     <div class="promotion-actions"><button type="submit">Сохранить и загрузить</button>
      <button type="button" data-remove-performance-access>Удалить доступ с устройства</button></div>
    </form>
   </details>
   <div data-daily-results></div>
  </div>
 </section>`;
 const $=selector=>root.querySelector(selector);
 const form=$('[data-promotion-filters]'),from=form.elements.from,to=form.elements.to;
 const productButton=$('[data-promotion-product]'),loadButton=$('[data-load-queries]');
 const openSeller=$('[data-query-open-seller]');
 const manualEntry=$('[data-manual-queries]'),manualForm=$('[data-manual-query-form]');
 const manualText=manualForm.elements.phrases,manualSave=manualForm.querySelector('button'),manualResults=$('[data-manual-query-results]');
 const performanceButton=$('[data-load-performance]'),performanceSetup=$('[data-performance-setup]');
 const performanceForm=$('[data-performance-credentials]'),removePerformanceAccess=$('[data-remove-performance-access]');
 const performanceId=performanceForm.elements.namedItem('id'),performanceSecret=performanceForm.elements.namedItem('secret');
 performanceId.value=performanceAccess.id;
 performanceSecret.required=!performanceAccess.secret;
 if(performanceAccess.secret)performanceSecret.placeholder='Сохранён на этом устройстве';
 const campaignSelect=$('[data-promotion-campaign]');
 const status=$('[data-promotion-status]'),accessNote=$('[data-query-access-note]');
 const queryResults=$('[data-query-results]'),dailyResults=$('[data-daily-results]');
 const product=()=>byId.get(filters.productId);
 const record=()=>getPromotion().products.find(entry=>entry.id===filters.productId)??{id:filters.productId,rows:[],notes:[]};
 const dailyReport=()=>record().performance?.client===performanceAccess.id?record().performance:null;
 const dailyKey=()=>JSON.stringify([filters.productId,product()?.sku,filters.from,filters.to,performanceAccess.id]);
 const credentialId=()=>String(getCredentials().ozonClient||'');
 const currentKey=()=>JSON.stringify([filters.productId,product()?.sku,latestQueries.from,latestQueries.to,credentialId()]);
 const samePeriod=entry=>entry.from===latestQueries.from&&entry.to===latestQueries.to;
 function message(text){status.textContent=text;status.hidden=!text;}
 function remember(){filters.from=from.value;filters.to=to.value;}
 function draw(){
  const selected=product();
  const name=selected?[selected.name,selected.variantNote,selected.sku].filter(Boolean).join(' · '):'Выбрать товар';
  productButton.querySelector('span').textContent=name;
  productButton.title=name;
  productButton.disabled=!products.length||Boolean(pending);
  const noProduct=selected?'':products.length?'Выберите товар из «Себестоимости».':'Укажите артикул хотя бы для одного товара в «Себестоимости».';
  loadButton.disabled=!selected||Boolean(pending);
  form.classList.toggle('promotion-query-filters',active==='queries');
  form.querySelectorAll('[data-promotion-dates]').forEach(label=>label.hidden=active==='queries');
  manualText.disabled=manualSave.disabled=Boolean(pending);
  performanceButton.disabled=!selected||Boolean(pending);
  removePerformanceAccess.hidden=!performanceAccess.id;
  performanceForm.querySelectorAll('input,button').forEach(control=>control.disabled=Boolean(pending));
  from.disabled=to.disabled=Boolean(pending);
  root.querySelectorAll('[data-promotion-tab]').forEach(button=>{
   button.setAttribute('aria-pressed',String(button.dataset.promotionTab===active));
   button.disabled=Boolean(pending);
  });
  root.querySelectorAll('[data-promotion-section]').forEach(section=>section.hidden=section.dataset.promotionSection!==active);
  if(active==='daily'){
   if(noProduct){dailyResults.innerHTML=`<p class="analytics-empty">${noProduct}</p>`;return;}
   const report=dailyReport(),previous=record();
   const rows=report?.rows??previous.rows;
   const names=new Map((report?.campaigns??[]).map(({id,title})=>[id,title]));
   const campaigns=[...new Set(rows.filter(row=>row.day>=filters.from&&row.day<=filters.to).map(row=>row.campaignId))].sort();
   if(!campaigns.includes(campaign))campaign='';
   campaignSelect.replaceChildren(new window.Option('Все кампании',''),...campaigns.map(id=>
    new window.Option(names.get(id)?names.get(id)+' · № '+id:'Кампания № '+id,id)));
   campaignSelect.value=campaign;
   campaignSelect.disabled=!campaigns.length||Boolean(pending);
   try{
    if(filters.to>today)throw Error('Дата окончания не может быть позже сегодняшней.');
    if(filters.from<performanceStart)throw Error('Статистика Performance API доступна с 1 февраля 2025 года.');
    const archiveNote=report?.archived?' · Архивных кампаний пропущено '+report.archived:'';
    const source=report?'Ozon Performance API · '+queryRange(report)+archiveNote:rows.length?'Ранее сохранённые данные':'';
    const scroll=dailyResults.querySelector('.promotion-daily-scroll')?.scrollLeft||0;
    dailyResults.innerHTML=dailyMarkup(promotionDays(rows,filters.from,filters.to,campaign),previous.notes,source);
    dailyResults.querySelector('.promotion-daily-scroll').scrollLeft=scroll;
   }catch(error){dailyResults.innerHTML=`<p class="analytics-empty">${esc(error.message)}</p>`;}
  }else{
   const key=currentKey(),denied=state.queryDenied===key;
   accessNote.hidden=!denied||Boolean(pending);
   openSeller.hidden=accessNote.hidden;
   queryResults.innerHTML=state.queries?.key===key?queryMarkup(state.queries.data):noProduct?
    `<p class="analytics-empty">${noProduct}</p>`:'';
   const lists=(selected&&record().queryLists)||[];
   manualEntry.hidden=!selected||(!denied&&!lists.length);
   const saved=lists.find(samePeriod)?.phrases||[];
   if(manualKey!==key){
    manualKey=key;
    manualText.value=saved.join('\n');
   }
   manualResults.innerHTML=lists.map(list=>
    `<section class="promotion-manual-phrases"><h2>Фразы из кабинета Ozon</h2>
     <p class="promotion-caption">${queryRange(list)}</p><ul>${list.phrases.map(phrase=>`<li>${esc(phrase)}</li>`).join('')}</ul></section>`).join('');
  }
 }
 form.onsubmit=event=>event.preventDefault();
 form.oninput=()=>{remember();message('');draw();};
 root.querySelectorAll('[data-promotion-tab]').forEach(button=>button.onclick=()=>{
  active=state.tab=button.dataset.promotionTab;message('');draw();
  maybeLoadActive();
 });
 productButton.onclick=()=>{
  if(dialog?.open)return;
  dialog=openFunnelProductPicker({button:productButton,products,selectedId:filters.productId,hydrateProductImages,onSelect:id=>{
   filters.productId=id;campaign='';message('');draw();
   maybeLoadActive();
  }});
 };
 $('[data-promotion-api]').onclick=onOpenApi;
 campaignSelect.onchange=()=>{campaign=campaignSelect.value;draw();};

 const run=async(text,task)=>{
  if(disposed||pending||!product())return;
  pending=new AbortController();
  const {signal}=pending,credentials=getCredentials();
  const call=(op,body)=>{
   signal.throwIfAborted();
   return request('ozon',op,credentials,body,(url,options)=>fetch(url,{
    ...options,signal:AbortSignal.any([signal,options.signal].filter(Boolean))
   }));
  };
  message(text);draw();
  try{await task(call,signal);}
  catch(error){if(!disposed)message(redact(error.message,credentials));}
  finally{pending=null;if(!disposed)draw();}
 };
 async function saveRecord(updated){
  if(disposed)return false;
  const data=getPromotion();
  const next={products:[...data.products.filter(entry=>entry.id!==updated.id),updated]};
  if(await savePromotion(next)===false)throw Error('Не удалось сохранить изменения.');
  return true;
 }

 const fetchQueries=()=>run('Загружаю поисковые запросы Ozon…',async(call,signal)=>{
  const key=currentKey(),article=product().sku.trim();
  const ids=await resolveOzonSkus(article,call);
  const data=await loadRecentOzonQueries(ids,today,call);
  signal.throwIfAborted();
  state.queryDenied=data?'':key;
  if(data)state.queries={key,data};
  message('');
 });
 function maybeLoadQueries(){
  if(disposed||pending)return;
  const credentials=getCredentials();
  if(active==='queries'&&product()&&credentials.ozonKey&&credentials.ozonClient){
   const key=currentKey();
   if(state.queries?.key!==key&&state.queryDenied!==key)fetchQueries();
  }
 }
 loadButton.onclick=fetchQueries;
 manualForm.onsubmit=event=>{
  event.preventDefault();
  return run('Сохраняю фразы…',async()=>{
   const phrases=readQueryPhrases(manualText.value),original=record();
   const list={...latestQueries,phrases};
   const queryLists=[...(original.queryLists??[]).filter(entry=>!samePeriod(entry)),list];
   if(!await saveRecord({...original,queryLists})||disposed)return;
   manualText.value=phrases.join('\n');
   manualEntry.open=false;
   message('Список фраз сохранён.');
  });
 };

 const fetchPerformance=()=>{
  if(!performanceAccess.id||!performanceAccess.secret){
   performanceSetup.open=true;
   performanceId.focus();
   message('Укажите доступ к Ozon Performance API.');
   return;
  }
  if(!form.reportValidity())return;
  return run('Загружаю кампании из Ozon…',async(call,signal)=>{
   const period={from:filters.from,to:filters.to},access=performanceAccess;
   attemptedDaily.add(dailyKey());
   const ads=(operation,body,token)=>requestPerformance(window,operation,body,token,signal);
   let report;
   try{
    const link=await ads('ping',{});
    if(link?.version!==1)throw Error('Обновите расширение «Мастерская — Ozon Performance API».');
    const ids=await resolveOzonSkus(product().sku.trim(),call);
    report=await loadOzonPerformance(ids,period,access,ads,{signal,onProgress:(index,total)=>{
     message(`Ozon формирует отчёт по дням · часть ${index} из ${total}…`);
    }});
   }catch(error){
    if(['EXTENSION_REQUIRED','PERFORMANCE_ACCESS_DENIED'].includes(error.code))performanceSetup.open=true;
    throw error;
   }
   signal.throwIfAborted();
   if(!await saveRecord({...record(),performance:report})||disposed)return;
   message(report.rows.length?'Статистика Ozon обновлена.':'Ozon не вернул статистику по выбранному товару за этот период.');
  });
 };
 function maybeLoadActive(){
  if(active==='queries'){maybeLoadQueries();return;}
  if(disposed||pending||!product()||!performanceAccess.id||!performanceAccess.secret||attemptedDaily.has(dailyKey()))return;
  const report=dailyReport();
  if(!report||report.from>filters.from||report.to<filters.to)fetchPerformance();
 }
 performanceButton.onclick=fetchPerformance;
 performanceForm.onsubmit=event=>{
  event.preventDefault();
  const id=performanceId.value.trim();
  const secret=performanceSecret.value.trim()||(id===performanceAccess.id?performanceAccess.secret:'');
  if(!id||!secret||/\s/.test(id)||/\s/.test(secret)){
   message('Введите Client ID и Client Secret из Ozon Performance API.');
   return;
  }
  try{savePerformanceCredentials(window,{id,secret});}
  catch{message('Браузер не разрешил сохранить доступ к Performance API.');return;}
  performanceAccess={id,secret};
  performanceSecret.value='';
  performanceSecret.required=false;
  performanceSecret.placeholder='Сохранён на этом устройстве';
  performanceSetup.open=false;
  return fetchPerformance();
 };
 removePerformanceAccess.onclick=async()=>{
  if(!await confirmAction('Удалить сохранённые Client ID и Client Secret с этого устройства?',{
   title:'Удалить доступ к Performance API',accept:'Удалить',document:doc
  })||disposed||pending)return;
  try{savePerformanceCredentials(window,{});}
  catch{message('Браузер не разрешил удалить сохранённый доступ.');return;}
  performanceAccess={id:'',secret:''};
  performanceId.value=performanceSecret.value=performanceSecret.placeholder='';
  performanceSecret.required=true;
  attemptedDaily.clear();
  message('Доступ к Performance API удалён с устройства.');
  draw();
 };

 dailyResults.onclick=event=>{
  const button=event.target.closest('[data-promotion-note]');
  if(!button||dialog?.open||pending)return;
  const day=button.dataset.promotionNote,note=record().notes.find(entry=>entry.day===day);
  const modal=doc.createElement('dialog');
  dialog=modal;
  modal.className='promotion-note-dialog';
  modal.setAttribute('aria-labelledby','promotion-note-title');
  modal.innerHTML=`<form>
   <div class="modal-head"><h2 id="promotion-note-title">Заметка за ${dateLabel(day)}</h2></div>
   <label>Что изменилось<textarea name="text" rows="4" maxlength="${promotionNoteLimit}" required autofocus placeholder="Например, поднял ставку с 8 до 10 ₽">${esc(note?.text)}</textarea></label>
   <label>Время изменения по Москве<input name="time" type="time" value="${note?.time??''}"></label>
   <p role="status"></p>
   <div class="sync-actions"><button type="submit" class="primary">Сохранить заметку</button>
    ${note?'<button type="button" data-delete-note>Удалить</button>':''}<button type="button" data-close-note>Отмена</button></div>
  </form>`;
  const noteForm=modal.querySelector('form'),noteStatus=modal.querySelector('[role="status"]');
  let saving=false;
  async function commit(next){
   if(saving)return;
   saving=true;
   const controls=noteForm.querySelectorAll('button,input,textarea');
   controls.forEach(control=>control.disabled=true);
   try{
    const original=record();
    const notes=original.notes.filter(entry=>entry.day!==day);
    if(next)notes.push(next);
    if(await saveRecord({...original,notes})&&!disposed){
     modal.close();draw();dailyResults.querySelector(`[data-promotion-note="${day}"]`)?.focus({preventScroll:true});
    }
   }catch(error){noteStatus.textContent=error.message;}
   finally{saving=false;controls.forEach(control=>control.disabled=false);}
  }
  noteForm.onsubmit=event=>{
   event.preventDefault();
   const text=noteForm.elements.text.value.trim();
   if(!text){noteStatus.textContent='Напишите, что изменилось.';return;}
   return commit({day,text,time:noteForm.elements.time.value});
  };
  modal.querySelector('[data-close-note]').onclick=()=>modal.close();
  const remove=modal.querySelector('[data-delete-note]');
  if(remove)remove.onclick=async()=>{
   if(await confirmAction('Удалить заметку за '+dateLabel(day)+'?',{title:'Удалить заметку',accept:'Удалить',document:doc})&&!disposed&&modal.open)await commit(null);
  };
  modal.oncancel=event=>{if(saving)event.preventDefault();};
  modal.onclose=()=>{modal.remove();if(button.isConnected)button.focus({preventScroll:true});};
  doc.body.append(modal);
  modal.showModal();
 };
 draw();
 queueMicrotask(maybeLoadActive);
 return ()=>{disposed=true;pending?.abort();if(dialog?.open)dialog.close();dialog?.remove();};
}
