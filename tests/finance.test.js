import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountFinance} from '../finance.js';

test('finance groups orders by date and reserves 10% after return costs',()=>{
 const {window}=new JSDOM('<section></section>');
 const root=window.document.querySelector('section');
 const rows=[
  {source:'wb-fbs',orderId:'1',orderedAt:'2025-01-01T10:00:00Z',status:'sold',currency:'RUB',price:500,quantity:1},
  {source:'wb-fbs',orderId:'2',orderedAt:'2025-01-02T10:00:00Z',status:'cancelled',currency:'RUB',price:500,quantity:1}
 ];
 mountFinance(root,[{rows}],(_,returned)=>returned?{profit:-20}:{profit:120,cost:150,materials:40,printing:30,electricity:10,labor:40,packaging:20});
 const number=element=>parseFloat(element.textContent.replace(',','.'));
 assert.equal(number(root.querySelector('.finance-reserve strong')),10);
 assert.equal(number(root.querySelector('tbody td:nth-child(7)')),90);
 root.querySelector('[data-finance-period="days"]').click();
 assert.equal(root.querySelectorAll('tbody tr').length,2);
 root.querySelector('[data-finance-period="weeks"]').click();
 assert.equal(root.querySelectorAll('tbody tr').length,1);
 window.close();
});
