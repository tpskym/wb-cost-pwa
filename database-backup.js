import {getFile,putFile} from './attachments.js?v=0.2.213';
export async function writeDatabaseBackup(raw,{storage=globalThis.localStorage,key='workshop-db-v1',write=putFile}={}){
 const database=JSON.parse(raw),savedAt=new Date().toISOString(),copy=JSON.stringify({...database,_backupAt:savedAt});let local=false,indexed=false;
 try{storage.setItem(key+'-backup',copy);local=true;}catch{}
 try{await write({id:key+'-database-backup',owner:'__database-backup',category:'database-backup',name:'previous-database.json',createdAt:savedAt,blob:new Blob([copy],{type:'application/json'})});indexed=true;}catch{}
 if(!local&&!indexed)throw Error('Не удалось создать резервную копию. Сначала скачайте текущую базу.');
}
export async function readDatabaseBackup({storage=globalThis.localStorage,key='workshop-db-v1',read=getFile}={}){
 const copies=[];try{const raw=storage.getItem(key+'-backup');if(raw)copies.push(JSON.parse(raw));}catch{}
 try{const record=await read(key+'-database-backup');if(record)copies.push(JSON.parse(await record.blob.text()));}catch{}
 copies.sort((a,b)=>String(b._backupAt||b.updatedAt||'').localeCompare(String(a._backupAt||a.updatedAt||'')));
 if(!copies.length)throw Error('Резервная копия не найдена');return copies[0];
}
