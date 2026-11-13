import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
test('real app renders the normal editor in cards workspace and saves field changes without JSON input',async()=>{const dom=new JSDOM('<div id="app"></div><div id="toast"></div>',{url:'https://tpskym.github.io/wb-cost-pwa/#cards'});globalThis.document=dom.window.document;globalThis.window=dom.window;globalThis.localStorage=dom.window.localStorage;globalThis.location=dom.window.location;globalThis.history=dom.window.history;globalThis.indexedDB=indexedDB;globalThis.confirm=()=>true;dom.window.scrollTo=()=>{};const {blankProduct}=await import('../calc.js');const initial=blankProduct();initial.sku='print_test_white';localStorage.setItem('workshop-db-v1',JSON.stringify({schema:1,id:crypto.randomUUID(),revision:0,updatedAt:new Date().toISOString(),products:[initial],stockSnapshots:[{source:'wb-fbs',updatedAt:new Date().toISOString(),rows:[{source:'wb-fbs',sku:initial.sku,name:initial.name,barcode:'',warehouse:'Основной',available:0,reserved:null,toCustomer:null,fromCustomer:null}]}]}));await import('../app.js');const $=s=>document.querySelector(s);assert.equal($('main').dataset.workspace,'cards');$('#api-new').click();await settle();assert.ok($('#card-title'));assert.equal($('#listing-json'),null);assert.equal($('#api-reference'),null);$('#card-title').value='Название обычным полем';$('#card-title').dispatchEvent(new dom.window.Event('input'));const stored=(await readDatabase());assert.equal(JSON.parse(stored.products[0].listingDrafts.wb.body)[0].variants[0].title,'Название обычным полем');const {disposeListingEditor}=await import('../listing-editor.js?v=0.2.386');disposeListingEditor();});
test('sales workspace is read-only and opens API settings from the order list',async()=>{
 document.querySelector('[data-space="sales"]').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'sales');assert.equal(document.querySelector('#sale-form'),null);assert.ok(document.querySelector('#orders-refresh'));document.querySelector('#orders-open-keys').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'api');assert.equal(document.querySelector('#api-tab-settings').getAttribute('aria-selected'),'true');document.querySelector('[data-space="cost"]').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'cost');
});
test('filament stock opens as a separate workspace and saves colour and spool count',async()=>{
 document.querySelector('[data-space="filament"]').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'filament');document.querySelector('#filament-color-code').value='10100 white';document.querySelector('#filament-add-quantity').value='3';document.querySelector('#filament-add-form').dispatchEvent(new window.Event('submit',{cancelable:true}));const saved=(await readDatabase());assert.equal(saved.filamentStock[0].colorCode,'10100 white');assert.equal(saved.filamentStock[0].quantity,3);
});
test('stock workspace and shared API keys are separate from product editing',async()=>{
 document.querySelector('[data-space="stocks"]').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'stocks');assert.equal(document.querySelector('.sidebar [aria-current=page]').dataset.space,'stocks');assert.equal(document.querySelectorAll('.sidebar .nav.active').length,1);assert.ok(document.querySelector('#stock-refresh'));document.querySelector('#stock-keys').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'api');assert.equal(document.querySelector('#api-settings-panel').hidden,false);assert.equal(document.querySelector('#api-cards-panel').hidden,true);assert.ok(document.querySelector('#wb-api-token'));document.querySelector('[data-space="cards"]').click();await settle();assert.equal(document.querySelector('#api-settings-panel').hidden,true);document.querySelector('#api-tab-settings').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'api');
});
test('compact workspace selector keeps navigation available and table filters sit beside results',async()=>{
 const selector=document.querySelector('#workspace-select');selector.value='stocks';selector.dispatchEvent(new window.Event('change'));assert.equal(document.querySelector('main').dataset.workspace,'stocks');assert.equal(document.querySelector('.breadcrumb'),null);assert.equal(document.querySelector('.space-switcher'),null);assert.ok(document.querySelector('.table-filter-rail #stock-query'));assert.ok(document.querySelector('.table-results #stock-table'));document.querySelector('[data-space="sales"]').click();await settle();assert.ok(document.querySelector('.table-filter-rail #orders-status'));assert.ok(document.querySelector('.table-results #orders-table'));
});
test('navigation groups warehouse and marketplace tools and backup has its own workspace',async()=>{
 const groups=[...document.querySelectorAll('.workspace-nav-group')];assert.deepEqual([...groups[0].querySelectorAll('[data-space]')].map(b=>b.dataset.space),['cost','filament','print-queue']);assert.deepEqual([...groups[1].querySelectorAll('[data-space]')].map(b=>b.dataset.space),['cards','sales','finance','expenses','prices','stocks','api']);document.querySelector('[data-space="backup"]').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'backup');assert.ok(document.querySelector('main #backup-workspace #full-export'));assert.ok(document.querySelector('main #backup-workspace #full-import'));assert.equal(document.querySelector('#export-top'),null);assert.equal(document.querySelector('#sync-open'),null);document.querySelector('[data-space="stocks"]').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'stocks');
});
test('table workspaces keep titles and counts inside the filter column',async()=>{
 for(const [space,count] of [['stocks','stock-total'],['sales','orders-count']]){document.querySelector('[data-space="'+space+'"]').click();await settle();assert.equal(document.querySelector('main>.heading'),null);assert.ok(document.querySelector('.table-filter-rail h1'));assert.ok(document.querySelector('.table-filter-rail #'+count));assert.equal(document.querySelector('.table-results h1'),null);}
});
test('per-product stock targets save separately for WB and Ozon and can be opened from stocks',async()=>{
 document.querySelector('[data-space="cost"]').click();await settle();for(const [market,key,value] of [['wb','minimum','3'],['wb','normal','10'],['ozon','minimum','2'],['ozon','normal','8']]){const input=document.querySelector('[data-stock-market="'+market+'"][data-stock-key="'+key+'"]');input.value=value;input.dispatchEvent(new window.Event('change'));}const stored=(await readDatabase());assert.deepEqual(stored.products[0].stockTargets,{wb:{minimum:3,normal:10},ozon:{minimum:2,normal:8}});document.querySelector('[data-space="stocks"]').click();await settle();assert.ok(document.querySelector('.restock-panel #stock-replenishment'));document.querySelector('.product-stock-targets').scrollIntoView=()=>{};document.querySelector('#stock-edit-targets').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'cost');assert.equal(document.querySelector('[data-stock-market="wb"][data-stock-key="normal"]').value,'10');
});
test('app zoom can be changed and reset without losing the current workspace',async()=>{const before=document.querySelector('main').dataset.workspace;document.querySelector('#app-zoom-in').click();await settle();assert.equal(document.documentElement.style.zoom,'1.1');assert.equal(localStorage.getItem('workshop-ui-zoom'),'110');assert.equal(document.querySelector('#app-zoom-reset').textContent,'110%');document.querySelector('#app-zoom-out').click();await settle();assert.equal(document.documentElement.style.zoom,'1');document.querySelector('#app-zoom-out').click();await settle();assert.equal(document.documentElement.style.zoom,'0.9');document.querySelector('#app-zoom-reset').click();await settle();assert.equal(document.documentElement.style.zoom,'1');assert.equal(document.querySelector('main').dataset.workspace,before);});
test('stock model button passes the article through the async handler and downloads the actual group model',async()=>{
 document.querySelector('[data-space="cost"]').click();await settle();const skuInput=document.querySelector('#sku');skuInput.value='print_test_white';skuInput.dispatchEvent(new window.Event('change'));const {putFile}=await import('../attachments.js?v=0.2.386');const stored=(await readDatabase()),product=stored.products[0];await putFile({id:crypto.randomUUID(),owner:stored.id+':'+product.id,category:'model',name:'group-model.3mf',createdAt:new Date().toISOString(),blob:new Blob(['group'])});const previousURL=URL.createObjectURL,previousRevoke=URL.revokeObjectURL,previousClick=window.HTMLAnchorElement.prototype.click,previousTimeout=globalThis.setTimeout;let downloaded='';URL.createObjectURL=()=> 'blob:group-model';URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=function(){downloaded=this.download;};globalThis.setTimeout=(fn,ms,...args)=>{const timer=previousTimeout(fn,ms,...args);if(ms===60000)timer.unref?.();return timer;};try{document.querySelector('[data-space="stocks"]').click();await settle();const button=[...document.querySelectorAll('[data-print-model-sku]')].find(b=>b.dataset.printModelSku===product.sku);assert.ok(button);button.click();await settle();for(let i=0;i<100&&!downloaded;i++)await new Promise(resolve=>previousTimeout(resolve,5));assert.equal(downloaded,'model.3mf');}finally{URL.createObjectURL=previousURL;URL.revokeObjectURL=previousRevoke;window.HTMLAnchorElement.prototype.click=previousClick;globalThis.setTimeout=previousTimeout;}
});
test('all sidebar items use aligned SVG icons instead of varying text glyphs',async()=>{const buttons=[...document.querySelectorAll('.workspace-nav .nav')];assert.equal(buttons.length,11);for(const button of buttons){assert.ok(button.querySelector('.nav-icon svg'));assert.equal(button.firstElementChild.className,'nav-icon');assert.ok(button.children[1].textContent.trim());}});
test('choosing a saved group model receives the change event and persists the selected file',async()=>{const {putFile}=await import('../attachments.js?v=0.2.386'),stored=(await readDatabase()),product=stored.products[0],fileId=crypto.randomUUID();await putFile({id:fileId,owner:stored.id+':'+product.id,category:'model',name:'chosen-model.stl',createdAt:new Date().toISOString(),blob:new Blob(['chosen'])});document.querySelector('[data-space="cost"]').click();await settle();for(let i=0;i<100&&!document.querySelector('#print-model-select option[value="'+fileId+'"]');i++)await new Promise(resolve=>setTimeout(resolve,5));const selector=document.querySelector('#print-model-select');assert.ok(selector);selector.value=fileId;selector.dispatchEvent(new window.Event('change'));for(let i=0;i<100&&(await readDatabase()).products[0].printModel?.fileId!==fileId;i++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal((await readDatabase()).products[0].printModel.fileId,fileId);});

test('product catalogue has a separate column beside navigation',async()=>{document.querySelector('[data-space="cost"]').click();await settle();const catalogue=document.querySelector('.product-catalogue');assert.ok(catalogue);assert.equal(document.querySelector('.sidebar .side-products'),null);assert.equal(document.querySelector('.sidebar').nextElementSibling,catalogue);assert.ok(catalogue.querySelector('#product-list'));});

test('label uploads live only in cost files beside the model and can be printed from stocks',async()=>{
 document.querySelector('[data-space="cost"]').click();await settle();
 const input=document.querySelector('#label-pdf-file');assert.ok(input.closest('.product-files .product-label-panel'));assert.equal(document.querySelector('.product-identification #label-pdf-file'),null);
 const file=new window.File(['%PDF-white'],'white-label.pdf',{type:'application/pdf'});Object.defineProperty(input,'files',{value:[file]});input.dispatchEvent(new window.Event('change'));
 for(let i=0;i<100&&!(await readDatabase()).products[0].labelPdf;i++)await new Promise(resolve=>setTimeout(resolve,5));
 const product=(await readDatabase()).products[0];assert.equal(product.labelPdf.name,'white-label.pdf');
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.dispatchEvent(new window.Event('close'));};
 document.querySelector('[data-space="stocks"]').click();await settle();const button=[...document.querySelectorAll('[data-label-sku]')].find(b=>b.dataset.labelSku===product.sku);assert.ok(button);assert.equal(button.disabled,false);const previousOpen=window.open;let opened='';window.open=url=>{opened=url;return {};};try{button.click();await settle();assert.match(opened,/^blob:/);assert.equal(document.querySelector('.label-preview-dialog'),null);}finally{window.open=previousOpen;}
});
test('queue workspace supports navigation back and forward to stocks without losing the selected variant',async()=>{
 document.querySelector('[data-space="print-queue"]').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'print-queue');assert.ok(document.querySelector('#queue-add'));document.querySelector('#queue-open-stocks').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'stocks');document.querySelector('#workspace-back').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'print-queue');document.querySelector('#workspace-forward').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'stocks');
});
test('cost deletes only the selected variant and preserves other group members and the previous backup',async()=>{
 document.querySelector('[data-space="cost"]').click();await settle();const before=(await readDatabase()),original=before.products[0];document.querySelector('#duplicate').click();await settle();const doubled=(await readDatabase());assert.equal(doubled.products.length,2);const duplicate=doubled.products.find(p=>p.id!==original.id);assert.equal(duplicate.printModel,undefined);const button=document.querySelector('#delete-product');assert.equal(button.textContent,'Удалить этот вариант');button.click();document.querySelector('.app-confirm .confirm-accept').click();await settle();for(let i=0;i<100&&(await readDatabase()).products.length!==1;i++)await new Promise(resolve=>setTimeout(resolve,5));const after=(await readDatabase());assert.equal(after.products.length,1);assert.equal(after.products[0].id,original.id);assert.equal(after.products[0].sku,original.sku);assert.equal((await readBackup()).products.length,2);
});

