import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankProduct,createTemplate} from '../calc.js';
import {createFullBackup,parseFullBackup,stageFullRestore,commitFullRestore} from '../full-backup.js';
import {makeZip,readZip} from '../attachments.js';
function fixture(){const a=blankProduct(),b=blankProduct();a.name='Белая подставка';a.productGroup='Watch';a.colorCode='001';a.marketplaces={wb:{price:370,payout:137.75,tax:14.8},ozon:{price:400,payout:200,tax:16}};a.labelPdf={name:'Этикетка.pdf',data:'data:application/pdf;base64,JVBERi0='};a.history=[{date:'saved',markets:a.marketplaces}];b.name='Чёрная подставка';const database={schema:1,id:'original',revision:8,products:[a,b],templates:[createTemplate(a,'Шаблон')]};const records=[{id:'one',owner:'original:'+a.id,name:'Модель.3mf',category:'model',createdAt:'2026-10-18T10:00:00Z',blob:new Blob([new Uint8Array([0,255,13,10])],{type:'application/octet-stream'})},{id:'two',owner:'original:'+b.id,name:'Фото.png',category:'source-ozon',createdAt:'2026-10-18T11:00:00Z',blob:new Blob(['original-photo-bytes'],{type:'image/png'})},{id:'three',owner:'original:'+a.id,name:'Фото.png',category:'source-wb',createdAt:'2026-10-18T11:00:00Z',blob:new Blob(['WB-photo'],{type:'image/png'})}];return {database,records};}
test('full archive restores all products, templates, history, PDFs and exact binary files with correct owners',async()=>{const {database,records}=fixture();const zip=await createFullBackup(database,records),parsed=await parseFullBackup(zip);assert.equal(parsed.database.products.length,2);assert.equal(parsed.database.templates[0].name,'Шаблон');assert.deepEqual(parsed.database.products[0].marketplaces,database.products[0].marketplaces);assert.deepEqual(parsed.database.products[0].history,database.products[0].history);assert.deepEqual(parsed.database.products[0].labelPdf,database.products[0].labelPdf);assert.equal(parsed.files.length,3);for(let i=0;i<records.length;i++){assert.equal(parsed.files[i].name,records[i].name);assert.equal(parsed.files[i].category,records[i].category);assert.equal(parsed.files[i].blob.type,records[i].blob.type);assert.deepEqual(new Uint8Array(await parsed.files[i].blob.arrayBuffer()),new Uint8Array(await records[i].blob.arrayBuffer()));}const staged=stageFullRestore(parsed);assert.notEqual(staged.database.id,database.id);for(let i=0;i<records.length;i++){assert.equal(staged.records[i].owner,staged.database.id+':'+parsed.files[i].productId);assert.notEqual(staged.records[i].id,records[i].id);}assert.equal(parsed.database.id,'original');});
test('full archive supports a database with no attachments',async()=>{const {database}=fixture();const parsed=await parseFullBackup(await createFullBackup(database,[]));assert.equal(parsed.files.length,0);assert.equal(parsed.database.products.length,2);});
test('new articles ZIP updates costs for existing products and transfers models only for new articles',async()=>{
 const {database,records}=fixture();
 const [existing,added]=database.products;
 existing.sku='Known';
 existing.values.box=18;
 added.sku='New';
 added.printer='Test printer';
 added.values.printerPrice=10;
 added.printModel={ownerId:existing.id,fileId:records[0].id};
 added.stockTargets={wb:{minimum:1,normal:5}};
 added.labelPdf=existing.labelPdf;
 database.costPrices={printers:[{model:added.printer,price:5000}],filaments:[]};
 database.products.push({...blankProduct(),sku:'Dupe'},{...blankProduct(),sku:' dupe '},blankProduct());
 const blank=database.products.at(-1);
 const sharedBlankFile={...records[0],id:'blank-model',owner:database.id+':'+blank.id};
 const extra={...blankProduct(),sku:'Another',printModel:{ownerId:blank.id,fileId:sharedBlankFile.id}};
 database.products.push(extra);
 const layout={...records[0],id:'plate-two',owner:database.id+':'+added.id,plateQuantity:2};
 const parsed=await parseFullBackup(await createFullBackup(database,[...records,sharedBlankFile,layout],{mode:'new-skus'}));
 assert.equal(parsed.database.backupMode,'new-skus');
 assert.equal(parsed.database.products.length,database.products.length);
 assert.ok(parsed.files.every(file=>file.category==='model'));
 assert.equal(parsed.database.templates[0].name,database.templates[0].name);
 const current={...blankProduct(),sku:' known ',plateCapacity:7,stockTargets:{wb:{minimum:2,normal:8}}};
 current.printModel={ownerId:current.id,fileId:'local-model'};
 const local={id:'target',schema:1,products:[current,{...blankProduct(),id:added.id,sku:'Other'}]};
 const staged=stageFullRestore(parsed,{localDatabase:local});
 const updated=staged.database.products[0];
 assert.equal(updated.id,current.id);
 assert.equal(updated.sku,current.sku);
 assert.equal(updated.values.box,18);
 assert.deepEqual(updated.printModel,current.printModel);
 assert.deepEqual(updated.stockTargets,current.stockTargets);
 assert.equal(updated.plateCapacity,7);
 assert.deepEqual(staged.database.products[1],local.products[1]);
 const newProduct=staged.database.products.find(product=>product.sku==='New');
 const otherNew=staged.database.products.find(product=>product.sku==='Another');
 assert.equal(newProduct.sku,'New');
 assert.notEqual(newProduct.id,added.id);
 assert.equal(newProduct.values.printerPrice,5000);
 assert.deepEqual(newProduct.labelPdf,existing.labelPdf);
 assert.deepEqual(newProduct.stockTargets,{});
 assert.equal(newProduct.plateCapacity,2);
 assert.equal(otherNew.sku,'Another');
 for(const product of [newProduct,otherNew]){
  const model=staged.records.find(file=>file.id===product.printModel.fileId);
  assert.equal(model?.owner,'target:'+product.id);
  assert.equal(product.printModel.ownerId,product.id);
 }
 assert.equal(staged.records.length,3);
 assert.equal(staged.database.products.length,5);
 assert.equal(staged.database.products.find(product=>product.id===blank.id).printModel,undefined);
 assert.deepEqual(staged.database.costPrices,database.costPrices);
 const again=stageFullRestore(parsed,{localDatabase:staged.database});
 assert.equal(again.records.length,0);
 assert.equal(again.database.products.length,staged.database.products.length);
 assert.deepEqual(again.database.products.find(product=>product.sku==='New').printModel,newProduct.printModel);
 assert.equal(again.database.products[0].values.box,18);
});
test('corruption or missing binaries are rejected before restoration',async()=>{const {database,records}=fixture();const zip=await createFullBackup(database,records);const bytes=new Uint8Array(await zip.arrayBuffer());bytes[60]^=1;await assert.rejects(()=>parseFullBackup(new Blob([bytes])));const entries=await readZip(zip);entries.delete([...entries.keys()].find(k=>k.startsWith('files/')));await assert.rejects(()=>parseFullBackupEntries(entries));});
async function parseFullBackupEntries(entries){return parseFullBackup(await makeZip([...entries].map(([name,blob])=>({name,blob}))));}
test('wrong product links, duplicate references and unlisted files are rejected',async()=>{const {database,records}=fixture();for(const mode of ['owner','duplicate','extra']){const entries=await readZip(await createFullBackup(database,records));const manifest=JSON.parse(await entries.get('manifest.json').text());if(mode==='owner')manifest.files[0].productId='missing';if(mode==='duplicate')manifest.files[1].path=manifest.files[0].path;if(mode==='extra')entries.set('unlisted.txt',new Blob(['bad']));entries.set('manifest.json',new Blob([JSON.stringify(manifest)]));await assert.rejects(()=>parseFullBackupEntries(entries));}});
test('ordinary product ZIP and JSON are not treated as full archives',async()=>{await assert.rejects(()=>parseFullBackup(new Blob(['{}'])));const zip=await makeZip([{name:'Товар.json',blob:new Blob(['{}'])}]);await assert.rejects(()=>parseFullBackup(zip));});

