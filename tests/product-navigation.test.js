import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {blankProduct} from '../calc.js';
test('large catalogue appends products on scroll, preserves rows, and searches the whole collection',async()=>{
 const dom=new JSDOM('<div id="app"></div><div id="toast"></div>',{url:'https://tpskym.github.io/wb-cost-pwa/'});
 Object.assign(globalThis,{document:dom.window.document,window:dom.window,localStorage:dom.window.localStorage,location:dom.window.location,history:dom.window.history,indexedDB,confirm:()=>true});dom.window.scrollTo=()=>{};
 const products=Array.from({length:205},(_,i)=>({...blankProduct(),name:'Товар '+i,sku:'SKU-'+i,marketplaceCategories:i%2?{}:{wb:{id:12,label:'Дом'},ozon:{id:22,typeId:23,label:'Аксессуары'}},productGroup:'Каталог '+Math.floor(i/5)}));
 products[0].marketplaceLogistics={ozon:{commission:23}};
 localStorage.setItem('workshop-db-v1',JSON.stringify({schema:1,id:crypto.randomUUID(),revision:0,updatedAt:new Date().toISOString(),products,templates:[],costPrices:{printers:[{model:"Bambu Lab A1",price:45000}],filaments:[]}}));
 await import('../app.js');
 const $=s=>document.querySelector(s);
 assert.equal($('[data-tab="important"]').getAttribute('aria-selected'),'true');assert.equal(document.querySelectorAll('[data-product]').length,20);
 assert.equal($('[data-product-page]'),null);const list=$('#product-list'),scroller=$('.product-catalogue'),first=$('[data-product]');Object.defineProperty(scroller,'clientHeight',{configurable:true,value:400});Object.defineProperty(scroller,'scrollHeight',{configurable:true,value:1000});scroller.scrollTop=650;scroller.dispatchEvent(new dom.window.Event('scroll'));assert.equal(document.querySelectorAll('[data-product]').length,40);assert.equal($('[data-product]'),first);assert.equal(scroller.scrollTop,650);assert.equal(list.querySelectorAll('[data-product]')[20].dataset.product,products[20].id);
 const search=$('#product-search');search.value='SKU-204';search.dispatchEvent(new dom.window.Event('input'));
 assert.equal(document.querySelectorAll('[data-product]').length,1);assert.equal($('[data-product]').dataset.product,products[204].id);
 $('[data-product]').click();await settle();assert.equal($('#sku').value,'SKU-204');assert.equal($('#product-search').value,'SKU-204');
 const {disposeListingEditor}=await import('../listing-editor.js?v=0.2.380');disposeListingEditor();
});
test('variants preserve the name and build article suffixes from selected colours',async()=>{
 const $=s=>document.querySelector(s),name=$('#name').value;
 $('#duplicate').click();await settle();
 assert.equal($('#name').value,name);assert.equal($('#sku').value,'SKU-204_');
 const change=color=>{const input=$('#variantNote');input.value=color;input.dispatchEvent(new window.Event('change'));};
 change('Черный');assert.equal($('#sku').value,'SKU-204_black');
 change('Белый');assert.equal($('#sku').value,'SKU-204_white');
 change('Серый');assert.equal($('#sku').value,'SKU-204_gray');
 change('Красный');assert.equal($('#sku').value,'SKU-204_red');
 change('Зелёный');assert.equal($('#sku').value,'SKU-204_green');
 change('Узкое основание');assert.equal($('#variantNote').value,'Узкое основание');assert.equal($('#sku').value,'SKU-204_green');
});

test('colour pencil opens choices and selection updates the article',async()=>{
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
 document.querySelector('#variant-color-pick').click();await settle();
 assert.equal(document.querySelectorAll('[data-variant-color]').length,5);
 document.querySelector('[data-variant-color="Черный"]').click();await settle();
 assert.equal(document.querySelector('#variantNote').value,'Черный');
 assert.equal(document.querySelector('#sku').value,'SKU-204_black');
 assert.equal(document.querySelector('.variant-color-dialog'),null);
});
test('selecting a sidebar product preserves list scroll and keyboard focus',async()=>{
 const search=document.querySelector('#product-search');search.value='';search.dispatchEvent(new window.Event('input'));
 const list=document.querySelector('#product-list');document.querySelector('.product-catalogue').scrollTop=360;
 const item=list.querySelectorAll('[data-product]')[3],id=item.dataset.product;item.click();await settle();
 assert.equal(document.querySelector('.product-catalogue').scrollTop,360);
 assert.equal(document.activeElement.dataset.product,id);
});
test('form variant number is copied while barcode is cleared and label prompt uses all identity fields',async()=>{
 const change=(id,value)=>{const input=document.querySelector('#'+id);input.value=value;input.dispatchEvent(new window.Event('change'));};
 change('variantNumber','3');change('barcode','2057336623159');
 document.querySelector('#duplicate').click();await settle();
 assert.equal(document.querySelector('#variantNumber').value,'3');assert.equal(document.querySelector('#barcode').value,'');
 change('barcode','1234567890123');change('variantNote','Белый');
 const name=document.querySelector('#name').value,sku=document.querySelector('#sku').value;
 assert.equal(document.querySelector('#label-ai-prompt'),null);assert.ok(document.querySelector('#label-design-prompt'));
});
test('sidebar switches preserve page position and invoke selection only once',async()=>{
 const previousScroll=window.scrollTo;Object.defineProperty(window,'scrollY',{configurable:true,value:540});const calls=[];window.scrollTo=options=>calls.push(options);const list=document.querySelector('#product-list');document.querySelector('.product-catalogue').scrollTop=200;list.querySelectorAll('[data-product]')[2].click();await settle();assert.equal(calls.length,1);assert.equal(calls[0].top,540);assert.equal(document.querySelector('.product-catalogue').scrollTop,200);window.scrollTo=previousScroll;
});
test('activating another product keeps the scrolled catalogue and loaded thumbnails in the DOM',async()=>{const catalogue=document.querySelector('.product-catalogue'),list=document.querySelector('#product-list'),buttons=[...list.querySelectorAll('[data-product]')],target=buttons.find(b=>!b.classList.contains('chosen')),image=buttons[0].querySelector('[data-product-image]');catalogue.scrollTop=730;target.click();await settle();assert.equal(document.querySelector('.product-catalogue'),catalogue);assert.equal(document.querySelector('#product-list'),list);assert.equal(catalogue.scrollTop,730);assert.equal(buttons[0].querySelector('[data-product-image]'),image);assert.equal(target.classList.contains('chosen'),true);assert.equal(target.getAttribute('aria-current'),'true');assert.equal(document.querySelectorAll('[data-product][aria-current="true"]').length,1);assert.equal(document.querySelector('#sku').value,target.querySelector('.product-sku').textContent);});
test('cost production editor mounts three spool selectors and saves a manual third colour',async()=>{const selects=document.querySelectorAll('#product-filament-colors select');assert.equal(selects.length,3);selects[2].value='__manual__';selects[2].dispatchEvent(new window.Event('change'));const input=document.querySelector('[data-material-color-manual="2"]');assert.equal(input.hidden,false);input.value='THIRD-COLOR';input.dispatchEvent(new window.Event('input'));const sku=document.querySelector('#sku').value,db=(await readDatabase()),p=db.products.find(p=>p.sku===sku);assert.equal(p.filamentSlots[2].code,'THIRD-COLOR');assert.match(p.colorCode,/THIRD-COLOR/);});

