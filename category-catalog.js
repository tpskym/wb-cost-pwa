import {normalizeCategories} from './listing-fields.js?v=0.2.139';
function openCatalogDB(){return new Promise((resolve,reject)=>{const request=indexedDB.open('workshop-category-catalogs-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('catalogs',{keyPath:'market'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function catalogTransaction(mode,action){const db=await openCatalogDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('catalogs',mode),request=action(tx.objectStore('catalogs'));let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Сохранение справочника отменено'));});}finally{db.close();}}
export const readCatalog=market=>catalogTransaction('readonly',store=>store.get(market));
export const writeCatalog=catalog=>catalogTransaction('readwrite',store=>store.put(catalog));
const normalize=s=>String(s).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
export function searchCatalog(rows,query){const words=normalize(query).split(' ').filter(Boolean);return rows.filter(row=>{const label=normalize(row.label);return words.every(word=>label.includes(word));});}
export async function fetchCatalog(market,request,progress=()=>{},pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 const rows=[],seen=new Set();
 if(market==='wb'){
  let offset=0;
  for(;;){const result=await request('categories',{offset});if(!Array.isArray(result.data))throw Error('Не удалось прочитать справочник WB');const batch=normalizeCategories('wb',result);let added=0;for(const row of batch){const key=String(row.id);if(!seen.has(key)){seen.add(key);rows.push(row);added++;}}progress(rows.length);
   if(result.data.length<1000)break;if(!added)throw Error('WB вернул повторную страницу. Старый справочник сохранён, попробуйте обновить позже');offset+=result.data.length;await pause(650);
  }
 }else if(market==='ozon'){const result=await request('categories',{language:'DEFAULT'});if(!Array.isArray(result.result))throw Error('Не удалось прочитать справочник Ozon');for(const row of normalizeCategories('ozon',result)){const key=row.id+':'+row.typeId;if(!seen.has(key)){seen.add(key);rows.push(row);}}progress(rows.length);}
 else throw Error('Неизвестная площадка');
 return {market,rows,updatedAt:new Date().toISOString(),complete:true};
}
