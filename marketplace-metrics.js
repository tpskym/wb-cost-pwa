import {marketRequest,readAllWBCards} from './marketplace-api.js?v=0.2.179';
const errorText=error=>typeof error==='string'?error:JSON.stringify(error);
export async function loadWBCreationErrors(request){
 const batches=[],seen=new Set();let cursor={limit:100};
 for(;;){const response=await request('errors',{cursor,order:{ascending:true}});const rows=Array.isArray(response.data)?response.data:response.data?.items||response.items;
 if(!Array.isArray(rows))throw Error('Не удалось прочитать список ошибок WB');batches.push(...rows);
 const next=response.cursor||response.data?.cursor;
 if(rows.length<100)break;
 if(!next?.updatedAt||!next?.batchUUID)throw Error('Не удалось проверить все страницы ошибок WB');
 const key=next.updatedAt+':'+next.batchUUID;if(seen.has(key))throw Error('WB повторил страницу ошибок');seen.add(key);cursor={limit:100,updatedAt:next.updatedAt,batchUUID:next.batchUUID};
 }
 return batches.flatMap(batch=>{const errors=batch.errors;if(!errors)return [];if(Array.isArray(errors))return errors.map(error=>({article:(batch.vendorCodes||[]).join(', '),message:errorText(error)}));if(typeof errors==='object')return Object.entries(errors).map(([article,error])=>({article,message:errorText(error)}));return [{article:(batch.vendorCodes||[]).join(', '),message:String(errors)}];});
}
export async function loadWBStocks(cards,request){
 const warehouses=await request('warehouses',{});if(!Array.isArray(warehouses))throw Error('Не удалось прочитать склады продавца WB');
 const ids=[...new Set(cards.flatMap(card=>(card.sizes||[]).map(size=>size.chrtID)).filter(id=>Number(id)>0))];
 const totals=new Map(ids.map(id=>[String(id),0]));
 for(const warehouse of warehouses){for(let offset=0;offset<ids.length;offset+=1000){const result=await request('stocks',{warehouseId:Number(warehouse.id),chrtIds:ids.slice(offset,offset+1000)});if(!Array.isArray(result.stocks))throw Error('Не удалось прочитать остатки WB');for(const row of result.stocks){const id=String(row.chrtId??row.chrtID);if(totals.has(id)&&Number.isFinite(row.amount))totals.set(id,totals.get(id)+row.amount);}}}
 for(const card of cards){const sizes=card.sizes||[];card.stockSummary=sizes.length&&sizes.every(s=>totals.has(String(s.chrtID)))?'Остаток FBS: '+sizes.reduce((n,s)=>n+totals.get(String(s.chrtID)),0)+' шт. · склады продавца':'Остаток FBS: нет ID размеров';}
}
export async function loadOzonStocks(cards,request){
 for(let offset=0;offset<cards.length;offset+=100){const batch=cards.slice(offset,offset+100),result=await request('stocks',{filter:{offer_id:batch.map(card=>card.offer_id),visibility:'ALL'},limit:100,cursor:''});const rows=result.items||result.result?.items;if(!Array.isArray(rows))throw Error('Не удалось прочитать остатки Ozon');
 for(const card of batch){const row=rows.find(row=>row.offer_id===card.offer_id);if(!row||!Array.isArray(row.stocks)){card.stockSummary='Остаток: не получен';continue;}card.stockSummary=row.stocks.length?row.stocks.map(stock=>String(stock.type||'Склад').toUpperCase()+': '+stock.present+' шт. · резерв '+stock.reserved+' шт.').join('; '):'Остаток: 0 шт.';}}
}
export async function loadOzonQuality(cards,request){
 const eligible=cards.filter(card=>card.sku);for(const card of cards)card.qualitySummary='Качество: SKU не получен';
 for(let offset=0;offset<eligible.length;offset+=100){const batch=eligible.slice(offset,offset+100),result=await request('quality',{skus:batch.map(card=>String(card.sku))});if(!Array.isArray(result.products))throw Error('Не удалось прочитать контент-рейтинг Ozon');
 for(const card of batch){const row=result.products.find(row=>String(row.sku)===String(card.sku));card.qualitySummary=row&&typeof row.rating==='number'?'Качество карточки: '+row.rating+'/100 · Ozon':'Качество: Ozon не вернул оценку';}}
}

export function mainPhoto(value){const list=Array.isArray(value)?value:[value];for(const item of list){const raw=typeof item==='string'?item:item?.big||item?.c516x688||item?.c246x328||item?.url||item?.file_name;try{const url=new URL(raw);if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;}catch{}}return '';}
export function productMainPhoto(product,market){const draft=product?.listingDrafts?.[market];if(!draft)return '';try{if(market==='wb'){const photo=mainPhoto(draft.photos)||mainPhoto(draft.photoURLs);if(photo)return photo;const body=JSON.parse(draft.body);return mainPhoto(body?.[0]?.photos)||mainPhoto(body?.[0]?.variants?.[0]?.photos);}return mainPhoto(JSON.parse(draft.body)?.items?.[0]?.images);}catch{return '';}}
export function tableProductPhoto(row,product,market){const url=mainPhoto(row.imageUrl)||productMainPhoto(product,market),escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return `<span class="table-product-image"><span class="table-photo-placeholder">Нет фото</span>${url?`<img class="table-product-photo" src="${escape(url)}" alt="Главное фото ${escape(row.sku||'товара')}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}</span>`;}
export function bindTablePhotos(root){for(const image of root.querySelectorAll('.table-product-photo'))image.onerror=()=>{image.hidden=true;};}
export async function enrichRowPhotos(market,rows,products,request){const wanted=new Set(rows.map(r=>r.sku).filter(Boolean)),images=new Map();if(!wanted.size)return rows;for(const product of products){const url=productMainPhoto(product,market);if(url)images.set(product.sku,url);}for(const row of rows){const url=mainPhoto(row.imageUrl);if(url)images.set(row.sku,url);}try{if(market==='wb'){for(const card of await readAllWBCards(request)){const url=mainPhoto(card.photos);if(url&&wanted.has(card.vendorCode))images.set(card.vendorCode,url);}}else{const skus=[...wanted];for(let i=0;i<skus.length;i+=100){const response=await request('info',{offer_id:skus.slice(i,i+100),product_id:[],sku:[]});for(const item of response.items||response.result?.items||[]){const url=mainPhoto(item.primary_image)||mainPhoto(item.images);if(url)images.set(item.offer_id,url);}}}}catch(error){for(const row of rows)if(images.has(row.sku))row.imageUrl=images.get(row.sku);throw error;}for(const row of rows)if(images.has(row.sku))row.imageUrl=images.get(row.sku);return rows;}