test('clearing calculation history affects only selected product, confirms and keeps a backup',async()=>{const $=s=>document.querySelector(s);$('#snapshot').click();await settle();$('#snapshot').click();await settle();const before=(await readDatabase()),sku=$('#sku').value,p=before.products.find(p=>p.sku===sku);assert.equal(p.history.length,2);$('#clear-history').click();document.querySelector('.app-confirm .confirm-actions button').click();await settle();assert.equal((await readDatabase()).products.find(p=>p.id===p.id&&p.sku===sku).history.length,2);$('#clear-history').click();document.querySelector('.app-confirm .confirm-accept').click();await settle();for(let i=0;i<100&&(await readDatabase()).products.find(q=>q.id===p.id).history.length;i++)await new Promise(resolve=>setTimeout(resolve,5));const after=(await readDatabase());assert.deepEqual(after.products.find(q=>q.id===p.id),{...p,history:[]});assert.deepEqual(after.products.filter(q=>q.id!==p.id),before.products.filter(q=>q.id!==p.id));assert.equal((await readBackup()).products.find(q=>q.id===p.id).history.length,2);assert.equal($('#clear-history').disabled,true);});
test('label panel opens a ready to copy design prompt with label dimensions',async()=>{document.querySelector('#label-design-prompt').click();await settle();assert.match(document.querySelector('#label-prompt-title').textContent,/58 × 40/);assert.match(document.querySelector('#label-prompt-text').value,/Создай готовые к печати товарные этикетки/);assert.match(document.querySelector('#label-prompt-text').value,/Артикул: /);document.querySelector('[data-prompt-close]').click();await settle();assert.equal(document.querySelector('.label-prompt-dialog'),null);});

test('group label prompt button opens group task beside individual label prompt',async()=>{document.querySelector('#label-group-prompt').click();await settle();assert.ok(document.querySelector('.group-label-picker'));assert.ok(document.querySelectorAll('[data-member]:checked').length);document.querySelector('[data-generate]').click();await settle();assert.equal(document.querySelector('.group-label-picker'),null);assert.match(document.querySelector('#label-prompt-title').textContent,/всей группы/);assert.match(document.querySelector('#label-prompt-text').value,/Этикетки для всей группы товаров/);document.querySelector('[data-prompt-close]').click();await settle();});

test('creating more than ten variants keeps the complete group together and the new item visible',async()=>{const before=(await readDatabase()),currentId=document.querySelector('#mobile-product').value,group=before.products.find(p=>p.id===currentId).productGroup;for(let i=0;i<12;i++)document.querySelector('#duplicate').click();await settle();const db=(await readDatabase()),members=db.products.filter(p=>p.productGroup===group),groups=[...document.querySelectorAll('#product-list [data-group]')].filter(item=>item.dataset.group===group);assert.equal(groups.length,1);assert.equal(groups[0].querySelectorAll('[data-product]').length,members.length);assert.ok(groups[0].querySelector('.chosen'));assert.equal(document.querySelectorAll('#product-list .chosen').length,1);});

