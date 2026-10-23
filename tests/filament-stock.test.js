import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {addFilamentSpools,mountFilamentStock} from '../filament-stock.js';
import {blankProduct,validateDB} from '../calc.js';
test('filament stock preserves leading zeroes and adds repeated colour codes',()=>{
 const stock=[];addFilamentSpools(stock,' 00100 White ',2);addFilamentSpools(stock,'00100 white',3);assert.equal(stock.length,1);assert.equal(stock[0].colorCode,'00100 White');assert.equal(stock[0].quantity,5);assert.throws(()=>addFilamentSpools(stock,'BLACK',1.5),/целое/);assert.throws(()=>addFilamentSpools(stock,'',2),/код цвета/);
});
test('older databases migrate stock and backups validate zero quantities',()=>{
 const db={schema:1,id:'db',products:[blankProduct()]};validateDB(db);assert.deepEqual(db.filamentStock,[]);db.filamentStock=[{id:'stock',colorCode:'10100',quantity:0}];assert.equal(validateDB(structuredClone(db)).filamentStock[0].quantity,0);assert.throws(()=>validateDB({...db,filamentStock:[{id:'stock',colorCode:'black',quantity:-1}]}),/филамента/);
});
test('filament UI saves arrivals and corrected counts and searches colour codes',()=>{
 const dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root'),database={};let saves=0;mountFilamentStock({root,database,save:()=>saves++,toast:()=>{}});const $=selector=>root.querySelector(selector),change=input=>input.dispatchEvent(new dom.window.Event('change'));
 $('#filament-color-code').value='10100 white';$('#filament-add-quantity').value='4';$('#filament-add-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));assert.equal(database.filamentStock[0].quantity,4);$('[data-filament-quantity]').value='0';change($('[data-filament-quantity]'));assert.equal(database.filamentStock[0].quantity,0);$('[data-filament-quantity]').value='-1';change($('[data-filament-quantity]'));assert.equal(database.filamentStock[0].quantity,0);$('#filament-stock-search').value='black';$('#filament-stock-search').dispatchEvent(new dom.window.Event('input'));assert.equal(root.querySelector('[data-filament-quantity]'),null);assert.equal(saves,2);
});
