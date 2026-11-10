import {connectWebDav,remoteWebDavFolder,webDavConnection,webDavHealthUrl,hasBackupPassword,saveBackupPassword,encryptBackupAccess,decryptBackupAccess} from './webdav-client.js?v=0.2.344';
import {createSyncScheduler} from './sync-scheduler.js?v=0.2.344';
import {encodeSyncArchive,localSnapshot,materializeSnapshot,needsAction,publishSyncSeed,publishSyncVersion,readSyncSeed,registerSyncDevice,seedSync,synchronizeFolder,syncRecordId} from './webdav-sync.js?v=0.2.344';
import {equal as sameSyncSnapshot} from './sync-merge.js?v=0.2.344';
import {mountFinance} from './finance.js?v=0.2.344';
import {buildCostDescriptionPrompt} from './ai-prompt.js?v=0.2.344';
import {attachCardDesignZip} from './attachments.js?v=0.2.344';
import {productDetailsMarkup,mountProductDetails,pullProductCategory,categoriesFromProduct} from './category-catalog.js?v=0.2.344';
import {mountCatalogueResize} from './catalogue-resize.js?v=0.2.344';
import {installPrintActionControls} from './print-action-controls.js?v=0.2.344';
import {backupModes,backupMode,createBackupSnapshot,applyBackupSnapshot} from './backup-modes.js?v=0.2.344';
import {mountExpenses,configuredCostPrices} from './expenses.js?v=0.2.344';
import {renderWindowsOpenerSettings} from './windows-opener.js?v=0.2.344';
import {workingDownloads,bindWorkingFolderControls} from './working-downloads.js?v=0.2.344';
import {createDatabaseStorage,mountStorageUsage} from './database-storage.js?v=0.2.344';
import {renderAppAccessGuide} from './google-drive-setup.js?v=0.2.344';
import {ensureProductImage} from './product-images.js?v=0.2.344';
import {writeDatabaseBackup,readDatabaseBackup,migrateLegacyDatabaseBackup} from './database-backup.js?v=0.2.344';
import {skuCopyButton,installSkuCopy} from './sku-copy.js?v=0.2.344';
import {installImagePreview} from './image-preview.js?v=0.2.344';
import {catalogueStatusMatches,catalogueCardPresence,rememberCatalogueCards,refreshCatalogueCards} from './catalogue-status.js?v=0.2.344';
import {openGroupLabelPicker} from './group-label-picker.js?v=0.2.344';
import {openCostReport} from './cost-report.js?v=0.2.344';
import {mountLabelThumbnail} from './label-thumbnail.js?v=0.2.344';
import {mountReleaseHistory} from './release-history.js?v=0.2.344';
import {mountMarketplacePrices} from './marketplace-prices.js?v=0.2.344';
import {createWorkspaceHistory,mountTopRefresh} from './workspace-history.js?v=0.2.344';
import {mountPrintQueue,openEnqueueDialog} from './print-queue.js?v=0.2.344';
import {printProductLabel,groupLabelDesignPrompt,labelDesignPrompt,openStockLabelDialog,readLabelPdf} from './product-labels.js?v=0.2.344';
import {mountWarehouseStocks} from './warehouse-stocks.js?v=0.2.344';
import {draftFromListingTemplate} from './listing-templates.js?v=0.2.344';
import {mountFilamentStock,mountProductFilaments,materialColorSlots} from './filament-stock.js?v=0.2.344';
import {mountSales} from './sales.js?v=0.2.344';
import {sharedListingChangesApplied,applySharedListingChanges,pullProductBarcodes} from './marketplace-api.js?v=0.2.344';
import {actionIcon,confirmAction} from './listing-fields.js?v=0.2.344';
import {installNumberControls} from './number-controls.js?v=0.2.344';
const APP_VERSION='0.2.344';
installImagePreview(document);installSkuCopy(document);
import {disposeListingEditor} from './listing-editor.js?v=0.2.344';
import {mountMarketplaceUI,getMarketplaceCredentials,activateMarketplaceSettings,restoreMarketplaceCredentials} from './marketplace-ui.js?v=0.2.344';
import {createFullBackup,parseFullBackup,commitFullRestore,validateBackupAccess} from './full-backup.js?v=0.2.344';
import {migrateProductModels,normalizeZipNames,replacePrintModel,assignPrintModel,selectedPrintModel,groupPrintModels,rehomePrintModels,listFiles,getFile,putFile,putFiles,deleteFile,makeZip,safeFilename,createCardDesignArchive} from './attachments.js?v=0.2.344';
import {catalogueProductBatches,productLabelPrompt,variantColors,variantSkuPrefix,variantSkuForColor,loadedListingForSku,savedListingDescription,normalizeDescriptionBreaks,productCostsBySku,groups,fields,blankProduct,calculateManual,ensureMarketplaces,validateDB,createTemplate,applyTemplate} from './calc.js?v=0.2.344';
const KEY='workshop-db-v1',CONFIG='workshop-config-v1', $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),rub=n=>n===null?'—':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(n),pct=n=>n===null?'—':n.toFixed(2).replace('.',',')+'%';
let cardsMarket=null,catalogueRefreshBusy=false;
let db,config={},selected,tab='important',space=globalThis.location?.hash==='#finance'?'finance':globalThis.location?.hash==='#expenses'?'expenses':globalThis.location?.hash==='#prices'?'prices':globalThis.location?.hash==='#print-queue'?'print-queue':globalThis.location?.hash==='#backup'?'backup':globalThis.location?.hash==='#api'?'api':globalThis.location?.hash==='#stocks'?'stocks':globalThis.location?.hash==='#filament'?'filament':globalThis.location?.hash==='#sales'?'sales':globalThis.location?.hash==='#cards'?'cards':'cost',saveError=false,savePending=false,installPrompt,recoveryRaw=null;
const databaseStorage=createDatabaseStorage({key:KEY,validate:raw=>validateDB(JSON.parse(raw))});
try{try{config=JSON.parse(localStorage.getItem(CONFIG)||'{}');}catch{}db=validateDB(JSON.parse(await databaseStorage.loadRaw()));}catch{try{recoveryRaw=databaseStorage.persistedRaw||localStorage.getItem(KEY);}catch{}db={schema:1,id:crypto.randomUUID(),revision:0,updatedAt:new Date().toISOString(),products:[blankProduct()]};}
let backupMigrationError=false;try{await migrateLegacyDatabaseBackup({key:KEY});}catch{backupMigrationError=true;}
const workspaceHistory=createWorkspaceHistory();let modelMigration=Promise.resolve(),disposePrices=()=>{},disposeTopRefresh=()=>{};
db.templates??=[];db.sales??=[];db.filamentStock??=[];selected=db.products[0].id;saveError=!!databaseStorage.migrationError;let initialStorageError=false;if(!recoveryRaw&&!databaseStorage.persistedRaw){try{await databaseStorage.saveRaw(JSON.stringify(db));}catch{saveError=true;initialStorageError=true;}}
function product(){return db.products.find(p=>p.id===selected)||db.products[0];}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('visible');setTimeout(()=>$('#toast').classList.remove('visible'),5000);}
function save(){if(recoveryRaw){toast('Сохранение заблокировано: сначала скачайте повреждённую базу через «Экспорт базы», затем загрузите исправную копию.');return false;}db.revision++;db.updatedAt=new Date().toISOString();const revision=db.revision;const finish=ok=>{if(revision!==db.revision)return ok;savePending=false;saveError=!ok;const status=$('#saved');if(status)status.textContent=ok?'Сохранено на устройстве'+(databaseStorage.usesIndexedDB?' · IndexedDB':'')+' · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):'Ошибка сохранения! Скачайте копию';if(!ok)toast('Не удалось сохранить данные ни в одном доступном хранилище. Скачайте полный ZIP.');return ok;};try{const result=databaseStorage.saveRaw(JSON.stringify(db));if(result?.then){savePending=true;if($('#saved'))$('#saved').textContent='Сохраняю на устройстве…';return result.then(()=>finish(true),()=>finish(false));}return finish(true);}catch{return finish(false);}}

async function backup(){await writeDatabaseBackup(JSON.stringify(db),{key:KEY});}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportDB(){if(recoveryRaw){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([recoveryRaw],{type:'application/json'}));a.download='workshop-recovery.json';a.click();return;}download(createBackupSnapshot(db,selectedBackupMode()),'workshop-'+new Date().toISOString().slice(0,10)+'.json');}
let fullBackupBusy=false;
function selectedBackupMode(){try{return localStorage.getItem('workshop-backup-mode')==='costs'?'costs':'full';}catch{return 'full';}}
function updateBackupModeLabels(){const name=backupModes[selectedBackupMode()];for(const [id,label]of [['full-export','Скачать ZIP'],['export','Скачать JSON']]){const button=document.getElementById(id);if(button)button.textContent=label+' · '+name;}}
function lockBackupUI(){document.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);}
function showArchiveProgress(title){const dialog=document.createElement('dialog');dialog.className='product-category-dialog archive-progress-dialog';dialog.innerHTML='<h2></h2><p data-progress-stage role="status"></p><progress max="100" aria-label="Прогресс архива"></progress><p data-progress-detail></p>';dialog.querySelector('h2').textContent=title;dialog.oncancel=event=>event.preventDefault();document.body.append(dialog);dialog.showModal();return {update({stage,done,total,unit}){dialog.querySelector('[data-progress-stage]').textContent=stage;const bar=dialog.querySelector('progress'),detail=dialog.querySelector('[data-progress-detail]');if(Number.isFinite(total)&&total>0&&Number.isFinite(done)){const percent=Math.min(100,Math.round(done/total*100));bar.value=percent;detail.textContent=percent+'%'+(unit==='files'?' · '+done+' из '+total+' файлов':unit==='bytes'?' · '+(done/1048576).toFixed(1)+' из '+(total/1048576).toFixed(1)+' МБ':'');}else{bar.removeAttribute('value');detail.textContent=unit==='bytes'&&Number.isFinite(done)?'Скачано '+(done/1048576).toFixed(1)+' МБ':'Пожалуйста, дождитесь завершения';}},close(){dialog.close();dialog.remove();}};}
async function prepareCostsExport(database, records, mode) {
 if(mode!=='costs')return {database,records};
 const files=records.map(record=>({...record,productId:record.owner.slice(database.id.length+1)}));
 const selection=await selectCostsTransfer({database,files},{exporting:true});
 return selection&&{database:selection.database,records:selection.files.map(({productId,...record})=>record)};
}
let webDavState,webDavScheduler,webDavIssue,webDavConflict;
let webDavResolution,webDavBusy=false,webDavAccount,webDavConnecting=false;
let backupPasswordConfigured=false,includeBackupAccess,webDavStatusCheck;
function webDavRecord({folder, ...state},publication){
 return {id:syncRecordId,owner:'__device-settings',category:'webdav-sync',state,publication};
}
async function webDavDevice(){
 const id=syncRecordId+'-device';
 const saved=await getFile(id);
 if(saved?.device)return saved.device;
 const device=webDavState?.device||crypto.randomUUID();
 await putFile({id,owner:'__device-settings',device});
 return device;
}
async function sendWebDavPublication(state,publication){
 if(!publication)return;
 await publishSyncVersion(state,publication);
 await putFile(webDavRecord(state));
}
const syncLocks=callback=>navigator.locks?navigator.locks.request('workshop-webdav-sync',callback):callback();
async function captureSyncSnapshot(database,epoch){
 const copy=structuredClone(database);
 const owners=[...copy.products.map(p=>copy.id+':'+p.id),copy.id+':marketplace-photos'];
 const records=(await Promise.all(owners.map(owner=>listFiles(owner)))).flat();
 return localSnapshot(copy,records,epoch);
}
function updateWebDavStatus(){
 for(const status of document.querySelectorAll('[data-webdav-issue]')){
  status.hidden=!webDavIssue;
  status.querySelector('span').textContent=webDavIssue?'Обмен WebDAV: '+webDavIssue.error.message:'';
  const action=status.querySelector('button');
  action.hidden=!webDavIssue?.requiresAction||space==='backup';
  action.onclick=()=>{space='backup';history.replaceState(null,'','#backup');render();};
 }
 for(const button of document.querySelectorAll('[data-webdav-run]')){
  button.disabled=fullBackupBusy||webDavBusy||webDavConnecting||!webDavState||webDavAccount!==webDavState.account;
  button.textContent=webDavConflict?'Разрешить конфликт':webDavIssue?.requiresAction?'Продолжить обмен':'Синхронизировать сейчас';
 }
 const status=$('[data-webdav-folder]');
 if(status)status.textContent=webDavConnecting?'Подключаем Облако Mail…':webDavAccount
  ? 'Аккаунт '+webDavAccount+(webDavState?.account===webDavAccount
   ? ' · Обмен каждые 10 минут при открытом приложении.'
   : ' · Сохранён. Выгрузите или восстановите исходную базу.')
  : 'Войдите в Облако Mail для обмена. ZIP можно восстановить из файла.';
 for(const button of document.querySelectorAll('#webdav-upload,#webdav-restore')){
  button.disabled=fullBackupBusy||webDavBusy||webDavConnecting||!webDavAccount;
 }
 const access=$('#backup-include-access');
 if(access){access.disabled=!backupPasswordConfigured||fullBackupBusy;access.checked=backupPasswordConfigured&&(includeBackupAccess??true);}
 const accessStatus=$('[data-backup-access-status]');
 if(accessStatus)accessStatus.textContent=backupPasswordConfigured
  ? 'Пароль шифрования сохранён в системном хранилище.'
  : 'Чтобы добавить доступы в ZIP или выгрузить их в облако, сохраните пароль шифрования.';
 $('#webdav-access-upload').disabled=!webDavAccount||!backupPasswordConfigured||fullBackupBusy||webDavBusy||webDavConnecting;
 $('#webdav-access-restore').disabled=!webDavAccount||fullBackupBusy||webDavBusy||webDavConnecting;
 const connect=$('#webdav-connect');
 if(connect)connect.disabled=fullBackupBusy||webDavBusy||webDavConnecting;
}
function startWebDavScheduler(){
 webDavScheduler?.stop();
 webDavIssue=null;webDavConflict=null;webDavResolution=undefined;
 webDavScheduler=webDavState&&webDavAccount===webDavState.account?createSyncScheduler({
  synchronize:()=>syncLocks(runWebDavCycle),
  onIssue:issue=>{webDavIssue=issue;updateWebDavStatus();},
 }):null;
 updateWebDavStatus();
}
async function applyWebDavSnapshot(snapshot,blobs,state,{initial=false,publication,local}={}){
 const previousFiles=new Map(local?.records.map(file=>[file.syncId||file.id,file.id]));
 const {database,records}=materializeSnapshot(snapshot,blobs,initial?crypto.randomUUID():db.id,
  id=>previousFiles.get(id)||crypto.randomUUID());
 validateDB(database);
 database.revision=(db.revision||0)+1;
 database.updatedAt=new Date().toISOString();
 if(initial)await backup();
 const nextIds=new Set(records.map(file=>file.id));
 const remove=[...previousFiles.values()].filter(id=>!nextIds.has(id));
 const previousMetadata=new Map(local?.data.files.map(file=>[file.id,file]));
 const changed=records.filter((file,index)=>!sameSyncSnapshot(previousMetadata.get(file.syncId),snapshot.files[index]));
 await databaseStorage.saveRaw(JSON.stringify(database),{records:[...changed,webDavRecord(state,publication)],remove});
 db=database;recoveryRaw=null;saveError=false;
 if(initial||!db.products.some(product=>product.id===selected))selected=db.products[0].id;
}
async function runWebDavCycle(){
 if(fullBackupBusy||webDavBusy||recoveryRaw||document.querySelector('dialog[open]'))return false;
 const stored=await getFile(syncRecordId);
 const checkpoint=stored?.state;
 if(!checkpoint||checkpoint.device!==webDavState?.device||checkpoint.epoch!==webDavState.epoch||
    checkpoint.account!==webDavAccount)throw needsAction('Подключение изменено. Откройте «Бэкап» и проверьте аккаунт Mail.');
 const state={...checkpoint,folder:remoteWebDavFolder(checkpoint.account)};
 await sendWebDavPublication(state,stored.publication);
 await modelMigration;
 await databaseStorage.flush();
 const persisted=(await getFile(KEY+'-main-database'))?.blob;
 if(persisted&&await persisted.text()!==databaseStorage.persistedRaw)throw needsAction('База изменена в другой вкладке. Перезагрузите приложение.');
 const current=db,revision=db.revision;
 const local=await captureSyncSnapshot(db,state.epoch);
 const result=await synchronizeFolder(state,local,{resolution:webDavResolution});
 if(result.conflicts){
  webDavConflict={items:result.conflicts,peer:result.peer,local:result.local};
  throw needsAction('На компьютерах изменены одни и те же данные. Выберите, какие значения оставить.');
 }
 webDavConflict=null;
 if(!result.snapshot){webDavState=result.state;return;}
 const publication=await result.preparePublication?.();
 if(db!==current||db.revision!==revision||fullBackupBusy)throw Error('База изменилась во время проверки. Обмен повторится.');
 const changed=!sameSyncSnapshot(local.data,result.snapshot);
 if(changed&&document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')){
  throw Error('Завершите редактирование поля. Обмен повторится автоматически.');
 }
 if(!sameSyncSnapshot(local.data,(await captureSyncSnapshot(db,state.epoch)).data)||db!==current||db.revision!==revision||fullBackupBusy){
  throw Error('База изменилась во время проверки. Обмен повторится.');
 }
 webDavBusy=true;
 updateWebDavStatus();
 const app=$('#app');
 app.inert=true;
 try{
  // Validate before writing a new version to the shared folder.
  validateDB(structuredClone(result.snapshot.database));
  if(changed)await applyWebDavSnapshot(result.snapshot,result.blobs,result.state,{publication,local});
  else await putFile(webDavRecord(result.state,publication));
  webDavState=result.state;
  webDavResolution=undefined;
  if(changed){
   const scroll=document.scrollingElement?.scrollTop;
   render();
   if(document.scrollingElement)document.scrollingElement.scrollTop=scroll;
  }
 }finally{app.inert=false;webDavBusy=false;updateWebDavStatus();}
 await sendWebDavPublication(result.state,publication);
}
function chooseWebDavValue(conflict){
 const dialog=document.createElement('dialog');
 dialog.className='app-confirm webdav-conflict';
 dialog.innerHTML='<h2 id="webdav-conflict-title">Какое значение оставить?</h2><p data-conflict-field></p><p data-conflict-local></p><p data-conflict-remote></p><div class="confirm-actions"><button value="cancel">Отмена</button><button value="remote">Из облака</button><button class="confirm-accept" value="local">С этого компьютера</button></div>';
 dialog.setAttribute('aria-labelledby','webdav-conflict-title');
 const brief=value=>{
  const text=value===undefined?'Нет значения':typeof value==='string'?value:JSON.stringify(value);
  return text.length>500?text.slice(0,500)+'…':text;
 };
 const [,collection,id,...property]=conflict.path;
 const matching=collection==='products'&&db.products.find(item=>item.id===id);
 const labels={name:'Название товара',sku:'Артикул',variantNote:'Вариант',description:'Описание',quantity:'Количество',printingQuantity:'Печатается'};
 const field=property.at(-1);
 dialog.querySelector('[data-conflict-field]').textContent=matching
  ? [matching.sku||matching.name,labels[field]||fields.find(([key])=>key===field)?.[1]||property.join(' / ')].filter(Boolean).join(' · ')
  : conflict.path.slice(1).join(' / ');
 dialog.querySelector('[data-conflict-local]').textContent='На этом компьютере — '+brief(conflict.local);
 dialog.querySelector('[data-conflict-remote]').textContent='В облаке — '+brief(conflict.remote);
 return new Promise(resolve=>{
  dialog.querySelectorAll('button').forEach(button=>{button.onclick=()=>dialog.close(button.value);});
  const previous=document.activeElement;
  dialog.addEventListener('close',()=>{dialog.remove();previous?.focus();resolve(dialog.returnValue);},{once:true});
  document.body.append(dialog);
  dialog.showModal();
 });
}
async function requestWebDavSync(){
 if(!webDavState||webDavBusy||webDavScheduler?.running)return;
 if(webDavState.account!==webDavAccount||!webDavScheduler)return;
 if(webDavConflict){
  const previous=webDavConflict;
  const choices=new Map();
  for(const conflict of previous.items){
   const choice=await chooseWebDavValue(conflict);
   if(!['local','remote'].includes(choice))return;
   choices.set(JSON.stringify(conflict.path),choice);
  }
  webDavResolution={...previous,choices};
 }
 if(webDavIssue?.requiresAction)webDavScheduler.resume();
 else webDavScheduler.syncNow();
}
async function transferViaWebDav(upload){
 if(fullBackupBusy||webDavBusy||webDavConnecting||webDavScheduler?.running)return;
 if(!webDavAccount)throw Error('Сначала подключите аккаунт Mail.');
 if(upload&&recoveryRaw)throw Error('Сначала восстановите исправную базу.');
 const account=webDavAccount;
 const folder=remoteWebDavFolder(account);
 await syncLocks(async()=>{
  if(fullBackupBusy||webDavBusy||webDavConnecting||webDavAccount!==account)return;
  fullBackupBusy=true;
  lockBackupUI();
  let progress;
  try{
   if(!upload){
    progress=showArchiveProgress('Чтение базы из WebDAV');
    progress.update({stage:'Проверяем облачный архив'});
    const {data,blobs,version}=await readSyncSeed(folder,progress.update);
    if(webDavState?.epoch===version.id&&webDavState.account===account&&!recoveryRaw)throw Error('Эта база уже подключена. Нажмите «Синхронизировать сейчас».');
    progress.close();progress=null;
    if(!await confirmAction('Товары, файлы, очередь печати и филамент этого компьютера будут заменены. Предыдущая база сохранится локально.',{
     title:'Заменить локальную базу из облака?',accept:'Заменить базу',
    }))return;
    progress=showArchiveProgress('Восстановление базы');
    progress.update({stage:'Сохраняем предыдущую базу и записываем файлы'});
    const state={...seedSync(folder,data,await webDavDevice()),account};
    await registerSyncDevice(state);
    await applyWebDavSnapshot(data,blobs,state,{initial:true});
    webDavState=state;
   }else{
    if(!await confirmAction('Выгрузка заменит исходный архив в папке masterskaya_files аккаунта '+account+' и начнёт новый цикл обмена.',{
     title:'Выгрузить всю базу в облако?',accept:'Выгрузить базу',
    }))return;
    progress=showArchiveProgress('Выгрузка базы');
    progress.update({stage:'Собираем товары и файлы'});
    await modelMigration;
    await databaseStorage.flush();
    const {data,blobs}=await captureSyncSnapshot(db,crypto.randomUUID());
    const state={...seedSync(folder,data,await webDavDevice()),account};
    const zip=await encodeSyncArchive(data,blobs,state.head,progress.update);
    progress.update({stage:'Записываем архив в выбранную папку'});
    await publishSyncSeed(state,zip);
    await putFile(webDavRecord(state));
    webDavState=state;
   }
   startWebDavScheduler();
   toast(upload?'Вся база записана в папку masterskaya_files':'База восстановлена из облака. Автообмен подключён.');
  }finally{progress?.close();fullBackupBusy=false;render();}
 });
}
async function refreshWebDavConnection(){
 const account=await webDavConnection();
 backupPasswordConfigured=await hasBackupPassword();
 const changed=webDavAccount!==account;
 webDavAccount=account;
 const login=$('#webdav-account');
 if(login&&account&&!login.value)login.value=account;
 if(changed)startWebDavScheduler();
 else updateWebDavStatus();
}
function checkWebDavOnOpen(){
 if(space!=='backup'||webDavStatusCheck||webDavConnecting||fullBackupBusy)return;
 webDavStatusCheck=refreshWebDavConnection().catch(()=>{}).finally(()=>{webDavStatusCheck=null;});
}
function backupPasswordDialog({envelope}={}){
 const dialog=document.createElement('dialog');
 dialog.className='app-confirm backup-access-dialog';
 dialog.setAttribute('aria-labelledby','backup-password-title');
 dialog.innerHTML=`<form><h2 id="backup-password-title">${envelope?'Восстановить доступы':'Пароль шифрования бэкапа'}</h2>
 <p>${envelope?'Введите пароль, которым был зашифрован файл доступов. Его можно восстановить отдельно от базы.':'Этот пароль защищает файл доступов. Сохраните его для восстановления на другом компьютере.'}</p>
 <label>Пароль шифрования<input type="password" name="passphrase" minlength="${envelope?1:12}" maxlength="256" autocomplete="${envelope?'current-password':'new-password'}" required></label>
 ${envelope?`<label class="backup-option"><input type="checkbox" name="remember" checked>Запомнить пароль на этом компьютере</label><label class="backup-option"><input type="checkbox" name="mail">Также подключить аккаунт Mail из файла</label>`:''}
 <p class="backup-access-error" role="alert" hidden></p>
 <div class="confirm-actions"><button type="button" data-cancel>${envelope?'Пропустить':'Отмена'}</button><button class="confirm-accept" type="submit">${envelope?'Восстановить доступы':'Сохранить пароль'}</button></div></form>`;
 const form=dialog.querySelector('form');
 return new Promise(resolve=>{
  const cancel=dialog.querySelector('[data-cancel]'),submit=form.querySelector('[type="submit"]');
  cancel.onclick=()=>dialog.close();
  dialog.addEventListener('cancel',event=>{if(submit.disabled)event.preventDefault();});
  dialog.addEventListener('close',()=>{form.elements.passphrase.value='';dialog.remove();resolve(dialog.returnValue==='done');},{once:true});
  form.onsubmit=async event=>{
   event.preventDefault();
   if(submit.disabled)return;
   const error=form.querySelector('[role="alert"]');
   submit.disabled=true;cancel.disabled=true;error.hidden=true;
   try{
    const password=form.elements.passphrase.value;
    if(envelope){
     const restored=await decryptBackupAccess(envelope,password,{restoreMail:form.elements.mail.checked,rememberPassword:form.elements.remember.checked});
     if(Object.values(restored.marketplace).some(Boolean))restoreMarketplaceCredentials(restored.marketplace);
     if(form.elements.remember.checked)backupPasswordConfigured=true;
     if(restored.mailRestored)await refreshWebDavConnection();
    }else{
     await saveBackupPassword(password);
     backupPasswordConfigured=true;
     includeBackupAccess=true;
    }
    updateWebDavStatus();
    dialog.close('done');
   }catch(reason){error.textContent=reason.message;error.hidden=false;}
   finally{submit.disabled=false;cancel.disabled=false;}
  };
  document.body.append(dialog);
  dialog.showModal();
 });
}
async function transferBackupAccess(upload){
 if(fullBackupBusy||webDavBusy||webDavConnecting||!webDavAccount)return;
 const folder=remoteWebDavFolder(webDavAccount);
 fullBackupBusy=true;
 updateWebDavStatus();
 try{
  if(upload){
   if(!await confirmAction('Заменим зашифрованный файл доступов в Облаке Mail.',{title:'Сохранить доступы в облако?',accept:'Сохранить доступы'}))return;
   const envelope=validateBackupAccess(await encryptBackupAccess(getMarketplaceCredentials()));
   await folder.write('workshop-access.json',new Blob([JSON.stringify(envelope)],{type:'application/json'}));
   toast('Зашифрованный файл доступов сохранён в облаке');
  }else{
   const blob=await folder.read('workshop-access.json');
   if(blob.size>1100000)throw Error('Файл доступов слишком большой.');
   if(await backupPasswordDialog({envelope:validateBackupAccess(JSON.parse(await blob.text()))}))toast('Доступы восстановлены');
  }
 }finally{fullBackupBusy=false;updateWebDavStatus();}
}
function bindWebDavConnection(){
 const form=$('#webdav-connection');
 form.onsubmit=safe(async event=>{
  event.preventDefault();
  if(webDavConnecting||webDavBusy||fullBackupBusy||webDavScheduler?.running)return;
  const login=form.elements.username,password=form.elements.password;
  webDavConnecting=true;
  updateWebDavStatus();
  try{
   webDavAccount=await connectWebDav(login.value,password.value);
   login.value=webDavAccount;
   password.value='';
   startWebDavScheduler();
  }finally{webDavConnecting=false;updateWebDavStatus();}
 });
 $('#webdav-check').onclick=safe(async()=>{
  await refreshWebDavConnection();
  if(!webDavAccount){toast('Компонент работает. Введите почту Mail и пароль приложения.');return;}
  await remoteWebDavFolder(webDavAccount).names();
  toast('Папка masterskaya_files доступна');
 });
 $('#backup-restore-file').onclick=()=>$('#full-import').click();
 $('#backup-password').onclick=safe(()=>backupPasswordDialog());
 $('#backup-include-access').onchange=event=>{includeBackupAccess=event.target.checked;};
 $('#webdav-access-upload').onclick=safe(()=>transferBackupAccess(true));
 $('#webdav-access-restore').onclick=safe(()=>transferBackupAccess(false));
 checkWebDavOnOpen();
}
async function exportFullArchive({replaceAll=false}={}){
 if(fullBackupBusy)return;
 if(recoveryRaw){exportDB();return toast('Сначала восстановите базу. Скачан исходный JSON для восстановления.');}
 fullBackupBusy=true;
 lockBackupUI();
 let progress;
 try{
  const mode=replaceAll?'full':selectedBackupMode();
  await modelMigration;
  const snapshot=structuredClone(db);
  let records=(await Promise.all([...snapshot.products.map(p=>listFiles(snapshot.id+':'+p.id)),listFiles(snapshot.id+':marketplace-photos')])).flat();
  const selection=await prepareCostsExport(snapshot,records,mode);
  if(!selection)return;
  progress=showArchiveProgress('Создание архива');
  progress.update({stage:'Собираем товары и файлы'});
  const chosen=selection.database, included=selection.records;
  const photos=new Set(included.filter(file=>file.category==='product-image').map(file=>file.owner));
  let unavailablePhotos=0;
  for(const product of chosen.products){
   const owner=chosen.id+':'+product.id;
   if(photos.has(owner)||product.transferParts?.parameters===false)continue;
   try{
    if(!await ensureProductImage(chosen,product,{download:false}))unavailablePhotos++;
    included.push(...(await listFiles(owner)).filter(file=>file.category==='product-image'));
   }catch{unavailablePhotos++;}
  }
  const accessEnvelope=mode==='full'&&backupPasswordConfigured&&(includeBackupAccess??true)
   ? await encryptBackupAccess(getMarketplaceCredentials())
   : undefined;
  const zip=await createFullBackup(chosen,included,{mode,replaceAll,accessEnvelope,onProgress:progress.update});
  downloadBlob(zip,'workshop-'+(replaceAll?'transfer':mode)+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.zip');
  toast('Архив подготовлен: '+chosen.products.length+' товаров'+(unavailablePhotos?' · без сохранённого фото: '+unavailablePhotos:''));
 }finally{progress?.close();fullBackupBusy=false;render();}
}
function selectCostsTransfer(parsed,{exporting=false}={}) {
 const products = parsed.database.products;
 const models = parsed.files.filter(file => file.category === 'model');
 const modelsByProduct = new Map(products.map(product => [
  product.id, models.filter(file => file.productId === product.id)
 ]));
 const selectedProducts = new Set(products.map(product => product.id));
 const selectedModels = new Set(models);
 const partsByProduct = new Map(products.map(product=>[product.id,{
  parameters:product.transferParts?.parameters!==false,
  label:!!product.labelPdf&&product.transferParts?.label!==false
 }]));
 const dialog = document.createElement('dialog');
 dialog.className = 'costs-transfer-picker';
 dialog.setAttribute('aria-label', 'Выбор товаров и моделей');
 dialog.innerHTML = `<h2>${exporting?'Что выгрузить в архив':'Что перенести из архива'}</h2>
 <label>Поиск по артикулу или названию<input type="search" data-transfer-search placeholder="Введите часть артикула"></label>
 <div class="file-actions"><button type="button" data-transfer-mark="all">Отметить найденные</button><button type="button" data-transfer-mark="none">Снять все отметки</button></div>

 <div class="costs-transfer-list"></div>
 <p data-transfer-summary role="status"></p>
 <form method="dialog" class="file-actions"><button value="apply">Продолжить</button><button value="cancel">Отмена</button></form>`;
 const list = dialog.querySelector('.costs-transfer-list');
 const search = dialog.querySelector('[data-transfer-search]');
 const visible = () => products.filter(product =>
  (product.sku+' '+product.name).toLowerCase().includes(search.value.trim().toLowerCase())
 );
 const hasParts = id => {
  const parts=partsByProduct.get(id);
  return parts.parameters||parts.label||modelsByProduct.get(id).some(file=>selectedModels.has(file));
 };
 const updateSummary = () => {
  const count = models.filter(file => selectedProducts.has(file.productId) && selectedModels.has(file)).length;
  dialog.querySelector('[data-transfer-summary]').textContent = 'Товаров выбрано: '+[...selectedProducts].filter(hasParts).length+' · файлов моделей: '+count;
  dialog.querySelector('[value="apply"]').disabled = ![...selectedProducts].some(hasParts);
 };
 const draw = () => {
  list.replaceChildren();
  for (const product of visible()) {
   const row = document.createElement('fieldset');
   const files = modelsByProduct.get(product.id);
   row.innerHTML = `<label><input type="checkbox" data-transfer-product> <strong>${esc(product.sku||product.name)}</strong> <span>${esc(product.sku?product.name:'')}</span></label>`;
   const check = row.querySelector('[data-transfer-product]');
   check.checked = selectedProducts.has(product.id);
   check.onchange = () => {
    if(check.checked)selectedProducts.add(product.id);
    else selectedProducts.delete(product.id);
    for(const fileCheck of row.querySelectorAll('[data-transfer-file],[data-transfer-part]'))fileCheck.disabled=!check.checked||fileCheck.hasAttribute('data-unavailable');
    updateSummary();
   };
   const parts=partsByProduct.get(product.id);
   for(const [key,title] of [['parameters','Все параметры карточки'],['label','Этикетка PDF']]){
    const available=key==='parameters'?product.transferParts?.parameters!==false:!!product.labelPdf&&product.transferParts?.label!==false;
    const label=document.createElement('label');
    label.innerHTML=`<input type="checkbox" data-transfer-part="${key}"> ${title}${available?'':' · нет в архиве'}`;
    const input=label.querySelector('input');
    input.checked=parts[key];
    input.disabled=!available||!check.checked;
    if(!available)input.dataset.unavailable='';
    input.onchange=()=>{parts[key]=input.checked;updateSummary();};
    row.append(label);
   }
   for(const file of files){
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" data-transfer-file> ${file.plateQuantity||1} шт. · ${esc(file.name)}`;
    const fileCheck = label.querySelector('input');
    fileCheck.checked = selectedModels.has(file);
    fileCheck.disabled = !check.checked;
    fileCheck.onchange = () => {
     if(fileCheck.checked)selectedModels.add(file);
     else selectedModels.delete(file);
     updateSummary();
    };
    row.append(label);
   }
   list.append(row);
  }
  if(!list.children.length)list.textContent='По этому запросу ничего не найдено.';
  updateSummary();
 };
 search.oninput=draw;
 dialog.querySelector('[data-transfer-mark="all"]').onclick=()=>{
  for(const product of visible()){
   selectedProducts.add(product.id);
   partsByProduct.set(product.id,{parameters:product.transferParts?.parameters!==false,label:!!product.labelPdf&&product.transferParts?.label!==false});
   for(const file of modelsByProduct.get(product.id))selectedModels.add(file);
  }
  draw();
 };
 dialog.querySelector('[data-transfer-mark="none"]').onclick=()=>{selectedProducts.clear();draw();};
 draw();
 return new Promise(resolve=>{
  dialog.addEventListener('close',()=>{
   const chosen=products.filter(product=>selectedProducts.has(product.id)&&hasParts(product.id));
   const ids=new Set(chosen.map(product=>product.id));
   const result=dialog.returnValue==='apply'&&chosen.length?{
    database:{
     ...parsed.database,
     products:chosen.map(product=>{
      const transferParts=partsByProduct.get(product.id);
      const copy=transferParts.parameters?{...product}:{
       ...blankProduct(),id:product.id,sku:product.sku,name:product.name,
       printModel:product.printModel,plateCapacity:product.plateCapacity
      };
      const hasModel=modelsByProduct.get(product.id).some(file=>selectedModels.has(file))||
       models.some(file=>ids.has(file.productId)&&selectedModels.has(file)&&(file.fileId||file.id)===product.printModel?.fileId);
      if(!hasModel){delete copy.printModel;delete copy.plateCapacity;}
      if(transferParts.label)copy.labelPdf=product.labelPdf;
      else delete copy.labelPdf;
      return {...copy,transferParts};
     }),
     templates:chosen.length===products.length&&chosen.every(p=>partsByProduct.get(p.id).parameters)?parsed.database.templates:[]
    },
    files:parsed.files.filter(file=>ids.has(file.productId)&&(file.category==='model'?selectedModels.has(file):partsByProduct.get(file.productId).parameters))
   }:null;
   dialog.remove();
   resolve(result);
  },{once:true});
  document.body.append(dialog);
  dialog.showModal();
 });
}
async function restoreFullArchive(file){
 if(!file||fullBackupBusy)return;fullBackupBusy=true;lockBackupUI();const progress=showArchiveProgress('Загрузка из архива');progress.update({stage:'Читаем архив'});
 try{toast('Проверяю полный архив…');let parsed=await parseFullBackup(file,{onProgress:progress.update});const mode=backupMode(parsed.database);progress.close();
 if(mode==='costs'){
  if(recoveryRaw)throw Error('Для восстановления повреждённой базы нужен полный бэкап.');
  parsed=await selectCostsTransfer(parsed);
  if(!parsed)return;
 }
 if(!await confirm('Восстановить '+parsed.database.products.length+' товаров и '+parsed.files.length+' файлов из архива? '+backupModes[mode]+'. '+(parsed.replaceAll?'Локальная база будет полностью заменена, включая очередь печати и остатки филамента.':mode==='costs'?'Будут перенесены отмеченные параметры, этикетки и файлы моделей.':'Нормы WB/Ozon, затраты и остальные переносимые данные будут заменены содержимым архива. Очередь печати и остатки филамента сохранятся.')+' Предыдущая база и её файлы останутся доступны через «Вернуть предыдущую базу».'))return;
 const restoring=showArchiveProgress('Восстановление базы');let restored;try{restored=await commitFullRestore(parsed,{onProgress:restoring.update,localDatabase:db,savePrevious:backup,writeFiles:putFiles,commitDatabase:async database=>{database.revision++;database.updatedAt=new Date().toISOString();await databaseStorage.saveRaw(JSON.stringify(database),parsed.replaceAll?{remove:[syncRecordId]}:undefined);}});}finally{restoring.close();}
 db=restored;recoveryRaw=null;selected=db.products[0].id;
 if(parsed.replaceAll){webDavState=null;startWebDavScheduler();}
 if(parsed.accessEnvelope)await backupPasswordDialog({envelope:parsed.accessEnvelope});
 toast(mode==='costs'?'Выбранные товары и файлы перенесены':'База и все файлы восстановлены из архива');return true;
 }finally{progress.close();fullBackupBusy=false;render();}
}
async function changeDB(x){x=applyBackupSnapshot(x,db);validateDB(x);await backup();const previous=db,oldSelected=selected;recoveryRaw=null;db=x;selected=db.products[0].id;const result=save();if((result?.then?await result:result)===false){db=previous;selected=oldSelected;throw Error('Не удалось сохранить загруженную базу');}render();}
function downloadBlob(blob,name){if(/\.(3mf|stl|step|stp|obj|gcode)$/i.test(name))return workingDownloads.save(blob,name,'model',{notify:toast});return downloadBrowserFile(blob,name);}
function downloadBrowserFile(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
const productImageUrls=new Map();
async function hydrateProductImages(scope=document){
 for(const img of scope.querySelectorAll('[data-product-image]')){
  try{const imageProduct=db.products.find(product=>product.id===img.dataset.productImage);const file=imageProduct?await ensureProductImage(db,imageProduct,{download:false}):null;if(!img.isConnected)continue;const previous=productImageUrls.get(img);if(previous)URL.revokeObjectURL(previous);productImageUrls.delete(img);if(!file){img.hidden=true;img.removeAttribute('src');continue;}const url=URL.createObjectURL(file.blob);productImageUrls.set(img,url);img.onerror=()=>{img.hidden=true;img.removeAttribute('src');img.title='Фото не удалось прочитать. Прикрепите изображение заново.';};img.src=url;img.hidden=false;}catch{img.hidden=true;}
 }
 for(const [img,url] of productImageUrls)if(!img.isConnected){URL.revokeObjectURL(url);productImageUrls.delete(img);}
}
function mountProductImage(){
 const p=product(),heading=document.querySelector('main>.heading');if(space!=='cost'||!heading)return;
 const panel=document.createElement('div');panel.className='cost-product-image';panel.innerHTML=`<img data-product-image="${esc(p.id)}" alt="Изображение товара" hidden><div><label class="file-button">${actionIcon('upload')}<span>Прикрепить изображение</span><input type="file" accept="image/jpeg,image/png,image/webp" hidden></label><button type="button" data-remove-image>${actionIcon('remove')}<span>Удалить изображение</span></button><button type="button" data-reveal-catalogue-product>${actionIcon('search')}<span>Активировать в списке</span></button><small>Фото хранится файлом в базе приложения и полном ZIP. JPG, PNG или WebP · до 10 МБ.</small></div><aside class="image-profit-summary"><strong>Прибыль на изделие</strong><div data-product-profit-summary>${profitSummary(p)}</div></aside>`;heading.prepend(panel);
 panel.querySelector('[data-reveal-catalogue-product]').onclick=()=>revealCatalogueProduct(p.id);
 panel.querySelector('input').onchange=safe(async event=>{if(recoveryRaw)throw Error('Сначала восстановите базу расчётов');const file=event.target.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Выберите JPG, PNG или WebP');if(file.size>10*1024*1024)throw Error('Изображение должно быть не больше 10 МБ');const url=URL.createObjectURL(file);try{await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(Error('Не удалось прочитать изображение'));image.src=url;});}finally{URL.revokeObjectURL(url);}const owner=db.id+':'+p.id,old=(await listFiles(owner)).filter(f=>f.category==='product-image');await putFile({id:crypto.randomUUID(),owner,category:'product-image',name:file.name,createdAt:new Date().toISOString(),blob:file});for(const f of old)await deleteFile(f.id);await hydrateProductImages();toast('Изображение товара сохранено');});
 panel.querySelector('[data-remove-image]').onclick=safe(async()=>{for(const file of (await listFiles(db.id+':'+p.id)).filter(f=>f.category==='product-image'))await deleteFile(file.id);await hydrateProductImages();toast('Изображение удалено');});hydrateProductImages(panel);
}
const fileCategories=[['model','Модель для печати','STL, 3MF, STEP и другие файлы. Скачайте модель, откройте её в Bambu Studio, выберите настройки и отправьте на принтер. Прямая отправка из приложения не подключена.'],['source-wb','Исходники карточки WB','Все материалы карточки WB: фотографии, проекты, тексты и готовые изображения. Скачайте ZIP для редактирования с ИИ и добавьте новые версии.'],['source-ozon','Исходники карточки Ozon','Отдельный комплект всех материалов карточки Ozon. Скачайте ZIP для редактирования с ИИ и добавьте новые версии.']];
async function plateModels(database, product) {
 const choices = new Map();
 try { choices.set(1, await selectedPrintModel(database, product)); } catch {}
 const files = (await listFiles(database.id + ':' + product.id)).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
 for (const file of files) {
  if (file.category === 'model' && file.plateQuantity >= 2 && file.plateQuantity <= (product.plateCapacity || 1)) choices.set(file.plateQuantity, file);
 }
 return choices;
}
async function openPlateModel(product) {
 await modelMigration.catch(()=>{});
 const choices = await plateModels(db, product);
 if (!choices.size) throw Error('Прикрепите модель в разделе «Файлы товара».');
 if (document.querySelector('.plate-picker[open]')) return;
 const capacity = product.plateCapacity || 1;
 if (capacity === 1) {
  const file = choices.get(1);
  return downloadBlob(file.blob, file.name);
 }
 const dialog = document.createElement('dialog');
 dialog.className = 'plate-picker';
 dialog.setAttribute('aria-label', 'Количество деталей на пластине');
 dialog.innerHTML = `<h2>Количество деталей на пластине</h2><p>${esc(product.name || product.sku)}</p><div class="plate-keypad">${Array.from({length:capacity}, (_,index)=>{
  const quantity=index+1,file=choices.get(quantity);
  return `<button type="button" data-plate-choice="${quantity}" ${file?'':'disabled'} aria-label="${quantity} шт. ${file?esc(file.name):'модель не прикреплена'}">${quantity}</button>`;
 }).join('')}</div><form method="dialog"><button>Отмена</button></form>`;
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.querySelectorAll('[data-plate-choice]').forEach(button=>button.onclick=safe(async()=>{
  const file=choices.get(Number(button.dataset.plateChoice));
  dialog.close();
  await downloadBlob(file.blob,file.name);
 }));
 document.body.append(dialog);
 dialog.showModal();
}
function renderPlateSettings(capacity, plateFiles) {
 return `<div class="plate-settings"><strong>Максимум деталей на пластине</strong><div class="file-actions"><button type="button" data-plate-step="-1" ${capacity<=1?'disabled':''} aria-label="Уменьшить вместимость">−</button><output>${capacity}</output><button type="button" data-plate-step="1" ${capacity>=100?'disabled':''} aria-label="Увеличить вместимость">+</button></div>${Array.from({length:capacity-1},(_,index)=>{const quantity=index+2,file=plateFiles.find(file=>file.plateQuantity===quantity);return `<div class="plate-slot"><span><strong>${quantity} шт.</strong> · ${file?esc(file.name):'Файл не прикреплён'}</span><label class="file-button">${file?'Заменить файл':'Прикрепить файл'}<input type="file" data-file-upload="model" data-plate-quantity="${quantity}" aria-label="Модель для ${quantity} деталей" hidden></label></div>`;}).join('')}</div>`;
}
async function renderFiles(){
 await modelMigration.catch(()=>{});const p=product(),owner=db.id+':'+p.id,container=$('#product-files');
 try{const files=await listFiles(owner),models=(await groupPrintModels(db,p)).filter(file=>!file.plateQuantity);const capacity=p.plateCapacity||1;const plateFiles=files.filter(file=>file.category==='model'&&file.plateQuantity).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));let chosenModel=null;try{chosenModel=await selectedPrintModel(db,p);}catch{}for(const file of files){if(['source','ready'].includes(file.category)){file.category=p.platform?.startsWith('Ozon')?'source-ozon':'source-wb';await putFile(file);}}if(container!==$('#product-files')||product().id!==p.id)return;
 const fileList=key=>`<ul class="attachment-list">${files.filter(f=>f.category===key).map(f=>`<li><span>${esc(f.name)}<small>${(f.blob.size/1024/1024).toFixed(2)} МБ · ${esc(new Date(f.createdAt).toLocaleString('ru-RU'))}</small></span><button data-file-download="${f.id}">Скачать</button><button data-file-delete="${f.id}">Удалить</button></li>`).join('')||'<li class="empty">Файлы этого товара пока не добавлены</li>'}</ul>`;
 container.innerHTML=fileCategories.filter(([key])=>key==='model').map(([key,title,hint])=>key==='model'?`<fieldset class="packaging-group print-model-panel"><legend>${title}</legend><p class="group-hint">Укажите вместимость пластины и прикрепите готовый файл раскладки для каждого количества. Основная модель используется для одной детали.</p><div class="print-model-toolbar"><div class="print-model-actions"><label class="file-button print-model-upload">${chosenModel?'Заменить файл для 1 шт.':'Прикрепить файл для 1 шт.'}<input type="file" data-file-upload="model" hidden></label><button type="button" id="print-model-download" ${chosenModel||plateFiles.some(file=>file.plateQuantity<=capacity)?'':'disabled'}>Печать модели</button></div><label>Модель для 1 детали<select id="print-model-select"><option value="">${models.length?'Выберите сохранённый файл':'Модель ещё не выбрана'}</option>${models.map(f=>`<option value="${esc(f.id)}" ${chosenModel?.id===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select></label></div><div class="print-model-meta"><span>Модель варианта: <strong>${esc(p.sku||p.name)}</strong></span>${chosenModel?`<span>${(chosenModel.blob.size/1024/1024).toFixed(2)} МБ</span>`:'<span>Загрузите файл или выберите из сохранённых.</span>'}</div>${renderPlateSettings(capacity,plateFiles)}<details class="print-model-library"><summary>Сохранённые файлы товара · ${files.filter(f=>f.category==='model').length}</summary>${fileList('model')}<button data-file-zip="model" ${files.some(f=>f.category==='model')?'':'disabled'}>Скачать модели товара ZIP</button></details></fieldset>`:`<fieldset class="packaging-group"><legend>${title}</legend><p class="group-hint">${hint}</p><div class="file-actions"><label class="file-button">Добавить файлы<input type="file" multiple data-file-upload="${key}" hidden></label><button data-file-zip="${key}" ${files.some(f=>f.category===key)?'':'disabled'}>Скачать исходники ZIP</button></div>${fileList(key)}</fieldset>`).join('');
 const design=$('#card-design-files');if(design){design.innerHTML=`<div class="card-design-actions"><label class="file-button card-design-upload">${actionIcon('upload')}<span>Прикрепить ZIP-архив</span><input type="file" accept=".zip,application/zip" data-design-zip hidden></label><label class="file-button card-design-upload">${actionIcon('upload')}<span>Выбрать файлы и сохранить ZIP</span><input type="file" multiple data-design-upload hidden></label></div>${fileList('card-design')}<p class="card-design-status" role="status"></p>`;design.querySelector('[data-design-zip]').onchange=safe(async event=>{if(recoveryRaw)throw Error('Сначала восстановите базу расчётов');const file=event.target.files[0];if(!file)return;const record=await attachCardDesignZip(owner,file);await putFile(record);await renderFiles();toast(record.zipNameWarning||'ZIP-архив сохранён в приложении');});design.querySelector('[data-design-upload]').onchange=safe(async event=>{if(recoveryRaw)throw Error('Сначала восстановите базу расчётов');const input=event.target;if(!input.files.length)return;input.disabled=true;const status=design.querySelector('[role=status]');status.textContent='Создаю и сохраняю архив…';try{const record=await createCardDesignArchive(owner,input.files,p.sku||p.name);await putFile(record);await renderFiles();toast('Архив материалов сохранён в приложении');}catch(error){input.disabled=false;status.textContent=error.message;throw error;}});}
 $('#all-product-files').disabled=!files.length;
 container.querySelector('#print-model-select').onchange=safe(async event=>{const file=models.find(f=>f.id===event.target.value);if(!file)return;assignPrintModel(db,p,file);save();await renderFiles();await refreshCatalogueFileStates();});container.querySelector('#print-model-download').onclick=safe(()=>openPlateModel(p));
 container.querySelectorAll('[data-plate-step]').forEach(button=>button.onclick=safe(async()=>{
  if(recoveryRaw)throw Error('Сначала восстановите базу расчётов');
  const previous=p.plateCapacity;
  p.plateCapacity=Math.max(1,Math.min(100,(previous||1)+Number(button.dataset.plateStep)));
  try { if(await save()===false)throw Error('Не удалось сохранить вместимость'); }
  catch(error){p.plateCapacity=previous;throw error;}
  await renderFiles();await refreshCatalogueFileStates();
 }));
 container.querySelectorAll('[data-file-upload]').forEach(input=>input.onchange=safe(async()=>{if(recoveryRaw)throw Error('Сначала восстановите базу расчётов');input.disabled=true;try{for(const file of input.files){if(file.size>100*1024*1024)throw Error('Максимальный размер одного файла — 100 МБ');const record={id:crypto.randomUUID(),owner,category:input.dataset.fileUpload,name:file.name,createdAt:new Date().toISOString(),blob:file};if(input.dataset.plateQuantity){
  const quantity=Number(input.dataset.plateQuantity);
  if(quantity>(p.plateCapacity||1))throw Error('Количество превышает вместимость пластины');
  if(!/\.(3mf|stl|step|stp|obj|gcode)$/i.test(file.name))throw Error('Выберите файл модели для печати');
  const existing=plateFiles.find(item=>item.plateQuantity===quantity);
  await putFile({...record,id:existing?.id||record.id,plateQuantity:quantity});
 }else if(record.category==='model')await replacePrintModel(db,p,record,save);else await putFile(record);}toast(input.dataset.plateQuantity?'Модель для '+input.dataset.plateQuantity+' шт. сохранена.':input.dataset.fileUpload==='model'?'Модель заменена. Старый файл удалён из этого товара.':'Файлы сохранены на этом устройстве');}finally{await renderFiles();await refreshCatalogueFileStates();}}));
 document.querySelectorAll('.product-files [data-file-download]').forEach(button=>button.onclick=safe(async()=>{const f=await getFile(button.dataset.fileDownload);if(!f||f.owner!==owner)throw Error('Файл не найден');let blob=f.blob;if(f.category==='card-design'){try{blob=await normalizeZipNames(f.blob);if(blob!==f.blob)await putFile({...f,blob});}catch(error){toast(error.message);}}await downloadBlob(blob,f.name);}));
 document.querySelectorAll('.product-files [data-file-delete]').forEach(button=>button.onclick=safe(async()=>{const f=await getFile(button.dataset.fileDelete);if(!f||f.owner!==owner)return;if(!await confirm('Удалить файл «'+f.name+'» с этого устройства? Скачайте копию перед удалением.'))return;await deleteFile(f.id);for(const q of db.products)if(q.printModel?.fileId===f.id)delete q.printModel;save();await renderFiles();await refreshCatalogueFileStates();}));
 async function exportFiles(category){const chosen=(await listFiles(owner)).filter(f=>!category||f.category===category);const entries=chosen.map((f,i)=>({name:f.category+'/'+String(i+1).padStart(3,'0')+'-'+safeFilename(f.name),blob:f.blob}));entries.push({name:'Товар.json',blob:new Blob([JSON.stringify({name:p.name,sku:p.sku,colorCode:p.colorCode,filamentSlots:p.filamentSlots,variantNote:p.variantNote,productGroup:p.productGroup,exportedAt:new Date().toISOString(),files:chosen.map(f=>({name:f.name,category:f.category,createdAt:f.createdAt}))},null,2)])});downloadBlob(await makeZip(entries),safeFilename(p.sku||p.name)+'-'+(category||'all')+'.zip');}
 container.querySelectorAll('[data-file-zip]').forEach(button=>button.onclick=safe(()=>exportFiles(button.dataset.fileZip)));
 $('#all-product-files').onclick=safe(()=>exportFiles());
 }catch(e){if(container=== $('#product-files'))container.textContent='Не удалось открыть хранилище файлов: '+e.message;}
}
let productQuery='',productPage=0,productGroupFilter='',productCategoryFilters={wb:'',ozon:''};
const productPageSize=20,productGroupOpen=new Map(),cataloguePresenceFilters={wb:'',ozon:'',label:'',model:''},catalogueModelStates=new Map();
function catalogueFileActions(p){const hasLabel=!!p.labelPdf?.data?.startsWith('data:application/pdf;base64,');return `<span class="catalogue-product-actions"><button type="button" data-catalogue-label-print="${esc(p.id)}" ${hasLabel?'':'disabled'} title="${hasLabel?'Открыть PDF этикетки этого варианта':'Прикрепите PDF этикетки в карточке товара'}" aria-label="Печать этикетки"><span class="catalogue-print-full">Печать этикетки</span><span class="catalogue-print-compact" aria-hidden="true">Этикетка</span></button><button type="button" data-catalogue-model-download="${esc(p.id)}" disabled title="Проверяем сохранённую модель" aria-label="Печать модели"><span class="catalogue-print-full">Печать модели</span><span class="catalogue-print-compact" aria-hidden="true">Модель</span></button></span>`;}
function catalogueStatusBadges(p){const badge=(label,state)=>`<span class="catalogue-status ${state===true?'is-ready':state===false?'is-missing':'is-unknown'}" title="${esc(label)}: ${state===true?'есть':state===false?'нет':'нет сохранённых сведений; нажмите Обновить'}">${esc(label)} <b>${state===true?'✓':state===false?'—':'?'}</b></span>`;return `<span class="catalogue-statuses">${badge('WB',catalogueCardPresence(db,p,'wb'))}${badge('Ozon',catalogueCardPresence(db,p,'ozon'))}${badge('Этикетка',!!p.labelPdf?.data?.startsWith('data:application/pdf;base64,'))}<span data-catalogue-model="${esc(p.id)}" class="catalogue-status is-unknown">Модель …</span></span>`;}
async function hydrateCatalogueModels(scope=document){await modelMigration.catch(()=>{});for(const badge of scope.querySelectorAll('[data-catalogue-model]')){const target=db.products.find(p=>p.id===badge.dataset.catalogueModel);if(!target)continue;let ready=false;try{ready=(await plateModels(db,target)).size>0;}catch{}catalogueModelStates.set(db.id+':'+target.id,ready);if(!badge.isConnected)continue;badge.className='catalogue-status '+(ready?'is-ready':'is-missing');badge.textContent='Модель '+(ready?'✓':'—');badge.title=ready?'Модель для печати прикреплена':'Модель для печати не выбрана';const action=badge.closest('.catalogue-product-row')?.querySelector('[data-catalogue-model-download]');if(action){action.disabled=!ready;action.title=ready?'Печать модели этого варианта':'Прикрепите или выберите модель в карточке товара';}}}
async function loadCatalogueModelStates(){await modelMigration.catch(()=>{});const database=db;await Promise.all(database.products.map(async p=>{let ready=false;try{ready=(await plateModels(database,p)).size>0;}catch{}catalogueModelStates.set(database.id+':'+p.id,ready);}));}
async function refreshCatalogueFileStates(){if(cataloguePresenceFilters.model){await loadCatalogueModelStates();$('#product-list').innerHTML=productList(product());bindProductList();}else hydrateCatalogueModels($('#product-list'));}
function cataloguePresenceControls(){return `<div class="catalogue-presence-filters">${[['wb','Карточка WB'],['ozon','Карточка Ozon'],['label','Этикетка'],['model','Модель']].map(([key,label])=>`<label>${label}<select data-catalogue-presence="${key}"><option value="">Все</option><option value="yes" ${cataloguePresenceFilters[key]==='yes'?'selected':''}>Есть</option><option value="no" ${cataloguePresenceFilters[key]==='no'?'selected':''}>Нет</option>${['wb','ozon'].includes(key)?`<option value="unknown" ${cataloguePresenceFilters[key]==='unknown'?'selected':''}>Не проверено</option>`:''}</select></label>`).join('')}</div><small class="catalogue-file-filter-status" role="status"></small>`;}
function openCatalogueGroupPicker(){const dialog=document.createElement('dialog');dialog.className='catalogue-group-picker';dialog.setAttribute('aria-labelledby','catalogue-group-picker-title');const groups=[...new Set(catalogueProductBatches(db.products).flat().map(p=>p.productGroup||'__ungrouped__'))];dialog.innerHTML=`<header><div><small>МОИ ТОВАРЫ</small><h2 id="catalogue-group-picker-title">Выберите группу</h2></div><button type="button" data-group-picker-close aria-label="Закрыть выбор группы">×</button></header><input type="search" data-group-picker-search placeholder="Название группы или артикул" aria-label="Поиск группы"><div class="catalogue-group-choices"></div>`;const draw=()=>{const query=dialog.querySelector('[data-group-picker-search]').value.trim().toLocaleLowerCase('ru');dialog.querySelector('.catalogue-group-choices').innerHTML=[['','Все группы',db.products],...groups.map(key=>[key,key==='__ungrouped__'?'Без группы':key,db.products.filter(p=>(p.productGroup||'__ungrouped__')===key)])].filter(([key,name,products])=>!query||[name,...products.map(p=>p.sku)].join(' ').toLocaleLowerCase('ru').includes(query)).map(([key,name,products])=>`<button type="button" data-pick-catalogue-group="${esc(key)}" class="catalogue-group-choice ${key===productGroupFilter?'is-selected':''}" aria-pressed="${key===productGroupFilter}">${key?`<img data-product-image="${esc(products[0].id)}" alt="" hidden>`:'<span class="catalogue-group-all-icon">▦</span>'}<span><strong>${esc(name)}</strong><small>${products.length} ${{one:'товар',few:'товара',many:'товаров',other:'товара'}[new Intl.PluralRules('ru').select(products.length)]}</small></span><b aria-hidden="true">${key===productGroupFilter?'✓':'›'}</b></button>`).join('')||'<p>Группы не найдены</p>';hydrateProductImages(dialog);};document.body.append(dialog);draw();dialog.querySelector('[data-group-picker-search]').oninput=draw;dialog.querySelector('[data-group-picker-close]').onclick=()=>dialog.close();dialog.onclick=event=>{const button=event.target.closest('[data-pick-catalogue-group]');if(button){const input=$('#catalogue-group-filter');input.value=button.dataset.pickCatalogueGroup;input.dispatchEvent(new window.Event('change'));dialog.close();}else if(event.target===dialog)dialog.close();};dialog.addEventListener('close',()=>{dialog.remove();hydrateProductImages($('#product-list'));document.querySelector('[data-catalogue-group-picker]')?.focus({preventScroll:true});},{once:true});dialog.showModal();}
function catalogueCategoryOptions(market){const categories=new Map();for(const p of db.products){if(productGroupFilter&&(p.productGroup||'__ungrouped__')!==productGroupFilter)continue;const category=categoriesFromProduct(p)[market];if(category)categories.set(category.id+':'+(category.typeId||''),category.label);}return `<option value="">Все категории</option><option value="__none__" ${productCategoryFilters[market]==='__none__'?'selected':''}>Без категории</option>${[...categories].sort((a,b)=>a[1].localeCompare(b[1],'ru')).map(([key,label])=>`<option value="${esc(key)}" ${productCategoryFilters[market]===key?'selected':''}>${esc(label)}</option>`).join('')}`;}
function catalogueCategoryMatches(p){const categories=categoriesFromProduct(p);return ['wb','ozon'].every(market=>{const filter=productCategoryFilters[market],category=categories[market];return !filter||(filter==='__none__'?!category:category&&category.id+':'+(category.typeId||'')===filter);});}
function catalogueFilterControls(){return `<button type="button" id="catalogue-refresh" class="catalogue-refresh" ${catalogueRefreshBusy?'disabled':''}>↻ Обновить карточки WB / Ozon</button><small id="catalogue-refresh-status" class="catalogue-refresh-status" role="status">По сохранённым данным · ? — ещё не проверено</small><div class="catalogue-filter-panel"><div class="catalogue-filters"><label>Группа<input type="hidden" id="catalogue-group-filter" value="${esc(productGroupFilter)}"><button type="button" data-catalogue-group-picker aria-haspopup="dialog"><span>${esc(productGroupFilter==='__ungrouped__'?'Без группы':productGroupFilter||'Все группы')}</span><b aria-hidden="true">⌄</b></button></label>${['ozon','wb'].map(market=>`<label>Категория ${market==='wb'?'WB':'Ozon'}<select class="ui-select" data-catalogue-category="${market}">${catalogueCategoryOptions(market)}</select></label>`).join('')}</div>${cataloguePresenceControls()}<div class="catalogue-group-actions"><button type="button" data-catalogue-collapse>Свернуть все</button><button type="button" data-catalogue-expand>Развернуть все</button><button type="button" data-catalogue-reset>Сбросить фильтры</button></div></div>`;}
function productList(p){
 const query=productQuery.trim().toLocaleLowerCase('ru'),matches=db.products.filter(q=>(!productGroupFilter||(productGroupFilter==='__ungrouped__'?!q.productGroup:q.productGroup===productGroupFilter))&&catalogueCategoryMatches(q)&&catalogueStatusMatches(db,q,cataloguePresenceFilters,catalogueModelStates.get(db.id+':'+q.id)??null)&&[q.name,q.sku,q.productGroup,q.variantNote,q.colorCode].filter(Boolean).join(' ').toLocaleLowerCase('ru').includes(query));
 const groupedPages=catalogueProductBatches(matches,productPageSize),pages=groupedPages.length;productPage=Math.min(productPage,pages-1);
 const visible=groupedPages.slice(0,productPage+1).flat(),offset=0,names=[...new Set(visible.map(q=>q.productGroup||''))];
 return `<div class="product-list-count">${matches.length?'Показано '+(offset+1)+'–'+(offset+visible.length):'Ничего не найдено'} · всего ${matches.length}</div>`+names.map(name=>`<details class="product-group" data-group="${esc(name)}" ${query||productGroupOpen.get(name)!==false?'open':''}><summary>${esc(name||'Без группы')} <small>${matches.filter(q=>(q.productGroup||'')===name).length}</small></summary>${visible.filter(q=>(q.productGroup||'')===name).map(q=>`<div class="catalogue-product-row"><button type="button" class="product ${q.id===p.id?'chosen':''}" data-product="${esc(q.id)}" title="${esc([q.sku,q.name,q.variantNote,q.colorCode].filter(Boolean).join(' · '))}" ${q.id===p.id?'aria-current="true"':''}><img class="product-list-image" data-product-image="${esc(q.id)}" alt="" hidden><span class="product-label"><span class="sku-with-copy"><strong class="product-sku">${esc(q.sku||'Без артикула')}</strong>${skuCopyButton(q.sku)}</span><small class="product-name">${esc(q.name)}</small>${q.variantNote||q.colorCode?`<small>${esc([q.variantNote,q.colorCode].filter(Boolean).join(' · '))}</small>`:''}<span class="catalogue-profit-summary" data-product-profit-summary>${profitSummary(q)}</span>${catalogueStatusBadges(q)}</span></button>${catalogueFileActions(q)}</div>`).join('')}</details>`).join('')+`<div class="catalogue-scroll-status" ${productPage<pages-1?'data-catalogue-more':''}>${productPage<pages-1?'Прокрутите ниже — подгрузятся следующие товары':matches.length?'Все товары загружены':''}</div>`;
}
function appendCatalogueBatch(list){
 if(!list.isConnected||!list.querySelector('[data-catalogue-more]'))return;
 const scroller=list.closest('.product-catalogue');const top=scroller.scrollTop;productPage++;const staging=document.createElement('div');staging.innerHTML=productList(product());
 list.querySelector('.product-list-count').textContent=staging.querySelector('.product-list-count').textContent;
 const marker=list.querySelector('.catalogue-scroll-status');
 for(const group of staging.querySelectorAll('details[data-group]')){const existing=[...list.querySelectorAll('details[data-group]')].find(node=>node.dataset.group===group.dataset.group);if(!existing)marker.before(group);else{const ids=new Set([...existing.querySelectorAll('[data-product]')].map(node=>node.dataset.product));for(const row of group.querySelectorAll('[data-product]'))if(!ids.has(row.dataset.product))existing.append(row.closest('.catalogue-product-row')||row);}}
 marker.replaceWith(staging.querySelector('.catalogue-scroll-status'));scroller.scrollTop=top;bindProductList();
}
function bindProductList(){
 const list=$('#product-list');hydrateProductImages(list);hydrateCatalogueModels(list);
 const scroller=list.closest('.product-catalogue');
 const loadNearEnd=()=>{if(list.isConnected&&scroller.clientHeight>0&&scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<240)appendCatalogueBatch(list);};
 scroller.onscroll=loadNearEnd;
 list.onclick=async e=>{const action=e.target.closest('[data-catalogue-label-print],[data-catalogue-model-download]');if(action){if(action.disabled)return;const target=db.products.find(product=>product.id===(action.dataset.catalogueLabelPrint||action.dataset.catalogueModelDownload));if(!target)return;try{if(action.hasAttribute('data-catalogue-label-print'))await printProductLabel(target.labelPdf,{open:url=>window.open(url,'_blank'),notify:toast});else{action.disabled=true;action.textContent='Готовим…';try{await modelMigration.catch(()=>{});await openPlateModel(target);}finally{action.disabled=false;action.textContent='Печать модели';}}}catch(error){toast(error.message);}return;}const item=e.target.closest('[data-product]');if(item)selectSidebarProduct(item.dataset.product);};
 list.querySelectorAll('[data-group]').forEach(group=>group.ontoggle=()=>{if(group.isConnected&&!productQuery.trim())productGroupOpen.set(group.dataset.group,group.open);window.requestAnimationFrame?.(loadNearEnd);});
 window.requestAnimationFrame?.(loadNearEnd);
}

function restoreSharedEdits(target,market,draft){const patch=target.sharedListingChanges?.[market];if(!patch)return;if(sharedListingChangesApplied(market,draft,patch))delete target.sharedListingChanges[market];else applySharedListingChanges(market,draft,patch);}
function revealCatalogueProduct(id){
 const list=$('#product-list'),scroller=list.closest('.product-catalogue');
 if(!scroller.getClientRects().length){
  const select=$('#mobile-product');
  select.focus();
  select.scrollIntoView?.({block:'nearest'});
  return;
 }
 const find=()=>list.querySelector(`[data-product="${CSS.escape(id)}"]`);
 const load=()=>{
  let row=find();
  while(!row&&list.querySelector('[data-catalogue-more]')){
   appendCatalogueBatch(list);
   row=find();
  }
  return row;
 };
 let row=load();
 if(!row){
  $('[data-catalogue-reset]').click();
  row=load();
 }
 if(!row)return;
 row.closest('details').open=true;
 row.focus({preventScroll:true});
 scroller.scrollTop+=row.getBoundingClientRect().top-scroller.getBoundingClientRect().top;
}
function selectSidebarProduct(id){const sidebarTop=$('.product-catalogue')?.scrollTop||0,pageTop=window.scrollY||0,pageLeft=window.scrollX||0,height=$('main')?.getBoundingClientRect().height||0;selected=id;render({preserveCatalogue:true});const main=$('main');main.style.minHeight=height+'px';const restore=()=>{if(main!==$('main'))return;$('.product-catalogue').scrollTop=sidebarTop;window.scrollTo?.({top:pageTop,left:pageLeft,behavior:'instant'});};const item=[...document.querySelectorAll('[data-product]')].find(button=>button.dataset.product===id);item?.focus({preventScroll:true});restore();window.requestAnimationFrame?.(restore);}

let appZoom=100;try{const savedZoom=Number(localStorage.getItem('workshop-ui-zoom'));if(savedZoom>=60&&savedZoom<=160)appZoom=savedZoom;}catch{}
function applyAppZoom(){document.documentElement.style.zoom=String(appZoom/100);try{localStorage.setItem('workshop-ui-zoom',String(appZoom));}catch{}const value=document.querySelector('#app-zoom-reset');if(value)value.textContent=appZoom+'%';window.dispatchEvent(new window.Event('workshop:zoom'));}
const confirm=message=>confirmAction(message,{title:/^Заполнить текущий товар/.test(message)?'Применить шаблон к товару?':/^Удалить/.test(message)?'Подтвердите удаление':/^Очистить/.test(message)?'Очистить историю?':'Подтвердите действие',accept:/^Заполнить текущий товар/.test(message)?'Применить шаблон':/^Удалить/.test(message)?'Удалить':/^Обновить шаблон/.test(message)?'Обновить шаблон':/^Очистить/.test(message)?'Очистить историю':'Продолжить'});
function descriptionEditor(p,context){const source=savedListingDescription(db.products,p.sku);return `<section class="product-description-editor"><div class="description-editor-head"><label for="description-${context}">Описание товара</label><div class="description-prompt-actions"><button type="button" data-description-prompt>${actionIcon('sparkles')}<span>Промпт для ИИ</span></button><button type="button" data-description-pull ${source?'':'disabled'} title="${source?'Из сохранённой карточки '+(source.market==='wb'?'Wildberries':'Ozon'):'Сначала загрузите карточку товара в разделе «Карточки WB / Ozon»'}">${actionIcon('download')}<span>Подтянуть из карточки</span></button></div></div><textarea id="description-${context}" data-product-description rows="5" placeholder="Описание товара, особенности и примечания">${esc(p.description||'')}</textarea><small class="description-character-count" data-description-count>${Array.from(p.description||'').length.toLocaleString('ru-RU')} символов · с пробелами и переносами строк</small><small data-description-status>${source?'Доступно описание из '+(source.market==='wb'?'Wildberries':'Ozon'):'Описание можно заполнить вручную или загрузить из сохранённой карточки.'}</small></section>`;}
function bindDescriptions(){const p=product();document.querySelectorAll('[data-description-prompt]').forEach(button=>button.onclick=()=>openLabelPrompt('description'));document.querySelectorAll('[data-product-description]').forEach(input=>input.oninput=()=>{const raw=input.value,text=normalizeDescriptionBreaks(raw);if(text!==raw){const start=normalizeDescriptionBreaks(raw.slice(0,input.selectionStart)).length,end=normalizeDescriptionBreaks(raw.slice(0,input.selectionEnd)).length;input.value=text;input.setSelectionRange(start,end);}p.description=text;for(const count of document.querySelectorAll('[data-description-count]'))count.textContent=Array.from(text).length.toLocaleString('ru-RU')+' символов · с пробелами и переносами строк';for(const other of document.querySelectorAll('[data-product-description]'))if(other!==input)other.value=input.value;save();});document.querySelectorAll('[data-description-pull]').forEach(button=>button.onclick=()=>{const source=savedListingDescription(db.products,p.sku);if(!source)return;p.description=source.description;for(const count of document.querySelectorAll('[data-description-count]'))count.textContent=Array.from(p.description).length.toLocaleString('ru-RU')+' символов · с пробелами и переносами строк';for(const input of document.querySelectorAll('[data-product-description]'))input.value=p.description;save();for(const status of document.querySelectorAll('[data-description-status]'))status.textContent='Описание загружено из '+(source.market==='wb'?'Wildberries':'Ozon')+'.';});}
function render({preserveCatalogue=false}={}){
 const sidebarScrollTop=$('.sidebar')?.scrollTop||0;
 const sidebarRecent=$('.sidebar [data-working-recent]');
 const sidebarFolder=$('.sidebar [data-working-folder]');
 const navScrollTop=$('.workspace-nav')?.scrollTop||0;
 const focusedNav=document.activeElement?.closest('.workspace-nav [data-space]')?.dataset.space;
 disposeTopRefresh();const preservedCatalogue=preserveCatalogue?$('.side-products'):null;workspaceHistory.visit({space,selected});const sidebarScroll=$('.product-catalogue')?.scrollTop||0;disposePrices();disposePrices=()=>{};disposeListingEditor();const p=product();ensureMarketplaces(p);$('#app').innerHTML=`<aside class="sidebar"><a class="brand" href="./"><span class="brand-icon">▦</span> Мастерская</a><div class="release-version-row"><span class="version">v${APP_VERSION}</span><button type="button" id="release-history" class="release-history-button">История</button></div><nav class="workspace-nav" aria-label="Рабочее пространство"><div class="workspace-nav-group"><p class="nav-label">СКЛАД</p><button class="nav ${space==='cost'?'active':''}" data-space="cost"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16"/></svg></span><span>Себестоимость</span></button><button class="nav ${space==='filament'?'active':''}" data-space="filament"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg></span><span>Остатки филамента</span></button><button class="nav ${space==='print-queue'?'active':''}" data-space="print-queue"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6z"/></svg></span><span>Очередь печати</span></button></div><div class="workspace-nav-group"><p class="nav-label">МАРКЕТПЛЕЙС</p><button class="nav ${space==='cards'?'active':''}" data-space="cards"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h6"/></svg></span><span>Карточки WB / Ozon</span></button><button class="nav ${space==='sales'?'active':''}" data-space="sales"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21V3h5a5 5 0 0 1 0 10H5m0 4h11"/></svg></span><span>Продажи</span></button><button class="nav ${space==='finance'?'active':''}" data-space="finance"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18M7 17v-4m5 4V9m5 8V5"/></svg></span><span>Финансы</span></button><button class="nav ${space==='expenses'?'active':''}" data-space="expenses"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 7h6M9 11h6M9 15h3"/></svg></span><span>Затраты</span></button><button class="nav ${space==='prices'?'active':''}" data-space="prices"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="8" cy="8" r="1"/></svg></span><span>Цены WB / Ozon</span></button><button class="nav ${space==='stocks'?'active':''}" data-space="stocks"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg></span><span>Остатки WB / Ozon</span></button><button class="nav ${space==='api'?'active':''}" data-space="api"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="9" r="5"/><path d="m12 13 8 8m-3-3 3-3m-6 0 3-3"/></svg></span><span>API и доступы</span></button></div><div class="workspace-nav-group workspace-backup"><button class="nav ${space==='backup'?'active':''}" data-space="backup"><span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg></span><span>Бэкап</span></button></div></nav><div class="side-products"><div class="list-title">Мои товары <button id="add-product" aria-label="Добавить товар">+</button></div><button type="button" class="catalogue-cost-report" id="cost-report-pdf" title="Открыть PDF себестоимости всех товаров">↗ PDF себестоимости</button><input id="product-search" type="search" placeholder="Название или артикул" aria-label="Поиск товаров" value="${esc(productQuery)}">${catalogueFilterControls()}<div class="product-list" id="product-list">${productList(p)}</div></div><div class="side-bottom"><button type="button" data-working-folder>Папка label / model</button><div data-working-recent></div><div class="app-zoom" role="group" aria-label="Масштаб приложения"><button type="button" id="app-zoom-out" aria-label="Уменьшить масштаб">−</button><button type="button" id="app-zoom-reset" title="Сбросить масштаб до 100%">${appZoom}%</button><button type="button" id="app-zoom-in" aria-label="Увеличить масштаб">+</button></div><span class="online-dot"></span> <span id="network">${navigator.onLine?'Онлайн':'Офлайн'}</span><p>Расчёты автоматически сохраняются в этом браузере.<br>Для резервной копии скачайте полный ZIP.</p><button id="install" ${installPrompt?'':'hidden'}>Установить приложение</button></div></aside><main data-workspace="${space}"><header class="app-header"><label class="mobile-workspace">Раздел<select id="workspace-select"><option value="cost" ${space==='cost'?'selected':''}>Себестоимость</option><option value="cards" ${space==='cards'?'selected':''}>Карточки WB / Ozon</option><option value="sales" ${space==='sales'?'selected':''}>Продажи</option><option value="finance" ${space==='finance'?'selected':''}>Финансы</option><option value="expenses" ${space==='expenses'?'selected':''}>Затраты</option><option value="prices" ${space==='prices'?'selected':''}>Цены WB / Ozon</option><option value="stocks" ${space==='stocks'?'selected':''}>Остатки WB / Ozon</option><option value="print-queue" ${space==='print-queue'?'selected':''}>Очередь печати</option><option value="filament" ${space==='filament'?'selected':''}>Остатки филамента</option><option value="api" ${space==='api'?'selected':''}>API и доступы</option><option value="backup" ${space==='backup'?'selected':''}>Бэкап</option></select></label><div class="workspace-history-controls"><button type="button" id="workspace-back" ${workspaceHistory.canBack?'':'disabled'}>← Назад</button><button type="button" id="workspace-forward" ${workspaceHistory.canForward?'':'disabled'}>Вперёд →</button>${space==='print-queue'?'<button type="button" id="queue-sort-printing">Сортировать по печати</button>':''}</div><div class="header-actions"><span class="app-version" aria-label="Версия приложения">v${APP_VERSION}</span><span id="saved">${savePending?'Сохраняю на устройстве…':saveError?'Ошибка сохранения! Скачайте копию':'Сохранено на устройстве · IndexedDB'}</span></div></header>${recoveryRaw?'<div class="result-warning">Сохранённая база повреждена. Она сохранена без изменений. Скачайте её через «Экспорт базы» и загрузите резервную копию.</div>':''}<div class="result-warning" data-webdav-issue hidden><span role="status"></span> <button type="button" hidden>Открыть бэкап</button></div><section class="heading"><div><div class="eyebrow">${space==='backup'?'ДАННЫЕ ПРИЛОЖЕНИЯ':space==='api'?'ОБЩЕЕ ПОДКЛЮЧЕНИЕ':space==='prices'?'ЦЕНЫ ТОВАРОВ':space==='stocks'?'СКЛАДСКИЕ ОСТАТКИ':space==='filament'?'ЗАПАСЫ МАТЕРИАЛОВ':space==='sales'?'УЧЁТ ПРОДАЖ':space==='cards'?'УПРАВЛЕНИЕ КАРТОЧКАМИ':'ЭКОНОМИКА ТОВАРА'}</div><h1>${space==='backup'?'Бэкап':space==='api'?'API и доступы':space==='prices'?'Цены WB / Ozon':space==='stocks'?'Остатки WB / Ozon':space==='filament'?'Остатки филамента':space==='sales'?'Заказы и продажи':esc(p.name)}</h1><p>${space==='backup'?'Резервные копии, восстановление и синхронизация.':space==='api'?'Ключи и права доступа для всех разделов приложения.':space==='prices'?'Загрузка и изменение цен продавца на площадках.':space==='stocks'?'Доступные остатки и товары в пути по складам площадок.':space==='filament'?'Нераспакованные мотки по кодам цвета.':space==='sales'?'Заказы, товары и статусы WB и Ozon · только чтение.':space==='cards'?'Подключение к площадкам, черновики и редактирование карточек.':'От грамма пластика до прибыли с продажи.'}</p></div><div class="heading-actions"><button class="cost-only" id="snapshot">Сохранить расчёт</button></div></section><div class="mobile-products"><select id="mobile-product" aria-label="Выбрать товар">${db.products.map(q=>`<option value="${esc(q.id)}" ${q.id===p.id?'selected':''}>${esc([q.productGroup,q.name,q.variantNote||q.colorCode].filter(Boolean).join(' · '))}</option>`).join('')}</select><button id="mobile-add">+ Товар</button></div><section class="panel template-bar cost-only"><h2>Шаблоны настроек расчёта</h2><p>Один раз заполните расходы и параметры печати, сохраните их в шаблон и используйте для других товаров.</p><div class="template-controls"><div class="template-create-controls"><h3>1. Сохранить настройки текущего товара</h3><p>Сначала заполните расчёт ниже. Затем задайте имя и сохраните его настройки для повторного использования.</p><label>Название шаблона<input id="template-name" placeholder="Например, PLA · подставки"></label><button id="template-save">Сохранить настройки в шаблон</button><small>В шаблон войдут расходы, параметры печати, цены, суммы к переводу и налоги WB / Ozon.</small></div><div class="template-use-controls"><h3>2. Заполнить товар из шаблона</h3><p>Откройте нужный товар слева, выберите сохранённый шаблон и нажмите «Применить к этому товару».</p>${db.templates.length?'':'<div class="template-empty">Шаблонов пока нет. Создайте первый в блоке слева, используя заполненный расчёт.</div>'}<label>Сохранённый шаблон<select id="template-select" ${db.templates.length?'':'disabled'}><option value="">${db.templates.length?'Выберите шаблон':'Сначала сохраните шаблон'}</option>${db.templates.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label><button id="template-apply" disabled>Применить к этому товару</button><small>Заменит настройки текущего расчёта. Название, номер варианта, цвет, артикул, штрихкод, файлы и история товара сохранятся.</small><details class="template-manage"><summary>Управление выбранным шаблоном</summary><p>Изменить сохранённый шаблон можно после его выбора. «Обновить» запишет в него настройки текущего товара.</p><div><button id="template-rename" disabled>Переименовать</button><button id="template-update" disabled>Обновить настройками этого товара</button><button id="template-delete" disabled>Удалить шаблон</button></div></details></div></div></section><section class="panel product-stock-targets cost-only"><h2>Нормы остатков на маркетплейсах</h2><p>Если доступный остаток меньше или равен минимальному, в разделе «Остатки WB / Ozon» появится количество для допечатки до нормального остатка. Пустые поля отключают расчёт.</p><div class="stock-target-fields">${['wb','ozon'].map(market=>`<fieldset><legend>${market==='wb'?'Wildberries':'Ozon'}</legend>${[['minimum','Минимальный остаток, шт.'],['normal','Нормальный остаток, шт.']].map(([key,label])=>`<label>${label}<input data-buttons-only type="number" min="0" max="1000000" step="1" data-stock-market="${market}" data-stock-key="${key}" value="${p.stockTargets?.[market]?.[key]??''}"></label>`).join('')}<small data-stock-target-help="${market}"></small></fieldset>`).join('')}</div></section><div class="workspace cost-only"><section class="editor panel"><div class="tabs cost-editor-tabs" role="tablist" aria-label="Разделы себестоимости">${editorGroups.map(([k,title])=>`<button role="tab" aria-selected="${tab===k}" class="${tab===k?'selected':''}" data-tab="${k}">${title}</button>`).join('')}</div><section class="identity panel cost-only" ${space==='cards'||tab!=='important'?'hidden':''}><div class="product-name-variant"><label>Название товара<input id="name" value="${esc(p.name)}"></label><label>Номер варианта<input id="variantNumber" value="${esc(p.variantNumber||'')}" placeholder="Форма №" inputmode="numeric"></label></div>${descriptionEditor(p,'identity')}<div class="identity-group-block"><label class="identity-group">Группа товаров<input id="productGroup" list="product-groups" value="${esc(p.productGroup||'')}" placeholder="Например, Подставки Apple Watch"><datalist id="product-groups">${[...new Set(db.products.map(q=>q.productGroup).filter(Boolean))].map(g=>`<option value="${esc(g)}"></option>`).join('')}</datalist></label><fieldset class="identity-group-actions label-prompt-actions"><legend>Промпты для этикеток</legend><div><button type="button" id="label-design-prompt">${actionIcon('label')}<span>Для этого товара</span></button><button type="button" id="label-group-prompt">${actionIcon('labels')}<span>Для всей группы</span></button></div></fieldset></div><div class="variant-controls"><label>Отличия варианта<span class="variant-color-field"><input id="variantNote" value="${esc(p.variantNote||'')}" placeholder="Выберите цвет или введите вручную"><button type="button" id="variant-color-pick" title="Выбрать цвет" aria-label="Выбрать цвет">${actionIcon('edit')}</button></span></label><button id="duplicate">Создать вариант</button></div><label class="identity-sku">Артикул ${skuCopyButton(p.sku)}<input id="sku" value="${esc(p.sku)}" placeholder="Например, AW-01"></label><label class="identity-barcode"><span class="barcode-label-row">Штрихкод<button type="button" class="barcode-pull-button" data-barcode-pull title="Подтянуть штрихкод из карточки" aria-label="Подтянуть штрихкод из карточки">${actionIcon('download')}</button><small data-barcode-status role="status"></small></span><input id="barcode" value="${esc(p.barcode||'')}" inputmode="numeric" placeholder="Введите штрихкод"></label><button class="danger-link cost-only" id="delete-product">Удалить этот вариант</button></section><div id="fields"></div></section><section class="summary panel"><div class="summary-head"><span>Результат на изделие</span><span class="pill">План</span></div><div id="results"></div>${marketplaceProfitEditor(p)}</section></div><section class="finance-only" id="finance-workspace"></section><section class="expenses-only" id="expenses-workspace"></section><section class="filament-only" id="filament-workspace"></section><section class="sales-only" id="sales-workspace"></section><section class="queue-only" id="print-queue-workspace"></section><section class="prices-only" id="prices-workspace"></section><section class="stocks-only" id="stocks-workspace"></section><section class="panel marketplace-api cards-only" id="marketplace-api"></section><section class="panel product-files"><div class="product-files-head"><h2>Файлы товара</h2><button type="button" id="all-product-files" disabled>Скачать все файлы товара ZIP</button></div><p>Модель для печати, этикетка и материалы для оформления карточки хранятся в этом браузере. Кнопка «Скачать ZIP выбранного режима» в разделе «Бэкап» сохраняет базу и все файлы всех товаров. На другом устройстве выберите «Бэкап → Восстановить из ZIP». Обычный JSON не включает файлы. При очистке данных сайта локальные файлы могут быть удалены.</p><div class="product-file-columns"><div class="product-file-label-column cost-only"><fieldset class="packaging-group product-label-panel cost-only"><legend>Этикетка товара</legend><p class="group-hint">PDF для этого артикула. Печать доступна также в остатках рядом с количеством для допечатки.</p><div class="label-panel-layout"><div class="label-pdf-controls"><label class="file-button">${p.labelPdf?'Заменить PDF этикетки':'Добавить PDF этикетки'}<input id="label-pdf-file" type="file" accept="application/pdf,.pdf" hidden></label><span class="label-primary-actions"><button id="label-print" ${p.labelPdf?'':'disabled'}>Печать этикетки</button><button type="button" class="ai-prompt-button label-prompt-action" id="label-file-prompt" title="Промпт для одной этикетки" aria-label="Промпт для одной этикетки">${actionIcon('sparkles')}<span>Промпт для этикетки</span></button></span><small>${esc(p.labelPdf?.name||'Этикетка ещё не загружена')}</small></div><div id="label-thumbnail" class="label-thumbnail" hidden></div></div></fieldset><fieldset class="packaging-group card-design-panel"><legend>Файлы для оформления карточки</legend><p class="group-hint">Выберите фотографии, исходники, тексты и другие материалы. Приложение сохранит их одним ZIP. Архив переносится в полном бэкапе и в режиме «Только себестоимость». До 100 МБ на файл и 500 МБ на подборку.</p><div id="card-design-files"></div></fieldset></div><div id="product-files"></div></div></section><section class="panel full-calculation cost-only" id="full-calculation"></section><section class="panel more cost-only"><h2>Дополнительные статьи</h2><p>Добавляйте затраты в рублях на изделие. Удержания площадок здесь вводить не нужно: они уже учтены в сумме к переводу.</p><div id="custom"></div><button id="add-custom">+ Добавить расход</button></section><section class="panel history cost-only"><div class="saved-history-heading"><h2>Сохранённые расчёты</h2><button type="button" id="clear-history">Очистить историю</button></div><p>Текущее заполнение сохраняется автоматически в этом браузере на этом устройстве. Кнопка «Сохранить расчёт» добавляет снимок в историю товара ниже. «Полный экспорт ZIP» скачивает базу и все файлы всех товаров, включая модели и исходники. Облачное сохранение работает только после отдельной настройки в разделе «Данные и синхронизация».</p><div id="history"></div></section><footer>Мастерская · Первая версия <span>Все тарифы и допущения можно изменить</span></footer></main><dialog id="sync"><div class="modal-head"><h2>Данные и синхронизация</h2><button id="sync-close" aria-label="Закрыть">×</button></div><p>Восстановите базу из файла или подключите Облако Mail.</p><div class="sync-actions backup-quick-actions"><button type="button" id="backup-restore-file">Выбрать ZIP для восстановления</button></div><fieldset class="webdav-settings"><legend>Синхронизация через WebDAV</legend>
 <p>Папка <strong>masterskaya_files</strong> создаётся в корне вашего Облака Mail. Распакуйте архив для вашей системы и запустите Workshop-WebDAV на этом компьютере.</p>
 <div class="sync-actions webdav-install"><a class="file-button" href="workshop-webdav-macos.zip?v=${APP_VERSION}" download>Mac с Apple Silicon</a><a class="file-button" href="workshop-webdav-macos-intel.zip?v=${APP_VERSION}" download>Mac с Intel</a><a class="file-button" href="workshop-webdav-windows.zip?v=${APP_VERSION}" download>Windows</a></div>
 <p><a href="${webDavHealthUrl}" target="_blank" rel="noopener noreferrer">Проверить запуск компонента ↗</a>. Если проверка открылась, а приложение не подключается, разрешите локальные подключения в настройках сайта и повторите проверку. При ошибке 403 на странице проверки скачайте свежий компонент.</p>
 <form id="webdav-connection" class="webdav-connection">
  <label>Почта Mail<input id="webdav-account" name="username" type="email" autocomplete="username" required value="${esc(webDavAccount||'')}"></label>
  <label>Пароль приложения<input id="webdav-password" name="password" type="password" autocomplete="off" required></label>
  <div class="sync-actions"><button type="submit" id="webdav-connect">Подключить Облако Mail</button><button type="button" id="webdav-check">Проверить подключение</button></div>
 </form>
 <p>После первого входа компонент берёт доступы из системного хранилища. <a href="https://help.mail.ru/cloud/desktop/webdav/" target="_blank" rel="noopener noreferrer">Как создать пароль приложения ↗</a></p>
 <ol><li>На компьютере с актуальной базой нажмите «Выгрузить всю базу».</li><li>На втором войдите в тот же аккаунт Mail, нажмите «Заменить базу из облака» и подтвердите замену.</li></ol>
 <p>Для первого запуска можно также восстановить базу из полного ZIP ниже. WebDAV переносит товары, файлы, затраты, очередь печати и остатки филамента.</p>
 <p data-webdav-folder role="status"></p>
 <div class="sync-actions"><button type="button" id="webdav-upload">Выгрузить всю базу</button><button type="button" id="webdav-restore">Заменить базу из облака</button><button type="button" data-webdav-run>Синхронизировать сейчас</button></div>
 </fieldset>
 <fieldset class="webdav-settings backup-access-settings"><legend>Зашифрованные доступы</legend>
  <p>Пароль шифрования хранится в Связке ключей macOS или Диспетчере учётных данных Windows. Для восстановления доступов на другом компьютере понадобится этот пароль.</p>
  <div class="sync-actions"><button type="button" id="backup-password">Настроить пароль шифрования</button><button type="button" id="webdav-access-upload">Сохранить доступы в облако</button><button type="button" id="webdav-access-restore">Восстановить доступы из облака</button></div>
  <p data-backup-access-status role="status"></p>
  <label class="backup-option"><input type="checkbox" id="backup-include-access">Включать зашифрованные доступы в полный ZIP</label>
  <p>В файл доступов входят токены WB и Ozon, Ozon Client ID и сохранённый вход в Mail. В облаке это отдельный файл, который обновляется кнопкой выше.</p>
 </fieldset>${renderAppAccessGuide()}<section class="panel working-files-settings"><h3>Рабочая папка для этикетки и модели</h3><p>В Chrome/Edge выберите папку «Загрузки» или отдельную рабочую папку кнопкой ниже. Для Safari установите компонент macOS из следующего блока и выберите папки в установщике. При скачивании из приложения файлы label.pdf и model.3mf / model.stl / model.step заменяются по постоянным именам. Исходные файлы в базе не меняются. Если формат модели изменился, предыдущий файл модели, сохранённый этим приложением, убирается после успешной записи нового.</p><button type="button" data-working-folder>Папка label / model</button><div data-working-recent></div><p>Прямая запись в папку доступна в Chrome и Edge на компьютере. В Safari используйте перенос через компонент macOS — настройка ниже. Браузер может снова запросить доступ после перезапуска или сброса разрешений. Встроенная кнопка скачивания в просмотрщике PDF управляется браузером; для сохранения и открытия используйте «Печать этикетки» в приложении. Старые копии с «(1)» автоматически не удаляются.</p></section>${renderWindowsOpenerSettings()}<section class="panel backup-rules"><h3>Два режима бэкапа</h3><label>Режим выгрузки<select class="ui-select" data-backup-mode><option value="full" ${selectedBackupMode()==='full'?'selected':''}>Полный бэкап</option><option value="costs" ${selectedBackupMode()==='costs'?'selected':''}>Только себестоимость</option></select></label><ul><li><b>Полный бэкап:</b> товары, расчёты, фотографии, этикетки, модели и исходники, шаблоны, история, нормы WB/Ozon, затраты, поступления и свои статьи. При загрузке нормы WB/Ozon заменяются значениями из архива.</li><li><b>Только себестоимость:</b> товары и их расчёты, фотографии, PDF-этикетки, модели, архивы материалов для оформления карточек и шаблоны расчёта. На другом компьютере товары добавляются или обновляются по артикулу; затраты, продажи, цены и остатки площадок, нормы WB/Ozon и остальные местные данные сохраняются.</li><li><b>В обоих режимах также сохраняются размеры, вес и категории WB/Ozon. Не переносятся:</b> очередь печати и её архив, остатки филамента и нормы мотков, токены, API-ключи и пароли в открытом виде. Полный ZIP может включать отдельный зашифрованный файл доступов.</li><li>Выбранный режим применяется к выгрузке ZIP и JSON. При загрузке режим берётся из архива и показывается перед подтверждением. Старые архивы считаются полными.</li><li>Для переноса моделей и фотографий используйте ZIP. JSON содержит данные расчётов и PDF-этикетки, но не файлы моделей.</li></ul></section><h3>Архив с файлами</h3><p>Один ZIP: база расчётов, товары, шаблоны, история, PDF-этикетки и все модели, фотографии и исходники WB/Ozon. Состав и восстановление зависят от выбранного режима выше. Очередь печати и остатки филамента сохраняются на устройстве.</p><div class="sync-actions"><button type="button" id="transfer-export">Скачать ZIP для полной замены</button><button id="full-export">Скачать ZIP выбранного режима</button><label class="file-button">Восстановить из ZIP<input id="full-import" type="file" accept=".zip,application/zip" hidden></label></div><hr><h3>База JSON без файлов моделей</h3><div class="sync-actions"><button id="export">Скачать базу JSON (без файлов)</button><label class="file-button">Загрузить базу<input id="import" type="file" accept=".json,application/json"></label><button id="restore">Вернуть предыдущую базу</button></div></dialog>`;
 if(preservedCatalogue){$('.side-products').replaceWith(preservedCatalogue);for(const button of preservedCatalogue.querySelectorAll('[data-product]')){const active=button.dataset.product===p.id;button.classList.toggle('chosen',active);if(active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');}}
 if(sidebarRecent)$('.sidebar [data-working-recent]').replaceWith(sidebarRecent);
 if(sidebarFolder)$('.sidebar [data-working-folder]').replaceWith(sidebarFolder);
 $('.sidebar').scrollTop=sidebarScrollTop;
 $('.workspace-nav').scrollTop=navScrollTop;
 if(focusedNav)document.querySelector('.workspace-nav [data-space="'+focusedNav+'"]')?.focus({preventScroll:true});
 const catalogue=$('.side-products');catalogue.classList.add('product-catalogue');catalogue.setAttribute('role','complementary');catalogue.setAttribute('aria-label','Мои товары');$('.sidebar').after(catalogue);mountCatalogueResize(catalogue);
 if(space==='backup'){const panel=document.createElement('section');panel.className='panel backup-workspace';panel.id='backup-workspace';const dialog=$('#sync');panel.innerHTML=dialog.innerHTML;dialog.replaceWith(panel);panel.querySelector('#sync-close').remove();const storagePanel=document.createElement('section');storagePanel.className='storage-usage-panel';panel.prepend(storagePanel);mountStorageUsage(storagePanel);document.querySelector('main').insertBefore(panel,document.querySelector('main>footer'));}renderFields();renderCustom();renderResults();renderHistory();bind();mountLabelThumbnail({root:$('#label-thumbnail'),label:p.labelPdf});mountReleaseHistory({root:document.querySelector('main'),button:document.querySelector('#release-history'),version:APP_VERSION});mountProductImage();document.querySelectorAll('.sidebar [data-space]').forEach(button=>{if(button.dataset.space===space)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});if(!['finance','expenses','prices','sales','filament','api','stocks','backup','print-queue'].includes(space))renderFiles();if(space==='print-queue')mountPrintQueue({root:$('#print-queue-workspace'),sortButton:$('#queue-sort-printing'),database:db,save,getCredentials:getMarketplaceCredentials,notify:toast,onOpenProduct:id=>{if(!db.products.some(p=>p.id===id))return toast('Товар удалён');selected=id;space='cost';history.replaceState(null,'','#cost');render();},getModelInfo:async id=>{await modelMigration.catch(()=>{});const target=db.products.find(p=>p.id===id);if(!target)throw Error('Товар удалён');const choices=await plateModels(db,target);if(!choices.size)throw Error('Модель не прикреплена');return choices.values().next().value;},onStocks:()=>{space='stocks';history.replaceState(null,'','#stocks');render();},onModel:async id=>{const target=db.products.find(p=>p.id===id);if(!target)throw Error('Товар удалён. Модель недоступна.');await openPlateModel(target);},onLabel:(sku,quantity)=>openStockLabelDialog({database:db,sku,quantity,notify:toast})});if(space==='prices')disposePrices=mountMarketplacePrices({root:$('#prices-workspace'),database:db,save,getCredentials:getMarketplaceCredentials,onOpenApi:()=>{space='api';history.replaceState(null,'','#api');render();}});if(space==='stocks')mountWarehouseStocks({root:$('#stocks-workspace'),database:db,save,getCredentials:getMarketplaceCredentials,onEnqueue:(sku,quantity,market)=>openEnqueueDialog({database:db,sku,quantity,market,save,notify:toast}),onOpenLabel:(sku,quantity)=>openStockLabelDialog({database:db,sku,quantity,save,notify:toast}),onOpenModel:safe(async sku=>{const target=db.products.find(q=>q.sku.trim()===sku.trim());if(!target)throw Error('Сначала загрузите карточку этого артикула в приложение');await openPlateModel(target);}),onOpenProduct:id=>{selected=id;space='cost';history.replaceState(null,'','#cost');render();document.querySelector('.product-stock-targets')?.scrollIntoView?.({block:'center'});},onOpenApi:()=>{space='api';history.replaceState(null,'','#api');render();}});if(space==='finance')mountFinance($('#finance-workspace'),db.orderSnapshots??[],orderProfitLookup(),db.products,categoriesFromProduct);if(space==='expenses')mountExpenses({root:$('#expenses-workspace'),database:db,save,notify:toast});if(space==='filament')mountFilamentStock({root:$('#filament-workspace'),database:db,save,toast});if(space==='sales')mountSales({root:$('#sales-workspace'),profitForRow:orderProfitLookup(),database:db,selectedProductId:p.id,save,toast,getCredentials:getMarketplaceCredentials,onOpenApi:()=>{activateMarketplaceSettings();space='api';history.replaceState(null,'','#api');render();window.scrollTo?.({top:0});}});if(['cards','api'].includes(space))mountMarketplaceUI({settingsOnly:space==='api',getGoogleClientId:()=>config.clientId||'',saveGoogleClientId:value=>{config={...config,clientId:value};localStorage.setItem(CONFIG,JSON.stringify(config));},onOpenSettings:()=>{space='api';history.replaceState(null,'','#api');render();},listingTemplates:()=>db.listingTemplates??=([]),onCreateFromTemplate:template=>{const target=blankProduct();const draft=draftFromListingTemplate(template,target);const body=JSON.parse(draft.body);target.name=template.market==='wb'?body[0].variants[0].title||template.name:body.items[0].name||template.name;target.listingDrafts={[template.market]:draft};db.products.push(target);selected=target.id;productQuery='';productGroupFilter='';productCategoryFilters={wb:'',ozon:''};for(const key of Object.keys(cataloguePresenceFilters))cataloguePresenceFilters[key]='';productPage=catalogueProductBatches(db.products,productPageSize).findIndex(page=>page.some(q=>q.id===target.id));productGroupOpen.set('',true);cardsMarket=template.market;space='cards';history.replaceState(null,'','#cards');save();render();},listingProducts:()=>db.products,onCardsListed:(market,cards,complete)=>{rememberCatalogueCards(db,market,cards,complete);save();$('#product-list').innerHTML=productList(product());bindProductList();},onCardLoaded:(draft,sku,market)=>{if(!sku.trim())throw Error('Площадка не вернула артикул карточки');let target=db.products.find(q=>q.sku.trim()===sku.trim());if(target?.id===p.id){restoreSharedEdits(target,market,draft);return false;}if(!target){const body=JSON.parse(draft.body),item=market==='wb'?body[0]:body.items[0];target=blankProduct();target.sku=sku;target.name=item.title||item.name||sku;db.products.push(target);}restoreSharedEdits(target,market,draft);target.listingDrafts??={};target.listingDrafts[market]=draft;selected=target.id;productQuery='';productGroupFilter='';productCategoryFilters={wb:'',ozon:''};for(const key of Object.keys(cataloguePresenceFilters))cataloguePresenceFilters[key]='';productPage=catalogueProductBatches(db.products,productPageSize).findIndex(page=>page.some(q=>q.id===target.id));productGroupOpen.set(target.productGroup||'',true);cardsMarket=market;save();render();toast('Открыт товар '+sku);return true;},listingSources:market=>db.products.filter(q=>q.listingDrafts?.[market]).map(q=>({product:q,draft:q.listingDrafts[market]})),initialMarket:cardsMarket,container:$('#marketplace-api'),product:p,owner:db.id+':'+p.id,save,toast,lookupCost:sku=>productCostsBySku(db.products.filter(row=>row.sku?.trim()===String(sku||'').trim()).map(productWithConfiguredPrices),sku),lookupListing:(sku,market)=>loadedListingForSku(db.products,sku,market),openListing:match=>{selected=match.ownerId;cardsMarket=match.market;space='cards';history.replaceState(null,'','#cards');render();window.scrollTo?.({top:0});},openCost:id=>{if(!db.products.some(p=>p.id===id))return;selected=id;space='cost';history.replaceState(null,'','#cost');render();window.scrollTo?.({top:0});}});if(['stocks','sales'].includes(space)){const heading=document.querySelector('main>.heading'),rail=document.querySelector('main .table-filter-rail');if(heading&&rail)rail.prepend(heading);}if(space==='prices')document.querySelector('main>.heading').hidden=true;disposeTopRefresh=mountTopRefresh(document,{'print-queue':'#queue-refresh-stocks',stocks:'#stock-refresh',prices:'#prices-refresh',sales:'#orders-refresh'}[space]);const sortButton=$('#queue-sort-printing');if(sortButton)sortButton.parentElement.append(sortButton);cardsMarket=null;$('.product-catalogue').scrollTop=sidebarScroll;}
const packagingGroups=[
 ['Коробки','Индивидуальная упаковка — на одно изделие. Общая — на отправляемую партию.',['box','outer','capacity']],
 ['Этикетки','Цена и количество относятся ко всей купленной партии этикеток. Расход наклеек укажите отдельно.',['labelPack','labelCount','labels','outerLabels']],
 ['Принтер этикеток','Ресурс — сколько этикеток принтер напечатает за весь срок службы.',['labelPrinter','labelLife']],
 ['Пупырчатая плёнка','Укажите цену всей купленной плёнки и на сколько изделий её хватит. Стоимость на изделие = цена ÷ количество изделий.',['bubblePrice','bubbleYield']],
 ['Вкладыши и прочая упаковка','Все суммы в этой группе — на одно изделие.',['card','tape']]
];
const editorGroups=[['important','Важное','Часто используемые параметры материала и печати'],...groups,['marketplace','Параметры на маркетплейсе','Размеры, вес и категории товара для оформления карточек']];
const fieldGroups={
 marketplace:[],
 important:[['Материал','Расход на всю печать, включая поддержки и отходы.',['grams','kgPrice']],['Печать','Время и количество изделий за одну печать.',['minutes','yield']]],
 production:[
  ['Материалы и комплектующие','Расход материала указан на всю печать, включая поддержки и отходы. Комплектующие — на одно изделие.',['grams','kgPrice','components']],
  ['Печать и оборудование','Время и количество изделий относятся к одной печати. Ресурс принтера — за весь срок службы.',['minutes','yield','printerPrice','printerLife']],
  ['Электричество','Средняя мощность вместе со временем печати определяет расход энергии.',['watts','tariff']],
  ['Труд, обслуживание и разработка','Каждая сумма — затраты на одно изделие.',['labor','maintenance','design']],
  ['Производственный брак','Доля изделий, которые не удастся продать из-за дефектов производства.',['defect']]
 ],
 packaging:packagingGroups,
 sales:[
  ['Комиссии и реклама','Проценты от цены продажи. Эквайринг укажите только если он начисляется отдельно.',['commission','acquiring','ads']],
  ['Доставка площадки','Заполняйте поля выбранного способа расчёта доставки. Неактивные поля в этом режиме не учитываются.',['wbDelivery','deliveryPercent','logistics','reverse']],
  ['Доставка партии и услуги склада','Доставка до приёмки — за общую коробку. Приёмка и хранение — на изделие.',['delivery','acceptance','storage']],
  ['Выкуп и потери','Выкуп влияет на модель доставки по тарифам. Потеря стоимости — отдельный резерв на повреждение или обесценение невыкупленного товара.',['buyout','loss']],
  ['Прочие удержания','Плановая сумма штрафов и прочих удержаний на одно изделие.',['penalties']]
 ],
 overhead:[
  ['Постоянные расходы за месяц','Укажите часть ежемесячных расходов, относящуюся к этому товару.',['rent','software','bank','otherMonthly']],
  ['План продаж','По этому объёму постоянные расходы распределяются на одно изделие.',['volume']],
  ['Прочие расходы на изделие','Затраты, которые ещё не учтены в других группах.',['otherUnit']]
 ]
};
function productWithConfiguredPrices(product){
 return {...product,values:{...product.values,...configuredCostPrices(db,product)}};
}
function calculate(product){
 return calculateManual(productWithConfiguredPrices(product));
}
function costPrinterPicker(product){
 const printers=db.costPrices?.printers??[];
 const known=printers.some(row=>row.model===product.printer);
 return `<label>Модель принтера<select class="ui-select" data-cost-printer><option value="" disabled ${known?'':'selected'}>${esc(product.printer?'Сохранённая модель: '+product.printer:'Выберите модель из «Затрат»')}</option>${printers.map(row=>`<option value="${esc(row.model)}" ${row.model===product.printer?'selected':''}>${esc(row.model)} · ${rub(row.price)}</option>`).join('')}</select></label>`;
}
function fieldGrid(p,items){const prices=configuredCostPrices(db,p);return `<div class="form-grid">${items.map(([k,label,unit])=>`<label>${label}<div class="input-unit"><input ${['шт.','этикеток'].includes(unit)?'data-buttons-only':''} data-field="${k}" ${Object.hasOwn(prices,k)?'readonly title="Цена из справочника затрат"':''} ${((k==='wbDelivery'&&p.shippingMode!=='wb-total')||(k==='deliveryPercent'&&p.shippingMode!=='percent')||(['logistics','reverse'].includes(k)&&p.shippingMode!=='rubles'))?'disabled':''} aria-label="${label}" type="number" min="0" step="any" ${['buyout','loss','defect','commission','ads','acquiring','deliveryPercent'].includes(k)?'max="100"':''} value="${prices[k]??p.values[k]??''}" placeholder="Не задано"><span>${unit}</span></div><small>${Object.hasOwn(prices,k)?'Цена из справочника затрат':p.values[k]===null?'Не заполнено · 0 введите явно':''}</small></label>`).join('')}</div>`;}
function packagingTypeMarkup(p){return `<label>Тип индивидуальной упаковки<select class="ui-select" data-packaging-type><option value="box" ${p.packagingType!=='bag'?'selected':''}>Коробка</option><option value="bag" ${p.packagingType==='bag'?'selected':''}>Пакет</option></select></label>`;}
function renderFields(){const p=product();$('#fields').classList.toggle('important-fields',['important','marketplace'].includes(tab));$('#fields').innerHTML=`<div class="section-title"><div><h2>${editorGroups.find(g=>g[0]===tab)[1]}</h2><p>${editorGroups.find(g=>g[0]===tab)[2]}</p></div><span class="section-number">0${editorGroups.findIndex(g=>g[0]===tab)+1}</span></div>${['production','important'].includes(tab)?`${tab==='important'?'<div class="important-equipment-layout">':''}<div class="form-grid">${costPrinterPicker(p)}<label>Материал<input id="material" value="${esc(p.material)}"></label></div><div id="product-filament-colors"></div>${tab==='important'?'</div>':''}${tab==='production'?`<div class="note">Энергия: 200 Вт — предварительная оценка для PLA. Прогрев и сушка AMS могут увеличить расход. <a href="https://bambulab.com/en-us/p2s/specs" target="_blank" rel="noreferrer">Спецификация ↗</a></div>`:''}`:''}${tab==='sales'?'<div class="note">Комиссия, реклама и эквайринг — отдельные проценты. Не вводите одну услугу дважды. Невыкуп: модель повторной продажи годного возврата; потери задаются отдельно.</div>':''}${tab==='sales'?`<label class="shipping-mode">Способ расчёта доставки площадки<select id="shipping-mode"><option value="rubles" ${p.shippingMode==='rubles'?'selected':''}>Тарифы в рублях + модель выкупа</option><option value="wb-total" ${p.shippingMode==='wb-total'?'selected':''}>Готовая сумма доставки WB, ₽ за продажу</option><option value="percent" ${p.shippingMode==='percent'?'selected':''}>Готовая доля доставки из калькулятора WB</option></select></label><div class="note">Доля из WB относится к исходной цене и параметрам расчёта. При изменении цены обновите её в WB. Готовая сумма WB предпочтительнее процента: при изменении цены доля пересчитается. В обоих готовых режимах прямая и обратная логистика не начисляются повторно и доставка не делится на выкуп. Доставка вашей коробки до приёмки остаётся отдельной.</div>`:''}${tab==='packaging'?packagingTypeMarkup(p):''}${tab==='important'?'<div class="important-production-blocks">':''}${fieldGroups[tab].map(([title,hint,keys])=>`<fieldset class="packaging-group"><legend>${title}</legend><p class="group-hint">${hint}</p>${fieldGrid(p,keys.map(k=>{const field=fields.find(f=>f[0]===k);return k==='box'?[k,p.packagingType==='bag'?'Индивидуальный пакет':'Индивидуальная коробка',...field.slice(2)]:field;}))}</fieldset>`).join('')}${tab==='important'?'</div>':''}${tab==='important'?`<fieldset class="packaging-group"><legend>Индивидуальная упаковка</legend><p class="group-hint">На одно изделие. Стоимость общая с вкладкой «Упаковка» и учитывается один раз.</p><div class="product-details-columns">${packagingTypeMarkup(p)}${fieldGrid(p,[['box',p.packagingType==='bag'?'Стоимость пакета':'Стоимость коробки','₽/шт.','packaging']])}</div></fieldset>`:''}${['important','marketplace'].includes(tab)?productDetailsMarkup(p):''}${tab==='marketplace'?'':'<div class="editor-bottom">Пустое поле означает неизвестный расход.<br>Если расхода нет, укажите 0.</div>'}`;
 $('#fields').querySelectorAll('[data-field]').forEach(el=>el.addEventListener('input',()=>{p.values[el.dataset.field]=el.value===''?null:Number(el.value);el.closest('label').querySelector('small').textContent=el.value===''?'Не заполнено · 0 введите явно':'';save();renderResults();}));
 const packagingType=$('#fields [data-packaging-type]');if(packagingType)packagingType.onchange=()=>{p.packagingType=packagingType.value;save();renderFields();};
 if($('#shipping-mode'))$('#shipping-mode').onchange=e=>{p.shippingMode=e.target.value;save();renderFields();renderResults();};
 const printerPicker=$('[data-cost-printer]');
 if(printerPicker)printerPicker.onchange=()=>{
  const row=db.costPrices?.printers.find(item=>item.model===printerPicker.value);
  if(!row)return;
  p.printer=row.model;
  p.values.printerPrice=row.price;
  save();renderFields();renderResults();
 };
 for(const k of ['material'])if($('#'+k))$('#'+k).oninput=e=>{p[k]=e.target.value;save();};if($('#product-filament-colors'))mountProductFilaments({root:$('#product-filament-colors'),product:p,stock:db.filamentStock||[],save:()=>{
  const prices=configuredCostPrices(db,p);
  if(Object.hasOwn(prices,'kgPrice'))p.values.kgPrice=prices.kgPrice;
  save();renderResults();
  const input=$('#fields [data-field="kgPrice"]');
  if(input){
   input.value=prices.kgPrice??p.values.kgPrice??'';
   input.readOnly=Object.hasOwn(prices,'kgPrice');
   input.title=input.readOnly?'Цена из справочника затрат':'';
   input.closest('label').querySelector('small').textContent=input.readOnly?'Цена из справочника затрат':input.value===''?'Не заполнено · 0 введите явно':'';
   const spread=input.closest('.cost-spread-field')?.querySelector('.spread-marketplace-field');
   if(spread)spread.disabled=input.readOnly;
  }
 }});bindDescriptions();if(['important','marketplace'].includes(tab))mountProductDetails({root:$('#fields'),product:p,products:db.products,save,getSourcePhoto:async source=>(await ensureProductImage(db,source,{download:false}))?.blob,loadCategory:market=>pullProductCategory(p,market,{products:db.products,credentials:getMarketplaceCredentials()}),onCategoriesRendered:host=>{
 for(const button of host.querySelectorAll('[data-category-market]')){
  const market=button.dataset.categoryMarket;
  addCostFieldSpread(button,(row,value)=>{(row.marketplaceCategories??={})[market]=structuredClone(value);},{
   label:'Категория '+(market==='wb'?'WB':'Ozon'),read:()=>categoriesFromProduct(p)[market]
  });
 }
 }});bindCostFieldSpread($('#fields'),p);}
function groupedCalculation(p,r){
 const amountCell=amount=>`<td>${r.invalid.length?'—':rub(amount)}</td>`;
 const rowHTML=([name,amount])=>`<tr><td>${esc(name)}</td>${amountCell(amount)}</tr>`;
 const sections=groups.map(([key,title])=>[title,fieldGroups[key].map(([name,hint,keys])=>[name,r.detailRows.filter(row=>keys.includes(row[2]))])]);
 sections.push(['Дополнительные статьи',[['Пользовательские расходы',r.detailRows.filter(row=>row[2].startsWith('custom:'))]]]);
 return sections.map(([title,subgroups])=>{
  const total=subgroups.reduce((sum,[,rows])=>sum+rows.reduce((s,row)=>s+row[1],0),0);
  return `<tr class="calculation-section"><th>${esc(title)}</th>${amountCell(total)}</tr>`+subgroups.map(([name,rows])=>`<tr class="calculation-subgroup"><th>${esc(name)}</th>${amountCell(rows.reduce((sum,row)=>sum+row[1],0))}</tr>${rows.map(rowHTML).join('')}${!rows.length?`<tr><td colspan="2" class="group-hint">${name==='План продаж'?'Объём продаж используется для распределения постоянных расходов; отдельной суммы затрат нет.':'Отдельных расходов нет: параметры этой группы используются в расчёте других строк.'}</td></tr>`:''}`).join('');
 }).join('');
}
function marketplacePayout(product,key,price=product.marketplaces?.[key.startsWith('ozon')?'ozon':'wb']?.price){
 if(key==='ozonFbo'||key==='ozonFbs'){
  const {commission,acquiring,fbo,fbs}=product.marketplaceLogistics?.ozon??{};
  const delivery=key==='ozonFbo'?fbo:fbs;
  if(![price,commission,acquiring,delivery].every(Number.isFinite))return null;
  return Math.round((price-price*(commission+acquiring)/100-delivery)*100)/100;
 }
 const {commission,delivery}=product.marketplaceLogistics?.wb??{};
 if(![price,commission,delivery].every(Number.isFinite))return null;
 return Math.round((price-price*commission/100-delivery)*100)/100;
}
const profitMarkets=[['Wildberries','wbFbs','wbFbw','FBW','https://seller.wildberries.ru/profit-calculator','Открыть калькулятор'],['Ozon','ozonFbs','ozonFbo','FBO','https://calculator.ozon.ru/','Открыть калькулятор']];
function marketplaceProfitEditor(source){
 const listing=loadedListingForSku(db.products,source.sku,'ozon');
 const ozonURL=db.products.find(row=>row.id===listing?.ownerId)?.listingDrafts?.ozon?.productURL;
 const copyOzonLink=typeof ozonURL==='string'&&/^https:\/\/(?:www\.)?ozon\.ru\/product\/[^\s]+$/i.test(ozonURL)
  ? `<button type="button" data-copy-ozon-product="${esc(ozonURL)}">Скопировать ссылку на товар</button>`:'';

 return `<fieldset class="marketplace-profit"><legend>К выплате за изделие</legend>
 <p class="group-hint">Для Wildberries выплата рассчитывается из цены продажи за вычетом комиссии и доставки. Для Ozon выплата рассчитывается из цены продажи за вычетом вознаграждения, эквайринга, обработки и доставки. Из выплаты вычитаются налог, себестоимость и доплата за невыкуп.</p>
 <label>Ставка налога, %<input type="number" min="0" max="99.99" step="0.01" data-no-stepper data-profit-tax-rate value="${esc(source.tax??'')}" placeholder="Укажите ставку"></label>
 <div class="marketplace-profit-markets">${profitMarkets.map(([market,fbs,warehouse,scheme,url,linkText])=>`<div class="marketplace-profit-card" data-profit-market="${market==='Ozon'?'ozon':'wb'}"><div class="marketplace-profit-heading"><h3>${market}</h3><a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${linkText} ${market} (новая вкладка)">${linkText} ↗</a>${market==='Ozon'?copyOzonLink:''}</div><label>Цена продажи, ₽<input type="number" min="0" step="any" data-no-stepper data-profit-sale-price="${market==='Ozon'?'ozon':'wb'}" value="${esc(source.marketplaces?.[market==='Ozon'?'ozon':'wb']?.price??'')}" placeholder="Укажите цену продажи"></label><fieldset class="marketplace-logistics"><legend>Обработка и доставка</legend>
 <div class="marketplace-logistics-fields">${(market==='Ozon'?[['commission','Вознаграждение Ozon, %',100],['acquiring','Эквайринг, %',100],['fbo','FBO, ₽',null],['fbs','FBS, ₽',null],['buyout','Выкуп, %',100]]:[['commission','Комиссия, %',100],['delivery','Доставка, ₽',null],['buyout','Выкуп, %',100]]).map(([key,label,max])=>`<div><label>${label}<input type="number" min="0" ${max===null?'':`max="${max}"`} step="any" data-no-stepper data-profit-logistics="${key}" data-market="${market==='Ozon'?'ozon':'wb'}" value="${esc(source.marketplaceLogistics?.[market==='Ozon'?'ozon':'wb']?.[key]??'')}" placeholder="Не задано"></label></div>`).join('')}</div>
 ${market==='Ozon'?'<small>При невыкупе возврат и повторная доставка считаются по FBO.</small>':''}<small data-logistics-result="${market==='Ozon'?'ozon':'wb'}"></small></fieldset><div class="marketplace-profit-fields">${(market==='Ozon'?[[warehouse,scheme],[fbs,'FBS']]:[[fbs,'']]).map(([key,label])=>`<div>${label?`<strong>${label}</strong>`:''}<div>К выплате · <output data-calculated-payout="${key}"></output></div><small data-profit-result="${key}"></small></div>`).join('')}</div></div>`).join('')}</div>
 <button type="button" id="spread-marketplace-profit">Распространить на все товары</button></fieldset>`;
}
function addCostFieldSpread(anchor,apply,{input,inline=false,label=anchor.childNodes[0]?.textContent.trim(),read=()=>{
 if(!input?.validity.valid||input.readOnly||input.value==='')return null;
 return input.type==='number'?input.valueAsNumber:input.value.trim();
}}={}){
 const field={apply,label,read};
 const button=document.createElement('button');
 button.type='button';
 button.disabled=!!input?.readOnly;
 button.className='spread-marketplace-field';
 button.innerHTML=actionIcon('spread');
 button.title='Распространить поле «'+label+'»';
 button.setAttribute('aria-label',button.title);
 button.onclick=()=>openMarketplaceProfitPicker([field]);
 if(inline)anchor.append(button);
 else{
  const wrapper=document.createElement('div');
  wrapper.className='cost-spread-field';
  anchor.before(wrapper);
  wrapper.append(anchor,button);
 }
 return field;
}
function bindCostFieldSpread(root,source){
 const bind=(selector,apply)=>{
  for(const input of root.querySelectorAll(selector))addCostFieldSpread(input.closest('label'),(row,value)=>apply(row,input,value),{input,label:input.closest('label').childNodes[0]?.textContent.trim()});
 };
 bind('[data-field]',(row,input,value)=>{row.values[input.dataset.field]=value;});
 bind('#printer,#material',(row,input,value)=>{row[input.id]=value;});
 bind('[data-packaging-type]',(row,input,value)=>{row.packagingType=value;});
 bind('[data-measurement]',(row,input,value)=>{
  const [part,key]=input.dataset.measurement.split('.');
  const measurements=row.measurements??={};
  if(key)(measurements[part]??={})[key]=value;
  else measurements[part]=value;
 });
 bind('[data-marketplace-code]',(row,input,value)=>{
  const [market,key]=input.dataset.marketplaceCode.split('.');
  ((row.marketplaceCodes??={})[market]??={})[key]=value;
 });
 for(const select of root.querySelectorAll('[data-material-color-slot]')){
  const index=Number(select.dataset.materialColorSlot);
  addCostFieldSpread(select.closest('.product-material-picker'),(row,value)=>{
   const slots=materialColorSlots(row);
   slots[index]=structuredClone(value);
   row.colorCode=slots.filter(slot=>slot.code).map(slot=>[slot.code,slot.originalColorName||slot.colorName].filter(Boolean).join(' ')).join(' / ');
  },{inline:true,label:'Цвет '+(index+1),read:()=>{const slot=materialColorSlots(source)[index];return slot.code?slot:null;}});
 }
}
function openMarketplaceProfitPicker(fields){
 const values=fields.map(field=>({...field,value:field.read()})).filter(({value})=>value!=null&&value!=='');
 if(!values.length)return toast('Сначала заполните поле');
 const targets=db.products.filter(row=>row.id!==product().id);
 if(!targets.length)return toast('В каталоге нет других товаров');
 const groups=new Map();
 for(const row of targets){
  const group=row.productGroup?.trim()||'';
  if(!groups.has(group))groups.set(group,[]);
  groups.get(group).push(row);
 }
 const dialog=document.createElement('dialog');
 dialog.className='marketplace-profit-picker';
 dialog.setAttribute('aria-labelledby','marketplace-profit-picker-title');
 dialog.innerHTML=`<form method="dialog"><div class="modal-head"><h2 id="marketplace-profit-picker-title">Распространить на товары</h2></div>
 <p>${fields.length===1?esc(values[0].label)+': '+esc(values[0].value?.label??values[0].value?.code??values[0].value):'Все заполненные поля блока'} заменят соответствующие значения у выбранных товаров.</p>
 <button type="button" data-select-all-targets>Выбрать все товары</button>
 <div class="marketplace-profit-targets">${[...groups].map(([group,rows])=>`<fieldset><legend>${esc(group||'Без группы')} · ${rows.length}</legend>
 <label><input type="checkbox" data-select-profit-group>Выбрать всю группу</label>
 ${rows.map(row=>`<label><input type="checkbox" name="target" value="${esc(row.id)}"><img data-product-image="${esc(row.id)}" alt="" hidden><span><strong>${esc(row.sku||row.name)}</strong><small>${esc([row.sku?row.name:'',row.variantNote].filter(Boolean).join(' · '))}</small></span></label>`).join('')}</fieldset>`).join('')}</div>
 <div class="sync-actions"><button type="submit" class="primary" value="apply" disabled>Применить к выбранным</button><button type="submit" value="cancel" autofocus>Отмена</button></div></form>`;
 const form=dialog.querySelector('form');
 const updateSelection=()=>{
  for(const group of form.querySelectorAll('[data-select-profit-group]')){
   const rows=[...group.closest('fieldset').querySelectorAll('[name="target"]')];
   group.checked=rows.every(row=>row.checked);
   group.indeterminate=!group.checked&&rows.some(row=>row.checked);
  }
  form.querySelector('[value="apply"]').disabled=!form.querySelector('[name="target"]:checked');
 };
 form.onchange=event=>{
  if(event.target.matches('[data-select-profit-group]')){
   for(const row of event.target.closest('fieldset').querySelectorAll('[name="target"]'))row.checked=event.target.checked;
  }
  updateSelection();
 };
 form.querySelector('[data-select-all-targets]').onclick=()=>{
  const rows=[...form.querySelectorAll('[name="target"]')];
  const checked=!rows.every(row=>row.checked);
  for(const row of rows)row.checked=checked;
  updateSelection();
 };
 dialog.addEventListener('close',async()=>{
  const ids=new Set(new FormData(form).getAll('target'));
  dialog.remove();
  if(dialog.returnValue!=='apply'||!ids.size)return;
  for(const row of targets)if(ids.has(row.id))for(const field of values)field.apply(row,field.value);
  if(await save()){
   for(const row of targets)if(ids.has(row.id)){
    const host=document.querySelector(`[data-product="${CSS.escape(row.id)}"] [data-product-profit-summary]`);
    if(host)host.innerHTML=profitSummary(row);
   }
   toast('Поля обновлены · товаров: '+ids.size);
  }
 },{once:true});
 document.body.append(dialog);
 dialog.showModal();
 hydrateProductImages(dialog);
}
function marketplaceProfitAmount(p,r,key,price=p.marketplaces?.[key.startsWith('ozon')?'ozon':'wb']?.price){
 const market=key.startsWith('ozon')?'ozon':'wb';
 const payout=marketplacePayout(p,key,price),rate=p.tax;
 if(!Number.isFinite(rate)||rate<0||rate>=100||!Number.isFinite(payout)||r.invalid.length||
    (rate>0&&(!Number.isFinite(price)||price<=0)))return null;
 const logistics=p.marketplaceLogistics?.[market]??{};
 const uplift=2*(100-logistics.buyout);
 const delivery=market==='ozon'?logistics.fbo:logistics.delivery;
 const surcharge=Number.isFinite(logistics.buyout)&&(uplift===0||Number.isFinite(delivery))
  ? uplift===0?0:delivery*uplift/100 : null;
 const tax=rate===0?0:price*rate/100;
 const cost=key==='ozonFbo'?r.ozonFboCost:r.cost;
 return {amount:payout-tax-cost-(surcharge??0),tax,surcharge,partial:!!r.missing.length||surcharge===null};
}
function orderProfitLookup(){
 const bySku=new Map(),costs=new Map();
 for(const product of db.products){
  const sku=product.sku?.trim();
  if(sku)bySku.set(sku,bySku.has(sku)?null:product);
 }
 const schemes={'wb-fbs':'wbFbs','wb-fbw':'wbFbs','ozon-fbs':'ozonFbs','ozon-fbo':'ozonFbo'};
 return (row,returned)=>{
  const product=bySku.get(row.sku?.trim()),key=schemes[row.source];
  if(!product||!key)return null;
  if(returned){
   const market=key.startsWith('ozon')?'ozon':'wb';
   const logistics=product.marketplaceLogistics?.[market]??{};
   const outward=market==='wb'?logistics.delivery:key==='ozonFbo'?logistics.fbo:logistics.fbs;
   const back=market==='wb'?logistics.delivery:logistics.fbo;
   return {profit:Number.isFinite(outward)&&Number.isFinite(back)?-(outward+back):null,cost:0};
  }
  if(!costs.has(product))costs.set(product,calculate(product));
  const calculation=costs.get(product);
  const result=Number.isFinite(row.price)&&row.currency==='RUB'?marketplaceProfitAmount(product,calculation,key,row.price):null;
  const cost=key==='ozonFbo'?calculation.ozonFboCost:calculation.cost;
  const details=Object.fromEntries(calculation.detailRows.map(([,value,field])=>[field,value]));
  return {profit:result&&!result.partial?result.amount:null,cost:calculation.missing.length||calculation.invalid.length?null:cost,
   materials:details.grams,printing:details.printerPrice,electricity:details.watts,labor:details.labor,packaging:calculation.packaging-(key==='ozonFbo'?calculation.outerBoxCost:0)};
 };
}
function profitSummary(p,r){
 if(!['wbFbs','ozonFbo','ozonFbs'].some(key=>Number.isFinite(marketplacePayout(p,key))))return '';
 r??=calculate(p);
 return profitMarkets.map(([market,fbs,warehouse,scheme])=>{
  const entries=market==='Ozon'?[[warehouse,scheme],[fbs,'FBS']]:[[fbs,'']];
  const amounts=entries.map(([key,label])=>{
   const result=marketplaceProfitAmount(p,r,key);
   return result?`<span class="profit-summary-value">${market==='Ozon'?'<small>'+label+'</small>':''}<strong>${result.partial?'≈ ':''}${rub(result.amount)}</strong></span>`:'';
  }).filter(Boolean);
  return amounts.length?`<span class="profit-summary-market" data-profit-market="${market==='Ozon'?'ozon':'wb'}"><b>${market==='Ozon'?'Ozon':'WB'}</b> ${amounts.join(' ')}</span>`:'';
 }).join('');
}
function renderMarketplaceProfit(p,r){
 const summary=profitSummary(p,r);
 for(const host of document.querySelectorAll('[data-product-profit-summary]')){
  const row=host.closest('[data-product]');
  if(!row||row.dataset.product===p.id)host.innerHTML=summary;
 }
 const rate=p.tax;
 for(const [,fbs,warehouse] of profitMarkets){
  const market=fbs==='ozonFbs'?'ozon':'wb';
  const price=p.marketplaces[market].price;
  const {commission,delivery,buyout,fbs:fbsCost,fbo:fboCost}=p.marketplaceLogistics?.[market]??{};
  const uplift=Number.isFinite(buyout)?2*(100-buyout):null;
  const extraDelivery=market==='ozon'?fboCost:delivery;
  const surcharge=uplift===0?0:uplift!==null&&Number.isFinite(extraDelivery)?extraDelivery*uplift/100:null;
  const logisticsOutput=$(`[data-logistics-result="${market}"]`);
  if(logisticsOutput&&market==='wb')logisticsOutput.textContent=uplift===null?'Укажите процент выкупа для расчёта доплаты':
   `${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(100+uplift)} доставок на 100 товаров · доставка +${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(uplift)}%`+(!Number.isFinite(delivery)?' · укажите стоимость доставки':
    ` · ${rub(delivery+surcharge)} с учётом выкупа · доплата ${rub(surcharge)}`+
    (Number.isFinite(commission)&&Number.isFinite(price)?` · комиссия ${rub(price*commission/100)} учтена в выплате`:''));

  if(logisticsOutput&&market==='ozon'){
   if(uplift===null)logisticsOutput.textContent='Укажите процент выкупа для расчёта доплаты';
   else if(surcharge===null)logisticsOutput.textContent='Укажите расходы FBO для расчёта возврата и повторной доставки';
   else{
    const totals=[['FBO',fboCost],['FBS',fbsCost]].filter(([,cost])=>Number.isFinite(cost))
     .map(([scheme,cost])=>`${scheme} ${rub(cost+surcharge)}`);
    logisticsOutput.textContent=[...totals,`Доплата за невыкуп ${rub(surcharge)} на изделие`].join(' · ');
   }
  }

  for(const key of [fbs,warehouse]){
   const output=$(`[data-profit-result="${key}"]`);
   if(!output)continue;
   const payout=marketplacePayout(p,key);
   const payoutOutput=$(`[data-calculated-payout="${key}"]`);
   if(payoutOutput)payoutOutput.textContent=Number.isFinite(payout)?rub(payout):'—';
   if(!Number.isFinite(rate)||rate<0||rate>=100)output.textContent='Укажите ставку налога';
   else if(!Number.isFinite(payout))output.textContent=market==='ozon'?'Укажите цену, оба процента и расходы по схеме':'Укажите цену, комиссию и доставку';
   else if(rate>0&&(!Number.isFinite(price)||price<=0))output.textContent='Укажите цену продажи для расчёта налога';
   else if(r.invalid.length)output.textContent='Исправьте себестоимость';
   else{
    const result=marketplaceProfitAmount(p,r,key);
    output.textContent=`${result.partial?'Предварительная прибыль':'Прибыль'} · ${rub(result.amount)} · налог вычтен: ${rub(result.tax)}`+(result.surcharge===null?' · без доплаты за невыкуп':'');
   }
  }
 }
}
function renderResults(){
 const p=product(),r=calculate(p),partial=r.missing.length||r.invalid.length;
 $('#results').innerHTML=`<div class="big-number"><small>Себестоимость изделия</small><strong>${r.invalid.length?'—':rub(r.cost)}</strong><span>общая для WB и Ozon</span></div><div class="result-warning ${partial?'':'complete'}">${r.invalid.length?'Исправьте некорректные значения':partial?`Частичный расчёт · не заполнено ${r.missing.length} полей`:'Все статьи себестоимости заполнены'}</div><div class="cost-list">${r.rows.map(([label,value])=>`<div><span>${label}</span><b>${rub(value)}</b></div>`).join('')}</div><details><summary>Незаполненные и ошибочные поля себестоимости</summary><ul>${[...r.invalid,...r.missing].map(k=>`<li>${esc(fields.find(f=>f[0]===k)?.[1]||k)}</li>`).join('')||'<li>Нет</li>'}</ul></details>`;

 renderMarketplaceProfit(p,r);
 renderFullCalculation(p,r);

}
function renderFullCalculation(p,r){
 const partial=r.missing.length||r.invalid.length;
 $('#full-calculation').innerHTML=`<h2>Полный расчёт себестоимости и прибыли</h2><p>На одно изделие. ${partial?'Расчёт частичный: незаполненные затраты исключены.':'Все статьи себестоимости заполнены.'}</p><div class="table-scroll"><table class="calculation-table"><thead><tr><th>Статья</th><th>₽ на изделие</th></tr></thead><tbody>${groupedCalculation(p,r)}</tbody><tfoot><tr><th>Себестоимость изделия</th><td>${r.invalid.length?'—':rub(r.cost)}</td></tr></tfoot></table></div><h3>Прибыль по маркетплейсам</h3><div class="table-scroll"><table class="calculation-table"><thead><tr><th>Показатель</th><th>WB</th><th>Ozon</th></tr></thead><tbody>${[['Цена продажи','price'],['К переводу за товар','payout'],['Налог','tax'],['Себестоимость','cost'],['Прибыль / шт.','profit'],['Маржа','margin']].map(([title,field])=>`<tr><th>${title}</th>${['wb','ozon'].map(key=>`<td>${field==='margin'?pct(r.markets[key].margin):rub(field==='cost'?(r.invalid.length?null:r.cost):r.markets[key][field])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="tax-help">Прибыль = сумма к переводу за товар − налог − себестоимость. При незаполненных затратах прибыль предварительная.</p>`;
}
function renderCustom(){const p=product();$('#custom').innerHTML=p.custom.map(c=>`<div class="custom-row"><input data-cname="${esc(c.id)}" aria-label="Название расхода" value="${esc(c.name)}"><select data-cmode="${esc(c.id)}" aria-label="Способ расчёта"><option value="unit" ${c.mode==='unit'?'selected':''}>₽ на изделие</option>${c.mode==='percent'?'<option value="percent" selected>Старый процент · не учитывается</option>':''}</select><input data-camount="${esc(c.id)}" aria-label="Величина расхода" type="number" min="0" step="any" value="${c.amount??''}" placeholder="Не задано"><button data-cdelete="${esc(c.id)}" aria-label="Удалить расход">×</button></div>`).join('')||'<p class="empty">Пока нет дополнительных статей.</p>';
 for(const attr of ['cname','cmode','camount'])$('#custom').querySelectorAll(`[data-${attr}]`).forEach(e=>e.onchange=()=>{const c=p.custom.find(x=>x.id===e.dataset[attr]);c[{cname:'name',cmode:'mode',camount:'amount'}[attr]]=attr==='camount'?(e.value===''?null:Number(e.value)):e.value;save();renderResults();});$('#custom').querySelectorAll('[data-cdelete]').forEach(e=>e.onclick=()=>{p.custom=p.custom.filter(c=>c.id!==e.dataset.cdelete);save();renderCustom();renderResults();});}
function renderHistory(){const p=product();const clear=$('#clear-history');clear.disabled=!p.history.length;clear.onclick=safe(async()=>{if(!p.history.length||!await confirm('Очистить все сохранённые расчёты текущего товара «'+(p.sku||p.name)+'»? Текущие поля и файлы товара сохранятся.'))return;await backup();const previous=p.history;p.history=[];var saveResult=save();if(saveResult===false||(saveResult?.then&&await saveResult===false)){p.history=previous;return;}renderHistory();toast('История расчётов очищена. Восстановление: Бэкап → Вернуть предыдущую базу.');});$('#history').innerHTML=p.history.slice().reverse().map((h,i)=>`<div class="history-row"><span>${esc(h.date)}<small>${esc(h.platform)}</small></span><span>Цена ${rub(h.price)}</span><span>Прибыль ${rub(h.profit)} ${h.partial?'· частично':''}</span><button data-history="${p.history.length-1-i}">Открыть снимок JSON</button></div>`).join('')||'<p class="empty">Сохраните расчёт, чтобы сравнить его после изменения цен и тарифов.</p>';$('#history').querySelectorAll('[data-history]').forEach(e=>e.onclick=()=>download(p.history[+e.dataset.history],'calculation.json'));}
const safe=fn=>async(...args)=>{try{await fn(...args);}catch(e){toast(e.message);}};
function openLabelPrompt(design=false,selectedProducts=null,options={}){
 const dialog=document.createElement('dialog');dialog.className='label-prompt-dialog';dialog.setAttribute('aria-labelledby','label-prompt-title');
 dialog.innerHTML=`<div class="modal-head"><h2 id="label-prompt-title">${design==='description'?'Промпт для описания товара':design==='group'?'Промпт для этикеток всей группы':design?'Промпт для этикетки 58 × 40 мм':'Текст для языковой модели'}</h2><button type="button" data-prompt-close aria-label="Закрыть">×</button></div><p>Скопируйте текст и отправьте в языковую модель.</p>${design==='description'?'<label class="description-prompt-limit">Максимум символов описания · необязательно<input type="number" min="1" max="50000" data-no-stepper id="description-prompt-limit" placeholder="Лимит не задан"><small>С пробелами и переносами строк. Укажите предел нужного поля площадки.</small></label>':''}<textarea id="label-prompt-text" rows="16" aria-label="Промпт">${esc(design==='description'?buildCostDescriptionPrompt(product()):design==='group'?groupLabelDesignPrompt(product(),selectedProducts??db.products,db.filamentStock,options):design?labelDesignPrompt(product(),db.filamentStock):productLabelPrompt(product()))}</textarea><div class="confirm-actions"><button type="button" data-prompt-close>Закрыть</button><button type="button" id="label-prompt-copy">Скопировать</button></div><p id="label-prompt-status" role="status"></p>`;
 if(design==='description')dialog.querySelector('#description-prompt-limit').oninput=event=>{const input=event.target;if(!input.checkValidity())return;dialog.querySelector('#label-prompt-text').value=buildCostDescriptionPrompt(product(),{limit:input.value?Number(input.value):null});};
 const close=()=>{dialog.remove();$(design==='description'?'[data-description-prompt]':design==='group'?'#label-group-prompt':design?'#label-design-prompt':'#label-ai-prompt')?.focus({preventScroll:true});};dialog.querySelectorAll('[data-prompt-close]').forEach(button=>button.onclick=close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.querySelector('#label-prompt-copy').onclick=async()=>{const text=dialog.querySelector('textarea');try{await navigator.clipboard.writeText(text.value);dialog.querySelector('#label-prompt-status').textContent='Скопировано';}catch{text.focus();text.select();dialog.querySelector('#label-prompt-status').textContent='Нажмите ⌘C или Ctrl+C, чтобы скопировать';}};
 document.body.append(dialog);dialog.showModal();
}
async function pullBarcodeIntoProduct(){const p=product(),button=$('[data-barcode-pull]'),status=$('[data-barcode-status]');button.disabled=true;status.textContent='Загрузка…';try{const result=await pullProductBarcodes(p,db.products,getMarketplaceCredentials());const apply=async value=>{const previous=p.barcode;p.barcode=value;if(await save()===false){p.barcode=previous;throw Error('Не удалось сохранить штрихкод');}$('#barcode').value=value;status.textContent='✓ Получен';button.title='Штрихкод получен из карточки';};if(result.codes.length===1){await apply(result.codes[0].value);return;}const dialog=document.createElement('dialog');dialog.className='product-category-dialog';dialog.innerHTML='<div class="product-category-heading"><h2>Выберите штрихкод</h2><button type="button" data-close aria-label="Закрыть">×</button></div><p>В карточках найдено несколько разных штрихкодов. Выберите нужный для этого товара.</p><div class="product-category-results">'+result.codes.map((row,index)=>'<button type="button" class="product-category-option" data-barcode-index="'+index+'">'+esc(row.value)+' · '+row.markets.map(m=>m==='wb'?'WB':'Ozon').join(', ')+'</button>').join('')+'</div><p data-barcode-error role="status"></p><button type="button" data-close>Отмена</button>';document.body.append(dialog);dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());dialog.onclose=()=>{dialog.remove();if(status.textContent==='Выберите штрихкод')status.textContent='';};dialog.querySelectorAll('[data-barcode-index]').forEach(b=>b.onclick=async()=>{try{await apply(result.codes[Number(b.dataset.barcodeIndex)].value);dialog.close();}catch(error){dialog.querySelector('[data-barcode-error]').textContent=error.message;}});status.textContent='Выберите штрихкод';dialog.showModal();}catch(error){status.textContent='Не получен';throw error;}finally{button.disabled=false;}}
function openVariantColorPicker(){
 const previous=$('#variant-color-pick'),dialog=document.createElement('dialog');dialog.className='variant-color-dialog';dialog.setAttribute('aria-labelledby','variant-color-title');
 dialog.innerHTML=`<div class="modal-head"><h2 id="variant-color-title">Цвет варианта</h2><button type="button" data-color-close aria-label="Закрыть">×</button></div><p>Цвет заполнит отличия варианта и окончание артикула.</p><div class="variant-color-options">${Object.entries(variantColors).map(([name,color])=>`<button type="button" data-variant-color="${esc(name)}"><span class="variant-color-swatch" style="background:${color}"></span>${esc(name)}</button>`).join('')}</div><div class="confirm-actions"><button type="button" data-color-close>Отмена</button></div>`;
 const close=()=>{dialog.remove();previous?.focus();};dialog.querySelectorAll('[data-color-close]').forEach(button=>button.onclick=close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.querySelectorAll('[data-variant-color]').forEach(button=>button.onclick=()=>{const input=$('#variantNote');input.value=button.dataset.variantColor;dialog.remove();input.dispatchEvent(new window.Event('change'));$('#variant-color-pick')?.focus();});
 document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-variant-color]').focus();
}
function bind(){
 const profitProduct=product();
 const copyOzonProduct=$('[data-copy-ozon-product]');
 if(copyOzonProduct)copyOzonProduct.onclick=safe(async()=>{
  await navigator.clipboard.writeText(copyOzonProduct.dataset.copyOzonProduct);
  copyOzonProduct.textContent='✓ Ссылка скопирована';
  setTimeout(()=>{copyOzonProduct.textContent='Скопировать ссылку на товар';},2200);
 });
 const bindProfitNumber=(input,set)=>{
  input.oninput=()=>{
   if(!input.validity.valid)return;
   set(input.value===''?null:input.valueAsNumber);
   save();
   renderMarketplaceProfit(profitProduct,calculate(profitProduct));
  };
 };
 bindProfitNumber($('[data-profit-tax-rate]'),value=>{profitProduct.tax=value;});
 document.querySelectorAll('[data-profit-sale-price]').forEach(input=>bindProfitNumber(input,value=>{
  profitProduct.marketplaces[input.dataset.profitSalePrice].price=value;
 }));
 document.querySelectorAll('[data-profit-logistics]').forEach(input=>bindProfitNumber(input,value=>{
  const settings=profitProduct.marketplaceLogistics??={};
  const market=settings[input.dataset.market]??={};
  market[input.dataset.profitLogistics]=value;
 }));

 const description=$('.identity [data-product-description]');
 addCostFieldSpread(description,(row,value)=>{row.description=value;},{
  input:description,label:'Описание товара'
 });
 for(const input of document.querySelectorAll('[data-stock-market][data-stock-key]')){
  const {stockMarket,stockKey}=input.dataset;
  addCostFieldSpread(input.closest('label'),(row,value)=>{
   const rules=row.stockTargets??={};
   (rules[stockMarket]??={minimum:null,normal:null})[stockKey]=value;
  },{input,label:(stockMarket==='wb'?'WB':'Ozon')+' · '+input.closest('label').childNodes[0].textContent.trim()});
 }
 const spreadFields=[];
 const addSpread=(input,apply)=>spreadFields.push(addCostFieldSpread(input.closest('label'),apply,{
  input,
  label:[input.closest('.marketplace-profit-markets>div')?.querySelector('h3')?.textContent,input.closest('label').childNodes[0].textContent.trim()].filter(Boolean).join(' · ')
 }));
 addSpread($('[data-profit-tax-rate]'),(row,value)=>{row.tax=value;});
 for(const input of document.querySelectorAll('[data-profit-sale-price]'))addSpread(input,(row,value)=>{
  ensureMarketplaces(row)[input.dataset.profitSalePrice].price=value;
 });
 for(const input of document.querySelectorAll('[data-profit-logistics]'))addSpread(input,(row,value)=>{
  const logistics=row.marketplaceLogistics??={};
  const market=logistics[input.dataset.market]??={};
  market[input.dataset.profitLogistics]=value;
 });
 $('#spread-marketplace-profit').onclick=()=>openMarketplaceProfitPicker(spreadFields);
 const backupModeInput=document.querySelector('[data-backup-mode]');if(backupModeInput)backupModeInput.onchange=()=>{try{localStorage.setItem('workshop-backup-mode',backupModeInput.value);updateBackupModeLabels();}catch{toast('Не удалось запомнить режим');}};updateBackupModeLabels();bindWorkingFolderControls(document,{notify:toast});$('#app-zoom-out').onclick=()=>{appZoom=Math.max(60,appZoom-10);applyAppZoom();};$('#app-zoom-in').onclick=()=>{appZoom=Math.min(160,appZoom+10);applyAppZoom();};$('#app-zoom-reset').onclick=()=>{appZoom=100;applyAppZoom();};applyAppZoom();const p=product();
 $('[data-barcode-pull]').onclick=safe(pullBarcodeIntoProduct);$('#variant-color-pick').onclick=openVariantColorPicker;$('#label-design-prompt').onclick=()=>openLabelPrompt(true);$('#label-group-prompt').onclick=safe(async()=>{const folder=await workingDownloads.status();let outputDirectory=folder.name||'';try{outputDirectory=localStorage.getItem('workshop-label-output-folder')||outputDirectory;}catch{}openGroupLabelPicker({database:db,product:product(),outputDirectory,onGenerate:(members,options)=>{try{localStorage.setItem('workshop-label-output-folder',options.outputDirectory);}catch{}openLabelPrompt('group',members,options);},onClose:()=>$('#label-group-prompt')?.focus({preventScroll:true})});});
 bindProductList();$('#catalogue-refresh').onclick=async()=>{if(catalogueRefreshBusy)return;catalogueRefreshBusy=true;const button=$('#catalogue-refresh'),status=$('#catalogue-refresh-status');button.disabled=true;status.textContent='Обновляю карточки всех товаров…';try{const result=await refreshCatalogueCards(db,getMarketplaceCredentials(),{onSaved:()=>save()});status.textContent=result.map(r=>(r.market==='wb'?'WB':'Ozon')+': '+(r.error||('карточек '+r.count+' · параметры товаров: '+r.metadataCount+(r.warning?' · '+r.warning:'')))).join(' · ');for(const input of document.querySelectorAll('[data-catalogue-category]'))input.innerHTML=catalogueCategoryOptions(input.dataset.catalogueCategory);$('#product-list').innerHTML=productList(product());bindProductList();renderFields();for(const input of document.querySelectorAll('[data-product-description]'))input.value=product().description||'';for(const count of document.querySelectorAll('[data-description-count]'))count.textContent=Array.from(product().description||'').length.toLocaleString('ru-RU')+' символов · с пробелами и переносами строк';}catch(error){status.textContent=error.message;}finally{catalogueRefreshBusy=false;button.disabled=false;const current=$('#catalogue-refresh');if(current)current.disabled=false;}};const refreshCatalogue=()=>{productPage=0;$('#product-list').innerHTML=productList(product());bindProductList();};document.querySelector('[data-catalogue-group-picker]').onclick=openCatalogueGroupPicker;for(const input of document.querySelectorAll('[data-catalogue-presence]'))input.onchange=async()=>{const key=input.dataset.cataloguePresence;cataloguePresenceFilters[key]=input.value;const status=document.querySelector('.catalogue-file-filter-status');if(key==='model'&&input.value){status.textContent='Проверяю сохранённые модели…';await loadCatalogueModelStates();if(status.isConnected)status.textContent='';}refreshCatalogue();};$('#product-search').oninput=e=>{productQuery=e.target.value;refreshCatalogue();};$('#catalogue-group-filter').onchange=e=>{productGroupFilter=e.target.value;document.querySelector('[data-catalogue-group-picker] span').textContent=productGroupFilter==='__ungrouped__'?'Без группы':productGroupFilter||'Все группы';productCategoryFilters={wb:'',ozon:''};for(const input of document.querySelectorAll('[data-catalogue-category]'))input.innerHTML=catalogueCategoryOptions(input.dataset.catalogueCategory);refreshCatalogue();};for(const input of document.querySelectorAll('[data-catalogue-category]'))input.onchange=e=>{productCategoryFilters[e.target.dataset.catalogueCategory]=e.target.value;refreshCatalogue();};document.querySelector('[data-catalogue-reset]').onclick=()=>{productQuery='';productGroupFilter='';productCategoryFilters={wb:'',ozon:''};for(const key of Object.keys(cataloguePresenceFilters))cataloguePresenceFilters[key]='';$('#product-search').value='';$('#catalogue-group-filter').value='';document.querySelector('[data-catalogue-group-picker] span').textContent='Все группы';document.querySelectorAll('[data-catalogue-presence]').forEach(input=>input.value='');for(const input of document.querySelectorAll('[data-catalogue-category]'))input.innerHTML=catalogueCategoryOptions(input.dataset.catalogueCategory);refreshCatalogue();};for(const [selector,open] of [['[data-catalogue-collapse]',false],['[data-catalogue-expand]',true]])document.querySelector(selector).onclick=()=>{for(const p of db.products)productGroupOpen.set(p.productGroup||'',open);$('#product-list').querySelectorAll('details[data-group]').forEach(group=>group.open=open);};
 const restoreWorkspace=state=>{if(!state)return;space=state.space;selected=db.products.some(p=>p.id===state.selected)?state.selected:db.products[0].id;history.replaceState(null,'','#'+space);render();};$('#workspace-back').onclick=()=>restoreWorkspace(workspaceHistory.back());$('#workspace-forward').onclick=()=>restoreWorkspace(workspaceHistory.forward());
 $('#workspace-select').onchange=event=>{space=event.target.value;history.replaceState(null,'','#'+space);render();window.scrollTo?.({top:0});};
 document.querySelectorAll('[data-space]').forEach(button=>button.onclick=()=>{space=button.dataset.space;if(globalThis.history?.replaceState)history.replaceState(null,'','#'+space);render();window.scrollTo?.({top:0});});
 $('#label-pdf-file').onchange=safe(async()=>{const file=$('#label-pdf-file').files[0];if(!file)return;if(file.size>2*1024*1024)throw Error('PDF должен быть не больше 2 МБ');const buffer=await new Promise((resolve,reject)=>{const reader=new window.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Не удалось прочитать PDF'));reader.readAsArrayBuffer(file);});const label=await readLabelPdf({name:file.name,size:file.size,arrayBuffer:async()=>buffer});const old=p.labelPdf;p.labelPdf=label;save();if(saveError){p.labelPdf=old;return;}render();toast('Этикетка сохранена для этого товара');});
 $('#label-file-prompt').onclick=()=>openLabelPrompt(true);$('#label-print').onclick=safe(()=>printProductLabel(p.labelPdf,{notify:toast}));
 $('#template-save').onclick=safe(()=>{const t=createTemplate(product(),$('#template-name').value);if(db.templates.some(x=>x.name===t.name))throw Error('Шаблон с таким именем уже есть. Укажите другое имя.');db.templates.push(t);save();render();toast('Шаблон «'+t.name+'» сохранён');});
 const chosenTemplate=()=>db.templates.find(t=>t.id===$('#template-select').value);
 $('#template-select').onchange=()=>{const t=chosenTemplate();for(const id of ['template-apply','template-rename','template-update','template-delete'])$('#'+id).disabled=!t;};
 $('#template-rename').onclick=safe(async()=>{const t=chosenTemplate();if(!t)return;const name=prompt('Новое имя шаблона',t.name);if(name===null)return;const title=name.trim();if(!title)throw Error('Введите имя шаблона');if(db.templates.some(x=>x.id!==t.id&&x.name===title))throw Error('Шаблон с таким именем уже есть');await backup();t.name=title;save();render();toast('Шаблон переименован');});
 $('#template-update').onclick=safe(async()=>{const t=chosenTemplate();if(!t)return;if(!await confirm('Обновить шаблон «'+t.name+'» параметрами текущего расчёта?'))return;await backup();t.inputs=createTemplate(product(),t.name).inputs;save();render();toast('Шаблон обновлён из текущего расчёта');});
 $('#template-delete').onclick=safe(async()=>{const t=chosenTemplate();if(!t)return;if(!await confirm('Удалить шаблон «'+t.name+'»? Товары останутся без изменений.'))return;await backup();db.templates=db.templates.filter(x=>x.id!==t.id);save();render();toast('Шаблон удалён. Для отмены доступна предыдущая база в разделе данных.');});
 $('#template-apply').onclick=async()=>{const t=db.templates.find(x=>x.id===$('#template-select').value);if(!t)return toast('Выберите шаблон');if(!await confirm('Заполнить текущий товар по шаблону «'+t.name+'»? Текущие параметры будут заменены. Предыдущая база сохранится как резервная.'))return;try{const original=product();await backup();const previous=db.products,q=applyTemplate(original,t);db.products=db.products.map(x=>x.id===q.id?q:x);var saveResult=save();if(saveResult===false||(saveResult?.then&&await saveResult===false)){db.products=previous;throw Error('Шаблон не применён: не удалось сохранить товар');}render();toast('Шаблон применён');}catch(e){toast(e.message);}};$('#mobile-product').onchange=e=>{selected=e.target.value;render();};$('#mobile-add').onclick=()=>$('#add-product').click();$('#add-product').onclick=()=>{const q=blankProduct();db.products.push(q);selected=q.id;productQuery='';productGroupFilter='';productCategoryFilters={wb:'',ozon:''};for(const key of Object.keys(cataloguePresenceFilters))cataloguePresenceFilters[key]='';productGroupOpen.set(q.productGroup||'',true);productPage=catalogueProductBatches(db.products,productPageSize).findIndex(page=>page.some(item=>item.id===q.id));save();render();document.querySelector('#product-list .chosen')?.scrollIntoView?.({block:'nearest'});};document.querySelectorAll('[data-stock-market]').forEach(input=>{input.onchange=()=>{const value=input.value===''?null:Number(input.value);if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>1000000)){input.setCustomValidity('Введите целое число от 0 до 1000000');input.reportValidity();return;}input.setCustomValidity('');p.stockTargets??={};p.stockTargets[input.dataset.stockMarket]??={minimum:null,normal:null};p.stockTargets[input.dataset.stockMarket][input.dataset.stockKey]=value;save();updateStockTargetHelp();};});const updateStockTargetHelp=()=>{for(const market of ['wb','ozon']){const rule=p.stockTargets?.[market];document.querySelector('[data-stock-target-help="'+market+'"]').textContent=rule?.minimum!==null&&rule?.minimum!==undefined&&rule?.normal!==null&&rule?.normal!==undefined?(rule.normal>rule.minimum?'Допечатать до '+rule.normal+' шт., когда останется '+rule.minimum+' шт. или меньше.':'Нормальный остаток должен быть больше минимального.'): 'Задайте оба значения для расчёта.';}};updateStockTargetHelp();document.querySelectorAll('[data-tab]').forEach(e=>e.onclick=()=>{tab=e.dataset.tab;render();});for(const k of ['name','sku','productGroup','variantNote','variantNumber','barcode'])$('#'+k).onchange=e=>{p[k]=e.target.value;if(k==='variantNote'){const sku=variantSkuForColor(p.sku,p.variantNote);if(sku!==null)p.sku=sku;}save();render();};$('#duplicate').onclick=()=>{const q=structuredClone(p);q.id=crypto.randomUUID();q.history=[];q.sku=variantSkuPrefix(p.sku);q.variantNote='';q.colorCode='';q.barcode='';q.labelPdf=null;delete q.printModel;q.listingDrafts={};delete q.sharedListingChanges;if(!p.productGroup){p.productGroup=p.name;q.productGroup=p.name;}db.products.push(q);selected=q.id;save();render();};$('#delete-product').onclick=safe(async()=>{const queued=(db.printQueue||[]).filter(j=>j.productId===p.id&&!j.archivedAt).length;if(!await confirm('Удалить из приложения только вариант «'+(p.sku||p.name)+'»? Остальные варианты группы сохранятся. Карточка на площадке останется.'+(queued?' В очереди печати останутся задания этого варианта: '+queued+'.':'')))return;await backup();const before=structuredClone(db.products),previousSelected=selected,files=(await listFiles(db.id+':'+p.id)).filter(f=>f.category==='model');try{await rehomePrintModels(db,p);db.products=db.products.filter(q=>q.id!==p.id);if(!db.products.length)db.products.push(blankProduct());selected=db.products[0].id;var saveResult=save();if(saveResult===false||(saveResult?.then&&await saveResult===false))throw Error('Не удалось сохранить удаление варианта');}catch(error){await putFiles(files);db.products=before;selected=previousSelected;render();throw error;}render();toast('Вариант удалён. При необходимости используйте «Бэкап → Вернуть предыдущую базу».');});$('#add-custom').onclick=()=>{p.custom.push({id:crypto.randomUUID(),name:'Новый расход',mode:'unit',amount:null});save();renderCustom();renderResults();};$('#cost-report-pdf').onclick=safe(()=>openCostReport(db.products.map(productWithConfiguredPrices)));$('#snapshot').onclick=()=>{const r=calculate(p);p.history.push({date:new Date().toLocaleString('ru-RU'),platform:p.platform,price:r.price,profit:r.profit,markets:structuredClone(r.markets),partial:!!(r.missing.length||r.invalid.length),inputs:structuredClone({...p,history:[]}),results:r});save();renderHistory();toast('Снимок расчёта сохранён');};$('#full-export').onclick=safe(exportFullArchive);bindWebDavConnection();updateWebDavStatus();$('[data-webdav-run]').onclick=safe(requestWebDavSync);$('#webdav-upload').onclick=safe(()=>transferViaWebDav(true));$('#webdav-restore').onclick=safe(()=>transferViaWebDav(false));$('#transfer-export').onclick=safe(()=>exportFullArchive({replaceAll:true}));$('#full-import').onchange=safe(()=>restoreFullArchive($('#full-import').files[0]));$('#export').onclick=exportDB;$('#import').onchange=safe(async()=>{const f=$('#import').files[0];if(!f)return;if(f.size>20*1024*1024)throw Error('Файл слишком большой');const x=validateDB(JSON.parse(await f.text()));if(await confirm(backupModes[backupMode(x)]+': '+(backupMode(x)==='costs'?'обновить себестоимость и этикетки, сохранив остальные местные данные?':'заменить переносимые данные и нормы WB/Ozon? Очередь и филамент останутся местными.')+' Текущая база будет сохранена как резервная.')){await changeDB(x);toast('База загружена');}});$('#restore').onclick=safe(async()=>{const x=validateDB(await readDatabaseBackup({key:KEY}));if(await confirm('Вернуть предыдущую базу?'))await changeDB(x);});document.querySelector('[data-copy-app-address]').onclick=safe(async()=>{await navigator.clipboard.writeText('https://tpskym.github.io/wb-cost-pwa/');const button=document.querySelector('[data-copy-app-address]');if(button){button.textContent='✓ Адрес скопирован';button.setAttribute('aria-label','Адрес приложения скопирован');}toast('Адрес приложения скопирован');});$('#install').onclick=async()=>{await installPrompt?.prompt();installPrompt=null;$('#install').hidden=true;};}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;if($('#install'))$('#install').hidden=false;});window.addEventListener('online',()=>{$('#network').textContent='Онлайн';});window.addEventListener('offline',()=>{$('#network').textContent='Офлайн';});window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue!==JSON.stringify(db)){toast('База изменена в другой вкладке. Перезагрузите страницу перед редактированием.');document.querySelectorAll('input,select,button').forEach(x=>x.disabled=true);}});
installNumberControls();installPrintActionControls();modelMigration=migrateProductModels(db);render();modelMigration.then(changed=>{if(changed){save();if(['cost','cards'].includes(space))renderFiles();}}).catch(()=>toast('Не удалось проверить старые модели. Файлы сохранены, попробуйте открыть себестоимость снова.'));if(initialStorageError)toast('Не удалось создать базу в IndexedDB. Сохранение на устройстве недоступно.');if(backupMigrationError)toast('Не удалось перенести старую резервную копию. Она сохранена в прежнем хранилище.');if(databaseStorage.migrationError)toast('Не удалось перенести базу в IndexedDB. Исходная база сохранена. Скачайте полный ZIP.');if(recoveryRaw)toast('Повреждённая база сохранена. Используйте экспорт для восстановления.');if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('Офлайн-режим недоступен в этом браузере'));

export const flushDatabase=()=>databaseStorage.flush();

getFile(syncRecordId).then(async record=>{
 if(record?.state?.account){
  webDavState=record.state;
  webDavAccount??=record.state.account;
  startWebDavScheduler();
 }else checkWebDavOnOpen();
}).catch(()=>{});