test('catalogue category filters combine with groups, collapse and reset',async()=>{
 const $=s=>document.querySelector(s),db=await readDatabase(),group=db.products.find(p=>p.productGroup)?.productGroup;
 $('#catalogue-group-filter').value=group;$('#catalogue-group-filter').dispatchEvent(new window.Event('change'));
 $('[data-catalogue-collapse]').click();assert.equal(document.querySelectorAll('#product-list details[open]').length,0);$('[data-catalogue-expand]').click();assert.ok(document.querySelectorAll('#product-list details[open]').length>0);
 const wb=$('[data-catalogue-category=wb]'),ozon=$('[data-catalogue-category=ozon]');wb.value='12:';wb.dispatchEvent(new window.Event('change'));assert.ok(document.querySelectorAll('#product-list [data-product]').length>0);
 for(const item of document.querySelectorAll('#product-list [data-product]')){const p=db.products.find(p=>p.id===item.dataset.product);assert.equal(p.productGroup,group);assert.equal(p.marketplaceCategories.wb.id,12);}
 ozon.value='__none__';ozon.dispatchEvent(new window.Event('change'));assert.equal(document.querySelectorAll('#product-list [data-product]').length,0);
 $('[data-catalogue-reset]').click();await settle();assert.equal(wb.value,'');assert.equal(ozon.value,'');assert.equal($('#catalogue-group-filter').value,'');
});
test('category choices follow the selected group',async()=>{
 const $=s=>document.querySelector(s),db=await readDatabase();for(const group of [...new Set(db.products.map(p=>p.productGroup||'__ungrouped__'))]){
 $('#catalogue-group-filter').value=group;$('#catalogue-group-filter').dispatchEvent(new window.Event('change'));
 for(const market of ['wb','ozon']){const expected=[...new Set(db.products.filter(p=>(p.productGroup||'__ungrouped__')===group).map(p=>p.marketplaceCategories?.[market]).filter(Boolean).map(c=>c.id+':'+(c.typeId||'')))];assert.deepEqual([...$('[data-catalogue-category='+market+']').options].map(o=>o.value),['','__none__',...expected]);}}
 $('[data-catalogue-reset]').click();await settle();
});
test('catalogue displays four saved status badges without refreshing marketplaces',async()=>{
 const row=document.querySelector('#product-list [data-product]');assert.ok(row);assert.equal(row.querySelectorAll('.catalogue-status').length,4);assert.match(row.textContent,/WB/);assert.match(row.textContent,/Ozon/);assert.match(row.textContent,/Этикетка/);assert.match(row.textContent,/Модель/);assert.ok(document.querySelector('#catalogue-refresh'));assert.match(document.querySelector('#catalogue-refresh-status').textContent,/сохранённым/);
});
test('presence filters combine and reset without calling the API',async()=>{
 const choose=(key,value)=>{const input=document.querySelector('[data-catalogue-presence="'+key+'"]');input.value=value;input.dispatchEvent(new window.Event('change'));};
 choose('wb','yes');assert.equal(document.querySelectorAll('#product-list [data-product]').length,0);choose('wb','unknown');assert.ok(document.querySelectorAll('#product-list [data-product]').length);choose('label','yes');assert.equal(document.querySelectorAll('#product-list [data-product]').length,0);document.querySelector('[data-catalogue-reset]').click();await settle();assert.ok(document.querySelectorAll('#product-list [data-product]').length);assert.ok([...document.querySelectorAll('[data-catalogue-presence]')].every(input=>input.value===''));
 const model=document.querySelector('[data-catalogue-presence="model"]');model.value='no';await model.onchange();assert.ok(document.querySelectorAll('#product-list [data-product]').length);model.value='yes';await model.onchange();assert.equal(document.querySelectorAll('#product-list [data-product]').length,0);document.querySelector('[data-catalogue-reset]').click();await settle();
});
test('large group picker searches by article and applies the chosen group',async()=>{
 document.querySelector('[data-catalogue-group-picker]').click();await settle();const dialog=document.querySelector('.catalogue-group-picker');assert.ok(dialog);const search=dialog.querySelector('[data-group-picker-search]');search.value='SKU-204';search.dispatchEvent(new window.Event('input'));const choices=[...dialog.querySelectorAll('[data-pick-catalogue-group]')],choice=choices.find(button=>button.dataset.pickCatalogueGroup);assert.ok(choice);assert.ok(choice.querySelector('[data-product-image]'));const group=choice.dataset.pickCatalogueGroup;choice.click();await settle();assert.equal(document.querySelector('.catalogue-group-picker'),null);assert.equal(document.querySelector('#catalogue-group-filter').value,group);assert.equal(document.querySelector('[data-catalogue-group-picker] span').textContent,group);assert.ok([...document.querySelectorAll('#product-list [data-group]')].every(node=>node.dataset.group===group));document.querySelector('[data-catalogue-reset]').click();await settle();
});

async function settle(){await new Promise(resolve=>setTimeout(resolve,5));const {flushDatabase}=await import('../app.js');await flushDatabase().catch(()=>{});await new Promise(resolve=>setTimeout(resolve,0));}
async function readDatabase(){await settle();const {getFile}=await import('../attachments.js'),record=await getFile('workshop-db-v1-main-database');return JSON.parse(await record.blob.text());}
async function readBackup(){const {readDatabaseBackup}=await import('../database-backup.js');return readDatabaseBackup();}

test('Important tab edits the same production parameters without adding extra calculation fields',async()=>{
 const $=s=>document.querySelector(s);$('[data-space="cost"]').click();await settle();$('[data-tab="important"]').click();await settle();assert.equal($('[data-tab="important"]').getAttribute('aria-selected'),'true');assert.deepEqual([...document.querySelectorAll('#fields [data-field]')].map(e=>e.dataset.field),['grams','kgPrice','minutes','yield','box']);assert.ok($('[data-cost-printer]'));assert.ok($('#material'));assert.equal(document.querySelectorAll('#product-filament-colors select').length,3);assert.equal($('#fields [data-field="printerLife"]'),null);assert.doesNotMatch($('#fields').textContent,/Энергия: 200 Вт/);
 const input=$('#fields [data-field="grams"]');input.value='32';input.dispatchEvent(new window.Event('input',{bubbles:true}));$('[data-cost-printer]').value='Bambu Lab A1';$('[data-cost-printer]').dispatchEvent(new window.Event('change',{bubbles:true}));await settle();const productId=$('#mobile-product').value;assert.equal((await readDatabase()).products.find(p=>p.id===productId).values.grams,32);
 $('[data-tab="production"]').click();await settle();assert.equal($('#fields [data-field="grams"]').value,'32');assert.equal($('[data-cost-printer]').value,'Bambu Lab A1');assert.equal($('#fields [data-field="printerPrice"]').value,'45000');assert.ok($('#fields [data-field="printerPrice"]').readOnly);const price=$('#fields [data-field="kgPrice"]');price.value='1300';price.dispatchEvent(new window.Event('input',{bubbles:true}));await settle();$('[data-tab="important"]').click();await settle();assert.equal($('#fields [data-field="kgPrice"]').value,'1300');assert.equal(document.querySelectorAll('#fields [data-field="grams"]').length,1);$('[data-tab="production"]').click();await settle();
});

test('cost summary contains cost breakdown without unused marketplace profit inputs',async()=>{document.querySelector('[data-space="cost"]').click();await settle();const root=document.querySelector('#results');assert.ok(root.querySelector('.big-number'));assert.ok(root.querySelector('.cost-list'));assert.ok(root.querySelector('details'));assert.equal(root.querySelector('[data-market-field]'),null);assert.equal(root.querySelector('[data-open-loaded-listing]'),null);assert.equal(root.querySelector('[data-market-profit]'),null);assert.doesNotMatch(root.textContent,/К переводу за товар|Налог на продажу|Маржа от цены/);});

