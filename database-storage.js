import {getFile,putFile} from './attachments.js?v=0.2.262';
// IndexedDB is the only write target. localStorage is read solely for migration.
export function createDatabaseStorage({storage=globalThis.localStorage,key='workshop-db-v1',read=getFile,write=putFile,validate=raw=>JSON.parse(raw)}={}){
 let tail=Promise.resolve(),persisted=null,migrationError=null;
 const clearLegacy=()=>{try{storage.removeItem(key);}catch{}};
 const saveRaw=raw=>{const record={id:key+'-main-database',owner:'__main-database',category:'main-database',name:'database.json',createdAt:new Date().toISOString(),blob:new Blob([raw],{type:'application/json'})};const next=tail.catch(()=>{}).then(()=>write(record)).then(()=>{persisted=raw;clearLegacy();return true;});tail=next;return next;};
 return {async loadRaw(){let local=null,record=null,stored=null,corrupt=null;try{local=storage.getItem(key);}catch{}try{record=await read(key+'-main-database');if(record){const raw=await record.blob.text();corrupt=raw;validate(raw);stored=raw;}}catch{}
 let validLocal=false;try{if(local){validate(local);validLocal=true;}}catch{}
 if(stored){let useStored=true;try{const previous=validLocal?JSON.parse(local):null,current=JSON.parse(stored);useStored=!previous||(current.id===previous.id&&Number.isSafeInteger(current.revision)&&Number.isSafeInteger(previous.revision)?current.revision>=previous.revision:Date.parse(record.createdAt)>=Date.parse(previous.updatedAt||0));}catch{}if(useStored){persisted=stored;clearLegacy();return stored;}}
 if(validLocal){persisted=local;try{await saveRaw(local);}catch(error){migrationError=error;}return local;}
 persisted=local||corrupt;return persisted;},saveRaw,
 get persistedRaw(){return persisted;},get usesIndexedDB(){return true;},get migrationError(){return migrationError;},flush:()=>tail};
}
