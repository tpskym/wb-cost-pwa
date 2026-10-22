import {makeZip,readZip,safeFilename} from './attachments.js?v=0.2.77';
import {validateDB} from './calc.js?v=0.2.77';
const categories=['model','source-wb','source-ozon','source','ready'];
export async function createFullBackup(database,records){
 const db=validateDB(structuredClone(database)),owners=new Map(db.products.map(p=>[db.id+':'+p.id,p.id]));
 const files=[],entries=[];
 for(const record of records){if(!owners.has(record.owner))throw Error('Файл не принадлежит базе');const path='files/'+String(files.length+1).padStart(6,'0')+'/'+safeFilename(record.name);files.push({path,fileId:record.id,productId:owners.get(record.owner),name:record.name,category:record.category,createdAt:record.createdAt,type:record.blob.type,size:record.blob.size});entries.push({name:path,blob:record.blob});}
 const manifest={format:'workshop-full-backup',version:1,createdAt:new Date().toISOString(),database:'database.json',files};
 entries.unshift({name:'manifest.json',blob:new Blob([JSON.stringify(manifest,null,2)])},{name:'database.json',blob:new Blob([JSON.stringify(db,null,2)])});
 return makeZip(entries);
}
export async function parseFullBackup(blob){
 const entries=await readZip(blob);if(!entries.has('manifest.json')||!entries.has('database.json'))throw Error('Это не полный архив приложения');
 if(entries.get('manifest.json').size>20*1024*1024||entries.get('database.json').size>20*1024*1024)throw Error('Слишком большой файл базы или манифеста');
 const manifest=JSON.parse(await entries.get('manifest.json').text());
 if(manifest.format!=='workshop-full-backup'||manifest.version!==1||manifest.database!=='database.json'||!Array.isArray(manifest.files))throw Error('Неподдерживаемая версия полного архива');
 const database=validateDB(JSON.parse(await entries.get('database.json').text())),products=new Set(database.products.map(p=>p.id)),used=new Set(),files=[];
 for(const f of manifest.files){
  if(!f||typeof f.path!=='string'||!f.path.startsWith('files/')||used.has(f.path)||!entries.has(f.path)||!products.has(f.productId)||typeof f.name!=='string'||!f.name||!categories.includes(f.category)||typeof f.createdAt!=='string'||typeof f.type!=='string'||!Number.isSafeInteger(f.size)||f.size<0||entries.get(f.path).size!==f.size)throw Error('Некорректные данные файла в архиве');
  used.add(f.path);files.push({...f,blob:new Blob([entries.get(f.path)],{type:f.type})});
 }
 if(entries.size!==files.length+2)throw Error('Состав архива не совпадает с описанием');
 return {database,files};
}
export function stageFullRestore(parsed){
 const database=structuredClone(parsed.database);database.id=crypto.randomUUID();
 const references=new Map();
 const records=parsed.files.map(f=>{const id=crypto.randomUUID();if(f.fileId)references.set(f.productId+':'+f.fileId,id);return {id,owner:database.id+':'+f.productId,name:f.name,category:f.category,createdAt:f.createdAt,blob:f.blob};});
 for(const product of database.products)for(const draft of Object.values(product.listingDrafts||{}))for(const photo of draft.photos||[]){const id=references.get(product.id+':'+photo.fileId);if(photo.kind==='local'&&id)photo.fileId=id;}

 return {database,records};
}
// Storage commit is last: a failed file write can never activate an incomplete database.
export async function commitFullRestore(parsed,{savePrevious,writeFiles,commitDatabase}){
 const staged=stageFullRestore(parsed);await savePrevious();await writeFiles(staged.records);await commitDatabase(staged.database);return staged.database;
}
