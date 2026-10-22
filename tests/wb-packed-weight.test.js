import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareWBContent,marketRequest} from '../marketplace-api.js';
const item={nmID:123,description:'Изменённое описание',dimensions:{length:10,width:12,height:7,weightBrutto:0.068,isValid:true},characteristics:[{id:88952,value:68},{id:90630,value:0.068},{id:2,value:['белый']},{id:3,value:24}]};
test('WB content removes obsolete packed weights but retains kilograms and unpacked weight',()=>{
 const result=prepareWBContent([item]);assert.deepEqual(result[0].characteristics,[{id:2,value:['белый']},{id:3,value:24}]);assert.equal(result[0].dimensions.weightBrutto,0.068);assert.equal(result[0].description,item.description);assert.equal(result[0].dimensions.isValid,undefined);assert.equal(item.characteristics.length,4);
 const custom=prepareWBContent([item],'update',[{id:2,name:'Вес с упаковкой (г)'},{id:3,name:'Вес без упаковки (г)'}]);assert.deepEqual(custom[0].characteristics,[{id:3,value:24}]);
 const created=prepareWBContent([{subjectID:1,variants:[item]}],'create');assert.equal(created[0].variants[0].characteristics.length,2);
});
test('WB transport also cleans saved old drafts before sending without changing them',async()=>{
 await marketRequest('wb','update',{wbToken:'test'},[item],async(url,options)=>{const sent=JSON.parse(options.body);assert.equal(sent[0].dimensions.weightBrutto,0.068);assert.deepEqual(sent[0].characteristics.map(a=>a.id),[2,3]);return new Response(JSON.stringify({error:false}));});assert.equal(item.characteristics.length,4);
});
