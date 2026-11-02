import {listFiles,putFile} from './attachments.js?v=0.2.232';
import {productMainPhoto,mainPhoto} from './marketplace-metrics.js?v=0.2.232';
const pending=new Map();
export function productImageSources(database,product){return [...new Set([mainPhoto(product.marketplaceImageUrl),productMainPhoto(product,'wb'),productMainPhoto(product,'ozon'),...[...(database.stockSnapshots||[]),...(database.orderSnapshots||[])].flatMap(snapshot=>(snapshot.rows||[]).filter(row=>row.sku===product.sku).map(row=>mainPhoto(row.imageUrl)))].filter(Boolean))];}
export async function ensureProductImage(database,product,{read=listFiles,write=putFile,fetcher=globalThis.fetch,download=true}={}){
 const owner=database.id+':'+product.id,cacheSku=product.photoCacheSku,category=cacheSku?'marketplace-image':'product-image',matches=file=>file.category===category&&(!cacheSku||file.sku===cacheSku)&&file.blob?.size>0,pendingKey=owner+':'+(cacheSku||'')+':'+download;if(pending.has(pendingKey))return pending.get(pendingKey);
 const work=(async()=>{const files=await read(owner),existing=files.filter(matches).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];if(existing)return existing;if(!download)return null;
 for(const source of productImageSources(database,product)){try{const response=await fetcher(source,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});if(!response.ok)continue;const type=(response.headers.get('content-type')||'').split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(type)||Number(response.headers.get('content-length'))>10*1024*1024)continue;const reader=response.body?.getReader();let blob;if(reader){const chunks=[];let size=0;try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>10*1024*1024){await reader.cancel();throw Error('Фото больше 10 МБ');}chunks.push(part.value);}}finally{reader.releaseLock();}blob=new Blob(chunks,{type});}else blob=await response.blob();if(!blob.size||blob.size>10*1024*1024)continue;
 const newer=(await read(owner)).filter(matches).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];if(newer)return newer;const record={id:crypto.randomUUID(),owner,category,...(cacheSku?{sku:cacheSku}:{}),name:'product-photo.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type]),createdAt:new Date().toISOString(),blob,sourceUrl:source};await write(record);return record;
 }catch{}}
 return null;})();pending.set(pendingKey,work);try{return await work;}finally{pending.delete(pendingKey);}
}

export function ensureMarketplaceImage(database,sku,imageUrl,options){if(!sku)return Promise.resolve(null);return ensureProductImage(database,{id:'marketplace-photos',sku,photoCacheSku:sku,marketplaceImageUrl:imageUrl},options);}
