import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyWBContent,wbContentDifferences} from '../marketplace-api.js';
const card={nmID:123,vendorCode:'stand_aw_number_four_white',title:'Подставка',description:'Новое описание',dimensions:{length:10,width:12,height:7,weightBrutto:0.1},characteristics:[{id:1,value:['белый']}],sizes:[{chrtID:12,techSize:'0',skus:['123']}]};
test('WB verification reads exact nmID and detects an accepted but unapplied description',async()=>{
 const calls=[],result=await verifyWBContent(async(op,body)=>{calls.push({op,body});return {cards:[{...card,nmID:999}, {...card,description:'Старое описание'}],cursor:{total:2}};},[card]);
 assert.deepEqual(result.differences,['Описание']);assert.equal(calls[0].op,'list');assert.equal(calls[0].body.settings.filter.textSearch,'123');
 assert.equal(card.description,'Новое описание');
});
test('WB comparison ignores response-only fields and normalizes attribute order',()=>{
 assert.deepEqual(wbContentDifferences(card,{...card,photos:[{big:'https://example.com/a.jpg'}],updatedAt:'now',dimensions:{...card.dimensions,width:'12'}}),[]);
 assert.deepEqual(wbContentDifferences(card,{...card,characteristics:[]}),['Характеристики']);
});
test('WB read failure or missing card never confirms application',async()=>{
 assert.equal((await verifyWBContent(async()=>({cards:[],cursor:{total:0}}),[card])).card,null);
 await assert.rejects(verifyWBContent(async()=>({}),[card]),/прочитать/);
});
