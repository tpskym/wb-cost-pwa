import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wbMergeBody,marketRequest,readAllWBCards} from '../marketplace-api.js';
const cards=[{nmID:1,imtID:10,subjectID:5},{nmID:2,imtID:20,subjectID:5},{nmID:3,imtID:10,subjectID:5},{nmID:4,imtID:40,subjectID:6}];
test('WB joins selected existing variants to an explicit target and guards category and group size',()=>{
 assert.deepEqual(wbMergeBody(cards,1,[2,2,3]),{targetIMT:10,nmIDs:[2]});
 assert.throws(()=>wbMergeBody(cards,1,[4]),/одного предмета/);assert.throws(()=>wbMergeBody(cards,1,[3]),/уже/);assert.throws(()=>wbMergeBody(cards,1,[99]),/существующие/);
 const full=[...Array.from({length:30},(_,i)=>({nmID:i+100,imtID:10,subjectID:5})),cards[1]];assert.throws(()=>wbMergeBody(full,100,[2]),/30/);
});
test('WB merge uses the fixed official route and never permits implicit separation',async()=>{
 await marketRequest('wb','merge',{wbToken:'test'},{targetIMT:10,nmIDs:[2]},async(url,options)=>{assert.equal(url,'https://content-api.wildberries.ru/content/v2/cards/moveNm');assert.deepEqual(JSON.parse(options.body),{targetIMT:10,nmIDs:[2]});return new Response('{"error":false}');});
 await assert.rejects(marketRequest('wb','merge',{wbToken:'test'},{nmIDs:[2]},()=>assert.fail('must not send')),/группа WB/);
});
test('WB preflight reads all pages before computing merged group membership',async()=>{
 let page=0;const result=await readAllWBCards(async()=>page++===0?{cards:Array.from({length:100},(_,i)=>({nmID:i+1})),cursor:{total:100,updatedAt:'now',nmID:100}}:{cards:[{nmID:101}],cursor:{total:1}});assert.equal(result.length,101);assert.equal(page,2);
});
