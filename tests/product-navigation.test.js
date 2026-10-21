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
 const {disposeListingEditor}=await import('../listing-editor.js?v=0.2.68');disposeListingEditor();
});