test('restoration commits database only after all files and aborts on storage failure',async()=>{const {database,records}=fixture(),parsed=await parseFullBackup(await createFullBackup(database,records));const calls=[];const restored=await commitFullRestore(parsed,{savePrevious:()=>calls.push('backup'),writeFiles:rows=>{calls.push('files');assert.equal(rows.length,3);},commitDatabase:()=>calls.push('commit')});assert.deepEqual(calls,['backup','files','commit']);assert.notEqual(restored.id,database.id);let committed=false;await assert.rejects(()=>commitFullRestore(parsed,{savePrevious:()=>{},writeFiles:()=>{throw Error('quota');},commitDatabase:()=>{committed=true;}}));assert.equal(committed,false);let written=false;await assert.rejects(()=>commitFullRestore(parsed,{savePrevious:()=>{throw Error('backup failed');},writeFiles:()=>{written=true;},commitDatabase:()=>{}}));assert.equal(written,false);});

test('restoring a full archive remaps selected source-photo references to the exact restored file',async()=>{const {database,records}=fixture();database.products[0].listingDrafts={wb:{mode:'create',body:'[]',photos:[{kind:'local',fileId:'three',name:'Фото.png',category:'source-wb',createdAt:records[2].createdAt,url:''}]}};const parsed=await parseFullBackup(await createFullBackup(database,records)),staged=stageFullRestore(parsed);assert.equal(staged.database.products[0].listingDrafts.wb.photos[0].fileId,staged.records[2].id);assert.equal(parsed.database.products[0].listingDrafts.wb.photos[0].fileId,'three');});
test('full ZIP preserves sales and payouts while excluding local filament inventory',async()=>{
 const {database,records}=fixture();database.sales=[{id:'sale-1',date:'2026-10-23',market:'wb',productId:database.products[0].id,productName:database.products[0].name,sku:'stand_white',quantity:2,unitPrice:395,payout:500,costPerUnit:77.14},{id:'sale-2',date:'2026-10-23',market:'ozon',productId:database.products[1].id,productName:database.products[1].name,sku:'stand_black',quantity:1,unitPrice:400,payout:null,costPerUnit:null}];database.filamentStock=[{id:'spools-1',material:'PLA Basic',colorCode:'00100',colorName:'Белый',originalColorName:'Jade White',quantity:3,minimumSpools:1,normalSpools:5,purchaseSpools:4},{id:'spools-2',material:'PLA Lite',colorCode:'00100',colorName:'Белый',originalColorName:'White',quantity:0,minimumSpools:0,normalSpools:2,purchaseSpools:2}];
 const parsed=await parseFullBackup(await createFullBackup(database,records)),restored=stageFullRestore(parsed);assert.deepEqual(parsed.database.sales,database.sales);assert.deepEqual(parsed.database.filamentStock,[]);assert.deepEqual(restored.database.sales,database.sales);assert.deepEqual(restored.database.filamentStock,[]);assert.equal(restored.records.length,records.length);
});
test('product thumbnail survives full ZIP backup and restore with its variant owner',async()=>{const {database}=fixture(),record={id:'thumbnail',owner:database.id+':'+database.products[1].id,name:'product.webp',category:'product-image',createdAt:'2026-10-27T10:00:00Z',blob:new Blob([new Uint8Array([1,5,9,255])],{type:'image/webp'})};const parsed=await parseFullBackup(await createFullBackup(database,[record])),staged=stageFullRestore(parsed);assert.equal(staged.records[0].category,'product-image');assert.equal(staged.records[0].owner,staged.database.id+':'+database.products[1].id);assert.equal(staged.records[0].blob.type,'image/webp');assert.deepEqual(new Uint8Array(await staged.records[0].blob.arrayBuffer()),new Uint8Array([1,5,9,255]));});
test('ZIP excludes filament inventory, credentials and all print jobs',async()=>{const {database}=fixture();database.accessToken='private-google';database.apiCredentials={wbToken:'private-wb',ozonKey:'private-ozon'};database.filamentStock=[{id:'spool',material:'',colorCode:'white',colorName:'White',originalColorName:'White',quantity:4,minimumSpools:1,normalSpools:3}];const parsed=await parseFullBackup(await createFullBackup(database,[]));assert.equal(parsed.database.accessToken,undefined);assert.equal(parsed.database.apiCredentials,undefined);assert.deepEqual(parsed.database.filamentStock,[]);assert.equal(database.accessToken,'private-google');});

