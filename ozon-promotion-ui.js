import {marketRequest,redact} from './marketplace-api.js?v=0.2.418';
import {dayKey,dateRange} from './ozon-analytics.js?v=0.2.392';
import {openFunnelProductPicker,resolveOzonSkus} from './sales-funnel.js?v=0.2.418';
import {confirmAction} from './listing-fields.js?v=0.2.392';
import {loadOzonQueries,parseOzonPromotion,promotionDays,promotionNoteLimit,shiftDay} from './ozon-promotion.js?v=0.2.418';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatNumber=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const dateLabel=day=>day.split('-').reverse().join('.');
const display=(value,unit='')=>value==null?'—':formatNumber.format(value)+(unit?' '+unit:'');
const ratio=(a,b,scale=1)=>a!=null&&b>0?a/b*scale:null;
const tabLabels={queries:'Поисковые запросы',daily:'Оплата за клик по дням'};

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

async function readWorkbook(file){
 if(!/\.xlsx$/i.test(file.name))throw Error('Выберите выгрузку Ozon в формате XLSX.');
 if(file.size>20*1024*1024)throw Error('Выберите XLSX размером не больше 20 МБ.');
 const {readSheet,readSheetNames}=await import('./ozon-workbook-runtime.js?v=0.2.418');
 const names=await readSheetNames(file);
 const sheets=[];
 for(const name of names)sheets.push({name,rows:await readSheet(file,{sheet:name})});
 return sheets;
}

function queryMarkup(report){
 const {period,rows}=report;
 const range=period.to&&period.to!==period.from?dateLabel(period.from)+' — '+dateLabel(period.to):dateLabel(period.from);
 const summary=`<p class="promotion-caption">Данные Ozon за ${range} · до 15 запросов на SKU</p>`;
 if(!rows.length)return summary+'<p class="analytics-empty">Ozon не вернул поисковые запросы за этот период.</p>';
 return summary+`<div class="analytics-cluster-results" role="region" aria-label="Поисковые запросы Ozon" tabindex="0">
  <table class="analytics-cluster-table promotion-query-table">
   <thead><tr>${['Запрос','SKU Ozon','Увидели в поиске','Посмотрели карточку','Средняя позиция','Заказы','Сумма заказов'].map(label=>`<th scope="col">${label}</th>`).join('')}</tr></thead>
   <tbody>${rows.map(row=>`<tr><th scope="row">${esc(row.query)}</th><td>${row.sku}</td>
    <td>${display(row.searches)}</td><td>${display(row.views)}</td><td>${display(row.position)}</td>
    <td>${display(row.orders)}</td><td>${esc(display(row.sales,row.currency))}</td></tr>`).join('')}</tbody>
  </table>
 </div>`;
}

