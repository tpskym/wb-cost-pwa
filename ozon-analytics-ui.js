import {marketRequest} from './marketplace-api.js?v=0.2.392';
import {accrualBreakdownVersion,analyticsGroups,dayKey,dateRange,parseAccrualTypes,fetchAccrualDay,analyticsPeriods,aggregateDays} from './ozon-analytics.js?v=0.2.392';
import {mountOzonClusterOrders} from './ozon-cluster-orders.js?v=0.2.399';
import {loadWbAccrualDays,requestWbFinanceReport,wbAccrualDays,wbAnalyticsGroups,wbSellerId} from './wb-analytics.js?v=0.2.397';

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
const reports=[['accruals','Начисления WB и Ozon'],['clusters','Заказы по кластерам Ozon']];

export function mountAnalyticsWorkspace({root,state,getState,commitDay,getWbState,commitWbDays,getCredentials,getProducts,onOpenApi}){
 root.innerHTML=`
  <nav class="analytics-report-list" aria-labelledby="analytics-reports-label">
   <h2 id="analytics-reports-label">Отчёты</h2>
   ${reports.map(([id,label])=>`<button type="button" data-analytics-report="${id}" aria-pressed="false"><span>${label}</span></button>`).join('')}
  </nav>
  <label class="analytics-report-picker">Отчёт
   <select class="ui-select" data-analytics-report-picker>${reports.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select>
  </label>
  ${reports.map(([id])=>`<div data-analytics-report-panel="${id}" hidden></div>`).join('')}`;
 const buttons=root.querySelectorAll('[data-analytics-report]');
 const picker=root.querySelector('[data-analytics-report-picker]');
 const panels=new Map([...root.querySelectorAll('[data-analytics-report-panel]')].map(panel=>[panel.dataset.analyticsReportPanel,panel]));
 const mounted=new Map();
 const mount={
  accruals:root=>mountAccrualAnalytics({root,getState,commitDay,getWbState,commitWbDays,getCredentials,onOpenApi}),
  clusters:root=>mountOzonClusterOrders({root,state:state.clusters,getCredentials,getProducts,onOpenApi})
 };
 function show(report){
  state.report=report;
  for(const [id,panel] of panels)panel.hidden=id!==report;
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.analyticsReport===report));
  picker.value=report;
  if(!mounted.has(report))mounted.set(report,mount[report](panels.get(report)));
 }
 function select(report){
  if(report===state.report)return;
  show(report);
  root.ownerDocument.defaultView?.scrollTo?.({top:0,behavior:'instant'});
 }
 for(const button of buttons)button.onclick=()=>select(button.dataset.analyticsReport);
 picker.onchange=()=>select(picker.value);
 show(panels.has(state.report)?state.report:'accruals');
 return ()=>{for(const dispose of mounted.values())dispose();};
}

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

const platforms={ozon:'Ozon',wb:'WB'};
const platformGroups=Object.entries(platforms);
const viewGroups={ozon:analyticsGroups,wb:wbAnalyticsGroups,all:platformGroups};
const payoutLabels={ozon:'К выплате за период',wb:'Итого к оплате WB',all:'Общий итог к выплате'};
const headings={ozon:'Начисления Ozon',wb:'Начисления WB',all:'Начисления WB и Ozon'};

function combineAccruals(ozon,wb){
 const markets={ozon,wb};
 const rows=platformGroups.flatMap(([market])=>viewGroups[market].flatMap(([group,label])=>{
  const entries=markets[market].rows.filter(row=>row.group===group);
  return entries.length?[{group:market,label,amount:entries.reduce((sum,row)=>sum+row.amount,0)}]:[];
 }));
 return {...ozon,markets,rows,loaded:ozon.loaded+wb.loaded,expected:ozon.expected+wb.expected,total:ozon.total+wb.total};
}

