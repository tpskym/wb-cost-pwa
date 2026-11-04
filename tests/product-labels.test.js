import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readLabelPdf,printProductLabel,openStockLabelDialog} from '../product-labels.js';
import {renderStockSummary,stockSummary} from '../warehouse-stocks.js';
const label={name:'white.pdf',data:'data:application/pdf;base64,JVBERi0='};
function setup(){const dom=new JSDOM('<body></body>');dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};return dom;}
test('label uploads validate PDF contents and limit size before saving',async()=>{
 const file=new File(['%PDF-test'],'label.pdf',{type:'application/octet-stream'});
 assert.deepEqual(await readLabelPdf(file),{name:'label.pdf',data:'data:application/pdf;base64,'+btoa('%PDF-test')});
 await assert.rejects(()=>readLabelPdf(new File(['wrong'],'label.pdf')),/PDF-файл/);
 await assert.rejects(()=>readLabelPdf({size:2*1024*1024+1}),/2 МБ/);
});
test('stock summary exposes the correct article label and suggested print count',()=>{
 const products=[{sku:'white',labelPdf:label,stockTargets:{wb:{minimum:1,normal:5}}},{sku:'black'}],rows=[{sku:'white',available:1},{sku:'black',available:0}],summary=stockSummary(products,[{source:'wb-fbs',rows}]);
 const doc=new JSDOM(renderStockSummary(summary)).window.document;
 assert.equal(doc.querySelector('[data-label-sku="white"]').textContent,'Печать этикетки');
 assert.equal(doc.querySelector('[data-label-sku="white"]').dataset.labelQuantity,'4');
 assert.equal(doc.querySelector('[data-label-sku="black"]').textContent,'Нет этикетки');
});
test('stock label opens the exact article PDF directly without a quantity form or automatic printing',()=>{
 const dom=setup(),database={products:[{sku:'white',productGroup:'Watch',labelPdf:label},{sku:'black',productGroup:'Watch'}]},before=structuredClone(database);let message='';
 assert.equal(openStockLabelDialog({database,sku:'black',document:dom.window.document,notify:text=>{message=text;}}),null);assert.match(message,/PDF/);
 let opened='';assert.equal(openStockLabelDialog({database,sku:'white',quantity:4,document:dom.window.document,open:url=>{opened=url;return {};}}),null);assert.match(opened,/^blob:/);assert.equal(dom.window.document.querySelector('dialog'),null);assert.deepEqual(database,before);
});
test('opening the stored PDF does not invoke print on its initial load; popup blocking is reported',()=>{
 const create=URL.createObjectURL,revoke=URL.revokeObjectURL;let registered=0,printed=0,revoked=0,blob;
 URL.createObjectURL=b=>{blob=b;return 'blob:label';};URL.revokeObjectURL=()=>revoked++;
 try{printProductLabel(label,{open:url=>{assert.equal(url,'blob:label');return {addEventListener:()=>{registered++;},focus:()=>{},print:()=>printed++};}});assert.equal(blob.type,'application/pdf');assert.equal(registered,0);assert.equal(printed,0);assert.throws(()=>printProductLabel(label,{open:()=>null}),/Разрешите/);assert.equal(revoked,1);}finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
});


 test('label design prompt uses 58 by 40 mm and Russian spool names in slot order',async()=>{const {labelDesignPrompt}=await import('../product-labels.js');const text=labelDesignPrompt({name:'Органайзер',variantNumber:'7',sku:'org_white_black',variantNote:'wrong',filamentSlots:[{filamentId:'w',colorName:'Старое'},{filamentId:'b',colorName:'Чёрный'}]},[{id:'w',colorName:'Белый',originalColorName:'Jade white'}]);assert.match(text,/58 × 40 мм/);assert.match(text,/Название: Органайзер/);assert.match(text,/Вариант: 7/);assert.match(text,/Цвет: белый-чёрный/);assert.match(text,/Артикул: org_white_black/);assert.doesNotMatch(text,/Jade white|wrong|Старое/);});

