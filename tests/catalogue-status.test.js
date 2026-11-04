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

test('refresh pulls Ozon categories and measurements in batches and saves matched local products',async()=>{
 const p={sku:' a ',measurements:{product:{width:42},productWeight:15}},db={products:[p]},calls=[];let saves=0;
 const results=await refreshCatalogueCards(db,{ozonKey:'x',ozonClient:'x'},{onSaved:()=>saves++,request:async(market,op,credentials,body)=>{calls.push(op);if(op==='list')return {result:{items:[{offer_id:'a'},{offer_id:'unrelated'}]}};if(op==='details'){assert.deepEqual(body.filter.offer_id,['a']);return {result:[{offer_id:'a',description_category_id:10,type_id:11,width:2,height:3,depth:4,dimension_unit:'cm',weight:.2,weight_unit:'kg'}]};}return {result:[{description_category_id:10,category_name:'Дом',children:[{type_id:11,type_name:'Подставки',children:[]}]}]};}});
 assert.deepEqual(calls,['list','details','categories','attributes']);assert.equal(saves,1);assert.deepEqual(p.marketplaceCategories.ozon,{id:10,typeId:11,label:'Дом / Подставки'});assert.deepEqual(p.measurements,{product:{width:42},productWeight:15,packaged:{width:20,height:30,depth:40},packagingWeight:200});assert.equal(results[1].metadataCount,1);
});
test('WB card dimensions use mm and grams, missing data never clears local measurements',async()=>{
 const {applyCatalogueCardMetadata,cardMeasurementValues}=await import('../catalogue-status.js');const p={sku:'a',measurements:{packaged:{depth:91},product:{width:50},productWeight:30}},db={products:[p]};applyCatalogueCardMetadata(db,'wb',[{vendorCode:'a',subjectID:22,subjectName:'Подставки',dimensions:{width:3,height:4,length:0,weightBrutto:.125}}]);assert.deepEqual(p.measurements,{packaged:{width:30,height:40,depth:91},packagingWeight:125,product:{width:50},productWeight:30});assert.equal(p.marketplaceCategories.wb.label,'Подставки');assert.deepEqual(cardMeasurementValues('ozon',{width:5,weight:5}),{});assert.deepEqual(cardMeasurementValues('wb',{characteristics:[{name:'Ширина товара без упаковки, см',value:[2]},{name:'Вес товара без упаковки, г',value:[34]}]}),{product:{width:20},productWeight:34});
});
test('failed Ozon metadata refresh preserves local parameters and reports partial success',async()=>{
 const p={sku:'a',measurements:{packagingWeight:12}},db={products:[p]};let saves=0;const result=await refreshCatalogueCards(db,{ozonKey:'x',ozonClient:'x'},{onSaved:()=>saves++,request:async(market,op)=>{if(op==='list')return {result:{items:[{offer_id:'a'}]}};throw Error('denied');}});assert.deepEqual(p.measurements,{packagingWeight:12});assert.equal(saves,1);assert.match(result[1].warning,/denied/);assert.equal(catalogueCardPresence(db,p,'ozon'),true);
});

test('item measurements resolve schema names and units for real WB fields and Ozon dimension triples',async()=>{
 const {cardMeasurementValues}=await import('../catalogue-status.js');
 const wb=cardMeasurementValues('wb',{characteristics:[{id:1,value:[2]},{id:2,value:[9]},{id:3,value:[4]}],measurementSchema:[{id:1,name:'Высота предмета',unit:'см'},{id:2,name:'Глубина предмета',unit:'см'},{id:3,name:'Ширина предмета',unit:'см'}]});assert.deepEqual(wb,{product:{height:20,depth:90,width:40}});
 const ozon=cardMeasurementValues('ozon',{attributes:[{id:5,values:[{value:'70x80x65'}]},{id:6,values:[{value:'32'}]}],measurementSchema:[{id:5,name:'Размеры, мм',description:'Размеры сторон товара без упаковки в миллиметрах. ДхШхВ, где Д - длина, Ш - ширина, В - высота.'},{id:6,name:'Вес товара, г'}]});assert.deepEqual(ozon,{product:{depth:70,width:80,height:65},productWeight:32});
});
test('refresh prioritizes every available Ozon measurement and falls back to WB independently',async()=>{
 const p={sku:'a'},db={products:[p]};const results=await refreshCatalogueCards(db,{wbToken:'x',ozonKey:'x',ozonClient:'x'},{request:async(market,op)=>{
 if(market==='wb'){if(op==='list')return {cards:[{vendorCode:'a',subjectID:10,dimensions:{width:5,height:6,length:7,weightBrutto:.3},characteristics:[{id:1,value:2},{id:2,value:9},{id:3,value:4}]}],cursor:{total:1}};return {data:[{charcID:1,name:'Высота предмета',unitName:'см'},{charcID:2,name:'Глубина предмета',unitName:'см'},{charcID:3,name:'Ширина предмета',unitName:'см'}]};}
 if(op==='list')return {result:{items:[{offer_id:'a'}]}};if(op==='details')return {result:[{offer_id:'a',description_category_id:20,type_id:21,width:80,dimension_unit:'mm',attributes:[{id:4,values:[{value:'70x80x65'}]},{id:5,values:[{value:'32'}]}]}]};if(op==='categories')return {result:[]};return {result:[{id:4,name:'Размеры, мм',description:'Размеры товара без упаковки в миллиметрах, ДхШхВ.'},{id:5,name:'Вес товара, г'}]};}});
 assert.ok(results.every(row=>!row.error));assert.deepEqual(p.measurements,{product:{width:80,height:65,depth:70},productWeight:32,packaged:{width:80,height:60,depth:70},packagingWeight:300});
});