test('sale price controls recalculate the scheme payouts, profit table and saved prices',async()=>{
 const $=selector=>document.querySelector(selector);
 const enter=(input,value)=>{input.value=value;input.dispatchEvent(new window.Event('input',{bubbles:true}));};
 $('[data-space="cost"]').click();
 await settle();
 enter($('[data-profit-tax-rate]'),6);
 for(const [market,fields] of [
  ['wb',{commissionOverride:20,dispatchHours:48,deliveryOverride:10,buyout:100}],
  ['ozon',{commissionFbo:20,commissionFbs:20,acquiring:5,fbo:10,fbs:20,buyout:100}]
 ])for(const [field,value] of Object.entries(fields))enter($(`[data-profit-logistics="${field}"][data-market="${market}"]`),value);
 const ozon=$('[data-profit-market="ozon"].marketplace-profit-card');
 const wb=$('[data-profit-market="wb"].marketplace-profit-card');
 const acceptance=[...wb.querySelectorAll('label')].find(label=>label.textContent.trim()==='Приёмка FBS, ₽/шт.')?.querySelector('input');
 assert.equal(acceptance?.value,'10');
 assert.equal(acceptance.readOnly,true);
 assert.doesNotMatch(ozon.querySelector('.marketplace-logistics-fields').textContent,/Приёмка/);
 const ozonPrice=ozon.querySelector('[data-profit-sale-price]');
 const ozonSlider=ozon.querySelector('[data-price-range]');
 assert.equal(ozonSlider.max,'300');
 enter(ozonSlider,180);
 assert.equal(ozonPrice.value,'180');
 assert.match($('[data-calculated-payout="ozonFbo"]').textContent,/125/);
 assert.match($('[data-calculated-payout="ozonFbs"]').textContent,/115/);
 const profit=$('[data-profit-result="ozonFbo"]');
 assert.match(profit.querySelector('small').textContent,/10,80/);
 assert.ok(profit.querySelector('strong').textContent.includes('₽'));
 assert.match($('[data-marketplace-profit-table]').textContent,/Ozon FBO.*Ozon FBS.*180,00.*125,00.*115,00/);
 ozon.querySelector('[data-price-adjust="1"]').click();
 assert.equal(ozonPrice.value,'181');
 assert.match($('[data-calculated-payout="ozonFbs"]').textContent,/115,75/);
 ozon.querySelector('[data-price-adjust="-1"]').click();
 assert.equal(ozonSlider.value,'180');
 enter(ozonSlider,299);
 ozon.querySelector('[data-price-adjust="1"]').click();
 assert.equal(ozonPrice.value,'300');
 assert.equal(ozon.querySelector('[data-price-adjust="1"]').disabled,true);
 enter(ozonSlider,0);
 ozonSlider.dispatchEvent(new window.Event('change'));
 assert.equal(ozon.querySelector('[data-price-adjust="-1"]').disabled,true);
 assert.equal(profit.dataset.profitTone,'loss');
 assert.match(profit.querySelector('strong').textContent,/-/);
 assert.match(profit.querySelector('small').textContent,/Налог вычтен: 0,00/);
 const wbAcquiring=wb.querySelector('[data-profit-logistics=acquiring]');
 assert.equal(wbAcquiring.value,'1.5');
 const wbPrice=wb.querySelector('[data-profit-sale-price]');
 const wbSlider=wb.querySelector('[data-price-range]');
 assert.equal(wbPrice.max,'');
 const oldEnd=Number(wbSlider.max);
 enter(wbSlider,oldEnd);
 wbSlider.dispatchEvent(new window.Event('change'));
 assert.ok(Number(wbSlider.max)>oldEnd);
 wb.querySelector('[data-price-adjust="1"]').click();
 assert.equal(wbSlider.valueAsNumber,oldEnd+1);
 assert.match($('[data-calculated-payout="wbFbs"]').textContent,/765,79/);
 $('[data-tab="packaging"]').click();
 enter($('#fields [data-field="capacity"]'),4);
 enter($('#fields [data-field="outer"]'),20);
 assert.equal($('#product-list [data-product-profit-summary]'),null);
 assert.ok($('.image-profit-summary [data-product-profit-summary] strong'));
 await settle();
 const database=await readDatabase();
 const current=database.products.find(p=>p.id===$('#mobile-product').value);
 assert.equal(current.marketplaces.wb.price,oldEnd+1);
 assert.equal(current.marketplaces.ozon.price,0);

 const {calculateManual,validateDB}=await import('../calc.js');
 const {configuredCostPrices}=await import('../expenses.js');
 const {cost}=calculateManual({...current,values:{...current.values,...configuredCostPrices(database,current)}});
 const prices=(market,kind)=>[...document.querySelectorAll(`[data-fbs-prices="${market}"] [data-fbs-${kind}]`)].map(el=>el.textContent);
 const money=new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB'});
 const ozonCost=cost-5;
 assert.equal($('#results .big-number strong').textContent,money.format(cost));
 assert.equal($('#results .ozon-fbs-cost strong').textContent,money.format(ozonCost));
 const costRow=[...document.querySelectorAll('[data-marketplace-profit-table] tbody tr')].find(row=>row.querySelector('th').textContent==='Себестоимость');
 assert.deepEqual([...costRow.querySelectorAll('td')].map(cell=>cell.textContent),[cost,ozonCost,ozonCost].map(value=>money.format(value)));
 assert.equal($('[data-profit-result="wbFbs"] strong').textContent,money.format(765.79-(oldEnd+1)*0.06-cost));
 const assertPrice=(market,kind,expected)=>{
  const values=prices(market,kind);
  assert.equal(values.length,2);
  assert.equal(values[0],values[1]);
  assert.ok(values[0].endsWith(money.format(expected)),values[0]);
 };
 assertPrice('wb','break-even',Math.ceil((20+cost)/0.725-1e-9));
 assertPrice('wb','working',Math.ceil((20+1.4*cost)/0.725-1e-9));
 const wbSuggested=Math.ceil((20+1.8*cost)/0.725-1e-9);
 assertPrice('wb','suggested',wbSuggested);
 assertPrice('wb','reference-price',wbSuggested/0.8);
 assertPrice('wb','working-profit',cost*0.4);
 assertPrice('wb','suggested-profit',cost*0.8);
 for(const host of document.querySelectorAll('[data-fbs-prices="wb"]'))assert.match(host.querySelector('.fbs-reference-price').textContent,/Зачёркнутая цена/);
 enter(wbAcquiring,0);
 assert.match($('[data-calculated-payout="wbFbs"]').textContent,/780,80/);
 assertPrice('wb','break-even',Math.ceil((20+cost)/0.74-1e-9));
 const saved=validateDB(await readDatabase()).products.find(p=>p.id===current.id);
 assert.equal(saved.marketplaceLogistics.wb.acquiring,0);
 enter($('[data-market="ozon"][data-profit-logistics="buyout"]'),80);
 assertPrice('ozon','break-even',Math.ceil((20+4+ozonCost)/0.69-1e-9));
 assertPrice('ozon','working',Math.ceil((20+4+1.4*ozonCost)/0.69-1e-9));
 const ozonSuggested=Math.ceil((20+4+1.8*ozonCost)/0.69-1e-9);
 assertPrice('ozon','suggested',ozonSuggested);
 assertPrice('ozon','reference-price',ozonSuggested*2);
 assertPrice('ozon','working-profit',ozonCost*0.4);
 assert.equal(ozonPrice.value,'0');
 assert.ok($('[data-fbs-suggested]').closest('.fbs-suggested-price'));
 enter(ozonSlider,180);
 assert.equal($('[data-profit-result="ozonFbs"] strong').textContent,money.format(115-10.8-4-ozonCost));
 const ozonDelivery=$('[data-market="ozon"][data-profit-logistics="fbs"]');
 enter(ozonDelivery,300*0.69-4-1.6*ozonCost);
 assertPrice('ozon','working-profit',ozonCost*0.4);
 assert.deepEqual(prices('ozon','working-percent'),[]);
 assertPrice('ozon','suggested',300);
 assertPrice('ozon','reference-price',600);
 assertPrice('ozon','suggested-profit',ozonCost*0.6);
 for(const label of prices('ozon','suggested-percent'))assert.match(label,/60,00%$/);
 enter(ozonDelivery,301);
 assert.deepEqual(prices('ozon','break-even'),Array(2).fill('Недостижимо до 300 ₽'));
 const cappedLoss=300*0.69-301-4-ozonCost;
 for(const kind of ['working','suggested']){
  assertPrice('ozon',kind,300);
  assertPrice('ozon',kind+'-profit',cappedLoss);
 }
});

