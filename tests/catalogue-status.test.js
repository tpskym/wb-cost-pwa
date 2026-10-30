import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rememberCatalogueCards,catalogueCardPresence,refreshCatalogueCards} from '../catalogue-status.js';
test('presence uses saved cards, ignores unsent drafts, and distinguishes unknown from absent',()=>{
 const p={id:'p',sku:'a',listingDrafts:{wb:{mode:'create',body:'[]'}}},db={products:[p]};assert.equal(catalogueCardPresence(db,p,'wb'),null);
 p.listingDrafts.wb={mode:'update',body:JSON.stringify([{vendorCode:'a'}])};assert.equal(catalogueCardPresence(db,p,'wb'),true);
 rememberCatalogueCards(db,'wb',[{vendorCode:'b'}],true);assert.equal(catalogueCardPresence(db,p,'wb'),false);
 rememberCatalogueCards(db,'wb',[{vendorCode:'a'}]);assert.equal(catalogueCardPresence(db,p,'wb'),true);assert.ok(db.catalogueCards.wb.skus.includes('b'));
});
test('explicit refresh reads all pages, saves successful market and preserves failed snapshot',async()=>{
 const db={products:[],catalogueCards:{ozon:{skus:['old'],complete:true}}},calls=[];let saves=0;
 const results=await refreshCatalogueCards(db,{wbToken:'x',ozonKey:'x',ozonClient:'x'},{onSaved:()=>saves++,request:async(market,op,credentials,body)=>{calls.push([market,op]);if(market==='ozon')throw Error('offline');return {cards:[{vendorCode:'a'}],cursor:{total:1}};}});
 assert.deepEqual(calls,[['wb','list'],['ozon','list']]);assert.equal(saves,1);assert.deepEqual(db.catalogueCards.wb.skus,['a']);assert.deepEqual(db.catalogueCards.ozon.skus,['old']);assert.equal(results[1].error,'offline');
});
test('Ozon pagination cannot silently replace snapshot with repeated pages',async()=>{
 const db={products:[],catalogueCards:{ozon:{skus:['old'],complete:true}}};const results=await refreshCatalogueCards(db,{ozonKey:'x',ozonClient:'x'},{request:async()=>({result:{items:Array.from({length:100},(_,i)=>({offer_id:String(i)})),last_id:'same'}})});
 assert.ok(results.find(r=>r.market==='ozon').error);assert.deepEqual(db.catalogueCards.ozon.skus,['old']);
});
test('refresh skips unconfigured marketplaces without any API request',async()=>{
 let calls=0;const result=await refreshCatalogueCards({products:[]},{},{request:async()=>{calls++;}});assert.equal(calls,0);assert.equal(result.length,2);assert.ok(result.every(r=>r.error));
});
test('Ozon full refresh collects all pages before replacing the saved snapshot',async()=>{
 const db={products:[]};let calls=0;await refreshCatalogueCards(db,{ozonKey:'x',ozonClient:'x'},{request:async(market,operation,credentials,body)=>{calls++;if(calls===1)return {result:{items:Array.from({length:100},(_,i)=>({offer_id:String(i)})),last_id:'next'}};assert.equal(body.last_id,'next');return {result:{items:[{offer_id:'last'}]}};}});assert.equal(db.catalogueCards.ozon.skus.length,101);assert.equal(db.catalogueCards.ozon.complete,true);
});
test('presence filters combine saved marketplace, label and model states and keep unknown separate',async()=>{const {catalogueStatusMatches}=await import('../catalogue-status.js');const p={id:'a',sku:'a',labelPdf:{data:'data:application/pdf;base64,JVBERi0='}},db={products:[p]};rememberCatalogueCards(db,'wb',[{vendorCode:'a'}],true);rememberCatalogueCards(db,'ozon',[],true);assert.equal(catalogueStatusMatches(db,p,{wb:'yes',ozon:'no',label:'yes',model:'yes'},true),true);assert.equal(catalogueStatusMatches(db,p,{wb:'no'},true),false);assert.equal(catalogueStatusMatches(db,p,{label:'no'},true),false);assert.equal(catalogueStatusMatches(db,p,{model:'no'},true),false);assert.equal(catalogueStatusMatches(db,p,{model:'no'},null),false);const unknown={products:[p]};assert.equal(catalogueStatusMatches(unknown,p,{wb:'unknown'}),true);assert.equal(catalogueStatusMatches(unknown,p,{wb:'no'}),false);});
