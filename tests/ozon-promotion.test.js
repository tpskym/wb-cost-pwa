import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {strToU8,zipSync} from 'fflate';
import {loadOzonPerformance} from '../ozon-performance.js';
import {handleOzonPerformance} from '../ozon-performance-extension/worker.js';
import {blankProduct,validateDB} from '../calc.js';
import {marketRequest} from '../marketplace-api.js';
import {loadOzonQueries,loadRecentOzonQueries,parseOzonPerformanceRows,promotionDays,readPastedOzonQueries} from '../ozon-promotion.js';
import {mountOzonPromotion} from '../ozon-promotion-ui.js';

const article='stand-white';
const dates={from:'2026-11-19',to:'2026-11-21'};
const row=(date,sku,clicks,expense)=>[date,sku,100,clicks,expense,3,600];
const headers=['Дата','SKU','Показы','Клики','Расход, ₽, с НДС','Заказы','Продажи, ₽'];
const csv=(rows)=>[headers,...rows].map(row=>'"'+row.join(';')+'"').join('\r\n');
const uuid='0c159c60-ab92-46d9-9a6b-d225dbf5c7b1';
const access={id:'test@performance.ozon.ru',secret:'fake-secret'};
const cpc=(id)=>({id,title:'Подставки',paymentType:'CPC',advObjectType:'SKU'});

test('daily analytics remembers the start date and opens through the current Moscow day',()=>{
 const {window}=new JSDOM('<main></main>',{url:'https://tpskym.github.io/wb-cost-pwa/'});
 const root=window.document.querySelector('main');
 const product={id:'stand',name:'Подставка',sku:article};
 let now=new Date('2026-11-23T20:00:00Z');
 const mount=state=>mountOzonPromotion({
  root,state,getProducts:()=>[product],getSelectedProductId:()=>product.id,
  getCredentials:()=>({}),getPromotion:()=>({products:[]}),now:()=>now
 });
 const update=(input,value)=>{
  input.value=value;
  input.dispatchEvent(new window.Event('input',{bubbles:true}));
 };
 let dispose=mount({tab:'daily'});
 let form=root.querySelector('[data-promotion-filters]');
 update(form.elements.from,'2026-11-17');
 update(form.elements.to,'2026-11-20');
 assert.equal(form.elements.to.value,'2026-11-20');
 dispose();

 now=new Date('2026-11-23T21:01:00Z');
 dispose=mount({tab:'daily'});
 form=root.querySelector('[data-promotion-filters]');
 assert.equal(form.elements.from.value,'2026-11-17');
 assert.equal(form.elements.to.value,'2026-11-24');
 update(form.elements.to,'2026-11-20');
 root.querySelector('[data-promotion-tab="queries"]').click();
 root.querySelector('[data-promotion-tab="daily"]').click();
 assert.equal(form.elements.from.value,'2026-11-17');
 assert.equal(form.elements.to.value,'2026-11-24');
 assert.equal(form.elements.to.max,'2026-11-24');
 dispose();window.close();
});

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
 assert.deepEqual(result.requestedPeriod,dates);
 assert.deepEqual(result.ids,['444','445']);
 assert.deepEqual(result.rows.map(row=>[row.sku,row.query,row.searches,row.views,row.currency]),
  [['445','подставка',20,null,'₽'],['444','подставка',12,0,'']]);
});

