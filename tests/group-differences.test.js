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
test('differing numeric and text attributes can be edited locally without touching identifiers',async()=>{
 const {differenceFieldEditor,editDifferenceField}=await import('../marketplace-api.js'),p=product(1);
 assert.equal(differenceFieldEditor('wb',p.listingDrafts.wb,'attr:90630').type,'text');
 p.listingDrafts.wb.attributeSchema[0].type='number';editDifferenceField(p,'wb','attr:90630','9.5');editDifferenceField(p,'wb','dimension:height','11');editDifferenceField(p,'wb','description','Новое описание');
 const item=JSON.parse(p.listingDrafts.wb.body)[0];assert.equal(item.characteristics[0].value,9.5);assert.equal(item.dimensions.height,11);assert.equal(item.description,'Новое описание');assert.equal(item.nmID,1);assert.equal(item.sizes[0].skus[0],'CODE-1');
 assert.throws(()=>editDifferenceField(p,'wb','dimension:height','-2'),/число/);assert.equal(JSON.parse(p.listingDrafts.wb.body)[0].dimensions.height,11);
 assert.equal(differenceFieldEditor('wb',p.listingDrafts.wb,'sizes'),null);assert.throws(()=>editDifferenceField(p,'wb','nmID','99'),/редактор/);
});
test('dictionary fields keep their IDs and use the normal card picker',async()=>{
 const {differenceFieldEditor,editDifferenceField}=await import('../marketplace-api.js'),p={listingDrafts:{ozon:{mode:'update',body:JSON.stringify({items:[{offer_id:'A',attributes:[{id:10,values:[{dictionary_value_id:55,value:'Белый'}]}]}]}),attributeSchema:[{id:10,name:'Цвет',dictionary:true}]}}};
 const before=p.listingDrafts.ozon.body;assert.equal(differenceFieldEditor('ozon',p.listingDrafts.ozon,'attr:10'),null);assert.throws(()=>editDifferenceField(p,'ozon','attr:10','Черный'),/редактор/);assert.equal(p.listingDrafts.ozon.body,before);
});
