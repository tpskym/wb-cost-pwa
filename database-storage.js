import {getFile,putFile} from './attachments.js?v=0.2.214';
// Keep synchronous saves while localStorage works; switch to durable IndexedDB on failure.
export function createDatabaseStorage({storage=globalThis.localStorage,key='workshop-db-v1',read=getFile,write=putFile,validate=raw=>JSON.parse(raw)}={}){
 let indexed=false,tail=Promise.resolve(),persisted=null;
 return {async loadRaw(){let local=null,record=null;try{local=storage.getItem(key);}catch{}try{record=await read(key+'-main-database');}catch{}if(record){try{const raw=await record.blob.text();validate(raw);let newer=true;try{const previous=local?JSON.parse(local):null,current=JSON.parse(raw);newer=!previous||(current.id===previous.id&&Number.isSafeInteger(current.revision)&&Number.isSafeInteger(previous.revision)?current.revision>=previous.revision:Date.parse(record.createdAt)>=Date.parse(previous.updatedAt||0));}catch{}if(newer){indexed=true;persisted=raw;return raw;}}catch{}}persisted=local;return local;},
 saveRaw(raw){if(!indexed){try{storage.setItem(key,raw);persisted=raw;return true;}catch{indexed=true;}}
 const record={id:key+'-main-database',owner:'__main-database',category:'main-database',name:'database.json',createdAt:new Date().toISOString(),blob:new Blob([raw],{type:'application/json'})};
 const next=tail.catch(()=>{}).then(()=>write(record)).then(()=>{persisted=raw;return true;});tail=next;return next;},
 get persistedRaw(){return persisted;},get usesIndexedDB(){return indexed;},flush:()=>tail};
}
