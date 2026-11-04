import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {blankProduct} from '../calc.js';
test('large catalogue appends products on scroll, preserves rows, and searches the whole collection',async()=>{
 const dom=new JSDOM('<div id="app"></div><div id="toast"></div>',{url:'https://tpskym.github.io/wb-cost-pwa/'});
 Object.assign(globalThis,{document:dom.window.document,window:dom.window,localStorage:dom.window.localStorage,location:dom.window.location,history:dom.window.history,indexedDB,confirm:()=>true});dom.window.scrollTo=()=>{};
 const products=Array.from({length:205},(_,i)=>({...blankProduct(),name:'Товар '+i,sku:'SKU-'+i,productGroup:'Каталог '+Math.floor(i/5)}));
 localStorage.setItem('workshop-db-v1',JSON.stringify({schema:1,id:crypto.randomUUID(),revision:0,updatedAt:new Date().toISOString(),products,templates:[]}));
 await import('../app.js');
 const $=s=>document.querySelector(s);
 assert.equal(document.querySelectorAll('[data-product]').length,20);
 assert.equal($('[data-product-page]'),null);const list=$('#product-list'),first=$('[data-product]');Object.defineProperty(list,'clientHeight',{configurable:true,value:400});Object.defineProperty(list,'scrollHeight',{configurable:true,value:1000});list.scrollTop=650;list.dispatchEvent(new dom.window.Event('scroll'));assert.equal(document.querySelectorAll('[data-product]').length,40);assert.equal($('[data-product]'),first);assert.equal(list.scrollTop,650);assert.equal(list.querySelectorAll('[data-product]')[20].dataset.product,products[20].id);
 const search=$('#product-search');search.value='SKU-204';search.dispatchEvent(new dom.window.Event('input'));
 assert.equal(document.querySelectorAll('[data-product]').length,1);assert.equal($('[data-product]').dataset.product,products[204].id);
 $('[data-product]').click();await settle();assert.equal($('#sku').value,'SKU-204');assert.equal($('#product-search').value,'SKU-204');
 const {disposeListingEditor}=await import('../listing-editor.js?v=0.2.262');disposeListingEditor();
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
 const list=document.querySelector('#product-list');list.scrollTop=360;
 const item=list.querySelectorAll('[data-product]')[3],id=item.dataset.product;item.click();await settle();
 assert.equal(document.querySelector('#product-list').scrollTop,360);
 assert.equal(document.activeElement.dataset.product,id);
});
test('form variant number is copied while barcode is cleared and label prompt uses all identity fields',async()=>{
 const change=(id,value)=>{const input=document.querySelector('#'+id);input.value=value;input.dispatchEvent(new window.Event('change'));};
 change('variantNumber','3');change('barcode','2057336623159');
 document.querySelector('#duplicate').click();await settle();
 assert.equal(document.querySelector('#variantNumber').value,'3');assert.equal(document.querySelector('#barcode').value,'');
 change('barcode','1234567890123');change('variantNote','Белый');
 const name=document.querySelector('#name').value,sku=document.querySelector('#sku').value;
 document.querySelector('#label-ai-prompt').click();await settle();
 assert.equal(document.querySelector('#label-prompt-text').value,`${name}\nВариант 3. Цвет: Белый\n${sku}\n1234567890123`);
 document.querySelector('[data-prompt-close]').click();await settle();
});
test('sidebar switches preserve page position and invoke selection only once',async()=>{
 const previousScroll=window.scrollTo;Object.defineProperty(window,'scrollY',{configurable:true,value:540});const calls=[];window.scrollTo=options=>calls.push(options);const list=document.querySelector('#product-list');list.scrollTop=200;list.querySelectorAll('[data-product]')[2].click();await settle();assert.equal(calls.length,1);assert.equal(calls[0].top,540);assert.equal(document.querySelector('#product-list').scrollTop,200);window.scrollTo=previousScroll;
});
test('activating another product keeps the scrolled catalogue and loaded thumbnails in the DOM',async()=>{const catalogue=document.querySelector('.product-catalogue'),list=document.querySelector('#product-list'),buttons=[...list.querySelectorAll('[data-product]')],target=buttons.find(b=>!b.classList.contains('chosen')),image=buttons[0].querySelector('[data-product-image]');list.scrollTop=730;target.click();await settle();assert.equal(document.querySelector('.product-catalogue'),catalogue);assert.equal(document.querySelector('#product-list'),list);assert.equal(list.scrollTop,730);assert.equal(buttons[0].querySelector('[data-product-image]'),image);assert.equal(target.classList.contains('chosen'),true);assert.equal(target.getAttribute('aria-current'),'true');assert.equal(document.querySelectorAll('[data-product][aria-current="true"]').length,1);assert.equal(document.querySelector('#sku').value,target.querySelector('.product-sku').textContent);});
test('cost production editor mounts three spool selectors and saves a manual third colour',async()=>{const selects=document.querySelectorAll('#product-filament-colors select');assert.equal(selects.length,3);selects[2].value='__manual__';selects[2].dispatchEvent(new window.Event('change'));const input=document.querySelector('[data-material-color-manual="2"]');assert.equal(input.hidden,false);input.value='THIRD-COLOR';input.dispatchEvent(new window.Event('input'));const sku=document.querySelector('#sku').value,db=(await readDatabase()),p=db.products.find(p=>p.sku===sku);assert.equal(p.filamentSlots[2].code,'THIRD-COLOR');assert.match(p.colorCode,/THIRD-COLOR/);});

