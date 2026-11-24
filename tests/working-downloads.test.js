import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {getFile,putFile} from '../attachments.js';
import {createWorkingDownloads,workingFileName} from '../working-downloads.js';
function fixture(){const files=new Map(),events=[];let saved={},picks=0,deny=false,failWrite=false;const directory={name:'Downloads',queryPermission:async()=>deny?'denied':'granted',requestPermission:async()=>deny?'denied':'granted',getFileHandle:async(name)=>({getFile:async()=>{if(!files.has(name))throw Object.assign(new Error('missing'),{name:'NotFoundError'});return new File([files.get(name)],name);},createWritable:async()=>{let pending;return {write:async blob=>{events.push('write:'+name);if(failWrite)throw Error('disk failed');pending=await blob.text();},close:async()=>{events.push('close:'+name);files.set(name,pending);},abort:async()=>events.push('abort:'+name)};}}),removeEntry:async name=>{events.push('remove:'+name);files.delete(name);}};const service=createWorkingDownloads({read:async()=>saved,write:async state=>{saved=state;},supported:()=>true,pick:async()=>{picks++;return directory;},fallback:()=>{throw Error('must not download duplicates');}});return {files,events,service,directory,get saved(){return saved;},get picks(){return picks;},deny:()=>{deny=true;},fail:()=>{failWrite=true;}};}
test('labels and models have fixed English names independent of their database names',()=>{assert.equal(workingFileName('Этикетка white.pdf','label'),'label.pdf');assert.equal(workingFileName('stand_white.3MF','model'),'model.3mf');assert.equal(workingFileName('another.step','model'),'model.step');assert.throws(()=>workingFileName('file.exe','model'),/Неизвестный/);});
test('choose folder once, overwrite label and model, and remove only the previously managed model format',async()=>{const f=fixture();f.files.set('personal.stl','untouched');await f.service.save(new Blob(['label1']),'one.pdf','label');await f.service.save(new Blob(['label2']),'two.pdf','label');await f.service.save(new Blob(['model1']),'one.stl','model');await f.service.save(new Blob(['model2']),'two.3mf','model');assert.equal(f.picks,1);assert.equal(f.files.get('label.pdf'),'label2');assert.equal(f.files.get('model.3mf'),'model2');assert.equal(f.files.has('model.stl'),false);assert.equal(f.files.get('personal.stl'),'untouched');assert.ok(f.events.indexOf('remove:model.stl')>f.events.indexOf('close:model.3mf'));assert.equal(f.saved.modelName,'model.3mf');const restored=createWorkingDownloads({read:async()=>f.saved,write:async()=>{},supported:()=>true,pick:()=>{throw Error('must reuse saved handle');}});await restored.save(new Blob(['new']),'other.3mf','model');assert.equal(f.files.get('model.3mf'),'new');});
test('denied access and failed write never fall back to duplicate downloads or delete the old model',async()=>{const f=fixture();await f.service.save(new Blob(['old']),'old.stl','model');f.fail();await assert.rejects(()=>f.service.save(new Blob(['new']),'new.3mf','model'),/disk failed/);assert.equal(f.files.get('model.stl'),'old');assert.equal(f.files.has('model.3mf'),false);assert.ok(f.events.includes('abort:model.3mf'));f.deny();await assert.rejects(()=>f.service.save(new Blob(['x']),'model.stl','model'),/Нет доступа/);});
test('PDF preview background saving never opens a folder picker or asks for permission',async()=>{const f=fixture();assert.equal(await f.service.save(new Blob(['pdf']),'x.pdf','label',{onlyIfConfigured:true}),null);assert.equal(f.picks,0);await f.service.choose();f.deny();assert.equal(await f.service.save(new Blob(['pdf']),'x.pdf','label',{onlyIfConfigured:true}),null);assert.equal(f.files.size,0);});
test('unsupported browsers use fixed names while explaining overwrite limitations',async()=>{let filename='',message='';const service=createWorkingDownloads({supported:()=>false,fallback:(_blob,name)=>{filename=name;}});await service.save(new Blob(['x']),'different.pdf','label',{notify:text=>{message=text;}});assert.equal(filename,'label.pdf');assert.match(message,/Chrome или Edge/);});

test('choosing a working folder never rewrites a legacy download or the other file receipt',async t=>{
 const previous=globalThis.indexedDB;
 globalThis.indexedDB=new IDBFactory();
 t.after(()=>{if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous;});
 const key='__working-downloads-folder';
 const oldModel={name:'model.3mf',sourceName:'existing.3mf',blob:new Blob(['old model'])};
 await putFile({id:key,owner:'__device-settings',directory:{name:'Old folder'},recent:{model:oldModel}});
 const originalPut=IDBObjectStore.prototype.put;
 const writes=[];
 t.mock.method(IDBObjectStore.prototype,'put',function(record){
  if(record.recent?.model?.blob)throw new DOMException('Failed to write blobs (InvalidBlob)','DataError');
  writes.push(record.id);
  return originalPut.call(this,record);
 });
 class PrintFolder{
  name='Print';
  async queryPermission(){return 'granted';}
  async getFileHandle(){
   return {createWritable:async()=>({write:async()=>{},close:async()=>{}})};
  }
 }
 const service=createWorkingDownloads({supported:()=>true,pick:async()=>new PrintFolder()});
 assert.equal(await service.choose(),'Print');
 await service.save(new Blob(['new label']),'new.pdf','label');
 assert.deepEqual(writes,[key+'-access',key+'-label']);
 assert.equal((await getFile(key+'-access')).recent,undefined);
 assert.equal((await getFile(key)).recent.model.sourceName,'existing.3mf');
 const restored=createWorkingDownloads();
 const status=await restored.status();
 assert.equal(status.name,'Print');
 assert.equal(status.recent.label.sourceName,'new.pdf');
 assert.equal(await (await restored.recent('model')).file.text(),'old model');
});

