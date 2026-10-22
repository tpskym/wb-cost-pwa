import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copyListingForProduct} from '../marketplace-api.js';
const target={name:'Подставка',sku:'stand_black',barcode:'222',variantNote:'Черный'};
const item={nmID:10,imtID:11,vendorCode:'stand_white',title:'Подставка',description:'Готовое описание',brand:'B',dimensions:{length:10,width:12,height:7,weightBrutto:.068},characteristics:[{id:1,value:['Белый']},{id:2,value:['Пластик']}],sizes:[{chrtID:100,techSize:'0',skus:['111']}]};
const source={mode:'update',body:JSON.stringify([item]),subjectID:123,attributeSchema:[{id:1,name:'Цвет'},{id:2,name:'Материал'}],photos:[{kind:'remote',url:'https://example.com/white.jpg'}],taskId:9,lastStatus:'Отправлено',wbPricing:{nmID:10}};
test('WB source fills a new variant retaining content but removing platform identity and photos',()=>{
 const copy=copyListingForProduct('wb',source,target),body=JSON.parse(copy.body),variant=body[0].variants[0];
 assert.equal(copy.mode,'create');assert.equal(body[0].subjectID,123);assert.equal(variant.vendorCode,'stand_black');assert.equal(variant.nmID,undefined);assert.equal(variant.imtID,undefined);assert.equal(variant.description,'Готовое описание');assert.deepEqual(variant.sizes,[{techSize:'0',skus:['222']}]);assert.deepEqual(variant.characteristics,[{id:2,value:['Пластик']},{id:1,value:['Черный']}]);assert.deepEqual(copy.photos,[]);assert.equal(copy.taskId,undefined);assert.equal(copy.wbPricing,undefined);assert.equal(JSON.parse(source.body)[0].sizes[0].skus[0],'111');
});
test('new variants never reuse the source barcode or source article',()=>{
 const copy=copyListingForProduct('wb',source,{...target,barcode:''});assert.deepEqual(JSON.parse(copy.body)[0].variants[0].sizes[0].skus,[]);
 assert.throws(()=>copyListingForProduct('wb',source,{...target,sku:'stand_white'}),/отличаться/);
 assert.throws(()=>copyListingForProduct('wb',source,{...target,sku:''}),/артикул/);
 const created=copyListingForProduct('wb',copy,{...target,sku:'stand_red'});assert.equal(JSON.parse(created.body)[0].variants[0].vendorCode,'stand_red');
});
test('Ozon copy uses a new offer and clears colour dictionary and old media',()=>{
 const source={mode:'update',body:JSON.stringify({items:[{id:10,offer_id:'stand_white',name:'Подставка',description_category_id:1,type_id:2,price:'395',barcode:'111',images:['white.jpg'],attributes:[{id:5,values:[{dictionary_value_id:20,value:'белый'}]},{id:6,values:[{value:'Описание'}]}]}]}),attributeSchema:[{id:5,name:'Цвет товара'}],taskId:123};
 const copied=copyListingForProduct('ozon',source,target),item=JSON.parse(copied.body).items[0];assert.equal(copied.mode,'create');assert.equal(item.offer_id,'stand_black');assert.equal(item.barcode,'222');assert.equal(item.id,undefined);assert.deepEqual(item.images,[]);assert.deepEqual(item.attributes,[{id:6,values:[{value:'Описание'}]}]);assert.equal(item.price,'395');assert.equal(copied.taskId,undefined);
});