test('clearing calculation history affects only selected product, confirms and keeps a backup',async()=>{const $=s=>document.querySelector(s);$('#snapshot').click();await settle();$('#snapshot').click();await settle();const before=(await readDatabase()),sku=$('#sku').value,p=before.products.find(p=>p.sku===sku);assert.equal(p.history.length,2);$('#clear-history').click();document.querySelector('.app-confirm .confirm-actions button').click();await settle();assert.equal((await readDatabase()).products.find(p=>p.id===p.id&&p.sku===sku).history.length,2);$('#clear-history').click();document.querySelector('.app-confirm .confirm-accept').click();await settle();for(let i=0;i<100&&(await readDatabase()).products.find(q=>q.id===p.id).history.length;i++)await new Promise(resolve=>setTimeout(resolve,5));const after=(await readDatabase());assert.deepEqual(after.products.find(q=>q.id===p.id),{...p,history:[]});assert.deepEqual(after.products.filter(q=>q.id!==p.id),before.products.filter(q=>q.id!==p.id));assert.equal((await readBackup()).products.find(q=>q.id===p.id).history.length,2);assert.equal($('#clear-history').disabled,true);});
test('label panel opens a ready to copy design prompt with label dimensions',async()=>{document.querySelector('#label-design-prompt').click();await settle();assert.match(document.querySelector('#label-prompt-title').textContent,/58 × 40/);assert.match(document.querySelector('#label-prompt-text').value,/Создай готовую к печати этикетку/);assert.match(document.querySelector('#label-prompt-text').value,/Артикул: /);document.querySelector('[data-prompt-close]').click();await settle();assert.equal(document.querySelector('.label-prompt-dialog'),null);});

test('group label prompt button opens group task beside individual label prompt',async()=>{document.querySelector('#label-group-prompt').click();await settle();assert.ok(document.querySelector('.group-label-picker'));assert.ok(document.querySelectorAll('[data-member]:checked').length);document.querySelector('[data-generate]').click();await settle();assert.equal(document.querySelector('.group-label-picker'),null);assert.match(document.querySelector('#label-prompt-title').textContent,/всей группы/);assert.match(document.querySelector('#label-prompt-text').value,/Сформируй этикетки для всей группы/);document.querySelector('[data-prompt-close]').click();await settle();});

test('creating more than ten variants keeps the complete group together and the new item visible',async()=>{const before=(await readDatabase()),currentId=document.querySelector('#mobile-product').value,group=before.products.find(p=>p.id===currentId).productGroup;for(let i=0;i<12;i++)document.querySelector('#duplicate').click();await settle();const db=(await readDatabase()),members=db.products.filter(p=>p.productGroup===group),groups=[...document.querySelectorAll('#product-list [data-group]')].filter(item=>item.dataset.group===group);assert.equal(groups.length,1);assert.equal(groups[0].querySelectorAll('[data-product]').length,members.length);assert.ok(groups[0].querySelector('.chosen'));assert.equal(document.querySelectorAll('#product-list .chosen').length,1);});

