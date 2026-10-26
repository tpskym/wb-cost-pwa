import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createSale,saleAmounts,mountSales} from '../sales.js';
import {blankProduct,validateDB} from '../calc.js';
const makeSale=(extra={})=>({id:'sale',date:'2026-10-23',market:'wb',productId:'p',productName:'Подставка',sku:'SKU',quantity:2,unitPrice:395,payout:null,costPerUnit:77.14,...extra});
test('sales distinguish unknown payout from zero and calculate totals for the whole sale',()=>{
 assert.deepEqual(saleAmounts(makeSale()),{revenue:790,cost:154.28,difference:null,result:null});assert.deepEqual(saleAmounts(makeSale({payout:500})),{revenue:790,cost:154.28,difference:290,result:345.72});assert.equal(saleAmounts(makeSale({payout:0})).result,-154.28);assert.equal(saleAmounts(makeSale({payout:500,costPerUnit:null})).result,null);
});
test('sales migrate with old databases and retain product snapshots after product removal',()=>{
 const p=blankProduct(),db={schema:1,id:'db',products:[p],templates:[]};validateDB(db);assert.deepEqual(db.sales,[]);db.sales.push(makeSale({productId:'deleted'}));assert.equal(validateDB(db).sales[0].productName,'Подставка');assert.throws(()=>validateDB({...db,sales:[makeSale({payout:-1})]}),/продажи/);
});
test('sale records snapshot the product and reject malformed amounts',()=>{
 const p=blankProduct();p.name='Исходный товар';const sale=createSale(p,{date:'2026-10-23',market:'ozon',quantity:1,unitPrice:395});p.name='Новое имя';assert.equal(sale.productName,'Исходный товар');assert.equal(sale.payout,null);assert.equal(sale.costPerUnit,null);assert.throws(()=>createSale(p,{date:'2026-10-23',market:'wb',quantity:0,unitPrice:395}),/Количество/);assert.throws(()=>createSale(p,{date:'2026-10-23',market:'wb',quantity:1,unitPrice:NaN}),/сумму/);
});
test('sales workspace has no manual entry or payout editing and preserves historical sales read-only',()=>{
 const dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root'),p=blankProduct(),database={products:[p],sales:[makeSale()]},before=structuredClone(database.sales);let saves=0;mountSales({root,database,selectedProductId:p.id,save:()=>saves++,toast:()=>{}});assert.equal(root.querySelector('#sale-form'),null);assert.equal(root.querySelector('[data-sale-payout]'),null);assert.equal(root.querySelector('[data-sale-delete]'),null);assert.equal(root.querySelectorAll('tbody input').length,0);assert.match(root.querySelector('.sales-journal').textContent,/только чтение/);assert.deepEqual(database.sales,before);assert.equal(saves,0);assert.ok(root.querySelector('#orders-refresh'));
});
