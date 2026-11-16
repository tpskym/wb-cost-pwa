import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {clusterOrdersPeriod,loadOzonClusterOrders,mountOzonClusterOrders,summarizeOzonClusters} from '../ozon-cluster-orders.js';

const today='2026-11-16';
const period=clusterOrdersPeriod('2026-11-01',today,today);
const posting=(number,order,cluster,quantity,offer='stand-white')=>({
 posting_number:number,order_number:order,in_process_at:'2026-11-05T08:00:00Z',
 financial_data:{cluster_to:cluster},products:[{offer_id:offer,quantity}]
});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('cluster orders read all requested Ozon pages and count split orders once per destination',async()=>{
 const root=posting('10-1-1','10-1','Москва, МО и Дальние регионы',2);
 const part=posting('10-1-2','10-1','Москва, МО и Дальние регионы',1);
 const unrelated=posting('11-1-1','11-1','Тверь',7,'stand-black');
 const old={...posting('12-1-1','12-1','Казань',1),in_process_at:'2026-10-31T20:59:00Z'};
 const calls=[];
 const data=[
  {postings:[root,part,old],cursor:'next',has_next:true},
  {postings:[part,posting('20-1-1','20-1','',1)],has_next:false},
  {postings:[posting('10-1-3','10-1','Казань',3),unrelated],has_next:false}
 ];
 const rows=await loadOzonClusterOrders(period,'all',async(operation,body)=>{calls.push({operation,body});return data.shift();},{pause:async()=>{}});
 assert.deepEqual(calls.map(call=>[call.operation,call.body.cursor]),[['ozonFbs',''],['ozonFbs','next'],['ozonFbo','']]);
 assert.ok(calls.every(call=>call.body.with.financial_data===true));
 assert.equal(calls[0].body.filter.since,'2026-10-31T21:00:00.000Z');
 assert.throws(()=>clusterOrdersPeriod('2026-11-31',today,today),/корректный период/);
 assert.deepEqual(summarizeOzonClusters(rows,{sku:'stand-white'}),{
  orders:2,units:7,rows:[
   {cluster:'Казань',orders:1,units:3},
   {cluster:'Москва, МО и Дальние регионы',orders:1,units:3},
   {cluster:null,orders:1,units:1}
  ]
 });
 assert.deepEqual(summarizeOzonClusters(rows,{sku:'stand-white',scheme:'fbo'}),{orders:1,units:3,rows:[{cluster:'Казань',orders:1,units:3}]});
});

test('cluster report filters loaded data by seller article and scheme and keeps the result after a failed refresh',async()=>{
 const dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root');
 const state={};
 let client='123',calls=0,failed=false;
 const options={
  root,state,getCredentials:()=>({ozonClient:client,ozonKey:'demo-key'}),getProducts:()=>[{sku:'stand-white'}],
  now:()=>new Date('2026-11-16T12:00:00Z'),
  request:async operation=>{
   calls++;
   if(failed)throw Error('Ozon временно недоступен.');
   return {postings:[operation==='ozonFbs'?posting('1-1-1','1-1','Тверь',1):
    posting('2-1-1','2-1','<Казань>',3,'stand-black')],has_next:false};
  }
 };
 const dispose=mountOzonClusterOrders(options);
 const fields=root.querySelector('form').elements;
 root.querySelector('#ozon-clusters-refresh').click();
 await tick();
 const table=root.querySelector('table');
 assert.equal(calls,2);
 assert.deepEqual([...table.querySelectorAll('tfoot td')].map(cell=>cell.textContent),['2','4']);
 assert.equal(table.querySelector('tbody tr th').textContent,'<Казань>');
 assert.doesNotMatch(table.innerHTML,/<Казань>/);

 fields.scheme.value='fbo';fields.scheme.dispatchEvent(new dom.window.Event('change'));
 fields.sku.value='stand-black';fields.sku.dispatchEvent(new dom.window.Event('input'));
 assert.deepEqual([...root.querySelectorAll('tfoot td')].map(cell=>cell.textContent),['1','3']);
 assert.equal(calls,2);
 failed=true;
 root.querySelector('#ozon-clusters-refresh').click();
 await tick();
 assert.match(root.querySelector('[role="status"]').textContent,/временно недоступен/);
 assert.match(root.querySelector('tbody').textContent,/<Казань>/);
 dispose();
 client='456';
 const disposeNew=mountOzonClusterOrders(options);
 assert.equal(root.querySelector('table'),null);
 assert.equal(root.querySelector('[name="sku"]').value,'stand-black');
 disposeNew();
 dom.window.close();
});

test('stopping a cluster report aborts before publishing a partial result',async()=>{
 const controller=new AbortController();
 await assert.rejects(loadOzonClusterOrders(period,'all',async()=>{
  controller.abort();
  return {postings:[posting('1-1-1','1-1','Тверь',1)],has_next:false};
 },{signal:controller.signal}),{name:'AbortError'});
});