test('prices have their own workspace, sidebar highlight and shared API settings',async()=>{document.querySelector('[data-space="prices"]').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'prices');assert.equal(document.querySelector('.sidebar [aria-current="page"]').dataset.space,'prices');assert.ok(document.querySelector('.table-filter-rail #prices-refresh'));assert.ok(document.querySelector('.table-results #prices-rows'));assert.equal(document.querySelector('#workspace-select').value,'prices');document.querySelector('#prices-keys').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'api');});
test('cost template and backup use IndexedDB without writing localStorage',async()=>{document.querySelector('[data-space="cost"]').click();await settle();const $=s=>document.querySelector(s),before=(await readDatabase()),id=$('#mobile-product').value;$('#template-name').value='Quota recovery template';$('#template-save').click();await settle();const stored=(await readDatabase()),template=stored.templates.find(t=>t.name==='Quota recovery template');$('#template-select').value=template.id;$('#template-select').dispatchEvent(new window.Event('change'));const proto=Object.getPrototypeOf(localStorage),original=proto.setItem;let failed=false;proto.setItem=function(key,value){if(key==='workshop-db-v1-backup'){failed=true;throw Error('QuotaExceededError');}return original.call(this,key,value);};try{globalThis.confirm=()=>true;$('#template-apply').click();assert.equal(document.querySelector('.app-confirm h2').textContent,'Применить шаблон к товару?');document.querySelector('.app-confirm .confirm-accept').click();await settle();for(let i=0;i<100&&!document.querySelector('#toast').textContent.includes('Шаблон применён');i++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(failed,false);assert.match(document.querySelector('#toast').textContent,/Шаблон применён/);const after=(await readDatabase());assert.equal(after.products.find(p=>p.id===id).sku,before.products.find(p=>p.id===id).sku);const {readDatabaseBackup}=await import('../database-backup.js');const backup=await readDatabaseBackup();assert.deepEqual(backup.products,stored.products);}finally{proto.setItem=original;}});
test('backup Drive enables automatic exchange with a valid Client ID',async()=>{document.querySelector('[data-space="backup"]').click();await settle();const input=document.querySelector('#client-id');assert.equal(document.querySelector('#google-connect').disabled,true);input.value='someone@gmail.com';input.dispatchEvent(new window.Event('input'));assert.equal(document.querySelector('#google-connect').disabled,true);input.value='123-abc.apps.googleusercontent.com';input.dispatchEvent(new window.Event('input'));assert.equal(document.querySelector('#google-connect').disabled,false);assert.equal(document.querySelector('[data-open-backup-settings]').hidden,true);for(const id of ['drive-create','drive-load'])assert.equal(document.querySelector('#'+id).disabled,false);assert.equal(document.querySelector('#google-out').disabled,true);assert.ok(document.querySelector('.backup-extra details #transfer-export'));assert.equal(document.querySelector('[data-drive-full-backup]'),null);});
test('printing quantity is durably saved and reloadable when localStorage rejects the main database',async()=>{document.querySelector('[data-space="print-queue"]').click();await settle();document.querySelector('#queue-add').click();await settle();const dialog=document.querySelector('.enqueue-dialog');dialog.querySelector('[name=quantity]').value='3';dialog.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true}));await settle();for(let i=0;i<100&&!document.querySelector('[data-enqueue-done]');i++)await new Promise(resolve=>setTimeout(resolve,5));document.querySelector('[data-enqueue-done]').click();await settle();const input=document.querySelector('[data-printing-job]');assert.ok(input);const id=input.dataset.printingJob,proto=Object.getPrototypeOf(localStorage),original=proto.setItem;proto.setItem=function(key,value){if(key==='workshop-db-v1')throw Error('QuotaExceededError');return original.call(this,key,value);};try{input.value='2';input.dispatchEvent(new window.Event('change',{bubbles:true}));for(let i=0;i<100&&input.disabled;i++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(input.value,'2');assert.equal(document.querySelector('[data-finish-printing]').disabled,false);assert.match(document.querySelector('#saved').textContent,/IndexedDB/);assert.equal(document.querySelector('#queue-status').textContent,'');const {createDatabaseStorage}=await import('../database-storage.js'),restarted=createDatabaseStorage(),restored=JSON.parse(await restarted.loadRaw());assert.equal(restored.printQueue.find(job=>job.id===id).printingQuantity,2);assert.match(document.querySelector('[data-queue-printing-total]').textContent,/2 шт/);}finally{proto.setItem=original;}});

