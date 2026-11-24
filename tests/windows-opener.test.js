import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {windowsFileLink,windowsOpenerEnabled,renderWindowsOpenerSettings,bindWindowsOpener,showSavedWindowsFile} from '../windows-opener.js';
import {createWorkingDownloads,openRecentWorkingFile} from '../working-downloads.js';
import {printProductLabel} from '../product-labels.js';
function fixture(agent='Windows NT 10.0'){const dom=new JSDOM('<body>'+renderWindowsOpenerSettings()+'</body>',{url:'https://tpskym.github.io/wb-cost-pwa/'});Object.defineProperty(dom.window.navigator,'userAgent',{value:agent});dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};return dom;}
test('Windows protocol accepts only fixed label and model filenames, never paths or commands',()=>{assert.equal(windowsFileLink('model.3mf'),'workshop-files://open/model.3mf');assert.equal(windowsFileLink('label.pdf'),'workshop-files://open/label.pdf');for(const name of ['../label.pdf','model.exe','model.stl?x=1','model.stl#arg','model.stl\n','x.pdf','C:\\model.stl'])assert.throws(()=>windowsFileLink(name));});
test('Windows setting is opt in and persists on this device; save dialog opens only for a real working-folder write',()=>{const dom=fixture(),doc=dom.window.document;assert.equal(windowsOpenerEnabled(dom.window),false);assert.equal(showSavedWindowsFile({name:'model.3mf',directory:'Print'},{document:doc}),null);bindWindowsOpener(doc);const input=doc.querySelector('[data-windows-opener]');input.checked=true;input.dispatchEvent(new dom.window.Event('change'));assert.equal(windowsOpenerEnabled(dom.window),true);bindWindowsOpener(doc);assert.equal(input.checked,true);const event=new dom.window.CustomEvent('workshop:file-saved',{detail:{name:'model.3mf',directory:'Print',sourceName:'source <part>.3mf'}});dom.window.dispatchEvent(event);assert.equal(doc.querySelectorAll('#working-file-saved').length,1);assert.equal(doc.querySelector('#working-file-saved a').getAttribute('href'),'workshop-files://open/model.3mf');assert.match(doc.querySelector('#working-file-saved').textContent,/source <part>/);dom.window.dispatchEvent(event);assert.equal(doc.querySelectorAll('#working-file-saved').length,1);doc.querySelector('#working-file-saved .modal-head button').click();assert.equal(doc.querySelector('#working-file-saved'),null);assert.equal(showSavedWindowsFile({name:'label.pdf'},{document:doc}),null);dom.window.close();});
test('recent link uses native association when enabled without reading or re-downloading the file',async()=>{const dom=fixture();dom.window.localStorage.setItem('workshop-windows-opener-v1','enabled');const view={navigator:dom.window.navigator,localStorage:dom.window.localStorage,location:{href:''}};const item={name:'model.3mf',directory:{name:'Print'}};await openRecentWorkingFile('model',{document:{defaultView:view},service:{status:async()=>({recent:{model:item}}),recent:()=>{throw Error('must not read the file in the browser');}}});assert.equal(view.location.href,'workshop-files://open/model.3mf');await assert.rejects(()=>openRecentWorkingFile('label',{document:{defaultView:view},service:{status:async()=>({recent:{label:{name:'label.pdf'}}})}}),/рабочую папку/);dom.window.close();});
test('save popup event follows successful explicit writes, never a failed write or background label save',async()=>{const calls=[];let fail=false;const directory={name:'Print',queryPermission:async()=> 'granted',getFileHandle:async()=>({createWritable:async()=>({write:async()=>{if(fail)throw Error('full');},close:async()=>calls.push('closed'),abort:async()=>{}})})};const service=createWorkingDownloads({read:async()=>({directory}),write:async()=>{},supported:()=>true,onChange:()=>{},onSaved:item=>calls.push(item.name)});await service.save(new Blob(['x']),'x.3mf','model');assert.deepEqual(calls,['closed','model.3mf']);calls.length=0;await service.save(new Blob(['x']),'x.pdf','label',{onlyIfConfigured:true});assert.deepEqual(calls,['closed']);calls.length=0;fail=true;await assert.rejects(()=>service.save(new Blob(['x']),'x.pdf','label'));assert.deepEqual(calls,[]);});

