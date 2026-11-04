import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankProduct,createTemplate,applyTemplate,savedListingDescription,normalizeDescriptionBreaks,validateDB} from '../calc.js';
test('saved description uses matching loaded article and the latest nonempty WB or Ozon card',()=>{
 const products=[{listingDrafts:{wb:{mode:'update',loadedAt:'2026-11-01',body:JSON.stringify([{vendorCode:'a',description:'WB\nОписание'}])}}},{listingDrafts:{ozon:{mode:'update',loadedAt:'2026-11-02',body:JSON.stringify({items:[{offer_id:'a',attributes:[{id:4191,values:[{value:'Ozon\nОписание'}]}]}]})}}}];assert.equal(savedListingDescription(products,'a').description,'Ozon\nОписание');assert.equal(savedListingDescription(products,'b'),null);assert.equal(savedListingDescription(products,''),null);products[1].listingDrafts.ozon.body='{';assert.equal(savedListingDescription(products,'a').market,'wb');
});
test('description remains specific to the product and is preserved when applying a cost template',()=>{
 const p={...blankProduct(),description:'Своё\nОписание'},source={...blankProduct(),description:'Другое'},template=createTemplate(source,'Расчёт');assert.equal(template.inputs.description,undefined);assert.equal(applyTemplate(p,template).description,p.description);assert.doesNotThrow(()=>validateDB({schema:1,id:'description-test',products:[p],templates:[]}));
});

test('each HTML break becomes exactly one newline without collapsing adjacent breaks',()=>{
 assert.equal(normalizeDescriptionBreaks('Первая<br/><br/>Вторая'),'Первая\n\nВторая');assert.equal(normalizeDescriptionBreaks('<br>А<BR />Б<br >В'),'\nА\nБ\nВ');assert.equal(normalizeDescriptionBreaks('А\n\nБ'),'А\n\nБ');
});
test('existing product descriptions normalize on loading and card import keeps the original draft intact',()=>{
 const p={...blankProduct(),sku:'a',description:'А<br/><br/>Б',listingDrafts:{wb:{mode:'update',body:JSON.stringify([{vendorCode:'a',description:'В<br/><br/>Г'}])}}},body=p.listingDrafts.wb.body;validateDB({schema:1,id:'breaks',products:[p],templates:[]});assert.equal(p.description,'А\n\nБ');assert.equal(savedListingDescription([p],'a').description,'В\n\nГ');assert.equal(p.listingDrafts.wb.body,body);
});