test('label colours are hyphenated in order, retain repetitions and support a single spool',async()=>{const {labelDesignPrompt}=await import('../product-labels.js');assert.match(labelDesignPrompt({filamentSlots:[{colorName:'Чёрный'},{colorName:'Белый'},{colorName:'Чёрный'}]}),/Цвет: чёрный-белый-чёрный\n/);assert.match(labelDesignPrompt({filamentSlots:[{colorName:'Белый'},{},{}]}),/Цвет: белый\n/);});

test('group label prompt includes only matching group variants with their own colours and asks for individual PDFs',async()=>{const {groupLabelDesignPrompt}=await import('../product-labels.js');const a={productGroup:'G',name:'A',sku:'a',filamentSlots:[{colorName:'Белый'}]},b={productGroup:'G',name:'B',sku:'b',filamentSlots:[{colorName:'Чёрный'},{colorName:'Белый'},{colorName:'Чёрный'}]},other={productGroup:'X',sku:'excluded'};const text=groupLabelDesignPrompt(a,[a,b,other]);assert.match(text,/всей группы товаров: 2 шт/);assert.match(text,/Артикул: a/);assert.match(text,/Артикул: b/);assert.match(text,/Цвет: чёрный-белый-чёрный/);assert.match(text,/одностраничный PDF размером 58 × 40 мм/);assert.match(text,/ZIP/);assert.doesNotMatch(text,/excluded/);assert.match(groupLabelDesignPrompt({...a,productGroup:''},[b,other]),/всей группы товаров: 1 шт/);});
test('label preview embeds the saved PDF without printing and releases it on close',async()=>{const {previewProductLabel}=await import('../product-labels.js');const {JSDOM}=await import('jsdom');const dom=new JSDOM('<body></body>');dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.dispatchEvent(new dom.window.Event('close'));};let closed=false;const dialog=previewProductLabel({name:'test.pdf',data:'data:application/pdf;base64,JVBERi0='},{document:dom.window.document,onClose:()=>{closed=true;}});assert.match(dialog.querySelector('iframe').src,/^blob:/);assert.equal(dialog.querySelector('p').textContent,'test.pdf');dialog.querySelector('button').click();assert.equal(closed,true);assert.equal(dom.window.document.querySelector('dialog'),null);});

test('Safari Print label saves through the component workflow instead of opening a browser tab',async()=>{const dom=setup();Object.defineProperty(dom.window.navigator,'userAgent',{value:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15'});let saved,opened=false;await printProductLabel(label,{view:dom.window,open:()=>{opened=true;},service:{save:async(blob,name,kind,options)=>{saved={blob,name,kind,options};}}});assert.equal(opened,false);assert.equal(saved.kind,'label');assert.equal(saved.options.onlyIfConfigured,undefined);assert.equal(await saved.blob.text(),'%PDF-');dom.window.close();});

test('label prompt uses the requested three block hierarchy and preserves selected product data',async()=>{const {labelDesignPrompt,groupLabelDesignPrompt}=await import('../product-labels.js');const product={id:'snow',name:'Набор снежинок сборных',variantNumber:'1',sku:'christmas_snowflakes_two',productGroup:'snow',filamentSlots:[{colorName:'Белый'}]};const prompt=labelDesignPrompt(product);for(const text of ['по 1–2 слова','В центре — Блок характеристик','Самый мелкий шрифт','ReportLab','3 мм','НЕ курсив / NOT italic','leading','прижат к нижней границе','Не пиши код','Название: Набор снежинок сборных','Цвет: белый','Артикул: christmas_snowflakes_two'])assert.ok(prompt.includes(text));const group=groupLabelDesignPrompt(product,[product]);assert.match(group,/Самый мелкий шрифт/);assert.match(group,/по 1–2 слова/);assert.equal((prompt.match(/Название: Набор снежинок сборных/g)||[]).length,1);});
