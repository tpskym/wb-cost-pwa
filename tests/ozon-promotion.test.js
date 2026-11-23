import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {blankProduct,validateDB} from '../calc.js';
import {marketRequest} from '../marketplace-api.js';
import {loadOzonQueries,loadRecentOzonQueries,parseOzonPromotion,promotionDays} from '../ozon-promotion.js';
import {mountOzonPromotion} from '../ozon-promotion-ui.js';

const article='stand-white';
const dates={from:'2026-11-19',to:'2026-11-21'};
const row=(date,sku,clicks,expense)=>[date,sku,100,clicks,expense,3,600];
const workbook=(campaign,rows)=>[{name:'Статистика',rows:[
 [`Кампания по продвижению товаров № ${campaign}, период 19.11.2026–21.11.2026`],
 ['Дата','SKU','Показы','Клики','Расход, ₽, с НДС','Заказы','Продажи, ₽'],
 ...rows
]}];

test('search queries use the exact Ozon SKU and display the actual reporting period in Moscow',async()=>{
 const credentials={ozonClient:'123',ozonKey:'fake-key'};
 const result=await loadOzonQueries(['444','445'],dates,(operation,body)=>marketRequest('ozon',operation,credentials,body,async(url,options)=>{
  assert.equal(url,'https://api-seller.ozon.ru/v1/analytics/product-queries/details');
  assert.equal(options.headers['Client-Id'],'123');
  assert.deepEqual(JSON.parse(options.body),{
   skus:['444','445'],page:0,page_size:100,limit_by_sku:15,date_from:'2026-11-19T00:00:00.000+03:00',
   date_to:'2026-11-21T23:59:59.999+03:00',sort_by:'BY_SEARCHES',sort_dir:'DESCENDING'
  });
  return Response.json({analytics_period:{date_from:'2026-11-18T21:00:00Z',date_to:'2026-11-21T20:59:59Z'},page_count:1,queries:[
   {sku:444,query:'подставка',unique_search_users:'12',unique_view_users:0},
   {sku:445,query:'подставка',unique_search_users:20,order_count:2,gmv:399,currency:'RUB'},
   {sku:555,query:'другой товар',unique_search_users:55}
  ]});
 }));
 assert.deepEqual(result.period,dates);
 assert.deepEqual(result.rows.map(row=>[row.sku,row.query,row.searches,row.views,row.currency]),
  [['445','подставка',20,null,'₽'],['444','подставка',12,0,'']]);
});

test('advertising statistics distinguish zero, missing metrics and days without data',()=>{
 const first=parseOzonPromotion(workbook('1000',[
  row('19.11.2026',444,0,0),row(new Date('2026-11-20'),444,5,'25,00'),
  row('20.11.2026',555,15,35),row('21.11.2026','Всего',20,60)
 ]),{article,ids:['444']});
 const second=parseOzonPromotion(workbook('2000',[row('20.11.2026',444,10,'37,50')]),{article,ids:['444']});
 const days=promotionDays([...first.rows,...second.rows],dates.from,dates.to);
 assert.deepEqual(days.map(day=>day.metrics?.clicks??null),[0,15,null]);
 assert.deepEqual(days.map(day=>day.metrics?.expense??null),[0,62.5,null]);
 assert.equal(days[1].metrics.cart,null);
 assert.equal(promotionDays(first.rows,dates.from,dates.to,'2000').every(day=>day.metrics===null),true);
 const aggregate=workbook('1000',[row('19.11.2026',444,5,25)]);
 aggregate[0].rows[1][0]='Дата добавления';
 assert.throws(()=>parseOzonPromotion(aggregate,{article,ids:['444']}),/группировку «По дням»/);
 const rollup=workbook('1000',[row('19.11.2026–21.11.2026',444,5,25)]);
 assert.throws(()=>parseOzonPromotion(rollup,{article,ids:['444']}),/группировку «По дням»/);
 assert.throws(()=>parseOzonPromotion(aggregate,{article,ids:['444'],campaignOverride:'2000'}),/группировку «По дням»/);
});