function payoutSummary(sum,market){
 if(market==='ozon')return analyticsSummary(sum,sum.loaded>0);
 const value=(amount,available)=>available?money(amount):'—';
 const card=(label,amount,available)=>`<section class="analytics-summary-block"><div class="analytics-summary-heading"><h2>${label}</h2><strong>${value(amount,available)}</strong></div></section>`;
 const rows=market==='all'?
  platformGroups.map(([key,name])=>card(`${name} · к выплате`,sum.markets[key].total,sum.markets[key].loaded)).join(''):
  card('Продажи за вычетом возвратов',sum.rows.find(row=>row.group==='sales')?.amount??0,sum.loaded)+
  card('К перечислению за товар',sum.rows.filter(row=>['sales','settlement'].includes(row.group)).reduce((n,row)=>n+row.amount,0),sum.loaded);
 return `<div class="analytics-summary">${rows}<div class="analytics-net"><h2>${payoutLabels[market]}</h2><strong>${value(sum.total,sum.loaded)}</strong></div></div>`;
}

function coverageLabel(column,day=false){
 if(column.markets)return platformGroups.map(([key,label])=>{
  const {loaded,expected}=column.markets[key];
  return day?`${label} ${loaded?'✓':'—'}`:`${label} ${loaded}/${expected}`;
 }).join(' · ');
 return day?(column.loaded?'Загружен':'Не загружен'):`${column.loaded} из ${column.expected} дней`;
}

function analyticsTable(periods,sum,mode,collapsed,market) {
 const columns=[...periods,{...sum,key:'total'}];
 const cell=(column,value,format=money,group)=>`<td class="${column.key==='total'?'analytics-total-column':''}">${(column.markets?.[group]?.loaded??column.loaded)?format(value):'—'}</td>`;
 const headers=columns.map(column=>{
  const title=column.key==='total'?'Всего за период':mode==='months'?new Date(column.key+'-01T00:00:00Z').toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}):mode==='weeks'?`Неделя с ${dateLabel(column.key)}`:new Date(column.key+'T00:00:00Z').toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});
  const fullExpected=mode==='weeks'?7:mode==='months'?new Date(Number(column.key.slice(0,4)),Number(column.key.slice(5,7)),0).getDate():1;
  const day=column.key!=='total'&&mode==='days';
  const expected=column.key==='total'?column.expected:fullExpected*(market==='all'?2:1);
  const coverage=coverageLabel(column,day)+(!day&&column.loaded<expected?' · неполный итог':'');
  return `<th scope="col" class="${column.key==='total'?'analytics-total-column':''}">${esc(title)}<small>${coverage}</small></th>`;
 }).join('');
 const body=viewGroups[market].map(([group,title])=>{
  const labels=[...new Set([...(market==='ozon'?standardRows[group]||[]:[]),...sum.rows.filter(row=>row.group===group).map(row=>row.label)])];
  if(['unclassified','adjustments'].includes(group)&&!labels.length)return '';
  const groupValue=column=>column.markets?.[group]?.total??column.rows.filter(row=>row.group===group).reduce((n,row)=>n+row.amount,0);
  return `<tr class="analytics-group-row ${group==='unclassified'?'analytics-warning':''}"><th scope="row">${labels.length?`<button type="button" data-analytics-group="${group}" aria-expanded="${!collapsed.has(group)}"><span aria-hidden="true">${collapsed.has(group)?'›':'⌄'}</span>${title}</button>`:title}</th>${columns.map(column=>cell(column,groupValue(column),money,group)).join('')}</tr>`+
   labels.map(label=>{
    const format=label==='Баллы за скидки'&&['sales','returns'].includes(group)?points:money;
    const amount=column=>column.rows.filter(row=>row.group===group&&row.label===label).reduce((n,row)=>n+row.amount,0);
    return `<tr class="analytics-detail-row" data-analytics-detail="${group}" ${collapsed.has(group)?'hidden':''}><th scope="row">${esc(label)}</th>${columns.map(column=>cell(column,amount(column),format,group)).join('')}</tr>`;
   }).join('');
 }).join('');
 return `<caption class="analytics-table-caption">Суммы в рублях. ${market==='ozon'?'Баллы за скидки показаны отдельно. ':''}«—» означает отсутствие загруженных данных.</caption><thead><tr><th scope="col">Статья доходов / расходов</th>${headers}</tr></thead><tbody>${body}<tr class="analytics-net-row"><th scope="row">${payoutLabels[market]}</th>${columns.map(column=>cell(column,column.total)).join('')}</tr></tbody>`;
}
export function mountOzonAnalytics(options){
 return mountAccrualAnalytics(options);
}

