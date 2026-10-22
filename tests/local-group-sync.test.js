import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncLocalListingGroup,applySharedListingChanges,sharedListingChangesApplied} from '../marketplace-api.js';
const make=(id,group='Форма 4')=>({id:String(id),sku:'stand_'+id,productGroup:group,variantNote:id===1?'Белый':'Черный',listingDrafts:{wb:{mode:'update',subjectID:5,attributeSchema:[{id:90630,name:'Высота предмета'},{id:14177449,name:'Цвет'}],body:JSON.stringify([{nmID:id,vendorCode:'stand_'+id,description:'Описание',dimensions:{height:7,width:12,length:10,weightBrutto:.1},characteristics:[{id:90630,value:6.5},{id:14177449,value:[id===1?'Белый':'Черный']}],sizes:[{chrtID:id*10,skus:['CODE-'+id]}]}])}}});
test('editing common fields propagates locally only in the matching group',()=>{
 const white=make(1),black=make(2),other=make(3,'Другая форма'),before=JSON.parse(white.listingDrafts.wb.body),after=structuredClone(before);after[0].dimensions.height=9;after[0].characteristics[0].value=7;
 white.listingDrafts.wb.body=JSON.stringify(after);assert.equal(syncLocalListingGroup([white,black,other],white,'wb',before,after,['1','2']),2);
 const updated=JSON.parse(black.listingDrafts.wb.body)[0];assert.equal(updated.dimensions.height,9);assert.equal(updated.characteristics.find(a=>a.id===90630).value,7);assert.equal(updated.nmID,2);assert.equal(updated.vendorCode,'stand_2');assert.deepEqual(updated.sizes,[{chrtID:20,skus:['CODE-2']}]);assert.deepEqual(updated.characteristics.find(a=>a.id===14177449).value,['Черный']);assert.equal(JSON.parse(other.listingDrafts.wb.body)[0].dimensions.height,7);
});
test('colour and price edits remain individual',()=>{
 const a=make(1),b=make(2),before=JSON.parse(a.listingDrafts.wb.body),after=structuredClone(before);after[0].characteristics[1].value=['Красный'];after[0].sizes[0].skus=['NEW'];assert.equal(syncLocalListingGroup([a,b],a,'wb',before,after,['1','2']),0);assert.deepEqual(JSON.parse(b.listingDrafts.wb.body)[0].sizes[0].skus,['CODE-2']);
});
test('shared edits survive loading old platform data until the platform returns them',()=>{
 const a=make(1),b=make(2),before=JSON.parse(a.listingDrafts.wb.body),after=structuredClone(before);after[0].dimensions.height=9;syncLocalListingGroup([a,b],a,'wb',before,after,['1','2']);
 const incoming=make(2).listingDrafts.wb,patch=b.sharedListingChanges.wb;assert.equal(sharedListingChangesApplied('wb',incoming,patch),false);assert.equal(applySharedListingChanges('wb',incoming,patch),true);assert.equal(sharedListingChangesApplied('wb',incoming,patch),true);assert.equal(JSON.parse(incoming.body)[0].dimensions.height,9);
});
test('a variant without a card receives a new local draft with its own identity',()=>{
 const a=make(1),b={id:'2',sku:'stand_2',productGroup:'Форма 4',variantNote:'Черный',barcode:''},before=JSON.parse(a.listingDrafts.wb.body),after=structuredClone(before);after[0].dimensions.width=15;syncLocalListingGroup([a,b],a,'wb',before,after,['1','2']);assert.equal(b.listingDrafts.wb.mode,'create');const item=JSON.parse(b.listingDrafts.wb.body)[0].variants[0];assert.equal(item.vendorCode,'stand_2');assert.equal(item.nmID,undefined);assert.equal(item.dimensions.width,15);assert.deepEqual(item.sizes[0].skus,[]);
});

test('shared updates require explicit source and destination selection',()=>{
 const a=make(1),b=make(2),c=make(3),before=JSON.parse(a.listingDrafts.wb.body),after=structuredClone(before);after[0].dimensions.height=9;
 assert.equal(syncLocalListingGroup([a,b,c],a,'wb',before,after),0);
 assert.equal(syncLocalListingGroup([a,b,c],a,'wb',before,after,['2','3']),0);
 assert.equal(syncLocalListingGroup([a,b,c],a,'wb',before,after,['1','2']),2);
 assert.equal(JSON.parse(b.listingDrafts.wb.body)[0].dimensions.height,9);assert.equal(JSON.parse(c.listingDrafts.wb.body)[0].dimensions.height,7);
});
