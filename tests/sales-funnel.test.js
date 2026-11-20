import assert from 'node:assert/strict';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
import {loadOzonFunnel,loadWbFunnel,mountSalesFunnel} from '../sales-funnel.js';
import {marketRequest} from '../marketplace-api.js';

const filters={from:'2026-11-01',to:'2026-11-10',sku:'test-sku',wbId:'',ozonIds:[]};
const wbReport={data:{products:[{product:{nmId:42},statistic:{selected:{
 period:{start:filters.from,end:filters.to},openCount:50,cartCount:12,orderCount:8,buyoutCount:5
}}}]}};
const ozonRow=(id,metrics)=>({dimensions:[{id}],metrics});

test('funnel endpoints use their official read-only routes and seller credentials',async()=>{
 const credentials={wbToken:'test-wb',ozonKey:'test-ozon',ozonClient:'91'};
 for(const [market,operation,expected] of [
  ['wb','salesFunnel','https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products'],
  ['ozon','salesFunnel','https://api-seller.ozon.ru/v1/analytics/data'],
  ['ozon','sellerInfo','https://api-seller.ozon.ru/v1/seller/info']
 ]){
  await marketRequest(market,operation,credentials,{},async (url,request)=>{
   assert.equal(url,expected);
   assert.equal(request.method,'POST');
   assert.equal(request.redirect,'error');
   assert.equal(request.headers.Authorization,market==='wb'?'test-wb':undefined);
   assert.equal(request.headers['Api-Key'],market==='ozon'?'test-ozon':undefined);
   return Response.json({});
  });
 }
});

test('WB resolves the exact article and reports date-specific funnel totals',async()=>{
 const wb=await loadWbFunnel(filters,async (operation,body)=>{
  if(operation==='list'){
   assert.equal(body.settings.filter.textSearch,filters.sku);
   return {cards:[{vendorCode:'test-sku-other',nmID:43},{vendorCode:filters.sku,nmID:42}]};
  }
  assert.equal(operation,'salesFunnel');
  assert.deepEqual(body.nmIds,[42]);
  assert.deepEqual(body.selectedPeriod,{start:filters.from,end:filters.to});
  return wbReport;
 });
 assert.deepEqual(wb.ids,['42']);
 assert.deepEqual(wb.totals,{opens:50,cart:12,ordered:8,bought:5});
 const missing=await loadWbFunnel({...filters,wbId:'43'},async ()=>wbReport);
 assert.equal(missing.totals,null);
});

test('Ozon uses every matching SKU once and does not substitute unreported values',async()=>{
 const ozon=await loadOzonFunnel(filters,async (operation,body)=>{
  if(operation==='sellerInfo')return {subscription:{type:'PREMIUM_PRO'}};
  if(operation==='info')return {items:[{offer_id:filters.sku,sources:[{sku:111},{sku:222},{sku:222}]}]};
  assert.equal(operation,'salesFunnel');
  assert.deepEqual(body.dimension,['sku']);
  assert.deepEqual(body.metrics,['ordered_units','hits_view_search','hits_view_pdp','hits_tocart','delivered_units','returns']);
  return {result:{data:[ozonRow('111',[7,60,22,6,5,0]),ozonRow('222',[3,40,12,null,2,1]),ozonRow('333',[99,999,999,999,99,99])]}};
 });
 assert.deepEqual(ozon.ids,['111','222']);
 assert.deepEqual(ozon.totals,{ordered:10,impressions:100,opens:34,cart:null,delivered:7,returned:1});
 assert.ok(!('bought' in ozon.totals));
});

test('Ozon without a qualifying subscription requests only basic counts',async()=>{
 const basic=await loadOzonFunnel({...filters,ozonIds:['111']},async (operation,body)=>{
  if(operation==='sellerInfo')return {subscription:{type:'PREMIUM'}};
  assert.equal(operation,'salesFunnel');
  assert.deepEqual(body.filters,[{key:'sku',op:'EQ',value:'111'}]);
  assert.deepEqual(body.metrics,['ordered_units']);
  return {result:{data:[ozonRow('111',[0])]}};
 });
 assert.deepEqual(basic.totals,{ordered:0});
 assert.match(basic.note,/Premium Plus/);
});

test('one marketplace failure leaves the other funnel visible',async()=>{
 const dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root');
 const dispose=mountSalesFunnel({
  root,getCredentials:()=>({wbToken:'test-wb',ozonClient:'91',ozonKey:'test-ozon'}),onOpenApi:()=>{},
  now:()=>new Date('2026-11-20T12:00:00Z'),
  request:async (market,operation)=>{
   if(market==='wb')throw Error('HTTP 403 <test-wb>');
   if(operation==='sellerInfo')return {subscription:{type:'PREMIUM_PLUS'}};
   if(operation==='info')return {items:[{offer_id:filters.sku,sources:[{sku:111}]}]};
   return {result:{data:[ozonRow('111',[13,140,39,20,9,0])]}};
  }
 });
 const form=root.querySelector('form');
 form.elements.sku.value=filters.sku;
 await form.onsubmit({preventDefault(){}});
 assert.match(root.querySelector('[data-funnel-status=wb]').textContent,/403 <\[скрыто\]>/);
 assert.match(root.querySelector('[data-funnel-status=ozon]').textContent,/Доставленные товары/);
 const ordered=[...root.querySelectorAll('tbody tr')].find(row=>row.querySelector('th').textContent==='Заказали, шт.');
 assert.deepEqual([...ordered.querySelectorAll('td')].map(cell=>cell.textContent),['—','13']);
 assert.equal(form.querySelector('button[type=submit]').disabled,false);
 dispose();
 dom.window.close();
});
