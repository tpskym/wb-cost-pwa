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
test('stocks only print the saved exact-article label and offer no upload controls',()=>{
 const dom=setup(),database={products:[{sku:'white',productGroup:'Watch',labelPdf:label},{sku:'black',productGroup:'Watch'}]},before=structuredClone(database);
 let dialog=openStockLabelDialog({database,sku:'black',quantity:4,document:dom.window.document});
 assert.equal(dialog.querySelector('input[type="file"]'),null);assert.equal(dialog.querySelector('[data-label-print]').disabled,true);assert.match(dialog.querySelector('.label-file-name').textContent,/себестоимости/);
 dialog=openStockLabelDialog({database,sku:'white',quantity:4,document:dom.window.document});assert.match(dialog.querySelector('.label-quantity').textContent,/4 копий/);assert.equal(dialog.querySelector('.label-file-name').textContent,'white.pdf');assert.equal(dialog.querySelector('[data-label-print]').disabled,false);assert.deepEqual(database,before);
 dialog.querySelector('[data-label-close]').click();assert.equal(dom.window.document.querySelector('dialog'),null);
});
test('printing opens the stored PDF and invokes print after loading; popup blocking is reported',()=>{
 const create=URL.createObjectURL,revoke=URL.revokeObjectURL;let callback,printed=0,revoked=0,blob;
 URL.createObjectURL=b=>{blob=b;return 'blob:label';};URL.revokeObjectURL=()=>revoked++;
 try{printProductLabel(label,{open:url=>{assert.equal(url,'blob:label');return {addEventListener:(event,fn)=>{assert.equal(event,'load');callback=fn;},focus:()=>{},print:()=>printed++};}});assert.equal(blob.type,'application/pdf');callback();assert.equal(printed,1);assert.throws(()=>printProductLabel(label,{open:()=>null}),/Разрешите/);assert.equal(revoked,1);}finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
});

 test('label design prompt uses 58 by 40 mm and Russian spool names in slot order',async()=>{const {labelDesignPrompt}=await import('../product-labels.js');const text=labelDesignPrompt({name:'Органайзер',variantNumber:'7',sku:'org_white_black',variantNote:'wrong',filamentSlots:[{filamentId:'w',colorName:'Старое'},{filamentId:'b',colorName:'Чёрный'}]},[{id:'w',colorName:'Белый',originalColorName:'Jade white'}]);assert.match(text,/58 × 40 мм/);assert.match(text,/Название: Органайзер/);assert.match(text,/Вариант: 7/);assert.match(text,/Цвет: белый-чёрный/);assert.match(text,/Артикул: org_white_black/);assert.doesNotMatch(text,/Jade white|wrong|Старое/);});

test('label colours are hyphenated in order, retain repetitions and support a single spool',async()=>{const {labelDesignPrompt}=await import('../product-labels.js');assert.match(labelDesignPrompt({filamentSlots:[{colorName:'Чёрный'},{colorName:'Белый'},{colorName:'Чёрный'}]}),/Цвет: чёрный-белый-чёрный\n/);assert.match(labelDesignPrompt({filamentSlots:[{colorName:'Белый'},{},{}]}),/Цвет: белый\n/);});

test('group label prompt includes only matching group variants with their own colours and asks for individual PDFs',async()=>{const {groupLabelDesignPrompt}=await import('../product-labels.js');const a={productGroup:'G',name:'A',sku:'a',filamentSlots:[{colorName:'Белый'}]},b={productGroup:'G',name:'B',sku:'b',filamentSlots:[{colorName:'Чёрный'},{colorName:'Белый'},{colorName:'Чёрный'}]},other={productGroup:'X',sku:'excluded'};const text=groupLabelDesignPrompt(a,[a,b,other]);assert.match(text,/всей группы товаров: 2 шт/);assert.match(text,/Артикул: a/);assert.match(text,/Артикул: b/);assert.match(text,/Цвет: чёрный-белый-чёрный/);assert.match(text,/одностраничный PDF размером 58 × 40 мм/);assert.match(text,/ZIP/);assert.doesNotMatch(text,/excluded/);assert.match(groupLabelDesignPrompt({...a,productGroup:''},[b,other]),/всей группы товаров: 1 шт/);});
test('label preview embeds the saved PDF without printing and releases it on close',async()=>{const {previewProductLabel}=await import('../product-labels.js');const {JSDOM}=await import('jsdom');const dom=new JSDOM('<body></body>');dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.dispatchEvent(new dom.window.Event('close'));};let closed=false;const dialog=previewProductLabel({name:'test.pdf',data:'data:application/pdf;base64,JVBERi0='},{document:dom.window.document,onClose:()=>{closed=true;}});assert.match(dialog.querySelector('iframe').src,/^blob:/);assert.equal(dialog.querySelector('p').textContent,'test.pdf');dialog.querySelector('button').click();assert.equal(closed,true);assert.equal(dom.window.document.querySelector('dialog'),null);});