test('multiline product description appears once above Important with its card import action and persists',async()=>{
 const $=s=>document.querySelector(s);$('[data-space="cost"]').click();await settle();$('[data-tab="important"]').click();await settle();const text='Описание товара\nВторая строка';assert.equal($('#fields [data-product-description]'),null);assert.equal(document.querySelectorAll('[data-product-description]').length,1);const input=$('#description-identity');assert.ok(input);assert.ok(input.closest('.product-description-editor').querySelector('[data-description-pull]'));input.value=text;input.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal($('#description-identity').value,text);await settle();const id=$('#mobile-product').value;assert.equal((await readDatabase()).products.find(p=>p.id===id).description,text);$('[data-tab="production"]').click();await settle();assert.equal($('#description-identity').value,text);assert.equal(document.querySelectorAll('[data-product-description]').length,1);
});

test('label panel keeps printing without a redundant preview button',()=>{assert.equal(document.querySelector('#label-preview'),null);assert.ok(document.querySelector('#label-print'));});

test('individual and group prompt actions are beside the product group field',()=>{const block=document.querySelector('#productGroup').closest('.identity-group-block');assert.ok(block.querySelector('#label-design-prompt'));assert.ok(block.querySelector('#label-group-prompt'));assert.equal(document.querySelectorAll('#label-design-prompt').length,1);assert.equal(document.querySelector('.product-label-panel #label-group-prompt'),null);});

test('pasted HTML breaks become newlines in the description without losing caret position',async()=>{const input=document.querySelector('#description-identity');input.value='А<br/><br/>Б';input.setSelectionRange(input.value.length,input.value.length);input.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(input.value,'А\n\nБ');assert.equal(input.selectionStart,4);await settle();const id=document.querySelector('#mobile-product').value;assert.equal((await readDatabase()).products.find(p=>p.id===id).description,'А\n\nБ');});

test('product archive and model actions appear above their file selectors',async()=>{
 for(let i=0;i<100&&!document.querySelector('.print-model-actions');i++)await new Promise(r=>setTimeout(r,5));const archive=document.querySelector('#all-product-files'),section=document.querySelector('.product-files');assert.ok(section.querySelector('.product-files-head').contains(archive));assert.equal(document.querySelectorAll('#all-product-files').length,1);const toolbar=document.querySelector('.print-model-toolbar');assert.equal(toolbar.firstElementChild.className,'print-model-actions');assert.ok(toolbar.lastElementChild.querySelector('#print-model-select'));
});

test('last marketplace parameters tab shares product dimensions with Important',async()=>{const $=s=>document.querySelector(s);$('[data-space="cost"]').click();await settle();const tabs=[...document.querySelectorAll('[data-tab]')];assert.equal(tabs.at(-1).dataset.tab,'marketplace');$('[data-tab="marketplace"]').click();await settle();assert.equal(document.querySelectorAll('[data-measurement]').length,8);const input=$('[data-measurement="product.width"]');input.value='42';input.dispatchEvent(new window.Event('change',{bubbles:true}));await settle();$('[data-tab="important"]').click();await settle();assert.equal($('[data-measurement="product.width"]').value,'42');});

 test('Important packaging price and type share the packaging tab fields',async()=>{const $=s=>document.querySelector(s);$('[data-space="cost"]').click();await settle();$('[data-tab="important"]').click();await settle();const type=$('[data-packaging-type]');type.value='bag';type.dispatchEvent(new window.Event('change'));const price=$('#fields [data-field="box"]');price.value='7.5';price.dispatchEvent(new window.Event('input',{bubbles:true}));await settle();$('[data-tab="packaging"]').click();await settle();assert.equal($('[data-packaging-type]').value,'bag');assert.equal($('#fields [data-field="box"]').value,'7.5');assert.match($('#fields').textContent,/Индивидуальный пакет/);const box=$('#fields [data-field="box"]');box.value='9';box.dispatchEvent(new window.Event('input',{bubbles:true}));$('[data-tab="important"]').click();await settle();assert.equal($('#fields [data-field="box"]').value,'9');});

test('label prompts are grouped and description prompt includes skill rules and a configurable cap',async()=>{const $=s=>document.querySelector(s);$('[data-space=cost]').click();await settle();assert.match($('.label-prompt-actions legend').textContent,/Промпты для этикеток/);assert.ok($('#label-design-prompt svg'));assert.ok($('#label-group-prompt svg'));assert.ok($('[data-barcode-pull] svg'));const input=$('[data-product-description]');input.value='Товар\nОписание';input.dispatchEvent(new window.Event('input'));assert.match($('[data-description-count]').textContent,/14 символов/);$('[data-description-prompt]').click();await settle();assert.match($('#label-prompt-title').textContent,/описания товара/);assert.match($('#label-prompt-text').value,/wb-ozon-content/);const limit=$('#description-prompt-limit');limit.value='1800';limit.dispatchEvent(new window.Event('input'));assert.match($('#label-prompt-text').value,/Максимальная длина описания: 1800/);$('[data-prompt-close]').click();});

