import {test} from 'node:test';import assert from 'node:assert/strict';import {readWBPrice,wbPriceValue,wbPriceBody,wbFbsCommission} from '../wb-prices.js';import {marketRequest} from '../marketplace-api.js';
test('WB price lookup filters exact nmID and preserves seller discount including zero',async()=>{const item=await readWBPrice(async(op,body)=>{assert.equal(op,'prices');assert.equal(body.nmID,12);return {data:{listGoods:[{nmID:99,sizes:[{price:1}]},{nmID:12,discount:0,sizes:[{price:500,discountedPrice:500}]}]}};},12);assert.equal(wbPriceValue(item),500);assert.deepEqual(wbPriceBody(item,600),{data:[{nmID:12,price:600,discount:0}]});assert.throws(()=>wbPriceBody({...item,editableSizePrice:true},600),/размерам/);assert.throws(()=>wbPriceBody({...item,sizes:[{price:1},{price:2}]},600),/размерам/);assert.throws(()=>wbPriceBody(item,1.2),/целым/);});
test('WB prices use the dedicated host and guarded GET filter without a request body',async()=>{let call;await marketRequest('wb','prices',{wbToken:'key'},{nmID:12},async(url,options)=>{call={url,options};return new Response('{}');});assert.equal(call.url,'https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter?limit=1000&offset=0&filterNmID=12');assert.equal(call.options.body,undefined);assert.equal(call.options.method,'GET');await assert.rejects(()=>marketRequest('wb','prices',{wbToken:'key'},{nmID:'../bad'}));});


test('WB FBS applies the temporary dispatch window until February in Moscow',()=>{
 const lastMinute=Date.parse('2027-01-31T23:59:00+03:00');
 const nextMonth=Date.parse('2027-02-01T00:00:00+03:00');
 assert.equal(wbFbsCommission(37,null,lastMinute),37);
 assert.equal(wbFbsCommission(37,13,lastMinute),32);
 assert.equal(wbFbsCommission(37,30,lastMinute),33.5);
 assert.equal(wbFbsCommission(37,43,lastMinute),37);
 assert.equal(wbFbsCommission(4,12,lastMinute),1);
 assert.equal(wbFbsCommission(37,30,nextMonth),37);
 assert.equal(wbFbsCommission(37,18,nextMonth),33.5);
});
