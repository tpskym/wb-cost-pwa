import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listingGroupDifferences} from '../marketplace-api.js';
const product=(id,height=7)=>({id:String(id),sku:'SKU-'+id,listingDrafts:{wb:{mode:'update',attributeSchema:[{id:90630,name:'Высота предмета'}],body:JSON.stringify([{nmID:id,title:'Подставка',description:'Общее описание',dimensions:{height},characteristics:[{id:90630,value:id===1?6.5:8}],sizes:[{chrtID:id,techSize:'0',skus:['CODE-'+id]}]}])}}});
test('group comparison lists only differing values and ignores platform identifiers',()=>{
 const result=listingGroupDifferences([product(1),product(2,9)],'wb');assert.deepEqual(result.rows.map(row=>row.key),['dimension:height','sizes','attr:90630']);assert.deepEqual(result.rows.find(row=>row.key==='attr:90630').values,[6.5,8]);assert.equal(result.products.length,2);
});
test('group comparison reports missing drafts rather than treating them as empty cards',()=>{
 const result=listingGroupDifferences([product(1),{id:'missing',sku:'EMPTY'}],'wb');assert.equal(result.rows.length,0);assert.equal(result.skipped[0].sku,'EMPTY');
});