test('Windows shows the saved model and opens explicit print jobs with a fresh click',async t=>{
 const dom=fixture(),doc=dom.window.document;
 t.after(()=>dom.window.close());
 let written='',downloaded='';
 const directory={name:'Print',queryPermission:async()=> 'granted',getFileHandle:async()=>({
  createWritable:async()=>({write:async blob=>{written=await blob.text();},close:async()=>{}})
 })};
 const service=createWorkingDownloads({
  read:async()=>({directory}),write:async()=>{},supported:()=>true,
  onSaved:detail=>dom.window.dispatchEvent(new dom.window.CustomEvent('workshop:file-saved',{detail})),
  fallback:(_blob,name)=>{downloaded=name;}
 });
 bindWindowsOpener(doc);
 await service.save(new Blob(['selected model']),'part.3mf','model',{openAfterSave:true});
 const dialog=doc.querySelector('#working-file-saved[open]');
 assert.equal(written,'selected model');
 assert.equal(dialog.querySelector('.working-open-native').getAttribute('href'),'workshop-files://open/model.3mf');
 assert.ok(dialog.querySelector('a[download="workshop-windows.zip"]'));
 assert.equal(windowsOpenerEnabled(dom.window),false);
 dialog.querySelector('[data-download-model]').click();
 assert.equal(downloaded,'model.3mf');
 assert.equal(doc.querySelector('#working-file-saved'),null);
 assert.equal(showSavedWindowsFile({name:'label.pdf',directory:'Print'},{document:doc}),null);

 dom.window.localStorage.setItem('workshop-windows-opener-v1','enabled');
 const activation={isActive:true},opened=[];
 Object.defineProperty(dom.window.navigator,'userActivation',{value:activation});
 doc.addEventListener('click',event=>{
  if(event.target.matches('.working-open-native')){
   event.preventDefault();
   opened.push([event.target.getAttribute('href'),written]);
  }
 });
 await service.save(new Blob(['new model']),'new.3mf','model',{openAfterSave:true});
 assert.deepEqual(opened,[['workshop-files://open/model.3mf','new model']]);
 await service.save(new Blob(['download only']),'download.3mf','model');
 assert.equal(opened.length,1);
 activation.isActive=false;
 await service.save(new Blob(['slow model']),'slow.3mf','model',{openAfterSave:true});
 assert.equal(opened.length,1);
 doc.querySelector('.working-open-native').click();
 assert.deepEqual(opened[1],['workshop-files://open/model.3mf','slow model']);

 activation.isActive=true;
 const label={name:'new-label.pdf',data:'data:application/pdf;base64,'+btoa('%PDF-1.7 new label')};
 await printProductLabel(label,{view:dom.window,service,open:()=>assert.fail('Expected the Windows viewer')});
 assert.deepEqual(opened[2],['workshop-files://open/label.pdf','%PDF-1.7 new label']);
 assert.equal(doc.querySelector('#working-file-saved[open] .working-saved-name').textContent,'label.pdf');
});

test('printing can choose or reauthorize the folder after the original click expires',async t=>{
 const dom=fixture(),doc=dom.window.document;
 const previousWindow=globalThis.window;
 globalThis.window=dom.window;
 t.after(()=>{
  if(previousWindow===undefined)delete globalThis.window;
  else globalThis.window=previousWindow;
  dom.window.close();
 });
 const activation={isActive:false};
 Object.defineProperty(dom.window.navigator,'userActivation',{value:activation});
 let granted=true,picks=0,requests=0,files=0;
 const directory={
  name:'Print',
  queryPermission:async()=>granted?'granted':'prompt',
  requestPermission:async()=>{
   assert.equal(activation.isActive,true);
   requests++;
   granted=true;
   return 'granted';
  },
  getFileHandle:async()=>({createWritable:async()=>({write:async()=>{},close:async()=>{files++;}})})
 };
 const service=createWorkingDownloads({
  read:async()=>({}),write:async()=>{},supported:()=>true,
  pick:async()=>{assert.equal(activation.isActive,true);picks++;return directory;},
  onSaved:()=>{},onChange:()=>{}
 });
 const save=()=>service.save(new Blob(['model']),'part.3mf','model');
 const dialogButton=async selector=>{
  await new Promise(resolve=>setImmediate(resolve));
  return doc.querySelector('.app-confirm[open] '+selector);
 };
 const first=save();
 const choose=await dialogButton('.confirm-accept');
 assert.equal(choose.textContent,'Выбрать папку');
 assert.equal(picks,0);
 activation.isActive=true;
 choose.click();
 await first;
 assert.equal(picks,1);
 assert.equal(files,1);

 activation.isActive=false;
 granted=false;
 const canceled=save();
 (await dialogButton('button')).click();
 assert.equal(await canceled,null);
 assert.equal(requests,0);
 assert.equal(files,1);
 const retried=service.save(new Blob(['%PDF-1.7']),'label.pdf','label',{openAfterSave:true});
 const allow=await dialogButton('.confirm-accept');
 assert.equal(allow.textContent,'Разрешить запись');
 activation.isActive=true;
 allow.click();
 await retried;
 assert.equal(requests,1);
 assert.equal(files,2);
});