function dailyMarkup(days,notes){
 const byDay=new Map(notes.map(note=>[note.day,note]));
 const count=days.filter(day=>day.metrics).length;
 return `<p class="promotion-caption">Загружено ${count} из ${days.length} дней · «—» означает, что показателя нет</p>
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
 getPromotion,savePromotion,onOpenApi,request=marketRequest,loadWorkbook=readWorkbook,now=()=>new Date()}){
 const doc=root.ownerDocument;
 const today=dayKey(now());
 const products=getProducts().filter(product=>product.sku?.trim());
 const byId=new Map(products.map(product=>[product.id,product]));
 const filters=state.filters??={productId:'',from:shiftDay(today,-13),to:today};
 const selectedId=getSelectedProductId();
 if(!byId.has(filters.productId))filters.productId=byId.has(selectedId)?selectedId:'';
 let active=state.tab??'queries',campaign='',pending,dialog,disposed=false,lastImportedPeriod;
 root.innerHTML=`<section class="panel ozon-analytics promotion-report">
  <div class="analytics-heading"><h1>Поиск и продвижение Ozon</h1>
   <button type="button" data-promotion-api>Настроить доступ Ozon</button></div>
  <form class="analytics-controls funnel-controls" data-promotion-filters>
   <div class="funnel-product"><span id="promotion-product-label">Товар из «Себестоимости»</span>
    <button type="button" class="ui-select" aria-haspopup="dialog" aria-labelledby="promotion-product-label promotion-product-name"
     data-promotion-product><span id="promotion-product-name"></span></button>
   </div>
   <label>С даты<input name="from" type="date" value="${esc(filters.from)}" min="2022-01-01" max="${today}" required></label>
   <label>По дату<input name="to" type="date" value="${esc(filters.to)}" min="2022-01-01" max="${today}" required></label>
  </form>
  <div class="analytics-view" role="group" aria-label="Данные отчёта">
   ${Object.entries(tabLabels).map(([id,label])=>`<button type="button" data-promotion-tab="${id}" aria-pressed="false">${label}</button>`).join('')}
  </div>
  <p class="analytics-status promotion-status" role="status" hidden></p>
  <div data-promotion-section="queries">
   <div class="promotion-actions"><button type="button" class="primary" data-load-queries>Загрузить запросы из Ozon</button></div>
   <p class="promotion-caption">Свежие запросы появляются с задержкой. За более ранние даты Ozon отдаёт аналитику по неделям при подходящей подписке.</p>
   <div data-query-results></div>
  </div>
  <div data-promotion-section="daily" hidden>
   <div class="promotion-actions">
    <button type="button" class="primary" data-import-promotion>Импортировать XLSX</button>
    <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-promotion-file hidden>
    <label>Кампания<select class="ui-select" data-promotion-campaign></select></label>
    <button type="button" data-import-dates hidden>Показать дни из файла</button>
   </div>
   <details class="analytics-help promotion-import-help"><summary>Как выгрузить статистику Ozon</summary>
    <p>Откройте «Продвижение → Оплата за клик», выберите кампанию и скачайте статистику с группировкой «По дням». Для каждой кампании импортируйте её XLSX.</p>
    <label>Номер кампании, если его нет в файле<input data-promotion-campaign-number inputmode="numeric" maxlength="20" autocomplete="off"></label>
    <a href="https://docs.ozon.kz/performance/product-ads/oplata-za-klik/results-of-campaign/" target="_blank" rel="noopener noreferrer">Инструкция Ozon ↗</a>
   </details>
   <div data-daily-results></div>
  </div>
 </section>`;
 const $=selector=>root.querySelector(selector);
 const form=$('[data-promotion-filters]'),from=form.elements.from,to=form.elements.to;
 const productButton=$('[data-promotion-product]'),loadButton=$('[data-load-queries]');
 const importButton=$('[data-import-promotion]'),fileInput=$('[data-promotion-file]');
 const campaignSelect=$('[data-promotion-campaign]'),campaignNumber=$('[data-promotion-campaign-number]');
 const importDates=$('[data-import-dates]'),status=$('.promotion-status');
 const queryResults=$('[data-query-results]'),dailyResults=$('[data-daily-results]');
 const product=()=>byId.get(filters.productId);
 const record=()=>getPromotion().products.find(entry=>entry.id===filters.productId)??{id:filters.productId,rows:[],notes:[]};
 const credentialId=()=>String(getCredentials().ozonClient||'');
 const currentKey=()=>JSON.stringify([filters.productId,product()?.sku,filters.from,filters.to,credentialId()]);
 function message(text){status.textContent=text;status.hidden=!text;}
 function remember(){filters.from=from.value;filters.to=to.value;}
 function daysInPeriod(){if(filters.to>today)throw Error('Дата окончания не может быть позже сегодняшней.');return dateRange(filters.from,filters.to);}
 function draw(){
  const selected=product();
  const name=selected?[selected.name,selected.variantNote,selected.sku].filter(Boolean).join(' · '):'Выбрать товар';
  productButton.querySelector('span').textContent=name;
  productButton.title=name;
  productButton.disabled=!products.length||Boolean(pending);
  const noProduct=selected?'':products.length?'Выберите товар из «Себестоимости».':'Укажите артикул хотя бы для одного товара в «Себестоимости».';
  loadButton.disabled=!selected||Boolean(pending);
  importButton.disabled=!selected||Boolean(pending);
  importDates.hidden=!lastImportedPeriod;
  from.disabled=to.disabled=Boolean(pending);
  root.querySelectorAll('[data-promotion-tab]').forEach(button=>{
   button.setAttribute('aria-pressed',String(button.dataset.promotionTab===active));
   button.disabled=Boolean(pending);
  });
  root.querySelectorAll('[data-promotion-section]').forEach(section=>section.hidden=section.dataset.promotionSection!==active);
  if(active==='daily'){
   if(noProduct){dailyResults.innerHTML=`<p class="analytics-empty">${noProduct}</p>`;return;}
   const {rows,notes}=record(),campaigns=[...new Set(rows.map(row=>row.campaignId))].sort();
   if(!campaigns.includes(campaign))campaign='';
   campaignSelect.innerHTML='<option value="">Все кампании</option>'+campaigns.map(id=>`<option value="${id}">Кампания № ${id}</option>`).join('');
   campaignSelect.value=campaign;
   campaignSelect.disabled=!campaigns.length||Boolean(pending);
   try{
    if(filters.to>today)throw Error('Дата окончания не может быть позже сегодняшней.');
    const scroll=dailyResults.querySelector('.promotion-daily-scroll')?.scrollLeft||0;
    dailyResults.innerHTML=dailyMarkup(promotionDays(rows,filters.from,filters.to,campaign),notes);
    dailyResults.querySelector('.promotion-daily-scroll').scrollLeft=scroll;
   }catch(error){dailyResults.innerHTML=`<p class="analytics-empty">${esc(error.message)}</p>`;}
  }else{
   queryResults.innerHTML=state.queries?.key===currentKey()?queryMarkup(state.queries.data):
    `<p class="analytics-empty">${noProduct||'Загрузите фразы из раздела Ozon «Запросы моего товара».'}</p>`;
  }
 }
 form.onsubmit=event=>event.preventDefault();
 form.oninput=()=>{remember();message('');draw();};
 root.querySelectorAll('[data-promotion-tab]').forEach(button=>button.onclick=()=>{
  active=state.tab=button.dataset.promotionTab;message('');draw();
 });
 productButton.onclick=()=>{
  if(dialog?.open)return;
  dialog=openFunnelProductPicker({button:productButton,products,selectedId:filters.productId,hydrateProductImages,onSelect:id=>{
   filters.productId=id;lastImportedPeriod=null;campaign='';message('');draw();
  }});
 };
 $('[data-promotion-api]').onclick=onOpenApi;
 campaignSelect.onchange=()=>{campaign=campaignSelect.value;draw();};
 importDates.onclick=()=>{
  if(!lastImportedPeriod)return;
  from.value=lastImportedPeriod.from;to.value=lastImportedPeriod.to;
  remember();draw();
 };

 const run=async(text,task)=>{
  if(pending||!product())return;
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

 loadButton.onclick=()=>run('Загружаю поисковые запросы Ozon…',async(call,signal)=>{
  remember();
  const days=daysInPeriod();
  const newest=shiftDay(today,-1),end=filters.to>newest?newest:filters.to;
  if(filters.from>end)throw Error('Выберите даты до сегодняшнего дня. Ozon ещё рассчитывает свежие показатели.');
  const weekly=filters.from<shiftDay(today,-30);
  if(weekly&&days.length>7)throw Error('За даты старше месяца выберите одну неделю или день внутри нужной недели.');
  const key=currentKey(),article=product().sku.trim();
  const ids=await resolveOzonSkus(article,call);
  const data=await loadOzonQueries(ids,{from:filters.from,to:weekly?undefined:end},call);
  signal.throwIfAborted();
  state.queries={key,data};
  message('');
 });

 importButton.onclick=()=>fileInput.click();
 fileInput.onchange=()=>{
  const file=fileInput.files?.[0];fileInput.value='';
  if(!file)return;
  return run('Читаю выгрузку Ozon…',async(call,signal)=>{
   const article=product().sku.trim(),original=record();
   const options={article,campaignOverride:campaignNumber.value.trim(),filename:file.name};
   const sheets=await loadWorkbook(file);
   signal.throwIfAborted();
   let report;
   try{report=parseOzonPromotion(sheets,options);}
   catch(error){
    if(error.code!=='OZON_PRODUCT_NOT_FOUND')throw error;
    report=parseOzonPromotion(sheets,{...options,ids:await resolveOzonSkus(article,call)});
   }
   signal.throwIfAborted();
   if(report.rows.some(row=>row.day>today))throw Error('В файле есть даты позже сегодняшнего дня.');
   const rows=[...original.rows.filter(row=>row.campaignId!==report.campaignId||!report.reportedDays.has(row.day)),...report.rows];
   if(!await saveRecord({...original,rows})||disposed)return;
   const dates=report.rows.map(row=>row.day).sort();
   lastImportedPeriod={from:dates[0],to:dates.at(-1)};
   message(`Кампания № ${report.campaignId} · сохранено ${dates.length} дней`);
  });
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
 return ()=>{disposed=true;pending?.abort();if(dialog?.open)dialog.close();dialog?.remove();};
}