test('positive sales with a zero count stay unconfirmed when the second response is from a different period',async()=>{
 const result=await loadRecentOzonQueries(['444'],'2026-11-23',async(operation,body)=>{
  assert.equal(operation,'productQueries');
  const recheck=body.sort_by==='BY_GMV';
  return {
   analytics_period:{date_from:recheck?'2026-11-15':'2026-11-16',date_to:'2026-11-22'},
   page_count:1,queries:[
    {sku:444,query:'подставка для эпл вотч',order_count:recheck?1:0,gmv:236,currency:'RUB'},
    {sku:444,query:'часы',order_count:0,gmv:0,currency:'RUB'}
   ]
  };
 });
 assert.deepEqual(result.rows.map(row=>[row.orders,row.sales]),[[null,236],[0,0]]);
});

test('promotion UI imports and updates a campaign by day and preserves a note in the database',async()=>{
 const {window}=new JSDOM('<main></main>');
 const doc=window.document,root=doc.querySelector('main');
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 window.HTMLDialogElement.prototype.close=function(){this.open=false;this.onclose?.();};
 const p={...blankProduct(),id:'p1',sku:article,name:'Подставка'};
 const database={schema:1,id:'db',products:[p]};
 let sheet=workbook('1010',[row('20.11.2026',444,8,24)]);
 const calls=[],state={filters:{productId:p.id,...dates}};
 const mount=()=>mountOzonPromotion({
  root,state,getProducts:()=>[p],getSelectedProductId:()=>p.id,hydrateProductImages:()=>{},
  getCredentials:()=>({ozonClient:'123',ozonKey:'fake'}),getPromotion:()=>database.ozonPromotion??{products:[]},
  savePromotion:next=>{database.ozonPromotion=next;validateDB(structuredClone(database));return true;},
  loadWorkbook:async()=>sheet,now:()=>new Date('2026-11-23T10:00:00Z'),
  request:async(market,op,credentials,body)=>{
   assert.equal(market,'ozon');calls.push(op);
   if(op==='info'){
    assert.deepEqual(body.offer_id,[article]);
    return {items:[{offer_id:'other',sku:555},{offer_id:article,sources:[{sku:444}]}]};
   }
   assert.deepEqual(body.skus,['444']);
   return {queries:[{sku:444,query:'подставка <img>',unique_search_users:10}],page_count:1};
  }
 });
 let dispose=mount();
 await root.querySelector('[data-load-queries]').onclick();
 assert.match(root.querySelector('[data-query-results]').textContent,/подставка <img>/);
 assert.equal(root.querySelector('[data-query-results] img'),null);
 root.querySelector('[data-promotion-tab="daily"]').click();
 const addNote=root.querySelector('[data-promotion-note="2026-11-20"]');
 addNote.click();
 const form=doc.querySelector('dialog form');
 form.elements.text.value='Поднял ставку до 10 ₽';
 form.elements.time.value='13:40';
 await form.onsubmit({preventDefault(){}});
 assert.match(root.querySelector('[data-promotion-note="2026-11-20"]').textContent,/13:40 МСК.*Поднял ставку/);
 const importFile=async()=>{
  const input=root.querySelector('[data-promotion-file]');
  Object.defineProperty(input,'files',{value:[{name:'campaign.xlsx'}],configurable:true});
  await input.onchange();
 };
 await importFile();
 sheet=workbook('1010',[row('20.11.2026',444,10,36)]);
 await importFile();
 assert.deepEqual(calls,['info','productQueries','info','info']);
 assert.deepEqual(database.ozonPromotion.products[0].rows.map(r=>[r.day,r.clicks,r.expense]),
  [['2026-11-20',10,36]]);
 assert.equal(root.querySelector('.promotion-daily-table tbody tr:nth-child(2) td:nth-child(3)').textContent,'10');
 dispose();
 dispose=mount();
 assert.match(root.querySelector('[data-promotion-note="2026-11-20"]').textContent,/Поднял ставку до 10 ₽/);
 dispose();window.close();
});

