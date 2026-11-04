import {getFile,putFile} from './attachments.js?v=0.2.268';
export async function writeDatabaseBackup(raw,{storage=globalThis.localStorage,key='workshop-db-v1',write=putFile}={}){
 const database=JSON.parse(raw),savedAt=new Date().toISOString(),copy=JSON.stringify({...database,_backupAt:savedAt});
 try{await write({id:key+'-database-backup',owner:'__database-backup',category:'database-backup',name:'previous-database.json',createdAt:savedAt,blob:new Blob([copy],{type:'application/json'})});}catch{throw Error('Не удалось создать резервную копию в IndexedDB. Сначала скачайте текущую базу.');}
 try{storage.removeItem(key+'-backup');}catch{}

}
export async function readDatabaseBackup({storage=globalThis.localStorage,key='workshop-db-v1',read=getFile}={}){
 const copies=[];try{const raw=storage.getItem(key+'-backup');if(raw)copies.push(JSON.parse(raw));}catch{}
 try{const record=await read(key+'-database-backup');if(record)copies.push(JSON.parse(await record.blob.text()));}catch{}
 copies.sort((a,b)=>String(b._backupAt||b.updatedAt||'').localeCompare(String(a._backupAt||a.updatedAt||'')));
 if(!copies.length)throw Error('Резервная копия не найдена');return copies[0];
}

export async function migrateLegacyDatabaseBackup(options={}){const {storage=globalThis.localStorage,key='workshop-db-v1'}=options;let raw;try{raw=storage.getItem(key+'-backup');}catch{}if(!raw)return;const previous=await readDatabaseBackup(options);await writeDatabaseBackup(JSON.stringify(previous),options);}
