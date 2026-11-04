import {createBackupSnapshot,backupMode,costProductIds,applyBackupSnapshot} from './backup-modes.js?v=0.2.290';
import {databaseForCloud} from './google-drive-backup.js?v=0.2.290';
import {makeZip,readZip,safeFilename} from './attachments.js?v=0.2.290';
import {validateDB} from './calc.js?v=0.2.290';
const categories=['card-design','product-image','model','source-wb','source-ozon','source','ready','marketplace-image'];
export async function createFullBackup(database,records,{mode=database.backupMode??'full',onProgress=()=>{}}={}){
 const db=validateDB(createBackupSnapshot(database,mode)),owners=new Map(db.products.map(p=>[db.id+':'+p.id,p.id]));
 const files=[],entries=[];
 for(const record of records){if(mode==='costs'&&!['product-image','model','card-design'].includes(record.category))continue;const cache=record.category==='marketplace-image'&&record.owner===db.id+':marketplace-photos'&&typeof record.sku==='string'&&record.sku.trim();if(record.category==='marketplace-image'?!cache:!owners.has(record.owner))throw Error('Файл не принадлежит базе');const path='files/'+String(files.length+1).padStart(6,'0')+'/'+safeFilename(record.name);files.push({path,fileId:record.id,productId:cache?null:owners.get(record.owner),...(cache?{sku:record.sku}:{}),name:record.name,category:record.category,createdAt:record.createdAt,type:record.blob.type,size:record.blob.size});entries.push({name:path,blob:record.blob});}
 const manifest={format:'workshop-full-backup',version:1,createdAt:new Date().toISOString(),database:'database.json',files};
 entries.unshift({name:'manifest.json',blob:new Blob([JSON.stringify(manifest,null,2)])},{name:'database.json',blob:new Blob([JSON.stringify(db,null,2)])});
 return makeZip(entries,{onProgress:(done,total)=>onProgress({stage:'Создание ZIP',done,total,unit:'bytes'})});
}
export async function parseFullBackup(blob,{onProgress=()=>{}}={}){
 const entries=await readZip(blob,{onProgress:(done,total)=>onProgress({stage:'Проверка ZIP',done,total,unit:'bytes'})});if(!entries.has('manifest.json')||!entries.has('database.json'))throw Error('Это не полный архив приложения');
 if(entries.get('manifest.json').size>20*1024*1024||entries.get('database.json').size>20*1024*1024)throw Error('Слишком большой файл базы или манифеста');
 const manifest=JSON.parse(await entries.get('manifest.json').text());
 if(manifest.format!=='workshop-full-backup'||manifest.version!==1||manifest.database!=='database.json'||!Array.isArray(manifest.files))throw Error('Неподдерживаемая версия полного архива');
 const database=validateDB(databaseForCloud(JSON.parse(await entries.get('database.json').text()))),products=new Set(database.products.map(p=>p.id)),used=new Set(),files=[];
 onProgress({stage:'Проверка файлов',done:0,total:manifest.files.length,unit:'files'});
 for(const f of manifest.files){
  if(!f||typeof f.path!=='string'||!f.path.startsWith('files/')||used.has(f.path)||!entries.has(f.path)||!(f.category==='marketplace-image'?f.productId===null&&typeof f.sku==='string'&&f.sku.trim():products.has(f.productId))||typeof f.name!=='string'||!f.name||!categories.includes(f.category)||typeof f.createdAt!=='string'||typeof f.type!=='string'||!Number.isSafeInteger(f.size)||f.size<0||entries.get(f.path).size!==f.size)throw Error('Некорректные данные файла в архиве');
  used.add(f.path);files.push({...f,blob:new Blob([entries.get(f.path)],{type:f.type})});onProgress({stage:'Проверка файлов',done:files.length,total:manifest.files.length,unit:'files'});await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(entries.size!==files.length+2)throw Error('Состав архива не совпадает с описанием');
 return {database,files};
}
export function stageFullRestore(parsed,{localDatabase}={}){
 const database=structuredClone(parsed.database);database.id=crypto.randomUUID();
 const references=new Map();
 const records=parsed.files.map(f=>{const id=crypto.randomUUID();if(f.fileId)references.set(f.productId+':'+f.fileId,id);return {id,owner:database.id+':'+(f.category==='marketplace-image'?'marketplace-photos':f.productId),...(f.category==='marketplace-image'?{sku:f.sku}:{}),name:f.name,category:f.category,createdAt:f.createdAt,blob:f.blob};});
 for(const product of database.products){const ref=product.printModel;if(ref){const id=references.get(ref.ownerId+':'+ref.fileId);if(id)product.printModel={...ref,fileId:id};else delete product.printModel;}}
 for(const product of database.products)for(const draft of Object.values(product.listingDrafts||{}))for(const photo of draft.photos||[]){const id=references.get(product.id+':'+photo.fileId);if(photo.kind==='local'&&id)photo.fileId=id;}

 if(localDatabase){if(backupMode(parsed.database)==='costs'){const ids=costProductIds(database,localDatabase),merged=applyBackupSnapshot(database,localDatabase,{modelReferences:true});const sorted=[...records].sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));const importedAt=Date.now();for(const [i,record]of sorted.entries()){const ownerId=record.owner.slice(database.id.length+1);record.owner=merged.id+':'+(ids.get(ownerId)||ownerId);record.sourceCreatedAt=record.createdAt;record.createdAt=new Date(importedAt+i).toISOString();}return {database:merged,records};}return {database:applyBackupSnapshot(database,localDatabase),records};}
 return {database,records};
}
// Storage commit is last: a failed file write can never activate an incomplete database.
export async function commitFullRestore(parsed,{savePrevious,writeFiles,commitDatabase,localDatabase,onProgress=()=>{}}){
 const staged=stageFullRestore(parsed,{localDatabase});onProgress({stage:'Сохранение резервной копии'});await savePrevious();onProgress({stage:'Сохранение файлов',done:0,total:staged.records.length,unit:'files'});await writeFiles(staged.records);onProgress({stage:'Сохранение базы'});await commitDatabase(staged.database);onProgress({stage:'Восстановлено',done:1,total:1});return staged.database;
}
