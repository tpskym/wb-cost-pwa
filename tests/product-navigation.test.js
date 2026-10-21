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
 const {disposeListingEditor}=await import('../listing-editor.js?v=0.2.70');disposeListingEditor();
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
