import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountAccrualAnalytics} from '../ozon-analytics-ui.js';
import {loadWbAccrualDays,requestWbFinanceReport,wbAccrualDays} from '../wb-analytics.js';
import {blankProduct} from '../calc.js';
import {createBackupSnapshot} from '../backup-modes.js';

const sellerId='39400000-0000-4000-8000-000000000001';
const token='test.'+Buffer.from(JSON.stringify({sid:sellerId})).toString('base64url')+'.test';
const dates=['2026-11-01','2026-11-02'];
const report=(id,extra={})=>({
 reportId:id,dateFrom:dates[0],dateTo:dates[0],currency:'RUB',
 retailAmountSum:'1000',forPaySum:'860',deliveryServiceSum:'45.50',
 paidStorageSum:'2.50',deductionSum:'-10',bankPaymentSum:'820.25',...extra
});

test('daily WB totals use each official report once and reconcile its breakdown',async()=>{
 const requests=[];
 const data=[report(7),report(7),report(8,{retailAmountSum:'50',forPaySum:'38',bankPaymentSum:'38',deliveryServiceSum:'0',paidStorageSum:'0',deductionSum:'0'})];
 const [day]=await loadWbAccrualDays(dates,async body=>{requests.push(body);return data;});
 assert.deepEqual(requests,[{dateFrom:'2026-11-01T00:00:00+03:00',dateTo:'2026-11-02T23:59:59+03:00',period:'daily',limit:1000,offset:0}]);
 assert.equal(day.count,2);
 assert.equal(day.total,85825);
 assert.equal(day.rows.reduce((sum,row)=>sum+row.amount,0),85825);
 assert.equal(day.rows.find(row=>row.group==='adjustments').amount,-175);
 assert.equal(day.rows.find(row=>row.label==='Прочие удержания и выплаты').amount,1000);
 const db={schema:1,id:'fixture',products:[blankProduct()],wbAnalytics:{accounts:{[sellerId]:[day]}}};
 assert.deepEqual(wbAccrualDays(createBackupSnapshot(db,'full').wbAnalytics,sellerId),[day]);
 assert.equal(createBackupSnapshot(db,'costs').wbAnalytics,undefined);
 assert.equal(wbAccrualDays(db.wbAnalytics,'another-seller').length,0);
 const [rounding]=await loadWbAccrualDays(dates,async()=>[report(9,{bankPaymentSum:'-1.005'})]);
 assert.equal(rounding.total,-101);
});

test('WB finance request uses the official finance host and treats 204 as no reports',async()=>{
 const signal=new AbortController().signal;
 const rows=await requestWbFinanceReport(token,{period:'daily'},signal,async(url,options)=>{
  assert.equal(url,'https://finance-api.wildberries.ru/api/finance/v1/sales-reports/list');
  assert.equal(options.method,'POST');
  assert.equal(options.headers.Authorization,token);
  assert.equal(options.credentials,'omit');
  assert.equal(JSON.parse(options.body).period,'daily');
  return new Response(null,{status:204});
 });
 assert.deepEqual(rows,[]);
});

test('shared report shows both totals and missing WB days, and uses the same dates in each view',async()=>{
 const dom=new JSDOM('<div id="root"></div>'),root=dom.window.document.querySelector('#root');
 const ozon={accounts:[{clientId:'123',days:dates.map(date=>({
  date,total:10000,count:1,breakdownVersion:3,rows:[{group:'sales',label:'Выручка',amount:10000}]
 }))}]};
 let wb,requests=0;
 const dispose=mountAccrualAnalytics({
  root,getState:()=>ozon,commitDay:async()=>true,getWbState:()=>wb,
  getCredentials:()=>({wbToken:token,ozonClient:'123'}),
  commitWbDays:async(id,period,days)=>{
   assert.equal(id,sellerId);assert.deepEqual(period,dates);
   wb={accounts:{[id]:days}};return true;
  },
  requestWb:async()=>{requests++;return [report(7)];},
  now:()=>new Date('2026-11-02T14:00:00Z'),onOpenApi:()=>{}
 });
 root.querySelector('#analytics-refresh').click();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(requests,1);
 assert.match(root.querySelector('.analytics-net').textContent,/1\s020,25/);
 assert.match(root.querySelector('.analytics-coverage').textContent,/Ozon 2\/2 · WB 1\/2 · итоги неполные/);
 const wbRow=root.querySelector('[data-analytics-group="wb"]').closest('tr');
 assert.deepEqual([...wbRow.querySelectorAll('td')].map(cell=>cell.textContent),['820,25\u00a0₽','—','820,25\u00a0₽']);
 root.querySelector('[data-analytics-mode="months"]').click();
 assert.match(root.querySelector('thead').textContent,/ноябрь 2026/);
 root.querySelector('[data-analytics-market="wb"]').click();
 assert.match(root.querySelector('.analytics-net').textContent,/820,25/);
 assert.equal(root.querySelector('[name="to"]').value,dates[1]);
 root.querySelector('[data-analytics-market="ozon"]').click();
 assert.match(root.querySelector('.analytics-net').textContent,/200,00/);
 assert.equal(requests,1);
 dispose();
 dom.window.close();
});