async function settle(){await new Promise(resolve=>setTimeout(resolve,5));const {flushDatabase}=await import('../app.js');await flushDatabase().catch(()=>{});await new Promise(resolve=>setTimeout(resolve,0));}
async function readDatabase(){await settle();const {getFile}=await import('../attachments.js'),record=await getFile('workshop-db-v1-main-database');return JSON.parse(await record.blob.text());}
async function readBackup(){const {readDatabaseBackup}=await import('../database-backup.js');return readDatabaseBackup();}
test('catalogue file actions print and download the clicked variant without selecting it',async()=>{document.querySelector('[data-space="cost"]').click();await settle();const original=(await readDatabase()).products[0];const row=document.querySelector('[data-product="'+original.id+'"]');row.click();await settle();document.querySelector('#duplicate').click();await settle();const selected=document.querySelector('#mobile-product').value;assert.notEqual(selected,original.id);const print=document.querySelector('[data-catalogue-label-print="'+original.id+'"]'),model=document.querySelector('[data-catalogue-model-download="'+original.id+'"]');for(let i=0;i<100&&model.disabled;i++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(print.closest('button')===print,true);assert.equal(model.closest('[data-product]'),null);assert.equal(print.disabled,false);assert.equal(model.disabled,false);const previousOpen=window.open,previousClick=window.HTMLAnchorElement.prototype.click,previousTimeout=globalThis.setTimeout;let opened='',downloaded='';window.open=url=>{opened=url;return {};};window.HTMLAnchorElement.prototype.click=function(){downloaded=this.download;};globalThis.setTimeout=(fn,ms,...args)=>{const timer=previousTimeout(fn,ms,...args);if(ms===60000)timer.unref?.();return timer;};try{print.click();await settle();assert.match(opened,/^blob:/);assert.equal(document.querySelector('#mobile-product').value,selected);assert.equal(document.querySelector('[data-catalogue-label-download]'),null);assert.equal(document.querySelector('#label-download'),null);assert.equal(document.querySelector('#mobile-product').value,selected);downloaded='';model.click();await settle();for(let i=0;i<100&&!downloaded;i++)await new Promise(resolve=>previousTimeout(resolve,5));assert.equal(downloaded,'model.stl');for(let i=0;i<200&&!document.querySelector('.sidebar [data-working-open="model"]')?.textContent.includes('model.stl');i++)await new Promise(resolve=>previousTimeout(resolve,5));assert.match(document.querySelector('.sidebar [data-working-open="model"]').textContent,/model.stl/);assert.equal(document.querySelector('#mobile-product').value,selected);assert.equal(document.querySelector('[data-catalogue-label-print="'+selected+'"]').disabled,true);}finally{window.open=previousOpen;window.HTMLAnchorElement.prototype.click=previousClick;globalThis.setTimeout=previousTimeout;}});
test('cloud buttons honor the selected mode in one cloud file and restore database, photos and models without local downloads',async()=>{document.querySelector('[data-space="cost"]').click();await settle();const original=(await readDatabase()).products[0],previousFetch=globalThis.fetch,previousGoogle=window.google,previousTimeout=globalThis.setTimeout,previousClick=window.HTMLAnchorElement.prototype.click;let cloud=null,binary=null,creates=0,updates=0,localDownloads=0;window.HTMLAnchorElement.prototype.click=()=>{localDownloads++;};globalThis.setTimeout=(fn,ms,...args)=>{const timer=previousTimeout(fn,ms,...args);if(ms>=3600000)timer.unref?.();return timer;};globalThis.fetch=async(url,options={})=>{if(url.includes('uploadType=resumable')){if(options.method==='POST')creates++;else updates++;return new Response(null,{status:200,headers:{Location:'https://www.googleapis.com/upload/session'}});}if(options.method==='PUT'){binary=options.body;cloud={id:'only-cloud-file',name:'Мастерская — полная база.zip',size:String(binary.size),modifiedTime:new Date().toISOString()};return Response.json(cloud);}if(url.includes('alt=media'))return new Response(binary);if(url.startsWith('https://www.googleapis.com/drive/v3/files?'))return Response.json({files:cloud?[cloud]:[]});if(url.includes('/files/only-cloud-file?fields='))return Response.json({...cloud,appProperties:{workshopBackup:'full-v1'}});throw Error('Unexpected request: '+url);};window.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'test-token',expires_in:3600})})}}};const waitFor=async(text)=>{for(let i=0;i<500;i++){if(document.querySelector('#google-status')?.textContent.includes(text)&&!document.querySelector('#drive-create').disabled)return;await new Promise(resolve=>previousTimeout(resolve,5));}throw Error(document.querySelector('#google-status')?.textContent);};try{const current=await readDatabase();assert.ok(current.printQueue.length);assert.ok(current.filamentStock.length);const {putFile}=await import('../attachments.js');await putFile({id:crypto.randomUUID(),owner:current.id+':'+original.id,name:'cloud-photo.png',category:'product-image',createdAt:new Date().toISOString(),blob:new Blob([new Uint8Array([137,80,78,71,0,255])],{type:'image/png'})});document.querySelector('[data-space="backup"]').click();await settle();chooseBackupMode('full');document.querySelector('#client-id').value='123-abc.apps.googleusercontent.com';document.querySelector('#google-connect').onclick();await settle();await document.querySelector('#drive-create').onclick();await waitFor('сохранена в Google Drive');assert.ok(document.querySelector('#backup-workspace'));assert.equal(document.querySelector('#sync'),null);assert.doesNotMatch(document.querySelector('#toast').textContent,/showModal|null is not|Cannot read/);await document.querySelector('#drive-create').onclick();await waitFor('сохранена в Google Drive');assert.ok(document.querySelector('#backup-workspace'));assert.equal(document.querySelector('#sync'),null);assert.doesNotMatch(document.querySelector('#toast').textContent,/showModal|null is not|Cannot read/);assert.equal(creates,1);assert.equal(updates,1);assert.equal(localDownloads,0);const {parseFullBackup}=await import('../full-backup.js');const parsed=await parseFullBackup(binary);assert.ok(parsed.files.some(file=>file.category==='model'));assert.ok(parsed.files.some(file=>file.category==='product-image'));assert.equal(parsed.database.products[0].name,original.name);assert.equal(parsed.replaceAll,false);assert.equal(parsed.database.backupMode,'full');assert.deepEqual(parsed.database.printQueue,[]);const {validateDB}=await import('../calc.js');const expectedStock=validateDB(structuredClone(current)).filamentStock;assert.deepEqual(parsed.database.filamentStock,[]);document.querySelector('[data-space="filament"]').click();await settle();document.querySelector('#filament-color-code').value='local-spool';document.querySelector('#filament-add-quantity').value='2';document.querySelector('#filament-add-form').dispatchEvent(new window.Event('submit',{cancelable:true}));assert.ok((await readDatabase()).filamentStock.some(row=>row.colorCode==='local-spool'));const localStock=(await readDatabase()).filamentStock;document.querySelector('[data-space="backup"]').click();await settle();const loading=document.querySelector('#drive-load').onclick();for(let i=0;i<500&&!document.querySelector('.app-confirm');i++)await new Promise(resolve=>previousTimeout(resolve,5));document.querySelector('.app-confirm .confirm-accept').click();await loading;await waitFor('Загрузка из Google Drive завершена');assert.doesNotMatch(document.querySelector('#toast').textContent,/showModal|null is not|Cannot read/);const restored=await readDatabase();assert.notEqual(restored.id,parsed.database.id);assert.deepEqual(restored.printQueue,current.printQueue);assert.deepEqual(restored.filamentStock,localStock);assert.equal(JSON.parse(localStorage.getItem('workshop-config-v1')).driveFileId,'only-cloud-file');const {listFiles}=await import('../attachments.js');const files=await listFiles(restored.id+':'+original.id);assert.ok(files.some(file=>file.category==='model'));assert.ok(files.some(file=>file.category==='product-image'));assert.equal(localDownloads,0);
const waitForElement=async selector=>{for(let i=0;i<500;i++){const node=document.querySelector(selector);if(node)return node;await new Promise(resolve=>previousTimeout(resolve,5));}throw Error('Missing '+selector);};
for(const selectedMode of ['costs','new-skus']){
 chooseBackupMode(selectedMode);
 const uploading=document.querySelector('#drive-create').onclick();
 if(selectedMode==='costs'){const picker=await waitForElement('.costs-transfer-picker');picker.returnValue='apply';picker.close();}
 await uploading;await waitFor('сохранена в Google Drive');
 const saved=await parseFullBackup(binary);
 assert.equal(saved.database.backupMode,selectedMode);assert.equal(saved.replaceAll,false);
 assert.ok(saved.files.some(file=>file.category==='model'));
 if(selectedMode==='new-skus')assert.ok(saved.files.every(file=>['model','product-image'].includes(file.category)));
 assert.ok(saved.files.some(file=>file.category==='product-image'&&file.productId===original.id));
 const before=await readDatabase();
 const beforeFiles=await listFiles(before.id+':'+original.id);
 const {deleteFile}=await import('../attachments.js');
 for(const photo of beforeFiles.filter(file=>file.category==='product-image'))await deleteFile(photo.id);
 const loadingMode=document.querySelector('#drive-load').onclick();
 if(selectedMode==='costs'){const picker=await waitForElement('.costs-transfer-picker');picker.returnValue='apply';picker.close();}
 (await waitForElement('.app-confirm .confirm-accept')).click();
 await loadingMode;await waitFor('Загрузка из Google Drive завершена');
 const after=await readDatabase();assert.deepEqual(after.filamentStock,before.filamentStock);assert.deepEqual(after.printQueue,before.printQueue);
 assert.equal(after.products.length,before.products.length);
 const {ensureProductImage}=await import('../product-images.js');
 const thumbnail=await ensureProductImage(after,after.products.find(product=>product.id===original.id),{download:false});
 assert.ok(thumbnail);assert.deepEqual(new Uint8Array(await thumbnail.blob.arrayBuffer()),new Uint8Array([137,80,78,71,0,255]));
 if(selectedMode==='new-skus')assert.deepEqual((await listFiles(after.id+':'+original.id)).filter(file=>file.category==='model').map(file=>file.id),beforeFiles.filter(file=>file.category==='model').map(file=>file.id));
}
assert.equal(creates,1);assert.equal(updates,3);assert.equal(localDownloads,0);
globalThis.fetch=async()=>new Response(null,{status:503});chooseBackupMode('full');await document.querySelector('#drive-create').onclick();assert.match(document.querySelector('#toast').textContent,/503/);assert.match(document.querySelector('#google-error-help').textContent,/503/);assert.ok(document.querySelector('#google-error-help a[href*="drive.googleapis.com"]'));assert.doesNotMatch(document.querySelector('#toast').textContent,/showModal/);assert.equal(document.querySelector('#drive-create').disabled,false);assert.ok(document.querySelector('#backup-workspace'));}finally{globalThis.fetch=previousFetch;window.google=previousGoogle;globalThis.setTimeout=previousTimeout;window.HTMLAnchorElement.prototype.click=previousClick;}});

