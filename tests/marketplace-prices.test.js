import {test} from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {loadMarketplacePrices,normalizePrice,submitPriceChange,mountMarketplacePrices} from '../marketplace-prices.js';
import {marketRequest} from '../marketplace-api.js';import {blankProduct,validateDB} from '../calc.js';
const wb=(id=1)=>({nmID:id,vendorCode:'SKU'+id,discount:10,sizes:[{price:1000,discountedPrice:900}],currencyIsoCode4217:'RUB'}),ozon=(sku='SKU1')=>({offer_id:sku,product_id:100,price:{price:'900',old_price:'1000',min_price:'600',currency_code:'RUB'}});
test('WB reads all price pages without filtering to local cards or stock quantities',async()=>{let pages=0;const loaded=await loadMarketplacePrices('wb',async(op,body)=>{if(op==='list')return {cards:[{nmID:1001,title:'New item'}],cursor:{total:1}};assert.equal(op,'pricesAll');assert.equal(body.offset,pages*1000);return {data:{listGoods:pages++===0?Array.from({length:1000},(_,i)=>wb(i+1)):[wb(1001)]}};},{wait:async()=>{}});assert.equal(loaded.rows.length,1001);assert.equal(loaded.rows.at(-1).name,'New item');assert.equal(loaded.rows[0].price,900);});
test('Ozon follows price cursors including new articles and fails repeated pages',async()=>{let page=0;const loaded=await loadMarketplacePrices('ozon',async(op,body)=>{if(op==='info')return {items:[]};assert.equal(op,'prices');assert.equal(body.cursor,page?'next':'');return page++?{items:[ozon('NEW')],cursor:''}:{items:[ozon()],cursor:'next'};},{wait:async()=>{}});assert.deepEqual(loaded.rows.map(r=>r.sku),['SKU1','NEW']);await assert.rejects(()=>loadMarketplacePrices('ozon',async()=>({items:[ozon()],cursor:'repeat'}),{wait:async()=>{}}),/повтор|сопоставить/);});
test('bulk WB price read uses prices host and validates offset',async()=>{await marketRequest('wb','pricesAll',{wbToken:'x'},{offset:1000},async(url,opt)=>{assert.equal(url,'https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter?limit=1000&offset=1000');assert.equal(opt.method,'GET');return Response.json({data:{listGoods:[]}});});await assert.rejects(()=>marketRequest('wb','pricesAll',{wbToken:'x'},{offset:-1},async()=>assert.fail()),/страница/);});
test('WB writes just one price after fresh check, cancellation and drift prevent writes',async()=>{const row=normalizePrice('wb',wb()),calls=[],request=async(op,body)=>{calls.push({op,body});return op==='prices'?{data:{listGoods:[wb()]}}:{data:{id:7}};};await submitPriceChange(row,{base:1200,discount:20},{request,confirm:async()=>true});assert.deepEqual(calls.find(c=>c.op==='setPrice').body,{data:[{nmID:1,price:1200,discount:20}]});assert.equal(row.submission.status,'accepted');assert.equal(row.price,900);const before=calls.length;await submitPriceChange(row,{base:1300,discount:10},{request,confirm:async()=>false});assert.equal(calls.length,before+1);await assert.rejects(()=>submitPriceChange(row,{base:1300,discount:10},{request:async()=>({data:{listGoods:[{...wb(),discount:20}]}}),confirm:async()=>assert.fail()}),/изменилась/);});
test('Ozon sends normal, crossed and minimum price, and catches per-item rejection',async()=>{const row=normalizePrice('ozon',ozon());let sent;const request=async(op,body)=>{if(op==='prices')return {items:[ozon()]};sent=body;return {result:[{offer_id:'SKU1',updated:false,errors:[{message:'Price rejected'}]}]};};await assert.rejects(()=>submitPriceChange(row,{base:1200,price:1000,minimum:700},{request,confirm:async()=>true}),/Price rejected/);assert.equal(row.submission.status,'rejected');assert.deepEqual(sent,{prices:[{offer_id:'SKU1',price:'1000.00',old_price:'1200.00',min_price:'700.00',currency_code:'RUB'}]});});
test('network outcome stays unknown without a retry; failed local save prevents price write',async()=>{let writes=0;const row=normalizePrice('wb',wb()),request=async(op)=>{if(op==='prices')return {data:{listGoods:[wb()]}};writes++;throw Error('network');};await assert.rejects(()=>submitPriceChange(row,{base:1100,discount:10},{request,confirm:async()=>true}),/network/);assert.equal(row.submission.status,'unknown');assert.equal(writes,1);await assert.rejects(()=>submitPriceChange(row,{base:1100,discount:10},{request,confirm:async()=>true,save:()=>false}),/не отправлена/);assert.equal(writes,1);});
test('price snapshots and pending requests survive validation and invalid prices fail',()=>{const row=normalizePrice('ozon',ozon()),db={schema:1,id:'db',products:[blankProduct()],priceSnapshots:[{market:'ozon',updatedAt:'now',rows:[row]}]};assert.equal(validateDB(structuredClone(db)).priceSnapshots[0].rows[0].sku,'SKU1');assert.throws(()=>validateDB({...db,priceSnapshots:[...db.priceSnapshots,...db.priceSnapshots]}),/снимок/);row.price=-1;assert.throws(()=>validateDB(db),/строка/);});
test('price UI escapes names and automatically confirms a price applied immediately',async()=>{
 const {window}=new JSDOM('<main></main>'),root=window.document.querySelector('main');
 const updatedAt=new Date().toISOString(),row=normalizePrice('wb',wb());
 const database={products:[],priceSnapshots:[
  {market:'wb',updatedAt,rows:[row]},
  {market:'ozon',updatedAt,rows:[normalizePrice('ozon',ozon('<img src=x onerror=alert(1)>'))]}
 ]};
 const calls=[];
 let latest=wb();
 const dispose=mountMarketplacePrices({
  root,database,save:()=>true,getCredentials:()=>({}),confirm:async()=>true,
  request:async(market,operation,body)=>{
   assert.equal(market,'wb');
   calls.push(operation);
   if(operation==='prices')return {data:{listGoods:[latest]}};
   assert.equal(operation,'setPrice');
   latest={...wb(),discount:body.data[0].discount,sizes:[{price:body.data[0].price,discountedPrice:960}]};
   return {data:{id:1}};
  }
 });
 assert.equal(root.querySelector('img'),null);
 assert.equal(root.querySelectorAll('thead th').length,3);
 const discount=root.querySelector('[data-price-field="discount"]');
 const cell=discount.closest('td');
 const final=cell.querySelector('[data-price-field="price"]');
 final.value='960';
 discount.value='20';
 final.dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.equal(cell.querySelector('[data-price-field="base"]').readOnly,true);
 await root.querySelector('#prices-rows').onclick({target:cell.querySelector('[data-price-send]')});
 assert.deepEqual(calls,['prices','setPrice','prices']);
 assert.equal(row.price,960);
 assert.equal(row.submission.status,'confirmed');
 assert.match(cell.textContent,/Применение подтверждено/);
 dispose();
 window.close();
});
test('price refresh preserves the failed marketplace snapshot and refreshes the other independently',async()=>{const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main'),old={market:'wb',updatedAt:'2026-10-20T00:00:00Z',rows:[normalizePrice('wb',wb())]},database={products:[],priceSnapshots:[old]};mountMarketplacePrices({root,database,save:()=>true,getCredentials:()=>({}),request:async(market,op)=>{if(market==='wb')throw Error('access denied');return op==='prices'?{items:[ozon('NEW')],cursor:''}:{items:[]};}});await root.querySelector('#prices-refresh').onclick();assert.equal(database.priceSnapshots.find(s=>s.market==='wb'),old);assert.equal(database.priceSnapshots.find(s=>s.market==='ozon').rows[0].sku,'NEW');assert.match(root.textContent,/Предыдущие цены сохранены/);});
test('sending or checking one price keeps the page, row, and other drafts in place',async()=>{
 const {window}=new JSDOM('<main></main>'),root=window.document.querySelector('main');
 const updatedAt=new Date().toISOString(),article='SKU34';
 const database={products:[],priceSnapshots:[
  {market:'wb',updatedAt,rows:Array.from({length:35},(_,i)=>normalizePrice('wb',wb(i+1)))},
  {market:'ozon',updatedAt,rows:[normalizePrice('ozon',ozon(article))]}
 ]};
 let allow=false,writes=0,readsAfterWrite=0,latest=wb(34);
 const dispose=mountMarketplacePrices({
  root,database,save:()=>true,getCredentials:()=>({}),confirm:async()=>allow,
  request:async (market,operation,body)=>{
   assert.equal(market,'wb');
   if(operation==='prices'){
    assert.equal(body.nmID,34);
    if(writes&&++readsAfterWrite<=2)return {data:{listGoods:[wb(34)]}};
    return {data:{listGoods:[latest]}};
   }
   assert.equal(operation,'setPrice');
   assert.equal(body.data[0].nmID,34);
   writes++;
   latest={...latest,sizes:[{price:1200,discountedPrice:1080}]};
   return {data:{id:12}};
  }
 });
 root.querySelector('#prices-next').click();
 const next=root.querySelector('#prices-next'),page=root.querySelector('#prices-page');
 const scroller=root.querySelector('.prices-table-scroll'),tbody=root.querySelector('#prices-rows');
 const row=[...tbody.rows].find(row=>row.querySelector('[data-price-photo-sku]').dataset.pricePhotoSku===article);
 const [wbCell,ozonCell]=row.querySelectorAll('td'),neighbor=row.previousElementSibling;
 const wbInput=wbCell.querySelector('[data-price-field="price"]'),ozonInput=ozonCell.querySelector('[data-price-field="price"]');
 for(const [field,value] of [[wbInput,'1080'],[ozonInput,'950']]){
  field.value=value;
  field.dispatchEvent(new window.Event('input',{bubbles:true}));
 }
 const send=wbCell.querySelector('[data-price-send]');
 const check=wbCell.querySelector('[data-price-check]');
 send.focus();
 scroller.scrollTop=730;
 const expectPosition=()=>{
  assert.equal(scroller.scrollTop,730);
  assert.equal(row.parentElement,tbody);
  assert.equal(neighbor.nextElementSibling,row);
  assert.equal(row.lastElementChild,ozonCell);
  assert.equal(ozonInput.value,'950');
  assert.equal(next.disabled,true);
  assert.match(page.textContent,/2 \/ 2/);
 };
 await tbody.onclick({target:send});
 assert.equal(writes,0);
 assert.equal(send.isConnected,true);
 expectPosition();
 allow=true;
 await tbody.onclick({target:send});
 assert.equal(writes,1);
 assert.equal(readsAfterWrite,2);
 assert.match(wbCell.querySelector('.price-row-status').textContent,/ещё не подтвердила.*«Проверить \/ получить»/);
 assert.equal(wbInput.value,'1080');
 assert.equal(window.document.activeElement,send);
 expectPosition();
 check.focus();
 await tbody.onclick({target:check});
 assert.equal(readsAfterWrite,3);
 assert.equal(wbCell.isConnected,true);
 assert.equal(wbCell.querySelector('[data-price-field="price"]').value,'1080');
 assert.equal(wbCell.querySelector('.price-row-status').textContent,'Применение подтверждено');
 assert.equal(window.document.activeElement,wbCell.querySelector('[data-price-check]'));
 expectPosition();
 dispose();
 window.close();
});
test('Ozon retries a pending verification after one second and confirms the price',async()=>{
 const {window}=new JSDOM('<main></main>'),root=window.document.querySelector('main');
 const item=ozon(),row=normalizePrice('ozon',item);
 const database={products:[],priceSnapshots:[{market:'ozon',updatedAt:new Date().toISOString(),rows:[row]}]};
 const calls=[],verificationTimes=[];
 let submitted;
 const dispose=mountMarketplacePrices({
  root,database,save:()=>true,getCredentials:()=>({}),confirm:async()=>true,
  request:async (market,operation,body)=>{
   assert.equal(market,'ozon');
   calls.push(operation);
   if(operation==='setPrice'){
    [submitted]=body.prices;
    return {result:[{offer_id:item.offer_id,updated:true,errors:[]}]};
   }
   if(submitted)verificationTimes.push(performance.now());
   return {items:[verificationTimes.length<2?item:{...item,price:submitted}]};
  }
 });
 const input=root.querySelector('[data-price-field="price"]');
 input.value='950';
 input.dispatchEvent(new window.Event('input',{bubbles:true}));
 await root.querySelector('#prices-rows').onclick({target:root.querySelector('[data-price-send]')});
 assert.deepEqual(calls,['prices','setPrice','prices','prices']);
 assert.ok(verificationTimes[1]-verificationTimes[0]>=950);
 assert.equal(row.price,950);
 assert.equal(row.submission.status,'confirmed');
 assert.equal(root.querySelector('.price-row-status').textContent,'Применение подтверждено');
 dispose();
 window.close();
});
test('WB missing task result remains unconfirmed, while invalid decimal amounts never reach Ozon',async()=>{const row=normalizePrice('wb',wb());await assert.rejects(()=>submitPriceChange(row,{base:1200,discount:10},{request:async op=>op==='prices'?{data:{listGoods:[wb()]}}:{},confirm:async()=>true}),/номер задачи/);assert.equal(row.submission.status,'unknown');await assert.rejects(()=>submitPriceChange(normalizePrice('ozon',ozon()),{price:901.001,base:1000,minimum:600},{request:async()=>assert.fail('invalid price must not be read or sent'),confirm:async()=>assert.fail()}),/двух знаков/);});
test('WB final price remains fixed while discount recalculates the initial price without requests or focus replacement',()=>{const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main'),row=normalizePrice('wb',{...wb(),discount:0,sizes:[{price:456,discountedPrice:0}]}),db={products:[],priceSnapshots:[{market:'wb',updatedAt:new Date().toISOString(),rows:[row]}]};mountMarketplacePrices({root,database:db,save:()=>assert.fail('typing must not save to marketplace'),getCredentials:()=>({}),request:async()=>assert.fail('typing must not call API')});const base=root.querySelector('[data-price-field="base"]'),final=root.querySelector('[data-price-field="price"]'),discount=root.querySelector('[data-price-field="discount"]'),output=root.querySelector('[data-wb-calculated]');assert.equal(base.readOnly,true);assert.equal(final.value,'456');discount.focus();discount.value='20';discount.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(base.value,'570');assert.equal(final.value,'456');assert.equal(output.textContent,'456 ₽');assert.equal(dom.window.document.activeElement,discount);assert.equal(root.querySelector('[data-price-field="discount"]'),discount);final.value='800';final.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(base.value,'1000');assert.equal(output.textContent,'800 ₽');discount.value='';discount.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(output.textContent,'— ₽');assert.equal(row.price,0);});
test('cost presets set only the corresponding marketplace sale-price draft',()=>{
 const {window}=new JSDOM('<main></main>'),root=window.document.querySelector('main');
 const product={...blankProduct(),sku:'SKU1'};
 const wbRow=normalizePrice('wb',wb()),ozonRow=normalizePrice('ozon',ozon());
 const database={products:[product],priceSnapshots:[
  {market:'wb',updatedAt:'now',rows:[wbRow,normalizePrice('wb',wb(2))]},
  {market:'ozon',updatedAt:'now',rows:[ozonRow]}
 ]};
 const dispose=mountMarketplacePrices({
  root,database,save:()=>assert.fail('A preset must not save marketplace data'),getCredentials:()=>({}),
  request:()=>assert.fail('A preset must not call the API'),getCostPrices:matched=>{
   assert.equal(matched,product);
   return {
    wb:{breakEven:235,minimumWorking:261,suggested:305,roiWithReserve:320,partial:false},
    ozon:{breakEven:180,minimumWorking:220,suggested:null,roiWithReserve:null,partial:true,atLimit:{amount:40}}
   };
  }
 });
 const [wbCell,ozonCell,unknownCell]=root.querySelectorAll('[data-price-index]');
 const field=(cell,key)=>cell.querySelector(`[data-price-field="${key}"]`).value;
 assert.deepEqual([...wbCell.querySelectorAll('[data-price-preset]')].map(button=>button.dataset.pricePreset),['235','261','305','320']);
 assert.match(unknownCell.textContent,/Артикул не найден/);
 assert.equal(unknownCell.querySelector('[data-price-preset]'),null);
 wbCell.querySelector('[data-price-preset="235"] b').click();
 assert.equal(field(wbCell,'price'),'235.8');
 assert.equal(field(wbCell,'base'),'262');
 assert.equal(field(wbCell,'discount'),'10');
 assert.equal(wbCell.querySelector('[data-wb-calculated]').textContent,'235,8 ₽');
 assert.equal(field(ozonCell,'price'),'900');
 ozonCell.querySelector('[data-price-preset="220"][data-price-preset-field="minimum"]').click();
 assert.equal(field(ozonCell,'minimum'),'220');
 assert.equal(field(ozonCell,'price'),'900');
 assert.match(ozonCell.querySelector('[data-price-preset-status]').textContent,/Минимальная цена — 220 ₽/);
 ozonCell.querySelector('[data-price-preset="180"]').click();
 assert.equal(field(ozonCell,'price'),'180');
 assert.equal(field(ozonCell,'minimum'),'220');
 assert.equal(field(ozonCell,'base'),'1000');
 assert.match(ozonCell.querySelector('[data-price-preset-status]').textContent,/Минимальная цена должна быть не выше цены продажи/);
 assert.match(ozonCell.querySelector('[data-price-preset="300"]').getAttribute('aria-label'),/лимит расчёта/);
 ozonCell.querySelector('[data-price-preset="300"]').click();
 assert.equal(field(ozonCell,'price'),'300');
 assert.equal(field(ozonCell,'minimum'),'220');
 assert.equal(field(wbCell,'price'),'235.8');
 const reserveButton=cell=>[...cell.querySelectorAll('[data-price-preset]')].find(button=>button.getAttribute('aria-label').startsWith('ROI 80% + 10 ₽'));
 reserveButton(wbCell).click();
 assert.equal(field(wbCell,'price'),'320.4');
 assert.equal(field(ozonCell,'price'),'300');
 assert.equal(reserveButton(ozonCell).disabled,true);
 assert.match(reserveButton(ozonCell).closest('.price-cost-choice').textContent,/Недостижима/);
 assert.equal(reserveButton(ozonCell).nextElementSibling.disabled,true);
 assert.equal(wbRow.price,900);
 assert.equal(ozonRow.price,900);
 assert.equal(ozonRow.minimum,600);
 root.querySelector('[data-prices-market="ozon"]').click();
 assert.equal(field(root,'price'),'300');
 assert.equal(field(root,'minimum'),'220');
 dispose();
 window.close();
});
test('Ozon highlights matching sale and minimum presets independently',async()=>{
 const {window}=new JSDOM('<main></main>'),root=window.document.querySelector('main');
 const item=ozon();
 const row=normalizePrice('ozon',{...item,price:{...item.price,price:'278.00',min_price:'278.0'}});
 const database={products:[{...blankProduct(),sku:row.sku}],priceSnapshots:[{market:'ozon',updatedAt:'now',rows:[row]}]};
 const dispose=mountMarketplacePrices({
  root,database,save:()=>true,getCredentials:()=>({}),
  getCostPrices:()=>({ozon:{breakEven:189,minimumWorking:226,suggested:264,roiWithReserve:278}}),
  request:async(market,operation)=>{
   assert.equal(market,'ozon');
   assert.equal(operation,'prices');
   return {items:[{...item,price:{...item.price,price:'264',min_price:'189'}}]};
  }
 });
 const selected=()=>[...root.querySelectorAll('[data-price-preset][aria-pressed="true"]')]
  .map(button=>[button.dataset.pricePreset,button.dataset.pricePresetField||'price']);
 assert.deepEqual(selected(),[['278','price'],['278','minimum']]);
 root.querySelector('[data-price-preset="226"][data-price-preset-field="minimum"]').click();
 assert.deepEqual(selected(),[['226','minimum'],['278','price']]);
 const sale=root.querySelector('[data-price-field="price"]');
 sale.value='';
 sale.dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.deepEqual(selected(),[['226','minimum']]);
 sale.value='226.00';
 sale.dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.deepEqual(selected(),[['226','price'],['226','minimum']]);
 root.querySelector('[data-prices-market="ozon"]').click();
 assert.deepEqual(selected(),[['226','price'],['226','minimum']]);
 await root.querySelector('#prices-rows').onclick({target:root.querySelector('[data-price-check]')});
 assert.deepEqual(selected(),[['189','minimum'],['264','price']]);
 dispose();
 window.close();
});
test('price loading attaches WB and Ozon main photos by exact article',async()=>{const wbResult=await loadMarketplacePrices('wb',async op=>op==='pricesAll'?{data:{listGoods:[wb()]}}:{cards:[{nmID:1,title:'WB name',photos:[{big:'https://example.com/wb.webp'}]}],cursor:{total:1}});const ozResult=await loadMarketplacePrices('ozon',async op=>op==='prices'?{items:[ozon()],cursor:''}:{items:[{offer_id:'OTHER',primary_image:['https://example.com/other.webp']},{offer_id:'SKU1',name:'Ozon name',primary_image:['https://example.com/ozon.webp']}]});assert.equal(wbResult.rows[0].imageUrl,'https://example.com/wb.webp');assert.equal(ozResult.rows[0].imageUrl,'https://example.com/ozon.webp');const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');mountMarketplacePrices({root,database:{products:[],priceSnapshots:[wbResult,ozResult]},save:()=>{},getCredentials:()=>({})});assert.equal(root.querySelector('.table-product-photo'),null);assert.match(root.textContent,/SKU1/);});
