import {loadedListingForSku} from './calc.js?v=0.2.197';
import {listBody,marketRequest,readAllWBCards} from './marketplace-api.js?v=0.2.197';
// Presence snapshots do not replace editable card drafts or send changes to marketplaces.
export function rememberCatalogueCards(database,market,cards,complete=false){
 const skus=cards.map(card=>String((market==='wb'?card.vendorCode:card.offer_id)||'').trim()).filter(Boolean),previous=database.catalogueCards?.[market];
 database.catalogueCards??={};database.catalogueCards[market]={skus:[...new Set(complete?skus:[...(previous?.skus||[]),...skus])],complete:complete||!!previous?.complete,updatedAt:new Date().toISOString()};
}
export function catalogueCardPresence(database,product,market){
 const sku=String(product.sku||'').trim();if(!sku)return null;
 const snapshot=database.catalogueCards?.[market];if(snapshot?.skus?.includes(sku))return true;if(snapshot?.complete)return false;
 return loadedListingForSku(database.products,sku,market)?true:null;
}
export async function refreshCatalogueCards(database,credentials,{request=marketRequest,onSaved=()=>{}}={}){
 const results=[];
 for(const market of ['wb','ozon']){
  if(market==='wb'?!credentials.wbToken:!credentials.ozonKey||!credentials.ozonClient){results.push({market,error:'Ключ не настроен'});continue;}
  try{
   let cards;
   if(market==='wb')cards=await readAllWBCards((op,body)=>request(market,op,credentials,body));
   else{cards=[];let cursor=null;const seen=new Set();for(;;){const result=await request(market,'list',credentials,listBody(market,'',cursor)),batch=result.result?.items;if(!Array.isArray(batch))throw Error('Не удалось прочитать список карточек Ozon');cards.push(...batch);const next=result.result?.last_id;if(batch.length<100)break;if(!next||seen.has(next))throw Error('Ozon повторил страницу: сохранён прежний список');seen.add(next);cursor=next;}}
   rememberCatalogueCards(database,market,cards,true);onSaved(market);results.push({market,count:cards.length});
  }catch(error){results.push({market,error:error.message});}
 }
 return results;
}
export function catalogueStatusMatches(database,product,filters={},modelState=null){
 const states={wb:catalogueCardPresence(database,product,'wb'),ozon:catalogueCardPresence(database,product,'ozon'),label:!!product.labelPdf?.data?.startsWith('data:application/pdf;base64,'),model:modelState};
 return Object.entries(filters).every(([key,value])=>!value||(value==='yes'?states[key]===true:value==='no'?states[key]===false:states[key]===null));
}