test('label files prompt button opens the current product label prompt without needing an attached PDF',()=>{const button=document.querySelector('#label-file-prompt');assert.ok(button);assert.ok(button.querySelector('svg'));button.click();const prompt=document.querySelector('#label-prompt-text');assert.ok(prompt);assert.match(prompt.value,/PrintScaling=None/);assert.ok(prompt.value.includes('Артикул: '+document.querySelector('#sku').value));document.querySelector('[data-prompt-close]').click();});

test('model upload replaces the previous file rather than growing the product model library',async()=>{const owner=(await readDatabase()).id+':'+document.querySelector('#product-list .chosen[data-product]').dataset.product;const upload=async name=>{let input;for(let attempt=0;attempt<100;attempt++){input=document.querySelector('[data-file-upload=model]');if(input)break;await new Promise(resolve=>setTimeout(resolve,20));}assert.ok(input,'model upload form is ready');const file=new Blob(['model bytes']);Object.defineProperty(file,'name',{value:name});Object.defineProperty(input,'files',{value:[file]});await input.onchange();await settle();};await upload('first.3mf');await upload('replacement.3mf');const {listFiles}=await import('../attachments.js');const models=(await listFiles(owner)).filter(f=>f.category==='model');assert.equal(models.length,1);assert.equal(models[0].name,'replacement.3mf');assert.equal(document.querySelector('#print-model-select').selectedOptions[0].textContent,'replacement.3mf');});


