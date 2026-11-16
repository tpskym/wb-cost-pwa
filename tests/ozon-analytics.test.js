import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {summarizeAccruals,parseAccrualTypes,fetchAccrualDay,dateRange,analyticsPeriods,validateAnalytics,feeGroup} from '../ozon-analytics.js';
import {mountOzonAnalytics} from '../ozon-analytics-ui.js';
import {marketRequest} from '../marketplace-api.js';
import {blankProduct,validateDB} from '../calc.js';
import {createBackupSnapshot} from '../backup-modes.js';
const amount=value=>({amount:String(value),currency:'RUB'});
const types=parseAccrualTypes({accrual_types:[{id:1,name:'Логистика',description:'Логистика'},{id:2,name:'Эквайринг',description:'Эквайринг'}]});
const sale={accrual_id:1,date:'2026-11-01',total_amount:amount(60),posting:{products:[{quantity:2,commission:{sale_amount:amount(80),bonus:amount(15),coinvestment:amount(5),commission:amount(-20),sale_commission:amount(-22),seller_price:amount(50),sale_price:amount(40)},delivery:{total_accrued:amount(-20),services:[{type_id:1,accrued:amount(-20)}]}}]}};
test('Ozon totals use actual accrued sums once, excluding informational prices and delivery totals',()=>{
 const day=summarizeAccruals(sale.date,[sale,sale],types);
 assert.equal(day.total,6000);assert.equal(day.count,1);assert.equal(day.rows.filter(r=>r.group==='sales').reduce((n,r)=>n+r.amount,0),10000);
 assert.equal(day.rows.find(r=>r.group==='commission').amount,-2000);assert.equal(day.rows.find(r=>r.group==='delivery').amount,-2000);assert.ok(!day.rows.some(r=>r.group==='unclassified'));
 validateAnalytics({schema:1,accounts:[{clientId:'123',days:[day]}]});
});
test('returns, container, item and non-item fees preserve signs and unknown reconciliation',()=>{
 const returned=structuredClone(sale);returned.accrual_id=2;returned.total_amount=amount(-80);
 for(const key of ['sale_amount','bonus','coinvestment','commission'])returned.posting.products[0].commission[key].amount=String(-Number(returned.posting.products[0].commission[key].amount));
 returned.posting.products[0].delivery=null;
 const fee={accrual_id:3,date:sale.date,total_amount:amount(-12),item_fees:{fees:[{quantity:4,fees:[{type_id:2,accrued:amount(-3)}]}]},container_fees:{fees:[{type_id:91,accrued:amount(-4)}]},non_item_fee:{type_id:92,accrued:amount(-2)}};
 const day=summarizeAccruals(sale.date,[returned,fee],types);
 assert.equal(day.total,-9200);assert.equal(day.rows.find(r=>r.label==='Возврат выручки').amount,-8000);assert.equal(day.rows.find(r=>r.label==='Возврат вознаграждения').amount,2000);
 assert.equal(day.rows.find(r=>r.group==='unclassified').amount,-300);assert.equal(day.rows.find(r=>r.group==='partners').amount,-300);
 assert.equal(day.rows.reduce((n,r)=>n+r.amount,0),day.total);
});
test('money format, date mismatches and conflicting duplicate accruals fail instead of replacing saved days',()=>{
 assert.throws(()=>summarizeAccruals('2026-11-02',[sale],types),/другую дату/);
 assert.throws(()=>summarizeAccruals(sale.date,[{...sale,total_amount:amount('oops')}],types),/формат/);
 assert.throws(()=>summarizeAccruals(sale.date,[{...sale,total_amount:{amount:'5',currency:'USD'}}],types),/валют/);
 assert.throws(()=>summarizeAccruals(sale.date,[sale,{...sale,total_amount:amount(99)}],types),/разные данные/);
});
test('pagination continues through empty pages with cursors and terminates only at empty last_id',async()=>{
 const calls=[];const pages=[{accruals:[],last_id:'next'},{accruals:[sale],last_id:'last'},{accruals:[sale],last_id:''}];
 const day=await fetchAccrualDay(sale.date,async(op,body)=>{calls.push([op,body]);return pages.shift();},types);
 assert.equal(day.total,6000);assert.deepEqual(calls.map(c=>c[1].last_id),['','next','last']);assert.ok(calls.every(c=>c[1].date===sale.date));
 await assert.rejects(fetchAccrualDay(sale.date,async()=>({accruals:[],last_id:'same'}),types),/повторил/);
 await assert.rejects(fetchAccrualDay(sale.date,async()=>({last_id:''}),types),/Неполный/);
});
test('stop after response prevents committing a partially loaded day',async()=>{
 const controller=new AbortController();
 await assert.rejects(fetchAccrualDay(sale.date,async()=>{controller.abort();return {accruals:[sale],last_id:''};},types,{signal:controller.signal}),{name:'AbortError'});
});
test('calendar grouping uses Monday and actual loaded coverage across month/year boundaries',()=>{
 const dates=dateRange('2025-12-28','2026-01-04');
 const days=[{date:'2025-12-28',count:1,total:100,rows:[{group:'sales',label:'Выручка',amount:100}]},{date:'2026-01-01',count:1,total:200,rows:[{group:'sales',label:'Выручка',amount:200}]}];
 const weeks=analyticsPeriods(dates,days,'weeks');assert.equal(weeks[0].key,'2025-12-29');assert.equal(weeks[0].loaded,1);assert.equal(weeks[0].expected,7);assert.equal(weeks[0].total,200);
 const months=analyticsPeriods(dates,days,'months');assert.equal(months[0].key,'2026-01');assert.equal(months[1].total,100);
 assert.throws(()=>dateRange('2026-02-30','2026-03-01'),/корректный/);assert.throws(()=>dateRange('2025-01-01','2026-01-02'),/366/);
 assert.equal(analyticsPeriods(dates,days,'days').find(p=>p.key==='2026-01-02').loaded,0);
});
test('known service families are separated and unknown fees remain visible',()=>{
 for(const label of ['Обработка отправления Drop-off партнёрами','Упаковка товара партнёрами','Обработка возвратов, отмен и невыкупов партнёрами','Эквайринг','Доставка до места выдачи партнёрами'])assert.equal(feeGroup(label),'partners',label);
 assert.equal(feeGroup('Доставка до места выдачи силами Ozon'),'delivery');assert.equal(feeGroup('Продвижение с оплатой за заказ'),'promotion');assert.equal(feeGroup('Обеспечение материалами для упаковки товара'),'other');
});
test('new Ozon routes use POST and exact body',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push([url,options]);return {ok:true,text:async()=>'{"accruals":[],"last_id":""}'};};
 for(const operation of ['accrualDay','accrualTypes'])await marketRequest('ozon',operation,{ozonClient:'123',ozonKey:'test'},operation==='accrualDay'?{date:sale.date,last_id:''}:{},fetcher);
 assert.ok(calls[0][0].endsWith('/v1/finance/accrual/by-day'));assert.ok(calls[1][0].endsWith('/v1/finance/accrual/types'));assert.equal(calls[0][1].method,'POST');
});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('analytics UI loads days, replaces updates, shows periods and isolates Ozon accounts',async()=>{
 const dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root');let state={schema:1,accounts:[]},client='123';
 const options={root,getState:()=>state,getCredentials:()=>({ozonClient:client,ozonKey:'test'}),now:()=>new Date('2026-11-01T12:00:00Z'),onOpenApi:()=>{},request:async(market,op)=>op==='accrualTypes'?{accrual_types:[]}:{accruals:[sale],last_id:''},commitDay:async(clientId,day)=>{state={schema:1,accounts:[{clientId,days:[day]}]};return true;}};
 const dispose=mountOzonAnalytics(options);assert.match(root.textContent,/нет сохранённых данных/);
 root.querySelector('#analytics-refresh').click();await tick();await tick();
 assert.match(root.querySelector('[role=status]').textContent,/Готово/);assert.match(root.textContent,/60,00/);assert.equal(state.accounts[0].days.length,1);
 root.querySelector('#analytics-refresh').click();await tick();await tick();assert.equal(state.accounts[0].days.length,1);
 root.querySelector('[data-analytics-mode="weeks"]').click();assert.match(root.textContent,/Неделя с/);assert.match(root.textContent,/неполный итог/);
 client='456';root.querySelector('[data-analytics-mode="days"]').click();assert.match(root.textContent,/нет сохранённых данных/);dispose();dom.window.close();
});
test('failed day leaves cached data intact; navigation cancels before saving pending request',async()=>{
 const dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root');let commits=0,resolve;
 const dispose=mountOzonAnalytics({root,getState:()=>null,getCredentials:()=>({ozonClient:'123',ozonKey:'test'}),now:()=>new Date('2026-11-01T12:00:00Z'),onOpenApi:()=>{},request:async(market,op)=>op==='accrualTypes'?{accrual_types:[]}:new Promise(r=>resolve=r),commitDay:async()=>{commits++;return true;}});
 root.querySelector('#analytics-refresh').click();await tick();dispose();resolve({accruals:[sale],last_id:''});await tick();assert.equal(commits,0);dom.window.close();
});
test('full backup preserves financial days, cost-only transfer excludes them, invalid totals are rejected',()=>{
 const day=summarizeAccruals(sale.date,[sale],types),db={schema:1,id:'analytics-backup',products:[blankProduct()],ozonAnalytics:{schema:1,accounts:[{clientId:'123',days:[day]}]}};
 const full=validateDB(createBackupSnapshot(db,'full'));assert.deepEqual(full.ozonAnalytics,db.ozonAnalytics);
 assert.equal(createBackupSnapshot(db,'costs').ozonAnalytics,undefined);
 full.ozonAnalytics.accounts[0].days[0].total++;assert.throws(()=>validateDB(full),/итог аналитики/);
});
test('rate-limit wait can be stopped without saving and failed refresh keeps old day',async()=>{
 const dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root'),day=summarizeAccruals(sale.date,[sale],types);let commits=0;
 const state={schema:1,accounts:[{clientId:'123',days:[day]}]};
 const dispose=mountOzonAnalytics({root,getState:()=>state,getCredentials:()=>({ozonClient:'123',ozonKey:'test'}),now:()=>new Date('2026-11-01T12:00:00Z'),onOpenApi:()=>{},request:async()=>{throw Object.assign(Error('Лимит'),{status:429,retryAfterMs:1000});},commitDay:async()=>{commits++;return true;}});
 root.querySelector('#analytics-refresh').click();await tick();assert.match(root.querySelector('[role=status]').textContent,/частоту/);root.querySelector('[data-analytics-stop]').click();await tick();assert.match(root.querySelector('[role=status]').textContent,/Остановлено/);assert.equal(commits,0);assert.equal(state.accounts[0].days[0],day);assert.equal(root.querySelector('#analytics-refresh').disabled,false);dispose();dom.window.close();
});

