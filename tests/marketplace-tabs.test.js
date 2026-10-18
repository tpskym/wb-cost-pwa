import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {blankListing} from '../marketplace-api.js';
import {readCatalog} from '../category-catalog.js';
import {disposeListingEditor} from '../listing-editor.js?v=0.2.25';
globalThis.indexedDB=indexedDB;
test('API settings owns keys and bulk catalogs, card editor keeps characteristics and unsaved input during tab switches',async()=>{
 const dom=new JSDOM('<div id="api"></div>',{url:'https://tpskym.github.io/wb-cost-pwa/'}),container=dom.window.document.querySelector('#api');globalThis.localStorage=dom.window.localStorage;globalThis.confirm=()=>true;
 const p={id:'tab-test',sku:'AW',name:'Watch',marketplaces:{ozon:{price:370}}};p.listingDrafts={wb:{mode:'create',body:JSON.stringify(blankListing('wb',p))}};
 const calls=[];const oldFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{calls.push({url,options});if(url.includes('wildberries'))return new Response(JSON.stringify({data:[{subjectID:10,parentName:'Аксессуары',subjectName:'Подставки'}]}));return new Response(JSON.stringify({result:[{description_category_id:20,category_name:'Дом',children:[{type_id:21,type_name:'Подставки Ozon'}]}]}));};
 try{const {mountMarketplaceUI}=await import('../marketplace-ui.js');mountMarketplaceUI({container,product:p,owner:'test:tab-test',save:()=>{},toast:()=>{}});const $=s=>container.querySelector(s);
 assert.equal($('#api-settings-panel').hidden,true);assert.ok($('#api-settings-panel').contains($('#wb-api-token')));assert.ok($('#api-settings-panel').contains($('[data-download-catalog="wb"]')));assert.ok($('#api-cards-panel').contains($('#card-load-attributes')));assert.equal($('#card-categories-load'),null);
 $('#card-title').value='Сохранённая правка';$('#card-title').dispatchEvent(new dom.window.Event('input'));$('#card-open-api-settings').click();assert.equal($('#api-settings-panel').hidden,false);assert.equal($('#api-cards-panel').hidden,true);assert.equal($('#api-tab-settings').getAttribute('aria-selected'),'true');
 $('#wb-api-token').value='wb-tab-secret';$('#ozon-client').value='123';$('#ozon-api-key').value='ozon-tab-secret';$('#api-save-keys').click();await $('[data-download-catalog="wb"]').onclick();await $('[data-download-catalog="ozon"]').onclick();assert.equal((await readCatalog('wb')).rows.length,1);assert.equal((await readCatalog('ozon')).rows[0].typeId,21);assert.equal(calls[0].options.headers.Authorization,'wb-tab-secret');assert.equal(calls[1].options.headers['Api-Key'],'ozon-tab-secret');
 $('#api-tab-cards').click();assert.equal($('#api-cards-panel').hidden,false);assert.equal($('#card-title').value,'Сохранённая правка');assert.ok(JSON.parse(p.listingDrafts.wb.body)[0].variants[0].title==='Сохранённая правка');assert.equal(calls.length,2);
 }finally{globalThis.fetch=oldFetch;disposeListingEditor();}
});