test('calculator pulls Ozon fees and adjusts the WB rate for the planned dispatch time',async t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-11-11T12:00:00+03:00'));
 const $=selector=>document.querySelector(selector);
 const enter=(selector,value)=>{const input=$(selector);input.value=value;input.dispatchEvent(new window.Event('input',{bubbles:true}));};
 const originalFetch=globalThis.fetch;
 const calls=[];
 let ozonCardPrice=279;
 let ozonAcquiring;
 globalThis.fetch=async(url,options)=>{
  calls.push({url,method:options.method,body:options.body});
  if(url==='https://common-api.wildberries.ru/api/v1/tariffs/commission?locale=ru'){
   return Response.json({report:[
    {subjectID:31,parentID:12,kgvpMarketplace:3},
    {subjectID:12,kgvpMarketplace:37,paidStorageKgvp:10},
   ]});
  }
  if(url==='https://api-seller.ozon.ru/v5/product/info/prices'){
   return Response.json({items:[
    {offer_id:'another-product',commissions:{sales_percent_fbo:4,sales_percent_fbs:5}},
    {offer_id:'SKU-0',price:{marketing_seller_price:String(ozonCardPrice),price:'450',min_price:'199',declared_price:'129',currency_code:'RUB'},acquiring:ozonAcquiring,
     commissions:{sales_percent_fbo:12.5,sales_percent_fbs:22.5}},
   ]});
  }
  if(url==='https://content-api.wildberries.ru/content/v2/get/cards/list'){
   assert.equal(JSON.parse(options.body).settings.filter.textSearch,'SKU-0');
   return Response.json({cards:[{vendorCode:'SKU-01',nmID:999},{vendorCode:'SKU-0',nmID:123}],cursor:{total:2}});
  }
  if(url==='https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter?limit=1000&offset=0&filterNmID=123'){
   return Response.json({data:{listGoods:[{vendorCode:'SKU-0',nmID:123,currencyIsoCode4217:'RUB',discount:20,sizes:[{price:500,discountedPrice:400}]}]}});
  }
  throw Error('Unexpected request '+url);
 };
 try{
  $('[data-space="api"]').click();
  $('#wb-api-token').value='test-wb-token';
  $('#ozon-client').value='1000';
  $('#ozon-api-key').value='test-ozon-key';
  $('#api-save-keys').click();
  $('[data-space="cost"]').click();
  enter('#product-search','SKU-0');
  $('#product-list [data-product]').click();
  await settle();
  assert.equal($('#sku').value,'SKU-0');
  assert.equal($('[data-market="ozon"][data-profit-logistics="commissionFbo"]').value,'23');
  assert.equal($('[data-market="ozon"][data-profit-logistics="commissionFbs"]').value,'23');
  enter('[data-profit-sale-price="ozon"]',200);
  enter('[data-market="ozon"][data-profit-logistics="acquiring"]',2);
  enter('[data-market="ozon"][data-profit-logistics="fbo"]',10);
  enter('[data-market="ozon"][data-profit-logistics="fbs"]',20);
  await $('[data-pull-commission="wb"]').onclick();
  await $('[data-pull-commission="ozon"]').onclick();
  const ozonAcquiringInput=$('[data-market="ozon"][data-profit-logistics="acquiring"]');
  const ozonStatus=$('[data-profit-market="ozon"] [data-commission-status]');
  assert.equal(ozonAcquiringInput.value,'2');
  assert.match(ozonStatus.textContent,/Эквайринг \(оценка\) — нет данных/);
  ozonAcquiring=2.79;
  await $('[data-pull-commission="ozon"]').onclick();
  assert.equal(ozonAcquiringInput.value,'1');
  assert.match(ozonStatus.textContent,/Эквайринг \(оценка\) 1,00%/);
  const wbField=key=>'[data-market="wb"][data-profit-logistics="'+key+'"]';
  assert.equal($(wbField('commission')).value,'37');
  assert.equal($(wbField('commission')).readOnly,true);
  assert.equal($(wbField('delivery')).readOnly,true);
  enter('[data-profit-sale-price="wb"]',395);
  $('[data-tab="important"]').click();
  for(const [side,mm] of Object.entries({width:110,height:120,depth:90})){
   const dimension=$(`[data-measurement="packaged.${side}"]`);
   dimension.value=mm;
   dimension.dispatchEvent(new window.Event('change',{bubbles:true}));
  }
  await $('[data-calculate-delivery="wb"]').onclick();
  assert.equal($(wbField('delivery')).value,'82.6744');
  enter(wbField('buyout'),93);
  const deliveryValue=$(wbField('deliveryOverride'));
  assert.equal(deliveryValue.value,'88.9');
  assert.match($('[data-calculated-payout="wbFbs"]').textContent,/157,85/);
  enter(wbField('buyout'),90);
  assert.equal(deliveryValue.value,'91.86');
  assert.match($('[data-calculated-payout="wbFbs"]').textContent,/154,89/);
  enter(wbField('buyout'),0);
  assert.equal(deliveryValue.value,'');
  assert.equal($('[data-calculated-payout="wbFbs"]').textContent,'—');
  enter(wbField('buyout'),93);
  const hours=$(wbField('dispatchHours'));
  assert.equal(hours.value,'24');
  const appliedRate=$(wbField('commissionOverride'));
  assert.equal(appliedRate.value,'33.5');
  for(const value of ['0','']){
   enter(wbField('dispatchHours'),value);
   hours.dispatchEvent(new window.Event('change',{bubbles:true}));
   assert.equal(hours.value,'24');
   assert.equal(appliedRate.value,'33.5');
   assert.equal((await readDatabase()).products.find(product=>product.sku==='SKU-0').marketplaceLogistics.wb.dispatchHours,24);
  }
  const defaultPrice=$('[data-fbs-prices="wb"] [data-fbs-suggested]').textContent;
  enter(wbField('dispatchHours'),43);
  assert.equal(appliedRate.value,'37');
  assert.notEqual($('[data-fbs-prices="wb"] [data-fbs-suggested]').textContent,defaultPrice);
  enter(wbField('dispatchHours'),30);
  assert.equal(appliedRate.value,'33.5');
  assert.match($('[data-logistics-result="wb"]').textContent,/132,33/);
  assert.equal($('[data-fbs-prices="wb"] [data-fbs-suggested]').textContent,defaultPrice);
  enter(wbField('commissionOverride'),20);
  enter(wbField('deliveryOverride'),60);
  assert.match($('[data-calculated-payout="wbFbs"]').textContent,/240,08/);
  assert.notEqual($('[data-fbs-prices="wb"] [data-fbs-suggested]').textContent,defaultPrice);
  enter(wbField('buyout'),90);
  assert.equal(deliveryValue.value,'60');
  assert.equal(appliedRate.value,'20');
  enter(wbField('buyout'),93);
  assert.equal($('[data-market="ozon"][data-profit-logistics="commissionFbo"]').value,'12.5');
  assert.equal($('[data-market="ozon"][data-profit-logistics="commissionFbs"]').value,'22.5');
  assert.match($('[data-calculated-payout="ozonFbo"]').textContent,/163,00/);
  assert.match($('[data-calculated-payout="ozonFbs"]').textContent,/133,00/);
  const {validateDB}=await import('../calc.js');
  const stored=validateDB(await readDatabase()).products.find(product=>product.sku==='SKU-0');
  assert.equal(stored.marketplaceLogistics.wb.commission,37);
  assert.equal(stored.marketplaceLogistics.wb.dispatchHours,30);
  assert.equal(stored.marketplaceLogistics.wb.commissionOverride,20);
  assert.equal(stored.marketplaceLogistics.wb.deliveryOverride,60);
  enter(wbField('commissionOverride'),'');
  enter(wbField('deliveryOverride'),'');
  assert.equal(appliedRate.value,'33.5');
  assert.equal(deliveryValue.value,'88.9');
  assert.match($('[data-calculated-payout="wbFbs"]').textContent,/157,85/);
  assert.equal(stored.marketplaceLogistics.ozon.commissionFbo,12.5);
  assert.equal(stored.marketplaceLogistics.ozon.commissionFbs,22.5);
  assert.equal(stored.marketplaceLogistics.ozon.acquiring,1);
  await $('[data-pull-commission="wb"]').onclick();
  assert.equal(calls.filter(call=>call.url.includes('/tariffs/commission')).length,1);
  const ozonCall=calls.find(call=>call.url.includes('/product/info/prices'));
  assert.deepEqual(JSON.parse(ozonCall.body).filter.offer_id,['SKU-0']);
  const wbCard=$('.marketplace-profit-card[data-profit-market="wb"]');
  const ozonCard=$('.marketplace-profit-card[data-profit-market="ozon"]');
  await wbCard.querySelector('[data-pull-sale-price]').onclick();
  assert.equal(wbCard.querySelector('[data-profit-sale-price]').value,'400');
  assert.equal(wbCard.querySelector('[data-price-range]').value,'400');
  assert.match($('[data-calculated-payout="wbFbs"]').textContent,/161,10/);
  const cardPrices=market=>[...document.querySelectorAll(`#results [data-fbs-prices="${market}"] .fbs-card-prices li`)]
   .map(row=>[row.querySelector('span').textContent,row.querySelector('b').textContent]);
  const money=new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB'});
  assert.deepEqual(cardPrices('wb'),[
   ['Цена продавца до скидки',money.format(500)],
   ['Цена продавца со скидкой',money.format(400)],
   ['Минимальная цена в автоакциях','API WB не передаёт']
  ]);
  await ozonCard.querySelector('[data-pull-sale-price]').onclick();
  assert.equal(ozonCard.querySelector('[data-profit-sale-price]').value,'279');
  assert.equal(ozonCard.querySelector('[data-price-range]').value,'279');
  assert.match($('[data-calculated-payout="ozonFbs"]').textContent,/193,44/);
  assert.deepEqual(cardPrices('ozon'),[
   ['Предельная цена',money.format(279)],
   ['Ограничение для акций и стратегий',money.format(199)]
  ]);
  ozonCardPrice=350;
  await ozonCard.querySelector('[data-pull-sale-price]').onclick();
  assert.match(ozonCard.querySelector('[data-sale-price-status]').textContent,/350,00.*300/);
  assert.equal(ozonCard.querySelector('[data-profit-sale-price]').value,'279');
  assert.equal(cardPrices('ozon')[0][1],money.format(350));
  const storedPrices=validateDB(await readDatabase()).products.find(product=>product.sku==='SKU-0');
  assert.equal(storedPrices.marketplaces.wb.price,400);
  assert.equal(storedPrices.marketplaces.ozon.price,279);
  assert.equal(storedPrices.marketplaceCardPrices.ozon.sale,350);
  assert.equal(storedPrices.marketplaceCardPrices.ozon.minimum,199);
 }finally{
  globalThis.fetch=originalFetch;
 }
});