test('advertising statistics load a daily archive and distinguish zeros, missing metrics and missing days',async()=>{
 const requests=[],progress=[];
 const archive=zipSync({
  'reports/1000-statistics.csv':strToU8(csv([row('19.11.2026',444,0,0),row('20.11.2026',444,5,'25,00'),row('20.11.2026',555,20,35)])),
  'statistics.csv':strToU8('Кампания по продвижению товаров № 2000\n'+csv([row('20.11.2026',444,10,'37,50')]))
 });
 let checks=0;
 const report=await loadOzonPerformance(['444'],dates,access,async(operation,body,token)=>{
  requests.push(operation);
  if(operation==='token'){
   assert.deepEqual(body,access);
   return {access_token:'bearer'};
  }
  assert.equal(token,'bearer');
  if(operation==='campaigns')return {list:[{...cpc('1000'),paymentType:undefined},{...cpc('2000'),advObjectType:undefined},
   {...cpc('3000'),paymentType:'CPO'},{...cpc('4000'),state:'CAMPAIGN_STATE_ARCHIVED'}]};
  if(operation==='submit'){
   assert.deepEqual(body,{campaigns:['1000','2000'],dateFrom:dates.from,dateTo:dates.to});
   return {UUID:uuid};
  }
  assert.equal(body.uuid,uuid);
  if(operation==='status')return {state:checks++?'OK':'IN_PROGRESS'};
  assert.equal(operation,'report');
  return Buffer.from(archive).toString('base64');
 },{wait:async()=>{},onProgress:(i,total)=>progress.push([i,total])});
 assert.deepEqual(requests,['token','campaigns','submit','status','status','report']);
 assert.deepEqual(progress,[[1,1]]);
 assert.equal(report.archived,1);
 assert.deepEqual(report.lookup,{skus:['444'],listed:4,clickCampaigns:3,requested:2,productRows:4,matchedRows:3,unavailable:[]});
 const days=promotionDays(report.rows,dates.from,dates.to);
 assert.deepEqual(days.map(day=>day.metrics?.clicks??null),[0,15,null]);
 assert.deepEqual(days.map(day=>day.metrics?.expense??null),[0,62.5,null]);
 assert.equal(days[1].metrics.cart,null);
 assert.equal(promotionDays(report.rows,dates.from,dates.to,'2000')[1].metrics.clicks,10);
 const aggregate=[['Дата добавления',...headers.slice(1)],row('19.11.2026',444,5,25)];
 assert.throws(()=>parseOzonPerformanceRows(aggregate,{...dates,campaignId:'1000',ids:['444']}),/не совпали с запрошенным/);
});

test('an absent campaign CSV is retried separately without losing its neighbours',async()=>{
 const archive=zipSync({'1000.csv':strToU8(csv([row('20.11.2026',444,5,25)]))});
 const submissions=[];
 const report=await loadOzonPerformance(['444'],dates,access,async(operation,body)=>{
  if(operation==='token')return {access_token:'bearer'};
  if(operation==='campaigns')return {list:[cpc('1000'),cpc('51897894')]};
  if(operation==='submit'){submissions.push(body.campaigns);return {UUID:uuid};}
  if(operation==='status')return {state:'OK'};
  assert.equal(operation,'report');
  if(submissions.length===1)return Buffer.from(archive).toString('base64');
  throw Object.assign(Error('Отчёт недоступен'),{status:404});
 });
 assert.deepEqual(submissions,[['1000','51897894'],['51897894']]);
 assert.deepEqual(report.lookup.unavailable,['51897894']);
 assert.deepEqual(report.rows.map(row=>[row.campaignId,row.clicks]),[['1000',5]]);
});

test('recent Ozon days are fetched by SKU and combined with disjoint historical dates',async()=>{
 const period={from:'2026-11-21',to:'2026-11-23'},sku='6035112693';
 const requests=[];
 const report=await loadOzonPerformance([sku],period,access,async(operation,body)=>{
  requests.push(operation);
  if(operation==='token')return {access_token:'bearer'};
  if(operation==='campaigns')return {list:[cpc('51897894')]};
  if(operation==='recent'){
   assert.deepEqual(body,{campaignIds:['51897894'],dateFrom:'2026-11-22',dateTo:'2026-11-23'});
   return {rows:[
    {campaignId:'51897894',date:'2026-11-23',sku,views:'171',clicks:'10',expense:'68,55',toCart:'2',orders:'0',sales:'0'},
    {campaignId:'51897894',date:'2026-11-23',sku:'555',clicks:'900'},
    {campaignId:'777',date:'2026-11-23',sku,clicks:'800'}
   ]};
  }
  if(operation==='submit'){
   assert.deepEqual(body,{campaigns:['51897894'],dateFrom:'2026-11-21',dateTo:'2026-11-21'});
   return {UUID:uuid};
  }
  if(operation==='status')return {state:'OK'};
  assert.equal(operation,'report');
  return Buffer.from(csv([row('21.11.2026',sku,5,25)])).toString('base64');
 },{today:'2026-11-23'});
 assert.deepEqual(requests,['token','campaigns','recent','submit','status','report']);
 const days=promotionDays(report.rows,period.from,period.to);
 assert.deepEqual(days.map(day=>day.metrics?.clicks??null),[5,null,10]);
 const current=days[2].metrics;
 assert.deepEqual([current.views,current.cart,current.expense,current.orders,current.totalSales],[171,2,68.55,0,null]);
});

