import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wbGroupUpdate,applyWBGroupPatch,marketRequest} from '../marketplace-api.js';
const card=(id,imt=10)=>({nmID:id,imtID:imt,subjectID:5,vendorCode:'SKU-'+id,title:'Товар '+id,description:'Описание '+id,brand:'B',dimensions:{length:10,width:12,height:7,weightBrutto:.1},characteristics:[{id:14177449,value:[id===1?'белый':'черный']},{id:90630,value:6.5}],sizes:[{chrtID:id*10,techSize:'0',skus:['CODE-'+id]}]});
test('group patch affects only selected fields and preserves unique variants',async()=>{
 const cards=[card(1),card(2),card(3,20)],body=wbGroupUpdate(cards,1,{dimensions:{height:8,weightBrutto:.12},characteristics:[{id:90630,value:7}]});assert.equal(body.length,2);
 for(let i=0;i<2;i++){assert.equal(body[i].dimensions.height,8);assert.equal(body[i].dimensions.length,10);assert.equal(body[i].characteristics.find(a=>a.id===90630).value,7);assert.deepEqual(body[i].characteristics.find(a=>a.id===14177449),cards[i].characteristics[0]);assert.deepEqual(body[i].sizes,cards[i].sizes);assert.equal(body[i].description,cards[i].description);assert.equal(body[i].vendorCode,cards[i].vendorCode);}
 assert.equal(cards[0].dimensions.height,7);
 await marketRequest('wb','update',{wbToken:'test'},body,async(url,options)=>{const sent=JSON.parse(options.body);assert.equal(sent.length,2);assert.equal(sent[1].characteristics.find(a=>a.id===90630).value,7);return new Response('{"error":false}');});
});
test('group patch rejects empty updates and missing or inconsistent groups',()=>{
 assert.throws(()=>wbGroupUpdate([card(1)],1,{dimensions:{height:8}}),/одна карточка/);assert.throws(()=>wbGroupUpdate([card(1),card(2)],1,{}),/Отметьте/);assert.throws(()=>wbGroupUpdate([card(1),card(2)],1,{dimensions:{height:0}}),/положительные/);assert.throws(()=>wbGroupUpdate([card(1),{...card(2),subjectID:6}],1,{dimensions:{height:8}}),/состав/);
});
test('local cached drafts retain unrelated unsent values when applying a common patch',()=>{
 const old={...card(1),description:'Локальное несохранённое описание'},updated=applyWBGroupPatch(old,{dimensions:{width:15}});assert.equal(updated.description,old.description);assert.equal(updated.dimensions.width,15);assert.equal(old.dimensions.width,12);
});
