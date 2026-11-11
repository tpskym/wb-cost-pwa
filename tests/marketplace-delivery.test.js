import assert from 'node:assert/strict';
import test from 'node:test';
import {ozonMoscowDelivery,wbFbsDelivery} from '../marketplace-delivery.js';

const box=(width,height,depth,packagingWeight)=>({packaged:{width,height,depth},packagingWeight});

test('WB FBS uses the Russian warehouse tariff and its one-liter boundary',()=>{
 assert.deepEqual(wbFbsDelivery(box(110,120,90,150)),{liters:1.188,delivery:82.67});
 assert.equal(wbFbsDelivery(box(100,100,100)).delivery,54.4);
 assert.equal(wbFbsDelivery(box(100,100,100.1)).delivery,78.22);
 assert.throws(()=>wbFbsDelivery(box(100,100,100,25001)),/крупногабаритного/);
 assert.throws(()=>wbFbsDelivery(box(1201,100,100)),/крупногабаритного/);
});

test('Ozon Moscow pickup and employee acceptance apply once per shipment',()=>{
 assert.deepEqual(ozonMoscowDelivery(box(110,120,90),279),{
  liters:1.188,logistics:27,pickup:25,handling:10,fbo:52,fbs:62
 });
 assert.equal(ozonMoscowDelivery(box(100,100,125),300).fbs,62);
 assert.equal(ozonMoscowDelivery(box(100,100,125.1),300).fbs,63);
 assert.throws(()=>ozonMoscowDelivery(box(110,120,90),300.01),/до 300/);
});

test('marketplace delivery requires every side of the packed item',()=>{
 const measurements={product:{width:110,height:120,depth:90},packaged:{width:110,height:120,depth:0}};
 assert.throws(()=>wbFbsDelivery(measurements),/Товар в упаковке/);
 assert.throws(()=>ozonMoscowDelivery(measurements,279),/Товар в упаковке/);
});