test('days are chronological columns with aligned detail rows, missing markers and period total',()=>{
 const dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root');
 const first=summarizeAccruals('2026-11-01',[sale],types),last={date:'2026-11-03',updatedAt:'2026-11-03T12:00:00Z',count:0,total:0,rows:[]};
 const dispose=mountOzonAnalytics({root,getState:()=>({accounts:[{clientId:'123',days:[first,last]}]}),getCredentials:()=>({ozonClient:'123'}),now:()=>new Date('2026-11-03T12:00:00Z'),onOpenApi:()=>{},commitDay:async()=>true});
 const headers=[...root.querySelectorAll('thead th')].map(e=>e.textContent);
 assert.match(headers[1],/01\.11\.2026/);assert.match(headers[2],/02\.11\.2026.*Не загружен/);assert.match(headers[3],/03\.11\.2026/);assert.match(headers[4],/Всего за период/);
 const revenue=[...root.querySelectorAll('tbody tr')].find(row=>row.querySelector('th').textContent==='Выручка');
 assert.deepEqual([...revenue.querySelectorAll('td')].map(e=>e.textContent.replace(/\s/g,'')),['80,00₽','—','0,00₽','80,00₽']);
 assert.equal(root.querySelectorAll('.analytics-net-row td').length,4);
 const button=root.querySelector('[data-analytics-group="sales"]');button.click();assert.equal(revenue.hidden,true);assert.equal(button.getAttribute('aria-expanded'),'false');button.click();assert.equal(revenue.hidden,false);
 root.querySelector('[data-analytics-mode="months"]').click();assert.equal(root.querySelectorAll('thead th').length,3);assert.match(root.querySelector('thead').textContent,/ноябрь 2026/);
 dispose();dom.window.close();
});
