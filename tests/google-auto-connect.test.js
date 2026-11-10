import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('async function connectGoogle('),end=source.indexOf('\n}',start)+2;
function setup({cancel=false,account='same@example.com'}={}){
 const requests=[],saved=[];
 const context=vm.createContext({config:{clientId:'123.apps.googleusercontent.com',googleAccount:'same@example.com',driveFileId:'existing'},CONFIG:'config',token:null,googleTokenExpires:0,googlePending:null,driveId:'existing',googleError:null,googleStatus:'',Date,Number,Promise,Error,$:()=>({value:'123.apps.googleusercontent.com'}),validGoogleClientId:()=>true,localStorage:{setItem:(k,v)=>saved.push(JSON.parse(v))},loadGoogleIdentity:async()=>{},updateDriveControls:()=>{},fetch:async()=>({ok:true,json:async()=>({user:{emailAddress:account}})}),window:{google:{accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:request=>{requests.push({...request,hint:options.login_hint});queueMicrotask(()=>cancel?options.error_callback():options.callback({access_token:'secret',expires_in:3600}));}})}}}},queueMicrotask});
 vm.runInContext(source.slice(start,end),context);return {context,requests,saved};
}
test('automatic authorization uses remembered account without forced chooser',async()=>{const s=setup();assert.equal(await vm.runInContext('connectGoogle(false)',s.context),'secret');assert.equal(s.requests[0].prompt,'');assert.equal(s.requests[0].hint,'same@example.com');assert.equal(s.context.config.driveFileId,'existing');assert.ok(s.saved.every(x=>!JSON.stringify(x).includes('secret')));});
test('explicit switch clears previous account file binding',async()=>{const s=setup({account:'other@example.com'});await vm.runInContext('connectGoogle(true)',s.context);assert.equal(s.requests[0].prompt,'select_account');assert.equal(s.context.config.googleAccount,'other@example.com');assert.equal(s.context.config.driveFileId,undefined);});
test('cancelled authorization rejects without starting exchange',async()=>{const s=setup({cancel:true});await assert.rejects(vm.runInContext('connectGoogle(false)',s.context),/отменён/);assert.equal(s.context.googlePending,null);assert.equal(s.context.token,null);});
