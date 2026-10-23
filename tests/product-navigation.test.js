import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {blankProduct} from '../calc.js';
test('large sidebar catalogue pages twenty products and searches the whole collection',async()=>{
 const dom=new JSDOM('<div id="app"></div><div id="toast"></div>',{url:'https://tpskym.github.io/wb-cost-pwa/'});
 Object.assign(globalThis,{document:dom.window.document,window:dom.window,localStorage:dom.window.localStorage,location:dom.window.location,history:dom.window.history,indexedDB,confirm:()=>true});dom.window.scrollTo=()=>{};
 const products=Array.from({length:205},(_,i)=>({...blankProduct(),name:'Товар '+i,sku:'SKU-'+i,productGroup:'Каталог'}));
 localStorage.setItem('workshop-db-v1',JSON.stringify({schema:1,id:crypto.randomUUID(),revision:0,updatedAt:new Date().toISOString(),products,templates:[]}));
 await import('../app.js');
 const $=s=>document.querySelector(s);
 assert.equal(document.querySelectorAll('[data-product]').length,20);
 $('[data-product-page="1"]').click();assert.equal($('[data-product]').dataset.product,products[20].id);
 const search=$('#product-search');search.value='SKU-204';search.dispatchEvent(new dom.window.Event('input'));
 assert.equal(document.querySelectorAll('[data-product]').length,1);assert.equal($('[data-product]').dataset.product,products[204].id);
 $('[data-product]').click();assert.equal($('#sku').value,'SKU-204');assert.equal($('#product-search').value,'SKU-204');
 const {disposeListingEditor}=await import('../listing-editor.js?v=0.2.95');disposeListingEditor();
});
test('variants preserve the name and build article suffixes from selected colours',()=>{
 const $=s=>document.querySelector(s),name=$('#name').value;
 $('#duplicate').click();
 assert.equal($('#name').value,name);assert.equal($('#sku').value,'SKU-204_');
 const change=color=>{const input=$('#variantNote');input.value=color;input.dispatchEvent(new window.Event('change'));};
 change('Черный');assert.equal($('#sku').value,'SKU-204_black');
 change('Белый');assert.equal($('#sku').value,'SKU-204_white');
 change('Серый');assert.equal($('#sku').value,'SKU-204_gray');
 change('Красный');assert.equal($('#sku').value,'SKU-204_red');
 change('Зелёный');assert.equal($('#sku').value,'SKU-204_green');
 change('Узкое основание');assert.equal($('#variantNote').value,'Узкое основание');assert.equal($('#sku').value,'SKU-204_green');
});

test('colour pencil opens choices and selection updates the article',()=>{
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 document.querySelector('#variant-color-pick').click();
 assert.equal(document.querySelectorAll('[data-variant-color]').length,5);
 document.querySelector('[data-variant-color="Черный"]').click();
 assert.equal(document.querySelector('#variantNote').value,'Черный');
 assert.equal(document.querySelector('#sku').value,'SKU-204_black');
 assert.equal(document.querySelector('.variant-color-dialog'),null);
});
test('selecting a sidebar product preserves list scroll and keyboard focus',()=>{
 const search=document.querySelector('#product-search');search.value='';search.dispatchEvent(new window.Event('input'));
 const list=document.querySelector('#product-list');list.scrollTop=360;
 const item=list.querySelectorAll('[data-product]')[3],id=item.dataset.product;item.click();
 assert.equal(document.querySelector('#product-list').scrollTop,360);
 assert.equal(document.activeElement.dataset.product,id);
});
test('form variant number is copied while barcode is cleared and label prompt uses all identity fields',()=>{
 const change=(id,value)=>{const input=document.querySelector('#'+id);input.value=value;input.dispatchEvent(new window.Event('change'));};
 change('variantNumber','3');change('barcode','2057336623159');
 document.querySelector('#duplicate').click();
 assert.equal(document.querySelector('#variantNumber').value,'3');assert.equal(document.querySelector('#barcode').value,'');
 change('barcode','1234567890123');change('variantNote','Белый');
 const name=document.querySelector('#name').value,sku=document.querySelector('#sku').value;
 document.querySelector('#label-ai-prompt').click();
 assert.equal(document.querySelector('#label-prompt-text').value,`${name}\nВариант 3. Цвет: Белый\n${sku}\n1234567890123`);
 document.querySelector('[data-prompt-close]').click();
});
test('sidebar switches preserve page position and invoke selection only once',()=>{
 const previousScroll=window.scrollTo;Object.defineProperty(window,'scrollY',{configurable:true,value:540});const calls=[];window.scrollTo=options=>calls.push(options);const list=document.querySelector('#product-list');list.scrollTop=200;list.querySelectorAll('[data-product]')[2].click();assert.equal(calls.length,1);assert.equal(calls[0].top,540);assert.equal(document.querySelector('#product-list').scrollTop,200);window.scrollTo=previousScroll;
});
