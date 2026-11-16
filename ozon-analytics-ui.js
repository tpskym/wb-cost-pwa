import {marketRequest} from './marketplace-api.js?v=0.2.388';
import {analyticsGroups,dayKey,dateRange,parseAccrualTypes,fetchAccrualDay,analyticsPeriods,aggregateDays} from './ozon-analytics.js?v=0.2.388';

const money=value=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB'}).format(value/100);
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
function analyticsTable(periods,sum,mode,loaded,expected,collapsed) {
 const columns=[...periods,{...sum,key:'total',loaded,expected}];
 const cell=(column,value)=>`<td class="${column.key==='total'?'analytics-total-column':''}">${column.loaded?money(value):'—'}</td>`;
 const headers=columns.map(column=>{
  const title=column.key==='total'?'Всего за период':mode==='months'?new Date(column.key+'-01T00:00:00Z').toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}):mode==='weeks'?`Неделя с ${dateLabel(column.key)}`:new Date(column.key+'T00:00:00Z').toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});
  const fullExpected=mode==='weeks'?7:mode==='months'?new Date(Number(column.key.slice(0,4)),Number(column.key.slice(5,7)),0).getDate():1;
  const coverage=column.key!=='total'&&mode==='days'?(column.loaded?'Загружен':'Не загружен'):`${column.loaded} из ${column.expected} дней${column.loaded<(column.key==='total'?column.expected:fullExpected)?' · неполный итог':''}`;
  return `<th scope="col" class="${column.key==='total'?'analytics-total-column':''}">${esc(title)}<small>${coverage}</small></th>`;
 }).join('');
 const body=analyticsGroups.map(([group,title])=>{
  const labels=[...new Set([...(standardRows[group]||[]),...sum.rows.filter(row=>row.group===group).map(row=>row.label)])];
  if(group==='unclassified'&&!labels.length)return '';
  const groupValue=column=>column.rows.filter(row=>row.group===group).reduce((n,row)=>n+row.amount,0);
  return `<tr class="analytics-group-row ${group==='unclassified'?'analytics-warning':''}"><th scope="row">${labels.length?`<button type="button" data-analytics-group="${group}" aria-expanded="${!collapsed.has(group)}"><span aria-hidden="true">${collapsed.has(group)?'›':'⌄'}</span>${title}</button>`:title}</th>${columns.map(column=>cell(column,groupValue(column))).join('')}</tr>`+
   labels.map(label=>`<tr class="analytics-detail-row" data-analytics-detail="${group}" ${collapsed.has(group)?'hidden':''}><th scope="row">${esc(label)}</th>${columns.map(column=>cell(column,column.rows.filter(row=>row.group===group&&row.label===label).reduce((n,row)=>n+row.amount,0))).join('')}</tr>`).join('');
 }).join('');
 return `<p class="analytics-table-hint">${mode==='days'?'Каждый столбец — один день.':mode==='weeks'?'Каждый столбец — одна неделя.':'Каждый столбец — один месяц.'} Прокручивайте таблицу вправо. Названия строк закреплены.</p><div class="analytics-table-scroll" role="region" aria-label="Таблица начислений Ozon" tabindex="0"><table class="analytics-table"><caption class="analytics-table-caption">Начисления Ozon в рублях. «—» означает, что данные не загружены.</caption><thead><tr><th scope="col">Статья доходов / расходов</th>${headers}</tr></thead><tbody>${body}<tr class="analytics-net-row"><th scope="row">Итого начислено</th>${columns.map(column=>cell(column,column.total)).join('')}</tr></tbody></table></div>`;
}
export function mountOzonAnalytics({root,getState,commitDay,getCredentials,onOpenApi,request=marketRequest,now=()=>new Date()}) {
 let disposed=false,controller=null,mode='days';const collapsed=new Set();
 const today=dayKey(now()),monthStart=today.slice(0,8)+'01';
 root.innerHTML=`<section class="panel ozon-analytics"><div class="analytics-heading"><div><span class="analytics-badge">Ozon · начисления</span><h1>Аналитика</h1><p>Доходы и расходы в таблице: дни по столбцам, статьи по строкам.</p></div><button type="button" data-analytics-api>Настроить доступ Ozon</button></div>
 <form class="analytics-controls"><label>С даты<input type="date" name="from" value="${monthStart}" min="2022-01-01" max="${today}" required></label><label>По дату<input type="date" name="to" value="${today}" min="2022-01-01" max="${today}" required></label><button class="primary" type="submit" id="analytics-refresh">Загрузить из Ozon</button><button type="button" data-analytics-stop hidden>Стоп</button></form>
 <p class="analytics-status" role="status" aria-live="polite"></p>
 <div class="analytics-view" role="group" aria-label="Период аналитики"><button type="button" data-analytics-mode="days" aria-pressed="true">По дням</button><button type="button" data-analytics-mode="weeks" aria-pressed="false">Итоги по неделям</button><button type="button" data-analytics-mode="months" aria-pressed="false">Итоги по месяцам</button></div>
 <div data-analytics-results></div>
 <details class="analytics-help"><summary>Как считаются данные</summary><p>Используются фактические начисления Seller API Ozon по дате начисления, а не по дате заказа. Недели начинаются в понедельник, месяцы — календарные. Итоги включают только выбранные и загруженные дни; неполный период отмечается.</p><p>Итого начислено — сумма операций Ozon до вашей себестоимости и налогов. Это не чистая прибыль и не банковская выплата. Баллы за скидки показаны в денежном эквиваленте, полученном из API.</p><p>Названия услуг берутся из справочника Ozon и объединяются по смыслу. Нераспределённая разница сохраняется отдельно. Данные API могут отличаться от кабинета продавца. Ozon может пересчитать прошлые дни — для обновления снова загрузите период.</p><p>Сохраняем каждый полностью загруженный день на этом устройстве. При остановке уже сохранённые дни остаются. Архив «Полный бэкап» включает аналитику.</p><a href="https://docs.ozon.ru/api/seller/#operation/GetFinanceAccrualByDay" target="_blank" rel="noopener noreferrer">Описание начислений в API Ozon ↗</a></details></section>`;
 const form=root.querySelector('form'),from=form.elements.from,to=form.elements.to,status=root.querySelector('.analytics-status'),results=root.querySelector('[data-analytics-results]'),stop=root.querySelector('[data-analytics-stop]');
 const stateDays=()=>getState()?.accounts?.find(account=>account.clientId===String(getCredentials().ozonClient||''))?.days||[];
 const selectedDates=()=>{const dates=dateRange(from.value,to.value);if(to.value>dayKey(now()))throw Error('Будущие дни ещё нельзя загрузить.');return dates;};
 function draw(){
  if(disposed)return;
  let dates;try{dates=selectedDates();}catch(error){results.innerHTML=`<p class="analytics-empty">${esc(error.message)}</p>`;return;}
  const cached=stateDays(),selected=cached.filter(day=>dates.includes(day.date)),sum=aggregateDays(selected);
  const sales=sum.rows.filter(row=>row.group==='sales').reduce((n,row)=>n+row.amount,0),returns=sum.rows.filter(row=>row.group==='returns').reduce((n,row)=>n+row.amount,0);
  const periods=analyticsPeriods(dates,cached,mode).reverse();
  const previousScroll=results.querySelector('.analytics-table-scroll'),scrollLeft=previousScroll?.scrollLeft||0,scrollTop=previousScroll?.scrollTop||0;
  results.innerHTML=`<div class="analytics-summary"><div><span>Продажи</span><strong>${selected.length?money(sales):'—'}</strong></div><div><span>Возвраты</span><strong>${selected.length?money(returns):'—'}</strong></div><div><span>Услуги и прочие начисления</span><strong>${selected.length?money(sum.total-sales-returns):'—'}</strong></div><div class="analytics-net"><span>Итого начислено</span><strong>${selected.length?money(sum.total):'—'}</strong></div></div>
  <p class="analytics-coverage">${dateLabel(from.value)} — ${dateLabel(to.value)} · загружено ${selected.length} из ${dates.length} дней${selected.length<dates.length?' · итоги неполные':''}</p>
  ${selected.length?'':'<p class="analytics-empty">За этот период нет сохранённых данных. Нажмите «Загрузить из Ozon». Используется ключ из раздела «API и доступы».</p>'}
  ${analyticsTable(periods,sum,mode,selected.length,dates.length,collapsed)}`;
  const scroll=results.querySelector('.analytics-table-scroll');scroll.scrollLeft=scrollLeft;scroll.scrollTop=scrollTop;
  results.querySelectorAll('[data-analytics-group]').forEach(button=>button.onclick=()=>{
   const group=button.dataset.analyticsGroup,hide=!collapsed.has(group);
   if(hide)collapsed.add(group);else collapsed.delete(group);
   button.setAttribute('aria-expanded',String(!hide));button.querySelector('span').textContent=hide?'›':'⌄';
   results.querySelectorAll(`[data-analytics-detail="${group}"]`).forEach(row=>row.hidden=hide);
  });
 }
 root.querySelector('[data-analytics-api]').onclick=onOpenApi;
 from.onchange=to.onchange=draw;
 root.querySelectorAll('[data-analytics-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.analyticsMode;const scroll=results.querySelector('.analytics-table-scroll');if(scroll){scroll.scrollLeft=0;scroll.scrollTop=0;}root.querySelectorAll('[data-analytics-mode]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));draw();});
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
 return ()=>{disposed=true;controller?.abort();};
}