test('expenses workspace and three export modes are available from desktop and mobile navigation',async()=>{document.querySelector('[data-space="expenses"]').click();await settle();assert.equal(document.querySelector('main').dataset.workspace,'expenses');assert.ok(document.querySelector('#expenses-workspace [data-expense-form]'));assert.ok(document.querySelector('#workspace-select option[value="expenses"]'));document.querySelector('[data-space="backup"]').click();await settle();const selector=document.querySelector('[data-backup-mode]');assert.deepEqual([...document.querySelectorAll('[data-backup-mode]')].map(option=>option.value),['full','costs','new-skus']);chooseBackupMode('new-skus');assert.ok(selector.closest('.backup-download').contains(document.querySelector('#full-export')));assert.match(document.querySelector('#backup-mode-description').textContent,/Модели добавляет только для новых артикулов/);assert.equal(document.querySelector('#export').hidden,false);assert.equal(document.querySelector('#export').disabled,false);chooseBackupMode('costs');assert.equal(localStorage.getItem('workshop-backup-mode'),'costs');assert.match(document.querySelector('#backup-mode-description').textContent,/Добавляет или обновляет выбранные данные товаров по артикулу/);assert.equal(document.querySelector('#export').hidden,false);assert.equal(document.querySelector('#export').disabled,false);assert.match(document.querySelector('#drive-create').textContent,/Выгрузить ZIP в Google Drive/);assert.equal(document.querySelector('#webdav-upload'),null);chooseBackupMode('full');assert.match(document.querySelector('#backup-mode-description').textContent,/нормы WB\/Ozon/);assert.match(document.querySelector('.backup-upload').textContent,/Режим определяется по файлу/);for(const button of document.querySelectorAll('.backup-upload [data-backup-file]')){const input=document.getElementById(button.dataset.backupFile);let opened=false;input.click=()=>{opened=true};button.click();assert.ok(opened);delete input.click};document.querySelector('[data-space="cost"]').click();await settle();});


