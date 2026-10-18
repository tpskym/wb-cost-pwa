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