test('extension sends credentials only to the documented Performance API operations',async()=>{
 const type='workshop-ozon-performance';
 const sender={url:'https://tpskym.github.io/wb-cost-pwa/#analytics',frameId:0};
 const denied=()=>assert.fail('No network request expected');
 assert.equal(await handleOzonPerformance({type,operation:'ping'}, {...sender,url:'https://tpskym.github.io/other/'},denied),undefined);
 assert.equal(await handleOzonPerformance({type,operation:'ping'}, {...sender,frameId:1},denied),undefined);
 assert.equal((await handleOzonPerformance({type,operation:'submit',token:'bearer',body:{campaigns:['https://invalid']}},sender,denied)).ok,false);
 const token=await handleOzonPerformance({type,operation:'token',body:access},sender,async(url,options)=>{
  assert.equal(url,'https://api-performance.ozon.ru/api/client/token');
  assert.equal(options.redirect,'error');
  assert.deepEqual(JSON.parse(options.body),{client_id:access.id,client_secret:access.secret,grant_type:'client_credentials'});
  return Response.json({access_token:'bearer'});
 });
 assert.equal(token.data.access_token,'bearer');
 const submitted=await handleOzonPerformance({type,operation:'submit',token:'bearer',
  body:{campaigns:['1000'],dateFrom:dates.from,dateTo:dates.to}},sender,async(url,options)=>{
  assert.equal(url,'https://api-performance.ozon.ru/api/client/statistics');
  assert.equal(options.headers.Authorization,'Bearer bearer');
  assert.equal(JSON.parse(options.body).groupBy,'DATE');
  return Response.json({UUID:uuid});
 });
 assert.equal(submitted.data.UUID,uuid);
 assert.equal((await handleOzonPerformance({type,operation:'ping'},sender,denied)).data.version,2);
 const recentBody={campaignIds:['51897894'],dateFrom:'2026-11-23',dateTo:'2026-11-23'};
 const recent=await handleOzonPerformance({type,operation:'recent',token:'bearer',body:recentBody},sender,async(url,options)=>{
  assert.equal(url,'https://api-performance.ozon.ru/api/client/statistics/products/sku');
  assert.equal(options.headers.Authorization,'Bearer bearer');
  assert.deepEqual(JSON.parse(options.body),recentBody);
  return Response.json({rows:[]});
 });
 assert.deepEqual(recent.data,{rows:[]});
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

test('promotion UI loads and refreshes campaigns from Performance API and preserves a note',async()=>{
 const {window}=new JSDOM('<main></main>',{url:'https://tpskym.github.io/wb-cost-pwa/'});
 const doc=window.document,root=doc.querySelector('main');
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 window.HTMLDialogElement.prototype.close=function(){this.open=false;this.onclose?.();};
 const p={...blankProduct(),id:'p1',sku:article,name:'Подставка'};
 const database={schema:1,id:'db',products:[p]};
 let values=[row('20.11.2026',444,8,24)];
 const calls=[],state={filters:{productId:p.id,...dates}};
 const mount=()=>mountOzonPromotion({
  root,state,getProducts:()=>[p],getSelectedProductId:()=>p.id,hydrateProductImages:()=>{},
  getCredentials:()=>({ozonClient:'123',ozonKey:'fake'}),getPromotion:()=>database.ozonPromotion??{products:[]},
  savePromotion:next=>{database.ozonPromotion=next;validateDB(structuredClone(database));return true;},
  now:()=>new Date('2026-11-23T10:00:00Z'),
  requestPerformance:async(w,operation)=>{
   assert.equal(w,window);
   switch(operation){
   case 'ping':return {version:1};
   case 'token':return {access_token:'fake-token'};
   case 'campaigns':return {list:[cpc('1010')]};
   case 'submit':return {UUID:uuid};
   case 'status':return {state:'OK'};
   case 'report':return Buffer.from(csv(values)).toString('base64');
   default:assert.fail(operation);
   }
  },
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
 const credentialsForm=root.querySelector('[data-performance-credentials]');
 credentialsForm.elements.namedItem('id').value=access.id;
 credentialsForm.elements.namedItem('secret').value=access.secret;
 await credentialsForm.onsubmit({preventDefault(){}});
 values=[row('20.11.2026',444,10,36)];
 await root.querySelector('[data-load-performance]').onclick();
 assert.deepEqual(calls,['info','productQueries','info','info']);
 assert.equal(root.querySelector('input[type="file"]'),null);
 assert.match(root.querySelector('[data-daily-results]').textContent,/Ozon Performance API/);
 assert.match(root.querySelector('[data-promotion-campaign]').textContent,/Подставки · № 1010/);
 assert.deepEqual(database.ozonPromotion.products[0].performance.rows.map(r=>[r.day,r.clicks,r.expense]),
  [['2026-11-20',10,36]]);
 assert.doesNotMatch(JSON.stringify(database),/fake-secret/);
 assert.equal(root.querySelector('.promotion-daily-table tbody tr:nth-child(2) td:nth-child(3)').textContent,'10');
 values=[row('20.11.2026',555,10,36)];
 await root.querySelector('[data-load-performance]').onclick();
 assert.match(root.querySelector('[data-daily-results]').textContent,/SKU 444 · Запрошено кампаний 1/);
 assert.match(root.querySelector('[data-daily-results]').textContent,/В отчётах кампаний есть данные по другим SKU/);
 assert.equal(root.querySelector('.promotion-daily-table tbody tr:nth-child(2) td:nth-child(3)').textContent,'—');
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
   }],page_count:1,analytics_period:{date_from:'16.11.2026',date_to:'0001-01-01T00:00:00Z'}};
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
 assert.match(results.textContent,/Запрос в Seller API с 16\.11\.2026\. В ответе Ozon указал только начало 16\.11\.2026 · SKU Ozon 444/);
 assert.doesNotMatch(results.textContent,/22\.11\.2026/);
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

test('search queries accept more than a hundred rows copied from Ozon and merge additional pages',async()=>{
 const {window}=new JSDOM('<main></main>',{url:'https://tpskym.github.io/wb-cost-pwa/'});
 const root=window.document.querySelector('main');
 const product={...blankProduct(),id:'stand',name:'Подставка',sku:article};
 const database={schema:1,id:'db',products:[product]};
 const mount=()=>mountOzonPromotion({
  root,state:{},getProducts:()=>[product],getSelectedProductId:()=>product.id,
  getCredentials:()=>({ozonClient:'123',ozonKey:'fake'}),
  getPromotion:()=>database.ozonPromotion??{products:[]},
  savePromotion:next=>{database.ozonPromotion=next;validateDB(structuredClone(database));return true;},
  now:()=>new Date('2026-11-23T10:00:00Z'),
  request:async(_market,operation)=>operation==='info'?{items:[{offer_id:article,sku:444}]}:{
   page_count:1,queries:Array.from({length:15},(_,index)=>({
    sku:444,query:'Из API '+index,unique_search_users:30
   }))
  }
 });
 let dispose=mount();
 const $=selector=>root.querySelector(selector);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal($('[data-manual-queries]').hidden,false);
 assert.match($('[data-query-results]').textContent,/Строк из API 15 \(до 15 на SKU\)/);

 const form=$('[data-manual-query-form]'),input=form.elements.phrases;
 const heading=['Запрос','Сколько покупателей искало','Заказано товаров по запросам','Заказано на сумму по запросам'];
 const first=Array.from({length:70},(_,index)=>['Фраза '+(index+1),'1 200 +12%',index===0?'1':'0',index===0?'236 ₽':'0 ₽']);
 const html='<table>'+[heading,['Итого и среднее','2 400','1','236 ₽'],...first].map(row=>
  '<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</table>';
 let intercepted=false;
 input.onpaste({clipboardData:{getData:type=>type==='text/html'?html:''},preventDefault(){intercepted=true;}});
 assert.equal(intercepted,true);
 await form.onsubmit({preventDefault(){}});
 assert.equal($('[data-manual-query-results]').querySelectorAll('tbody tr').length,70);

 const second=Array.from({length:60},(_,index)=>['Фраза '+(index+66),'250','0','0 ₽']);
 input.value=[heading,...second].map(line=>line.join('\t')).join('\n');
 await form.onsubmit({preventDefault(){}});
 const results=$('[data-manual-query-results]');
 assert.equal(results.querySelectorAll('tbody tr').length,125);
 assert.match(results.textContent,/Запросов 125/);
 assert.match(results.querySelector('tbody tr').textContent,/Фраза 11\s2001236 ₽/);
 assert.match(results.querySelector('tbody tr:last-child').textContent,/Фраза 12525000 ₽/);
 assert.equal($('[data-query-results] details').open,false);
 dispose();

 dispose=mount();
 assert.equal($('[data-manual-query-results]').querySelectorAll('tbody tr').length,125);
 dispose();window.close();
 assert.deepEqual(readPastedOzonQueries('1.\nподставка для часов\n160\n2. зарядка apple watch\n12'),
  {phrases:['подставка для часов','зарядка apple watch']});
});