test('backup downloads and imports costs JSON with PDF labels and retains the existing model',async()=>{
 const $=selector=>document.querySelector(selector);
 const {createCostsDataSnapshot,costsDataFormat}=await import('../backup-modes.js');
 const {listFiles}=await import('../attachments.js');
 $('[data-space="backup"]').click();
 await settle();
 const before=await readDatabase();
 const product=before.products[0];
 const files=await listFiles(before.id+':'+product.id);
 assert.ok(files.some(file=>file.category==='model'));
 const pdf={name:'transferred-label.pdf',data:'data:application/pdf;base64,JVBERi0='};
 const next=createCostsDataSnapshot({
  ...before,id:'other-device',
  products:[{...product,id:'remote-product',labelPdf:pdf,values:{...product.values,grams:52}}],
  costPrices:{printers:[{model:product.printer,price:60000}],filaments:[]},
 });
 const fileInput=$('#costs-data-file');
 Object.defineProperty(fileInput,'files',{value:[new Blob([JSON.stringify(next)],{type:'application/json'})]});
 const importing=fileInput.onchange({target:fileInput});
 for(let i=0;i<100&&!$('.app-confirm');i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal($('.app-confirm h2').textContent,'Загрузить себестоимость?');
 assert.equal((await readDatabase()).products[0].values.grams,product.values.grams);
 $('.app-confirm .confirm-accept').click();
 await importing;
 assert.match($('#toast').textContent,/Себестоимость загружена/);
 const restored=await readDatabase();
 assert.equal(restored.id,before.id);
 assert.equal(restored.products[0].id,product.id);
 assert.equal(restored.products[0].values.grams,52);
 assert.deepEqual(restored.products[0].labelPdf,pdf);
 assert.deepEqual(restored.products[0].printModel,product.printModel);
 assert.deepEqual((await listFiles(restored.id+':'+product.id)).map(file=>file.id),files.map(file=>file.id));
 assert.deepEqual(restored.costPrices,next.costPrices);
 assert.deepEqual((await readBackup()).products,before.products);

 const originalClick=window.HTMLAnchorElement.prototype.click, originalCreate=URL.createObjectURL;
 let fileName,downloaded;
 window.HTMLAnchorElement.prototype.click=function(){fileName=this.download;};
 URL.createObjectURL=blob=>{if(blob.type==='application/json')downloaded=blob;return originalCreate.call(URL,blob);};
 try{await $('#costs-data-export').onclick();}finally{
  window.HTMLAnchorElement.prototype.click=originalClick;
  URL.createObjectURL=originalCreate;
 }
 assert.match(fileName,/^workshop-costs-.*\.json$/);
 const exported=JSON.parse(await downloaded.text());
 assert.equal(exported.format,costsDataFormat);
 assert.equal(exported.products[0].values.grams,52);
 assert.deepEqual(exported.products[0].labelPdf,pdf);
 assert.equal(exported.products[0].printModel,undefined);
});

test('updating a selected JSON file uses its own mode while ZIP is set to models',async()=>{
 document.querySelector('[data-space="backup"]').click();await settle();
 chooseBackupMode('new-skus');
 assert.equal(document.querySelector('#write-file').disabled,true);
 assert.equal(document.querySelector('#export').disabled,false);
 assert.equal(document.querySelector('[data-json-backup-mode]').value,'costs');
 const previousPicker=window.showOpenFilePicker,previousClick=window.HTMLAnchorElement.prototype.click;
 let contents=JSON.stringify(await readDatabase()),written=null;
 window.HTMLAnchorElement.prototype.click=()=>{};
 window.showOpenFilePicker=async()=>[{name:'costs.json',getFile:async()=>({text:async()=>contents}),createWritable:async()=>({write:async text=>{written=text;},close:async()=>{contents=written;}})}];
 try{
  await document.querySelector('#pick-file').onclick();
  assert.equal(document.querySelector('#write-file').disabled,false);
  const fileMode=document.querySelector('[data-shared-backup-mode]');fileMode.value='costs';fileMode.dispatchEvent(new window.Event('change'));
  const writing=document.querySelector('#write-file').onclick();
  for(let i=0;i<100&&!document.querySelector('.app-confirm');i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.match(document.querySelector('.app-confirm').textContent,/Только себестоимость/);
  document.querySelector('.app-confirm .confirm-accept').click();await writing;
  assert.equal(JSON.parse(written).backupMode,'costs');
  assert.equal(document.querySelector('[data-backup-mode]:checked').value,'new-skus');
 }finally{window.showOpenFilePicker=previousPicker;window.HTMLAnchorElement.prototype.click=previousClick;}
});

function chooseBackupMode(mode){
 const input=document.querySelector('[data-backup-mode][value="'+mode+'"]');
 input.click();
 assert.equal(input.checked,true);
 assert.equal(document.querySelectorAll('[data-backup-mode]:checked').length,1);
}

test('Stop cancels ZIP creation and reading without downloads or database writes, then allows retry',async()=>{
 document.querySelector('[data-space="backup"]').click();await settle();
 const before=await readDatabase(),previousClick=window.HTMLAnchorElement.prototype.click,previousTimeout=globalThis.setTimeout;
 globalThis.setTimeout=(fn,ms,...args)=>{const timer=previousTimeout(fn,ms,...args);if(ms===60000)timer.unref?.();return timer;};
 let downloads=0;
 window.HTMLAnchorElement.prototype.click=()=>downloads++;
 try{
  chooseBackupMode('full');
  const exporting=document.querySelector('#full-export').onclick();
  document.querySelector('[data-backup-stop]').click();
  await exporting;
  assert.equal(downloads,0);
  assert.match(document.querySelector('#toast').textContent,/остановлена/);
  const input=document.querySelector('#full-import');
  const loading=input.onchange({target:{files:[{size:123,arrayBuffer:()=>new Promise(()=>{})}],value:'file'}});
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(document.querySelector('[data-backup-stop]').disabled,false);
  document.querySelector('[data-backup-stop]').click();
  await loading;
  assert.deepEqual(await readDatabase(),before);
  assert.equal(document.querySelector('.archive-progress-dialog'),null);
  assert.equal(document.querySelector('#full-export').disabled,false);
  await document.querySelector('#full-export').onclick();
  assert.equal(downloads,1);
 }finally{window.HTMLAnchorElement.prototype.click=previousClick;globalThis.setTimeout=previousTimeout;}
});

test('Stop cancels JSON reading and is disabled before the first ZIP restore write',async()=>{
 const before=await readDatabase();
 const jsonLoading=document.querySelector('#import').onchange({target:{files:[{size:10,text:()=>new Promise(()=>{})}],value:'file'}});
 document.querySelector('[data-backup-stop]').click();await jsonLoading;
 assert.deepEqual(await readDatabase(),before);
 const {createFullBackup}=await import('../full-backup.js');
 const incoming=structuredClone(before);incoming.products[0].name='Restored after stop boundary';
 const zip=await createFullBackup(incoming,[]);
 const {IDBDatabase}=await import('fake-indexeddb');
 const original=IDBDatabase.prototype.transaction;
 let writes=0;
 IDBDatabase.prototype.transaction=function(stores,mode,...args){
  if(mode==='readwrite'){
   writes++;
   const stop=document.querySelector('[data-backup-stop]');
   assert.ok(stop);assert.equal(stop.disabled,true);
   assert.match(document.querySelector('[data-stop-hint]').textContent,/запись в базу/);
   stop.click();
  }
  return original.call(this,stores,mode,...args);
 };
 try{
  const loading=document.querySelector('#full-import').onchange({target:{files:[zip],value:'file'}});
  for(let i=0;i<100&&!document.querySelector('.app-confirm');i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.ok(document.querySelector('.app-confirm'));
  document.querySelector('.app-confirm .confirm-accept').click();
  await loading;
  assert.ok(writes>0);
 }finally{IDBDatabase.prototype.transaction=original;}
 assert.equal((await readDatabase()).products[0].name,incoming.products[0].name);
 assert.equal(document.querySelector('.archive-progress-dialog'),null);
});

test('costs ZIP keeps the list photo when only a model is selected',async()=>{
 const stored=await readDatabase(),product=stored.products[0];
 const {putFile}=await import('../attachments.js');
 await putFile({id:crypto.randomUUID(),owner:stored.id+':'+product.id,category:'product-image',name:'list.png',createdAt:new Date().toISOString(),blob:new Blob(['list-photo'],{type:'image/png'})});
 await putFile({id:crypto.randomUUID(),owner:stored.id+':'+product.id,category:'model',name:'model.stl',createdAt:new Date().toISOString(),blob:new Blob(['model'])});
 document.querySelector('[data-space="backup"]').click();await settle();chooseBackupMode('costs');
 const previousURL=URL.createObjectURL,previousClick=window.HTMLAnchorElement.prototype.click,previousTimeout=globalThis.setTimeout;
 let zip;
 URL.createObjectURL=blob=>{if(blob.type==='application/zip')zip=blob;return previousURL(blob);};
 window.HTMLAnchorElement.prototype.click=()=>{};
 globalThis.setTimeout=(fn,ms,...args)=>{const timer=previousTimeout(fn,ms,...args);if(ms===60000)timer.unref?.();return timer;};
 try{
  const exporting=document.querySelector('#full-export').onclick();
  for(let i=0;i<100&&!document.querySelector('.costs-transfer-picker');i++)await new Promise(resolve=>previousTimeout(resolve,5));
  const picker=document.querySelector('.costs-transfer-picker');assert.ok(picker);
  const parameters=picker.querySelector('[data-transfer-part="parameters"]');parameters.click();
  assert.equal(parameters.checked,false);
  picker.returnValue='apply';picker.close();await exporting;
  assert.ok(zip);
  const {parseFullBackup}=await import('../full-backup.js');const parsed=await parseFullBackup(zip);
  assert.equal(parsed.database.products[0].transferParts.parameters,false);
  assert.ok(parsed.files.some(file=>file.productId===product.id&&file.category==='product-image'));
 }finally{URL.createObjectURL=previousURL;window.HTMLAnchorElement.prototype.click=previousClick;globalThis.setTimeout=previousTimeout;}
});