test('on Windows, a stuck local receipt and a rejected folder setting do not block completed file saves',{timeout:1000},async t=>{
 const previous=globalThis.window;
 globalThis.window={navigator:{userAgent:'Windows NT 10.0'}};
 t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
 const directory={
  name:'Print',
  queryPermission:async()=> 'granted',
  getFileHandle:async()=>({createWritable:async()=>({write:async()=>{},close:async()=>{}})})
 };
 const events=[],notices=[];
 const notify=message=>notices.push(message);
 const service=createWorkingDownloads({
  read:async()=>({}),supported:()=>true,pick:async()=>directory,onChange:()=>{},
  write:async(_state,part)=>{
   if(part==='access')throw new DOMException('Failed to write blobs','DataError');
   if(part==='model')await new Promise(()=>{});
  },
  onSaved:detail=>events.push(detail.name)
 });
 assert.equal(await service.choose({notify}),'Print');
 await service.save(new Blob(['model']),'part.3mf','model',{notify});
 await service.save(new Blob(['label']),'part.pdf','label',{notify});
 assert.deepEqual(events,['model.3mf','label.pdf']);
 assert.equal((await service.status()).recent.label.sourceName,'part.pdf');
 assert.ok(notices.some(message=>/на этот сеанс.*Failed to write blobs/.test(message)));
});
test('latest links retain original names and the last successful files without being changed by a failed write',async()=>{const f=fixture();await f.service.save(new Blob(['label']),'white.pdf','label');await f.service.save(new Blob(['model']),'stand.stl','model');let status=await f.service.status();assert.equal(status.recent.label.name,'label.pdf');assert.equal(status.recent.label.sourceName,'white.pdf');assert.equal(status.recent.model.sourceName,'stand.stl');assert.ok(status.recent.label.savedAt);f.fail();await assert.rejects(()=>f.service.save(new Blob(['bad']),'next.3mf','model'));status=await f.service.status();assert.equal(status.recent.model.name,'model.stl');});
test('latest regular download remains openable from its stored contents',async()=>{let saved={},downloads=0;const service=createWorkingDownloads({read:async()=>saved,write:async state=>{saved=state;},supported:()=>false,fallback:()=>{downloads++;}});await service.save(new Blob(['pdf'],{type:'application/pdf'}),'custom.pdf','label');const item=await service.recent('label');assert.equal(item.file.name,'label.pdf');assert.equal(await item.file.text(),'pdf');assert.equal(downloads,1);const restored=createWorkingDownloads({read:async()=>saved,supported:()=>false});assert.equal(await (await restored.recent('label')).file.text(),'pdf');});

test('opening a recent working model reads its actual saved file without another download or write',async()=>{const f=fixture();await f.service.save(new Blob(['saved']),'part.stl','model');const count=f.events.length;assert.equal(await (await f.service.recent('model')).file.text(),'saved');assert.equal(f.events.length,count);f.files.set('model.stl','externally changed');assert.equal(await (await f.service.recent('model')).file.text(),'externally changed');f.files.delete('model.stl');await assert.rejects(()=>f.service.recent('model'),/Файл удалён/);});
test('recent label opens its stored PDF and a failed read closes the temporary tab',async()=>{const {openRecentWorkingFile}=await import('../working-downloads.js');let location='',closed=0;const doc={defaultView:{open:()=>({opener:{},location:{replace:url=>{location=url;}},close:()=>{closed++;}})}};await openRecentWorkingFile('label',{document:doc,service:{recent:async()=>({file:new File(['%PDF-'],'label.pdf',{type:'application/pdf'})})}});assert.match(location,/^blob:/);await assert.rejects(()=>openRecentWorkingFile('label',{document:doc,service:{recent:async()=>{throw Error('deleted');}}}),/deleted/);assert.equal(closed,1);});

test('Safari native saving uses a unique transfer filename and retains the receipt link across reloads',async()=>{let stored={},downloaded='',event;const service=createWorkingDownloads({read:async()=>stored,write:async value=>{stored=value;},supported:()=>false,nativeTransfer:()=>true,fallback:(_blob,name)=>{downloaded=name;},onSaved:item=>{event=item;},onChange:()=>{}});await service.save(new Blob(['model']),'original.3mf','model');assert.match(downloaded,/^workshop-transfer-[a-f0-9]{32}-model\.3mf\.workshop$/);assert.equal(event.transfer.name,'model.3mf');assert.equal(event.transfer.token,stored.recent.model.transfer.token);const first=downloaded;await service.save(new Blob(['next']),'second.3mf','model');assert.notEqual(downloaded,first);const restored=createWorkingDownloads({read:async()=>stored,supported:()=>false,nativeTransfer:()=>true});assert.equal((await restored.status()).recent.model.transfer.token,event.transfer.token);event=null;assert.equal(await service.save(new Blob(['pdf']),'label.pdf','label',{onlyIfConfigured:true}),null);assert.equal(event,null);});
