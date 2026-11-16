import {marketRequest} from './marketplace-api.js?v=0.2.391';
import {accrualBreakdownVersion,analyticsGroups,dayKey,dateRange,parseAccrualTypes,fetchAccrualDay,analyticsPeriods,aggregateDays} from './ozon-analytics.js?v=0.2.391';

const moneyFormat=new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB'});
const pointsFormat=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});
const money=value=>moneyFormat.format(value/100);
const points=value=>pointsFormat.format(value/100);
const dateLabel=value=>new Date(value+'T00:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const pause=(ms,signal)=>new Promise((resolve,reject)=>{
 signal.throwIfAborted();
 const abort=()=>{clearTimeout(timer);reject(signal.reason);};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
 signal.addEventListener('abort',abort,{once:true});
});
const standardRows={
 sales:['Выручка','Баллы за скидки','Программы партнёров'],
 returns:['Возврат выручки','Баллы за скидки','Программы партнёров'],
 commission:['Вознаграждение за продажу','Возврат вознаграждения']
};

function analyticsSummary({rows,total},hasDays){
 const groupTotal=(...groups)=>rows.reduce((sum,row)=>sum+(groups.includes(row.group)?row.amount:0),0);
 const turnoverRows=rows.filter(row=>row.group==='sales'||row.group==='returns');
 const turnoverPart=(...labels)=>turnoverRows.reduce((sum,row)=>sum+(labels.includes(row.label)?row.amount:0),0);
 const turnover=groupTotal('sales','returns');
 const commission=groupTotal('commission');
 const services=groupTotal('delivery','partners','promotion','other');
 const adjustments=groupTotal('adjustments');
 const unclassified=groupTotal('unclassified');
 const value=(amount,format=money)=>hasDays?format(amount):'—';
 const row=(label,amount,format)=>`<div><dt>${label}</dt><dd>${value(amount,format)}</dd></div>`;

 return `<div class="analytics-summary">
  <section class="analytics-summary-block">
   <div class="analytics-summary-heading"><h2>Продажи и возвраты</h2><strong>${value(turnover)}</strong></div>
   <dl>
    ${row('Выручка',turnoverPart('Выручка','Возврат выручки'))}
    ${row('Баллы за скидки',turnoverPart('Баллы за скидки'),points)}
    ${row('Программы партнёров',turnoverPart('Программы партнёров'))}
   </dl>
  </section>
  <section class="analytics-summary-block">
   <div class="analytics-summary-heading"><h2>Начисления</h2><strong>${value(commission+services+adjustments+unclassified)}</strong></div>
   <dl>
    ${row('Вознаграждение Ozon',commission)}
    ${row('Услуги и штрафы',services)}
    ${row('Другие начисления',adjustments)}
    ${unclassified?row('Не распределено по статьям',unclassified):''}
   </dl>
  </section>
  <div class="analytics-net"><h2>К выплате за период</h2><strong>${value(total)}</strong></div>
 </div>`;
}