test('plate layouts survive full restore and selected layouts can update models without changing existing costs',async()=>{
 const {database,records}=fixture();
 const [source,newProduct]=database.products;
 source.sku='existing';
 source.plateCapacity=4;
 records.push({...records[0],id:'plate-four',name:'four.3mf',plateQuantity:4});
 const full=stageFullRestore(await parseFullBackup(await createFullBackup(database,records)));
 assert.equal(full.database.products[0].plateCapacity,4);
 assert.equal(full.records.find(file=>file.name==='four.3mf').plateQuantity,4);
 const existing={...blankProduct(),sku:source.sku,name:'Local name',plateCapacity:2};
 const untouched=blankProduct();
 const local={...database,id:'destination',products:[existing,untouched],templates:[]};
 const costs=await parseFullBackup(await createFullBackup(database,records,{mode:'costs'}));
 costs.files=costs.files.filter(file=>file.plateQuantity===4);
 const restored=stageFullRestore({...costs,modelsOnly:true},{localDatabase:local});
 assert.equal(restored.database.products[0].id,existing.id);
 assert.equal(restored.database.products[0].name,'Local name');
 assert.equal(restored.database.products[0].plateCapacity,4);
 assert.deepEqual(restored.database.products[1],untouched);
 assert.ok(restored.database.products.some(product=>product.id===newProduct.id));
 assert.equal(restored.records.length,1);
 assert.equal(restored.records[0].owner,'destination:'+existing.id);
 assert.equal(restored.records[0].plateQuantity,4);
});