test('calculator settings apply immediately to every other product in the current group',async()=>{
 const $=selector=>document.querySelector(selector);
 const enter=(selector,value)=>{
  const input=$(selector);
  input.value=value;
  input.dispatchEvent(new window.Event('input',{bubbles:true}));
 };
 const {products}=await readDatabase();
 const source=products.find(row=>row.sku==='SKU-0');
 const member=products.find(row=>row.sku==='SKU-1');
 const select=async row=>{
  enter('#product-search',row.sku);
  $(`#product-list [data-product="${row.id}"]`).click();
  await settle();
 };
 await select(member);
 enter('[data-market="wb"][data-profit-logistics="commissionOverride"]',40);
 enter('[data-market="wb"][data-profit-logistics="deliveryOverride"]',100);
 await select(source);
 enter('[data-market="wb"][data-profit-logistics="acquiring"]',0);
 enter('[data-market="ozon"][data-profit-logistics="buyout"]',90);
 enter('[data-profit-tax-rate]',6);

 const before=(await readDatabase()).products;
 await $('#spread-marketplace-profit').onclick();
 assert.equal($('.marketplace-profit-picker'),null);
 const after=(await readDatabase()).products;
 const current=after.find(row=>row.id===source.id);
 const inGroup=row=>row.id!==source.id&&row.productGroup===source.productGroup;
 const targets=after.filter(inGroup);
 assert.deepEqual(targets.map(row=>row.id),before.filter(inGroup).map(row=>row.id));
 assert.ok(targets.length>1);
 assert.ok(document.querySelectorAll('#product-list [data-product]').length<targets.length+1);
 for(const row of targets){
  const old=before.find(item=>item.id===row.id);
  assert.deepEqual(row.marketplaceLogistics.wb,{...current.marketplaceLogistics.wb,acquiring:0});
  assert.deepEqual(row.marketplaceLogistics.ozon,current.marketplaceLogistics.ozon);
  for(const market of ['wb','ozon']){
   assert.deepEqual(row.marketplaces[market],{...old.marketplaces[market],price:current.marketplaces[market].price});
  }
  assert.equal(row.tax,6);
  assert.deepEqual(row.values,old.values);
 }
 assert.deepEqual(after.filter(row=>row.productGroup!==source.productGroup),before.filter(row=>row.productGroup!==source.productGroup));
 assert.deepEqual(current,before.find(row=>row.id===source.id));
 assert.ok($('#toast').textContent.includes(`${source.productGroup} · товаров: ${targets.length}`));
});

test('printer spread assigns the model and its cost only to selected products',async()=>{
 const $=selector=>document.querySelector(selector);
 const selectProduct=async sku=>{
  const search=$('#product-search');
  search.value=sku;
  search.dispatchEvent(new window.Event('input'));
  $('#product-list [data-product]').click();
  await settle();
 };
 await selectProduct('SKU-180');
 $('[data-tab="important"]').click();
 const printer=$('[data-cost-printer]');
 printer.value='Bambu Lab A1';
 printer.dispatchEvent(new window.Event('change'));
 const before=(await readDatabase()).products;
 const target=before.find(row=>row.sku==='SKU-181');
 $('[data-cost-printer]').closest('.cost-spread-field').querySelector('button').click();
 const dialog=$('.marketplace-profit-picker');
 assert.match(dialog.textContent,/Модель принтера.*Bambu Lab A1/);
 dialog.querySelector(`[name="target"][value="${target.id}"]`).click();
 assert.equal(dialog.querySelector('[value="apply"]').disabled,false);
 const nativeFormData=globalThis.FormData;
 try{
  globalThis.FormData=window.FormData;
  dialog.returnValue='apply';
  dialog.close();
 }finally{globalThis.FormData=nativeFormData;}
 const after=(await readDatabase()).products;
 assert.deepEqual(after,before.map(row=>row.id===target.id
  ? {...row,printer:'Bambu Lab A1',values:{...row.values,printerPrice:45000}}
  : row));
 await selectProduct('SKU-181');
 $('[data-tab="production"]').click();
 assert.equal($('[data-cost-printer]').value,'Bambu Lab A1');
 assert.equal($('[data-field="printerPrice"]').value,'45000');
 assert.ok($('[data-cost-printer]').closest('.cost-spread-field').querySelector('button'));
});

test('price report covers the catalogue, filters by group and uses the product calculator prices',async()=>{
 const $=selector=>document.querySelector(selector);
 const search=$('#product-search');
 search.value='SKU-0';
 search.dispatchEvent(new window.Event('input'));
 $('#product-list [data-product]').click();
 const before=await readDatabase();
 const current=before.products.find(row=>row.id===$('#mobile-product').value);
 const group=before.products.filter(row=>row.productGroup===current.productGroup);
 const button=$('#show-fbs-price-report');
 assert.equal(button.previousElementSibling.id,'workspace-forward');
 button.click();
 const report=$('.fbs-price-report');
 const count=report.querySelector('[data-report-count]');
 assert.match(count.textContent,new RegExp('из '+before.products.length+'$'));
 const initialRows=report.querySelectorAll('.fbs-report-product').length;
 report.querySelector('[data-report-more]').click();
 assert.ok(report.querySelectorAll('.fbs-report-product').length>initialRows);
 const filter=report.querySelector('[data-report-group]');
 filter.value=[...filter.options].find(option=>option.textContent===current.productGroup).value;
 filter.dispatchEvent(new window.Event('change'));
 assert.deepEqual([...report.querySelectorAll('h3')].map(el=>el.textContent),[current.productGroup]);
 assert.equal(report.querySelectorAll('.fbs-report-product').length,group.length);
 const details=[current.sku,current.variantNote,current.colorCode].filter(Boolean).join(' · ');
 const row=[...report.querySelectorAll('.fbs-report-product')].find(el=>el.querySelector('.fbs-report-product-info p').textContent===details);
 assert.ok(row);
 assert.equal(row.querySelector('img').alt,current.name);
 for(const market of ['wb','ozon']){
  assert.equal(row.querySelector(`[data-report-market="${market}"]`).innerHTML,$(`#results [data-fbs-prices="${market}"]`).innerHTML);
 }
 report.querySelector('[data-report-close]').click();
 assert.equal($('.fbs-price-report'),null);
 assert.equal(document.activeElement,button);
 assert.equal($('#mobile-product').value,current.id);
 assert.deepEqual(await readDatabase(),before);
});