function analyticsTable(periods,sum,mode,loaded,expected,collapsed) {
 const columns=[...periods,{...sum,key:'total',loaded,expected}];
 const cell=(column,value,format=money)=>`<td class="${column.key==='total'?'analytics-total-column':''}">${column.loaded?format(value):'—'}</td>`;
 const headers=columns.map(column=>{
  const title=column.key==='total'?'Всего за период':mode==='months'?new Date(column.key+'-01T00:00:00Z').toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}):mode==='weeks'?`Неделя с ${dateLabel(column.key)}`:new Date(column.key+'T00:00:00Z').toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});
  const fullExpected=mode==='weeks'?7:mode==='months'?new Date(Number(column.key.slice(0,4)),Number(column.key.slice(5,7)),0).getDate():1;
  const coverage=column.key!=='total'&&mode==='days'?(column.loaded?'Загружен':'Не загружен'):`${column.loaded} из ${column.expected} дней${column.loaded<(column.key==='total'?column.expected:fullExpected)?' · неполный итог':''}`;
  return `<th scope="col" class="${column.key==='total'?'analytics-total-column':''}">${esc(title)}<small>${coverage}</small></th>`;
 }).join('');
 const body=analyticsGroups.map(([group,title])=>{
  const labels=[...new Set([...(standardRows[group]||[]),...sum.rows.filter(row=>row.group===group).map(row=>row.label)])];
  if(['unclassified','adjustments'].includes(group)&&!labels.length)return '';
  const groupValue=column=>column.rows.filter(row=>row.group===group).reduce((n,row)=>n+row.amount,0);
  return `<tr class="analytics-group-row ${group==='unclassified'?'analytics-warning':''}"><th scope="row">${labels.length?`<button type="button" data-analytics-group="${group}" aria-expanded="${!collapsed.has(group)}"><span aria-hidden="true">${collapsed.has(group)?'›':'⌄'}</span>${title}</button>`:title}</th>${columns.map(column=>cell(column,groupValue(column))).join('')}</tr>`+
   labels.map(label=>{
    const format=label==='Баллы за скидки'&&['sales','returns'].includes(group)?points:money;
    const amount=column=>column.rows.filter(row=>row.group===group&&row.label===label).reduce((n,row)=>n+row.amount,0);
    return `<tr class="analytics-detail-row" data-analytics-detail="${group}" ${collapsed.has(group)?'hidden':''}><th scope="row">${esc(label)}</th>${columns.map(column=>cell(column,amount(column),format)).join('')}</tr>`;
   }).join('');
 }).join('');
 return `<caption class="analytics-table-caption">Суммы в рублях. Баллы за скидки показаны отдельно. «—» означает, что данные не загружены.</caption><thead><tr><th scope="col">Статья доходов / расходов</th>${headers}</tr></thead><tbody>${body}<tr class="analytics-net-row"><th scope="row">К выплате за период</th>${columns.map(column=>cell(column,column.total)).join('')}</tr></tbody>`;
}
export function mountOzonAnalytics({root,getState,commitDay,getCredentials,onOpenApi,request=marketRequest,now=()=>new Date()}) {
 let disposed=false,controller=null,mode='days';const collapsed=new Set();
 const today=dayKey(now()),monthStart=today.slice(0,8)+'01';
 root.innerHTML=`<section class="panel ozon-analytics"><div class="analytics-heading"><div><span class="analytics-badge">Ozon · начисления</span><h1>Аналитика</h1><p>Доходы и расходы в таблице: дни по столбцам, статьи по строкам.</p></div><button type="button" data-analytics-api>Настроить доступ Ozon</button></div>
 <form class="analytics-controls"><label>С даты<input type="date" name="from" value="${monthStart}" min="2022-01-01" max="${today}" required></label><label>По дату<input type="date" name="to" value="${today}" min="2022-01-01" max="${today}" required></label><button class="primary" type="submit" id="analytics-refresh">Загрузить из Ozon</button><button type="button" data-analytics-stop hidden>Стоп</button></form>
 <p class="analytics-status" role="status" aria-live="polite"></p>
 <div class="analytics-view" role="group" aria-label="Период аналитики"><button type="button" data-analytics-mode="days" aria-pressed="true">По дням</button><button type="button" data-analytics-mode="weeks" aria-pressed="false">Итоги по неделям</button><button type="button" data-analytics-mode="months" aria-pressed="false">Итоги по месяцам</button></div>
 <div data-analytics-results></div>
 <div class="analytics-table-layout" hidden>
  <div class="analytics-table-scrollbar" role="region" aria-label="Горизонтальная прокрутка таблицы" tabindex="0" hidden><div aria-hidden="true"></div></div>
  <div class="analytics-table-scroll" role="region" aria-label="Таблица начислений Ozon" tabindex="0"><table class="analytics-table"></table></div>
 </div>
 <details class="analytics-help"><summary>Как считаются данные</summary><p>Продажи и возвраты складываются из выручки по цене покупателя, баллов за скидки и выплат по программам партнёров. Возвраты вычитаются. К этой сумме прибавляются начисления с их знаком: вознаграждение Ozon, услуги, штрафы и другие операции.</p><p>«К выплате за период» показывает итог операций за выбранные дни по данным Seller API. В кабинете Ozon в сумму также может войти задолженность на начало периода.</p><p>Периоды определяются по дате начисления. Недели начинаются в понедельник, месяцы календарные. Итоги включают загруженные дни.</p><p>Названия услуг берутся из справочника Ozon. Если разбивка не сходится с итогом операции из API, разница видна отдельной строкой. Чтобы учесть изменения Ozon за прошлые дни, снова загрузите период.</p><p>Загруженные дни сохраняются на устройстве и входят в полный бэкап.</p><a href="https://docs.ozon.ru/api/seller/#operation/GetFinanceAccrualByDay" target="_blank" rel="noopener noreferrer">Описание начислений в API Ozon ↗</a></details></section>`;
 const form=root.querySelector('form'),from=form.elements.from,to=form.elements.to,status=root.querySelector('.analytics-status'),results=root.querySelector('[data-analytics-results]'),stop=root.querySelector('[data-analytics-stop]');
 const tableLayout=root.querySelector('.analytics-table-layout');
 const tableScroll=tableLayout.querySelector('.analytics-table-scroll');
 const table=tableScroll.querySelector('table');
 const scrollbar=tableLayout.querySelector('.analytics-table-scrollbar');
 const scrollbarSpacer=scrollbar.firstElementChild;
 const view=root.ownerDocument.defaultView;

 function updateScrollbar(){
  const {clientWidth,scrollWidth}=tableScroll;
  scrollbar.hidden=!clientWidth||scrollWidth<=clientWidth;
  if(scrollbar.hidden)return;
  // Use the inner width so both tracks have the same horizontal range, even with a vertical scrollbar.
  scrollbar.style.width=`${clientWidth}px`;
  scrollbarSpacer.style.width=`${scrollWidth}px`;
  scrollbar.scrollLeft=tableScroll.scrollLeft;
 }
 scrollbar.onscroll=()=>{
  if(!scrollbar.hidden&&tableScroll.scrollLeft!==scrollbar.scrollLeft)tableScroll.scrollLeft=scrollbar.scrollLeft;
 };
 tableScroll.onscroll=()=>{
  if(!scrollbar.hidden&&scrollbar.scrollLeft!==tableScroll.scrollLeft)scrollbar.scrollLeft=tableScroll.scrollLeft;
 };
 const resizeObserver=view?.ResizeObserver?new view.ResizeObserver(updateScrollbar):null;
 resizeObserver?.observe(tableScroll);
 resizeObserver?.observe(table);
 view?.addEventListener('resize',updateScrollbar);
 view?.addEventListener('workshop:zoom',updateScrollbar);

 const stateDays=()=>getState()?.accounts?.find(account=>account.clientId===String(getCredentials().ozonClient||''))?.days||[];
 const selectedDates=()=>{const dates=dateRange(from.value,to.value);if(to.value>dayKey(now()))throw Error('Будущие дни ещё нельзя загрузить.');return dates;};
 function draw(){
  if(disposed)return;
  let dates;
  try{dates=selectedDates();}catch(error){
   tableLayout.hidden=true;
   results.innerHTML=`<p class="analytics-empty">${esc(error.message)}</p>`;
   return;
  }
  const cached=stateDays(),selected=cached.filter(day=>dates.includes(day.date)),sum=aggregateDays(selected);
  const periods=analyticsPeriods(dates,cached,mode).reverse();
  const {scrollLeft,scrollTop}=tableScroll;
  const needsRefresh=selected.some(day=>day.count>0&&day.breakdownVersion!==accrualBreakdownVersion);
  results.innerHTML=`${analyticsSummary(sum,selected.length>0)}
  <p class="analytics-coverage">${dateLabel(from.value)} — ${dateLabel(to.value)} · загружено ${selected.length} из ${dates.length} дней${selected.length<dates.length?' · итоги неполные':''}</p>
  ${needsRefresh?'<p class="analytics-empty">В выбранном периоде есть дни со старой разбивкой. Нажмите «Загрузить из Ozon», чтобы обновить выручку, баллы и выплаты партнёров.</p>':''}
  ${selected.length?'':'<p class="analytics-empty">За этот период нет сохранённых данных. Нажмите «Загрузить из Ozon». Используется ключ из раздела «API и доступы».</p>'}`;
  table.innerHTML=analyticsTable(periods,sum,mode,selected.length,dates.length,collapsed);
  tableLayout.hidden=false;
  tableScroll.scrollLeft=scrollLeft;
  tableScroll.scrollTop=scrollTop;
  updateScrollbar();
  table.querySelectorAll('[data-analytics-group]').forEach(button=>button.onclick=()=>{
   const group=button.dataset.analyticsGroup,hide=!collapsed.has(group);
   if(hide)collapsed.add(group);else collapsed.delete(group);
   button.setAttribute('aria-expanded',String(!hide));button.querySelector('span').textContent=hide?'›':'⌄';
   table.querySelectorAll(`[data-analytics-detail="${group}"]`).forEach(row=>row.hidden=hide);
  });
 }
 root.querySelector('[data-analytics-api]').onclick=onOpenApi;
 from.onchange=to.onchange=draw;
 const modeButtons=root.querySelectorAll('[data-analytics-mode]');
 modeButtons.forEach(button=>button.onclick=()=>{
  mode=button.dataset.analyticsMode;
  tableScroll.scrollLeft=0;
  tableScroll.scrollTop=0;
  modeButtons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  draw();
 });
 stop.onclick=()=>{controller?.abort();status.textContent='Останавливаем загрузку… Сохранённые дни останутся.';};
 form.onsubmit=async event=>{
  event.preventDefault();if(controller)return;
  let dates;try{dates=selectedDates();}catch(error){status.textContent=error.message;return;}
  const credentials={...getCredentials()},clientId=String(credentials.ozonClient||'');
  if(!clientId||!credentials.ozonKey){status.textContent='Добавьте Client-Id и API-ключ Ozon в разделе «API и доступы».';return;}
  controller=new AbortController();const signal=controller.signal;
  const fields=[...form.querySelectorAll('input,button[type="submit"]')];fields.forEach(field=>field.disabled=true);stop.hidden=false;
  let completed=0;
  const call=async(operation,body)=>{
   signal.throwIfAborted();
   // Requests remain sequential, as required by the finance API. A day is committed only after its last page.
   for(let attempt=0;;attempt++){
    signal.throwIfAborted();
    try{return await request('ozon',operation,credentials,body,(url,options)=>fetch(url,{...options,signal:AbortSignal.any([signal,options.signal].filter(Boolean))}));}
    catch(error){
     if(signal.aborted||error.status!==429||attempt>=3)throw error;
     const delay=Math.max(1000,Number(error.retryAfterMs)||1000*2**attempt);
     if(delay>60000)throw error;
     if(!disposed)status.textContent=`Ozon ограничил частоту запросов. Повтор через ${Math.ceil(delay/1000)} сек. · сохранено ${completed} дней`;
     await pause(delay,signal);
    }
   }
  };
  try{
   status.textContent='Получаем справочник начислений Ozon…';
   const types=parseAccrualTypes(await call('accrualTypes',{}));
   for(const date of dates){
    signal.throwIfAborted();
    status.textContent=`Загружаем ${dateLabel(date)} · ${completed} из ${dates.length} дней сохранено`;
    const day=await fetchAccrualDay(date,call,types,{signal,onPage:page=>{if(!disposed)status.textContent=`${dateLabel(date)} · страница ${page} · сохранено ${completed} из ${dates.length} дней`;}});
    signal.throwIfAborted();
    if(String(getCredentials().ozonClient||'')!==clientId)throw Error('Кабинет Ozon изменился. Загрузка остановлена.');
    if(!await commitDay(clientId,day))throw Error('Не удалось сохранить день на устройстве. Загрузка остановлена.');
    completed++;draw();
   }
   if(!disposed)status.textContent=`Готово. Сохранено ${completed} дней. Повторная загрузка обновит их без дублей.`;
  }catch(error){if(!disposed)status.textContent=signal.aborted?`Остановлено. Сохранено ${completed} из ${dates.length} дней.`:`${error.message} Сохранено ${completed} из ${dates.length} дней. Предыдущие данные остальных дней сохранены.`;}
  finally{controller=null;if(!disposed){fields.forEach(field=>field.disabled=false);stop.hidden=true;draw();}}
 };
 draw();
 return ()=>{
  disposed=true;
  controller?.abort();
  resizeObserver?.disconnect();
  view?.removeEventListener('resize',updateScrollbar);
  view?.removeEventListener('workshop:zoom',updateScrollbar);
 };
}