test('search queries load for the selected product over the last week without a date selection or retry button',async()=>{
 const {window}=new JSDOM('<main></main>');
 const root=window.document.querySelector('main');
 const product={...blankProduct(),id:'stand',name:'Подставка',sku:article};
 const state={filters:{productId:product.id,from:'2026-11-10',to:'2026-11-23'}};
 const database={schema:1,id:'db',products:[product]};
 const requested=[];
 let allowWeek=true;
 const mount=()=>mountOzonPromotion({
  root,state,getProducts:()=>[product],getSelectedProductId:()=>product.id,hydrateProductImages:()=>{},
  getCredentials:()=>({ozonClient:'123',ozonKey:'fake'}),
  getPromotion:()=>database.ozonPromotion??{products:[]},
  savePromotion:next=>{database.ozonPromotion=next;validateDB(structuredClone(database));return true;},
  now:()=>new Date('2026-11-23T10:00:00Z'),
  request:async(market,operation,credentials,body)=>{
   if(operation==='info'){
    assert.deepEqual(body.offer_id,[article]);
    return {items:[{offer_id:article,sku:444},{offer_id:'other',sku:445}]};
   }
   assert.deepEqual(body.skus,['444']);
   requested.push([body.date_from.slice(0,10),body.date_to?.slice(0,10),body.sort_by]);
   if(allowWeek&&!body.date_to)return {queries:[{
    sku:444,query:'подставка для часов',unique_search_users:128,order_count:body.sort_by==='BY_GMV'?'1':0,gmv:236,currency:'RUB'
   }],page_count:1,analytics_period:{date_from:'2026-11-16',date_to:'2026-11-22'}};
   throw Object.assign(Error('API OZON: 403 · Analytics for the specified period is available starting from the premium subscription'),{status:403});
  }
 });
 let dispose=mount();
 const $=selector=>root.querySelector(selector);
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(requested,[
  ['2026-11-16','2026-11-22','BY_SEARCHES'],['2026-11-16',undefined,'BY_SEARCHES'],['2026-11-16',undefined,'BY_GMV']
 ]);
 assert.equal($('[data-promotion-dates]').hidden,true);
 assert.equal($('[data-query-access-note]').hidden,true);
 const results=$('[data-query-results]');
 assert.match(results.textContent,/16.11.2026 — 22.11.2026/);
 assert.deepEqual([...results.querySelectorAll('thead th')].map(column=>column.textContent),
  ['Запрос','Покупателей искало','Заказы по запросу','Заказано на сумму']);
 assert.match(results.textContent,/подставка для часов1281236 ₽/);
 root.querySelector('[data-promotion-tab="daily"]').click();
 assert.equal($('[data-promotion-dates]').hidden,false);
 assert.equal($('[data-promotion-filters]').elements.from.value,'2026-11-10');
 root.querySelector('[data-promotion-tab="queries"]').click();
 assert.equal(requested.length,3);

 allowWeek=false;
 await $('[data-load-queries]').onclick();
 assert.equal(requested.length,5);
 assert.equal($('[data-query-access-note]').hidden,false);
 assert.equal($('[data-query-open-seller]').hidden,false);
 assert.equal($('[data-manual-queries]').open,false);
 const manualForm=$('[data-manual-query-form]');
 manualForm.elements.phrases.value=' Подставка для часов\nподставка для часов\nДержатель <img>';
 await manualForm.onsubmit({preventDefault(){}});
 assert.deepEqual(database.ozonPromotion.products[0].queryLists,[{
  from:'2026-11-16',to:'2026-11-22',phrases:['Подставка для часов','Держатель <img>']
 }]);
 assert.equal($('[data-manual-query-results] img'),null);
 dispose();
 dispose=mount();
 assert.equal($('[data-manual-query-results] li').textContent,'Подставка для часов');
 dispose();window.close();
});