export function mountAccrualAnalytics({root,getState,commitDay,getWbState=()=>undefined,commitWbDays,getCredentials,onOpenApi,request=marketRequest,requestWb=requestWbFinanceReport,now=()=>new Date()}) {
 let disposed=false,controller=null,mode='days';const collapsed=new Set();
 let market=commitWbDays?'all':'ozon';
 const today=dayKey(now()),monthStart=today.slice(0,8)+'01';
 root.innerHTML=`<section class="panel ozon-analytics"><div class="analytics-heading"><div><h1>${headings[market]}</h1><p>Доходы и расходы по дням с итогами за недели и месяцы.</p></div><button type="button" data-analytics-api>${commitWbDays?'Настроить доступ API':'Настроить доступ Ozon'}</button></div>
 ${commitWbDays?`<div class="analytics-view analytics-market-view" role="group" aria-label="Площадка">${[['all','Все площадки'],...platformGroups].map(([key,label])=>`<button type="button" data-analytics-market="${key}" aria-pressed="${key===market}">${label}</button>`).join('')}</div>`:''}
 <form class="analytics-controls"><label>С даты<input type="date" name="from" value="${monthStart}" min="2022-01-01" max="${today}" required></label><label>По дату<input type="date" name="to" value="${today}" min="2022-01-01" max="${today}" required></label><button class="primary" type="submit" id="analytics-refresh">Загрузить из Ozon</button><button type="button" data-analytics-stop hidden>Стоп</button></form>
 <p class="analytics-status" role="status" aria-live="polite"></p>
 <div class="analytics-view" role="group" aria-label="Период аналитики"><button type="button" data-analytics-mode="days" aria-pressed="true">По дням</button><button type="button" data-analytics-mode="weeks" aria-pressed="false">Итоги по неделям</button><button type="button" data-analytics-mode="months" aria-pressed="false">Итоги по месяцам</button></div>
 <div data-analytics-results></div>
 <div class="analytics-table-layout" hidden>
  <div class="analytics-table-scrollbar" role="region" aria-label="Горизонтальная прокрутка таблицы" tabindex="0" hidden><div aria-hidden="true"></div></div>
  <div class="analytics-table-scroll" role="region" aria-label="Таблица начислений" tabindex="0"><table class="analytics-table"></table></div>
 </div>
 <details class="analytics-help"><summary>Как считаются данные</summary>
 ${commitWbDays?'<p>Общий итог складывается из суммы к выплате Ozon и «Итого к оплате» ежедневных отчётов WB. Если отчёт одной площадки ещё не загружен, итог включает доступные суммы.</p><p>Для загрузки WB нужен персональный или сервисный токен категории «Финансы». В разрезе WB продажи показаны за вычетом возвратов, а строка «К перечислению за товар» в сводке уже учитывает комиссию и платёжные расходы.</p>':''}<p>Продажи и возвраты складываются из выручки по цене покупателя, баллов за скидки и выплат по программам партнёров. Возвраты вычитаются. К этой сумме прибавляются начисления с их знаком: вознаграждение Ozon, услуги, штрафы и другие операции.</p><p>«К выплате за период» показывает итог операций за выбранные дни по данным Seller API. В кабинете Ozon в сумму также может войти задолженность на начало периода.</p><p>Периоды определяются по дате начисления. Недели начинаются в понедельник, месяцы календарные. Итоги включают загруженные дни.</p><p>Названия услуг берутся из справочника Ozon. Если разбивка не сходится с итогом операции из API, разница видна отдельной строкой. Чтобы учесть изменения Ozon за прошлые дни, снова загрузите период.</p><p>Загруженные дни сохраняются на устройстве и входят в полный бэкап.</p><a href="https://docs.ozon.ru/api/seller/#operation/GetFinanceAccrualByDay" target="_blank" rel="noopener noreferrer">Описание начислений в API Ozon ↗</a></details></section>`;
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
 const refresh=form.querySelector('[type="submit"]');
 const marketButtons=root.querySelectorAll('[data-analytics-market]');
 const selectedDates=()=>{const dates=dateRange(from.value,to.value);if(to.value>dayKey(now()))throw Error('Будущие дни ещё нельзя загрузить.');return dates;};
 function draw(){
  if(disposed)return;
  let dates;
  try{dates=selectedDates();}catch(error){
   tableLayout.hidden=true;
   results.innerHTML=`<p class="analytics-empty">${esc(error.message)}</p>`;
   return;
  }
  const {scrollLeft,scrollTop}=tableScroll;
  const datesSet=new Set(dates);
  const ozon=market==='wb'?[]:stateDays().filter(day=>datesSet.has(day.date));
  const wb=market==='ozon'?[]:wbAccrualDays(getWbState(),wbSellerId(getCredentials().wbToken)).filter(day=>datesSet.has(day.date));
  const dataset=days=>({...aggregateDays(days),loaded:days.length,expected:dates.length});
  let sum,periods;
  if(market==='all'){
   sum=combineAccruals(dataset(ozon),dataset(wb));
   const wbPeriods=analyticsPeriods(dates,wb,mode);
   periods=analyticsPeriods(dates,ozon,mode).map((period,index)=>combineAccruals(period,wbPeriods[index]));
  }else{
   const days=market==='wb'?wb:ozon;
   sum=dataset(days);
   periods=analyticsPeriods(dates,days,mode);
  }
  const needsRefresh=ozon.some(day=>day.count>0&&day.breakdownVersion!==accrualBreakdownVersion);
  results.innerHTML=`${payoutSummary(sum,market)}
  <p class="analytics-coverage">${dateLabel(from.value)} — ${dateLabel(to.value)} · ${coverageLabel(sum)}${sum.loaded<sum.expected?' · итоги неполные':''}</p>
  ${needsRefresh?'<p class="analytics-empty">В выбранном периоде есть дни со старой разбивкой Ozon. Обновите период, чтобы пересчитать выручку, баллы и выплаты партнёров.</p>':''}
  ${sum.loaded?'':'<p class="analytics-empty">За этот период нет сохранённых данных. Для загрузки используются ключи из раздела «API и доступы».</p>'}`;
  table.innerHTML=analyticsTable(periods.reverse(),sum,mode,collapsed,market);
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
 from.onchange=to.onchange=()=>{
  status.textContent='';
  draw();
 };
 const modeButtons=root.querySelectorAll('[data-analytics-mode]');
 modeButtons.forEach(button=>button.onclick=()=>{
  mode=button.dataset.analyticsMode;
  tableScroll.scrollLeft=0;
  tableScroll.scrollTop=0;
  modeButtons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  draw();
 });
 function selectMarket(next){
  if(market!==next)status.textContent='';
  market=next;
  root.querySelector('h1').textContent=headings[market];
  refresh.textContent=market==='all'?'Загрузить WB и Ozon':'Загрузить из '+platforms[market];
  for(const button of marketButtons)button.setAttribute('aria-pressed',String(button.dataset.analyticsMarket===market));
  tableScroll.scrollLeft=0;
  tableScroll.scrollTop=0;
  draw();
 }
 for(const button of marketButtons)button.onclick=()=>selectMarket(button.dataset.analyticsMarket);

 async function loadOzon(dates,credentials,signal,progress){
  const clientId=String(credentials.ozonClient||'');
  if(!clientId||!credentials.ozonKey)throw Error('Добавьте Client-Id и API-ключ Ozon в разделе «API и доступы».');
  let completed=0;
  const call=async(operation,body)=>{
   for(let attempt=0;;attempt++){
    signal.throwIfAborted();
    try{
     return await request('ozon',operation,credentials,body,(url,options)=>fetch(url,{
      ...options,signal:AbortSignal.any([signal,options.signal].filter(Boolean))
     }));
    }catch(error){
     if(signal.aborted||error.status!==429||attempt>=3)throw error;
     const delay=Math.max(1000,Number(error.retryAfterMs)||1000*2**attempt);
     if(delay>60000)throw error;
     progress(`Ozon ограничил частоту запросов. Повтор через ${Math.ceil(delay/1000)} сек. · сохранено ${completed} дней`);
     await pause(delay,signal);
    }
   }
  };
  try{
   progress('Получаем справочник начислений Ozon…');
   const types=parseAccrualTypes(await call('accrualTypes',{}));
   for(const date of dates){
    signal.throwIfAborted();
    progress(`Ozon · ${dateLabel(date)} · ${completed} из ${dates.length} дней сохранено`);
    const day=await fetchAccrualDay(date,call,types,{signal,onPage:page=>progress(`Ozon · ${dateLabel(date)} · страница ${page}`)});
    signal.throwIfAborted();
    if(String(getCredentials().ozonClient||'')!==clientId)throw Error('Кабинет Ozon изменился.');
    if(!await commitDay(clientId,day))throw Error('Не удалось сохранить день Ozon.');
    completed++;
    draw();
   }
   return `Готово. Ozon · сохранено ${completed} из ${dates.length} дней.`;
  }catch(error){
   const message=signal.aborted?'Остановлено.':error.message;
   throw Error(`${message} Сохранено ${completed} из ${dates.length} дней Ozon.`);
  }
 }

 async function loadWb(dates,credentials,signal,progress){
  const sellerId=wbSellerId(credentials.wbToken);
  if(!sellerId)throw Error('Добавьте персональный или сервисный токен WB с категорией «Финансы» в разделе «API и доступы».');
  const days=await loadWbAccrualDays(dates,body=>requestWb(credentials.wbToken,body,signal),{signal,onProgress:progress});
  signal.throwIfAborted();
  if(wbSellerId(getCredentials().wbToken)!==sellerId)throw Error('Кабинет WB изменился.');
  if(!await commitWbDays(sellerId,dates,days))throw Error('Не удалось сохранить отчёты WB.');
  draw();
  return days.length?`WB · сохранено ${days.length} из ${dates.length} дней.`:'WB · за выбранный период ежедневные отчёты пока отсутствуют.';
 }

 stop.onclick=()=>controller?.abort();
 form.onsubmit=async event=>{
  event.preventDefault();
  if(controller)return;
  let dates;
  try{dates=selectedDates();}catch(error){status.textContent=error.message;return;}
  controller=new AbortController();
  const {signal}=controller,credentials=getCredentials();
  const fields=[from,to,refresh,...marketButtons];
  for(const field of fields)field.disabled=true;
  stop.hidden=false;
  const messages=[];
  const progress=message=>{if(!disposed)status.textContent=[...messages,message].join(' ');};
  try{
   const targets=market==='all'?['wb','ozon']:[market];
   for(const target of targets){
    if(signal.aborted)break;
    try{
     const load=target==='wb'?loadWb:loadOzon;
     messages.push(await load(dates,credentials,signal,progress));
    }catch(error){
     messages.push(signal.aborted?(target==='wb'?'Загрузка WB остановлена.':error.message):platforms[target]+' · '+error.message);
    }
   }
   progress('');
  }finally{
   controller=null;
   if(!disposed){
    for(const field of fields)field.disabled=false;
    stop.hidden=true;
    draw();
   }
  }
 };
 selectMarket(market);
 return ()=>{
  disposed=true;
  controller?.abort();
  resizeObserver?.disconnect();
  view?.removeEventListener('resize',updateScrollbar);
  view?.removeEventListener('workshop:zoom',updateScrollbar);
 };
}