test('selective card archive applies an included label and preserves unchecked parameters and model',async()=>{
 const {database}=fixture(),source=database.products[0];
 source.sku='existing';
 source.transferParts={parameters:false,label:true};
 const localProduct={...blankProduct(),sku:'existing',name:'Local name',printModel:{ownerId:'local-product',fileId:'existing-model'}};
 localProduct.id='local-product';
 const local={...database,id:'local',products:[localProduct]};
 const parsed=await parseFullBackup(await createFullBackup(database,[],{mode:'costs'}));
 const restored=stageFullRestore(parsed,{localDatabase:local}).database.products[0];
 assert.equal(restored.name,'Local name');
 assert.deepEqual(restored.labelPdf,source.labelPdf);
 assert.deepEqual(restored.printModel,localProduct.printModel);
 assert.equal(restored.transferParts,undefined);
});

test('initial transfer replaces local products and filament while excluding credentials',async()=>{
 const {database,records}=fixture();
 database.filamentStock=[{id:'spool',material:'PLA Basic',colorCode:'10100',colorName:'White',originalColorName:'Jade White',quantity:3,minimumSpools:1,normalSpools:5}];
 database.credentials={password:'example'};
 const local={...fixture().database,filamentStock:[]};
 const parsed=await parseFullBackup(await createFullBackup(database,records,{replaceAll:true}));
 const staged=stageFullRestore(parsed,{localDatabase:local});
 assert.equal(parsed.replaceAll,true);
 assert.equal(staged.database.products[0].id,database.products[0].id);
 assert.equal(staged.database.filamentStock[0].quantity,3);
 assert.equal(staged.database.credentials,undefined);
 assert.equal(staged.records.length,records.length);
});

test('full ZIP keeps the encrypted access file separate from database and cost-only ZIP',async()=>{
 const {database}=fixture();
 const accessEnvelope={version:1,salt:'01'.repeat(16),iv:'02'.repeat(12),ciphertext:'03'.repeat(24)};
 const full=await createFullBackup(database,[],{accessEnvelope,replaceAll:true});
 const entries=await readZip(full);
 assert.deepEqual(JSON.parse(await entries.get('workshop-access.json').text()),accessEnvelope);
 assert.equal(JSON.parse(await entries.get('database.json').text()).accessEnvelope,undefined);
 assert.deepEqual((await parseFullBackup(full)).accessEnvelope,accessEnvelope);
 assert.equal((await parseFullBackup(await createFullBackup(database,[],{mode:'costs',accessEnvelope}))).accessEnvelope,undefined);
 entries.delete('workshop-access.json');
 await assert.rejects(()=>parseFullBackupEntries(entries),/файл доступов/);
});

test('ZIP preparation and verification honor Stop between entries',async()=>{
 const {database,records}=fixture();
 const creating=new AbortController();
 await assert.rejects(createFullBackup(database,records,{signal:creating.signal,onProgress:({done})=>{if(done>0)creating.abort();}}),{name:'AbortError'});
 const zip=await createFullBackup(database,records),reading=new AbortController();
 await assert.rejects(parseFullBackup(zip,{signal:reading.signal,onProgress:({done})=>{if(done>0)reading.abort();}}),{name:'AbortError'});
});
