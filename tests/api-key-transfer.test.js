import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {performanceCredentials,savePerformanceCredentials} from '../ozon-performance.js';
const dom=new JSDOM('<div id="api"></div>',{url:'https://tpskym.github.io/wb-cost-pwa/'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,indexedDB});
const {parseSharedCredentials,serializeSharedCredentials,mountMarketplaceUI,getMarketplaceCredentials}=await import('../marketplace-ui.js');
const keys={wbToken:'wb-example',ozonKey:'ozon-example',ozonClient:'12345'};
test('credential bundle round trips only marketplace credentials',()=>{const text=serializeSharedCredentials({...keys,googleToken:'excluded'});assert.deepEqual(parseSharedCredentials(text),keys);assert.ok(!text.includes('excluded'));for(const text of ['hello','{}',JSON.stringify({type:'workshop-api-credentials',version:1,...keys,ozonClient:'not-id'})])assert.throws(()=>parseSharedCredentials(text));});
test('clipboard import saves all three keys, clears secret text, and rejects malformed input atomically',async()=>{let clipboard=serializeSharedCredentials(keys);Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{readText:async()=>clipboard,writeText:async value=>{clipboard=value;}}}});const root=document.querySelector('#api');mountMarketplaceUI({container:root,product:{id:'p',listingDrafts:{}},owner:'db:p',save:()=>{},toast:()=>{},settingsOnly:true});await root.querySelector('#api-paste-keys').onclick();assert.deepEqual(getMarketplaceCredentials(),keys);assert.deepEqual(JSON.parse(localStorage.getItem('workshop-marketplace-keys-v1')),keys);assert.equal(root.querySelector('#api-transfer-text').value,'');await root.querySelector('#api-share-keys').onclick();assert.deepEqual(parseSharedCredentials(clipboard),keys);clipboard='invalid';await root.querySelector('#api-paste-keys').onclick();assert.deepEqual(getMarketplaceCredentials(),keys);root.querySelector('#api-transfer-text').value=serializeSharedCredentials({...keys,wbToken:'new-wb'});root.querySelector('#api-import-keys').click();assert.equal(getMarketplaceCredentials().wbToken,'new-wb');});

test('Google OAuth Client ID is copied and saved with marketplace keys; older bundles still work',async()=>{const googleClientId='123-google.apps.googleusercontent.com';let savedGoogle='',clipboard=serializeSharedCredentials({...keys,googleClientId});Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{readText:async()=>clipboard,writeText:async value=>{clipboard=value;}}}});const root=document.querySelector('#api');mountMarketplaceUI({container:root,product:{id:'p2',listingDrafts:{}},owner:'db:p2',save:()=>{},toast:()=>{},settingsOnly:true,getGoogleClientId:()=>savedGoogle,saveGoogleClientId:value=>{savedGoogle=value;}});await root.querySelector('#api-paste-keys').onclick();assert.equal(savedGoogle,googleClientId);assert.deepEqual(getMarketplaceCredentials(),keys);assert.equal(JSON.parse(localStorage.getItem('workshop-marketplace-keys-v1')).googleClientId,undefined);await root.querySelector('#api-share-keys').onclick();assert.equal(parseSharedCredentials(clipboard).googleClientId,googleClientId);clipboard=serializeSharedCredentials(keys);await root.querySelector('#api-paste-keys').onclick();assert.equal(savedGoogle,googleClientId);assert.throws(()=>parseSharedCredentials(JSON.stringify({type:'workshop-api-credentials',version:1,...keys,googleClientId:'not-google'})),/Google Client ID/);});

test('the token transfer copies Performance API credentials and restores them for the report',async()=>{
 const ozonPerformance={id:'example@performance.ozon.ru',secret:'example-performance-secret'};
 const root=document.querySelector('#api');
 let clipboard='';
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{
  readText:async()=>clipboard,writeText:async value=>{clipboard=value;}
 }}});
 mountMarketplaceUI({container:root,product:{id:'p3',listingDrafts:{}},owner:'db:p3',
  save:()=>{},toast:()=>{},settingsOnly:true});
 root.querySelector('#api-forget-keys').click();
 savePerformanceCredentials(window,ozonPerformance);
 await root.querySelector('#api-share-keys').onclick();
 const copied=parseSharedCredentials(clipboard);
 assert.deepEqual(copied.ozonPerformance,ozonPerformance);
 assert.equal(copied.wbToken,'');
 savePerformanceCredentials(window,{});
 await root.querySelector('#api-paste-keys').onclick();
 assert.deepEqual(performanceCredentials(window),ozonPerformance);
 assert.equal(localStorage.getItem('workshop-marketplace-keys-v1'),null);
 assert.match(root.querySelector('#api-transfer-status').textContent,/Доступ к Ozon Performance API сохранён/);
 clipboard=serializeSharedCredentials(keys);
 await root.querySelector('#api-paste-keys').onclick();
 assert.deepEqual(performanceCredentials(window),ozonPerformance);
 assert.throws(()=>parseSharedCredentials(JSON.stringify({...JSON.parse(clipboard),ozonPerformance:{id:ozonPerformance.id}})),
  /Client ID и Client Secret/);
});

test('failure to save Google access rolls back both Ozon Performance and marketplace keys',async()=>{
 const ozonPerformance={id:'existing@performance.ozon.ru',secret:'existing-secret'};
 savePerformanceCredentials(window,ozonPerformance);
 let clipboard=serializeSharedCredentials(keys);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{readText:async()=>clipboard}}});
 const root=document.querySelector('#api');
 mountMarketplaceUI({container:root,product:{id:'p4',listingDrafts:{}},owner:'db:p4',
  save:()=>{},toast:()=>{},settingsOnly:true,saveGoogleClientId:()=>{throw Error('Хранилище недоступно.');}});
 await root.querySelector('#api-paste-keys').onclick();
 clipboard=serializeSharedCredentials({...keys,wbToken:'new-wb',
  ozonPerformance:{id:'incoming@performance.ozon.ru',secret:'incoming-secret'},
  googleClientId:'123-google.apps.googleusercontent.com'});
 await root.querySelector('#api-paste-keys').onclick();
 assert.deepEqual(performanceCredentials(window),ozonPerformance);
 assert.deepEqual(JSON.parse(localStorage.getItem('workshop-marketplace-keys-v1')),keys);
 assert.deepEqual(getMarketplaceCredentials(),keys);
 assert.equal(root.querySelector('#api-transfer-status').textContent,'Хранилище недоступно.');
});