test('Mac download is available inside the app and enabling its component uses a separate local preference',()=>{const dom=fixture('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'),doc=dom.window.document;assert.ok(doc.querySelector('a[download="workshop-macos.zip"]'));assert.ok(doc.querySelector('a[download="workshop-windows.zip"]'));dom.window.localStorage.setItem('workshop-windows-opener-v1','enabled');assert.equal(windowsOpenerEnabled(dom.window),false);bindWindowsOpener(doc);const input=doc.querySelector('[data-windows-opener]');assert.equal(input.disabled,false);input.checked=true;input.dispatchEvent(new dom.window.Event('change'));assert.equal(dom.window.localStorage.getItem('workshop-macos-opener-v1'),'enabled');const popup=showSavedWindowsFile({name:'label.pdf',directory:'Print'},{document:doc});assert.equal(popup.querySelector('a').textContent,'Открыть на Mac');assert.equal(popup.querySelector('a').getAttribute('href'),'workshop-files://open/label.pdf');popup.close();dom.window.close();});
test('iPad desktop user agent does not enable a Mac-only component',()=>{const dom=fixture('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Mobile/15E148');bindWindowsOpener(dom.window.document);assert.equal(dom.window.document.querySelector('[data-windows-opener]').disabled,true);dom.window.close();});

test('Safari download popup and recent link address the exact transfer instead of the old working file',async()=>{const {macTransferLink}=await import('../windows-opener.js');const dom=fixture('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18 Safari/605.1.15'),doc=dom.window.document;dom.window.localStorage.setItem('workshop-macos-opener-v1','enabled');const transfer={token:'a'.repeat(32),name:'model.3mf'};const popup=showSavedWindowsFile({name:'model.3mf',sourceName:'part.3mf',transfer},{document:doc});assert.match(popup.textContent,/Файл скачивается/);assert.match(popup.querySelector('a').textContent,/Перенести/);assert.equal(popup.querySelector('a').getAttribute('href'),macTransferLink(transfer));const view={navigator:dom.window.navigator,localStorage:dom.window.localStorage,location:{href:''}};await openRecentWorkingFile('model',{document:{defaultView:view},service:{status:async()=>({recent:{model:{name:'model.3mf',transfer}}})}});assert.equal(view.location.href,macTransferLink(transfer));assert.throws(()=>macTransferLink({token:'../x',name:'model.3mf'}));popup.close();dom.window.close();});

test('Safari without a hidden setting shows setup before downloading, then the transfer action',async()=>{const {requestMacComponent}=await import('../windows-opener.js');const dom=fixture('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15');const {createWorkingDownloads}=await import('../working-downloads.js');let stored={},downloaded='';const service=createWorkingDownloads({supported:()=>false,read:async()=>stored,write:async value=>{stored=value;},nativeTransfer:()=>requestMacComponent({document:dom.window.document}),fallback:(_blob,name)=>{downloaded=name;},onChange:()=>{},onSaved:item=>showSavedWindowsFile(item,{document:dom.window.document})});const saving=service.save(new Blob(['pdf']),'label.pdf','label');await new Promise(resolve=>setTimeout(resolve,0));assert.ok(dom.window.document.querySelector('#working-component-setup'));assert.equal(downloaded,'');dom.window.document.querySelector('[data-component-ready]').click();await saving;assert.match(downloaded,/^workshop-transfer-.*\.workshop$/);assert.ok(dom.window.document.querySelector('#working-file-saved a[href^="workshop-files://import/"]'));assert.equal(windowsOpenerEnabled(dom.window),true);dom.window.close();});
test('closing Safari component setup cancels the download without enabling anything',async()=>{const {requestMacComponent}=await import('../windows-opener.js');const dom=fixture('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15');const pending=requestMacComponent({document:dom.window.document});dom.window.document.querySelector('[data-cancel]').click();await assert.rejects(pending,{name:'AbortError'});assert.equal(windowsOpenerEnabled(dom.window),false);dom.window.close();});