test('catalogue filters by group and colour and can collapse and expand all visible groups',async()=>{const $=s=>document.querySelector(s),db=(await readDatabase()),group=db.products.find(p=>p.productGroup)?.productGroup;$('#catalogue-group-filter').value=group;$('#catalogue-group-filter').dispatchEvent(new window.Event('change'));assert.ok([...document.querySelectorAll('#product-list [data-group]')].every(item=>item.dataset.group===group));$('[data-catalogue-collapse]').click();await settle();assert.equal(document.querySelectorAll('#product-list details[open]').length,0);$('[data-catalogue-expand]').click();await settle();assert.ok(document.querySelectorAll('#product-list details[open]').length>0);const option=[...$('#catalogue-colour-filter').options].find(o=>o.value);if(option){$('#catalogue-colour-filter').value=option.value;$('#catalogue-colour-filter').dispatchEvent(new window.Event('change'));for(const item of document.querySelectorAll('#product-list [data-product]')){const p=db.products.find(p=>p.id===item.dataset.product);assert.equal(p.variantNote||p.colorCode,option.value);}}$('[data-catalogue-reset]').click();await settle();assert.equal($('#catalogue-group-filter').value,'');assert.equal($('#catalogue-colour-filter').value,'');});
test('colour options follow the selected group and reset an unavailable selection',async()=>{
 const $=s=>document.querySelector(s),db=(await readDatabase());
 const groups=[...new Set(db.products.map(p=>p.productGroup||'__ungrouped__'))];
 const choose=group=>{$('#catalogue-group-filter').value=group;$('#catalogue-group-filter').dispatchEvent(new window.Event('change'));};
 for(const group of groups){choose(group);const expected=[...new Set(db.products.filter(p=>(p.productGroup||'__ungrouped__')===group).map(p=>p.variantNote||p.colorCode||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));assert.deepEqual([...$('#catalogue-colour-filter').options].map(o=>o.value),['',...expected]);}
 const coloured=db.products.find(p=>p.variantNote||p.colorCode);assert.ok(coloured);choose(coloured.productGroup||'__ungrouped__');$('#catalogue-colour-filter').value=coloured.variantNote||coloured.colorCode;$('#catalogue-colour-filter').dispatchEvent(new window.Event('change'));
 const other=groups.find(group=>!db.products.some(p=>(p.productGroup||'__ungrouped__')===group&&(p.variantNote||p.colorCode)===(coloured.variantNote||coloured.colorCode)));assert.ok(other);choose(other);assert.equal($('#catalogue-colour-filter').value,'');assert.ok(document.querySelectorAll('#product-list [data-product]').length>0);
 $('[data-catalogue-reset]').click();await settle();assert.ok([...$('#catalogue-colour-filter').options].some(o=>o.value===(coloured.variantNote||coloured.colorCode)));
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
 const $=s=>document.querySelector(s);$('[data-space="cost"]').click();await settle();$('[data-tab="important"]').click();await settle();assert.equal($('[data-tab="important"]').getAttribute('aria-selected'),'true');assert.deepEqual([...document.querySelectorAll('#fields [data-field]')].map(e=>e.dataset.field),['grams','kgPrice','minutes','yield']);assert.ok($('#printer'));assert.ok($('#material'));assert.equal(document.querySelectorAll('#product-filament-colors select').length,3);assert.equal($('#fields [data-field="printerLife"]'),null);assert.doesNotMatch($('#fields').textContent,/Энергия: 200 Вт/);
 const input=$('#fields [data-field="grams"]');input.value='32';input.dispatchEvent(new window.Event('input',{bubbles:true}));$('#printer').value='Bambu Lab P2S Combo';$('#printer').dispatchEvent(new window.Event('input',{bubbles:true}));await settle();const productId=$('#mobile-product').value;assert.equal((await readDatabase()).products.find(p=>p.id===productId).values.grams,32);
 $('[data-tab="production"]').click();await settle();assert.equal($('#fields [data-field="grams"]').value,'32');assert.equal($('#printer').value,'Bambu Lab P2S Combo');const price=$('#fields [data-field="kgPrice"]');price.value='1300';price.dispatchEvent(new window.Event('input',{bubbles:true}));await settle();$('[data-tab="important"]').click();await settle();assert.equal($('#fields [data-field="kgPrice"]').value,'1300');assert.equal(document.querySelectorAll('#fields [data-field="grams"]').length,1);$('[data-tab="production"]').click();await settle();
});

test('cost summary contains cost breakdown without unused marketplace profit inputs',async()=>{document.querySelector('[data-space="cost"]').click();await settle();const root=document.querySelector('#results');assert.ok(root.querySelector('.big-number'));assert.ok(root.querySelector('.cost-list'));assert.ok(root.querySelector('details'));assert.equal(root.querySelector('[data-market-field]'),null);assert.equal(root.querySelector('[data-open-loaded-listing]'),null);assert.equal(root.querySelector('[data-market-profit]'),null);assert.doesNotMatch(root.textContent,/К переводу за товар|Налог на продажу|Маржа от цены/);});
