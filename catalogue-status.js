import {loadedListingForSku} from './calc.js?v=0.2.294';
import {listBody,marketRequest,readAllWBCards} from './marketplace-api.js?v=0.2.294';
import {normalizeCategories} from './listing-fields.js?v=0.2.294';
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
const positive=(value,factor=1)=>{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>0?Math.round(n*factor*1000)/1000:null;};
export function cardMeasurementValues(market,card){
 const values={},dimensions={},scale=market==='wb'?10:({mm:1,cm:10,in:25.4}[card.dimension_unit]),weightScale=market==='wb'?1000:({g:1,kg:1000,lb:453.59237}[card.weight_unit]);
 for(const key of ['width','height','depth']){const value=market==='wb'?card.dimensions?.[key==='depth'?'length':key]:card[key],n=scale?positive(value,scale):null;if(n!==null)dimensions[key]=n;}
 if(Object.keys(dimensions).length)values.packaged=dimensions;
 const weight=weightScale?positive(market==='wb'?card.dimensions?.weightBrutto:card.weight,weightScale):null;if(weight!==null)values.packagingWeight=weight;
 // Use only explicitly named, unambiguous unpackaged characteristics; never infer from shipping dimensions.
 for(const attribute of card.characteristics||card.attributes||[]){const name=String(attribute.name||'').toLowerCase().trim(),value=Array.isArray(attribute.value)?attribute.value[0]:attribute.value??attribute.values?.[0]?.value;let key;
 if(/^ширина (товара|предмета) без упаковки,? (мм|см)$/.test(name))key='width';if(/^высота (товара|предмета) без упаковки,? (мм|см)$/.test(name))key='height';if(/^(глубина|длина) (товара|предмета) без упаковки,? (мм|см)$/.test(name))key='depth';
 if(key){const n=positive(value,name.endsWith('см')?10:1);if(n!==null){values.product??={};values.product[key]=n;}}
 if(/^вес (товара|предмета) без упаковки,? (г|кг)$/.test(name)){const n=positive(value,name.endsWith('кг')?1000:1);if(n!==null)values.productWeight=n;}
 }
 return values;
}
export function applyCatalogueCardMetadata(database,market,cards,categories=[]){let updated=0;
 for(const product of database.products||[]){const sku=String(product.sku||'').trim();if(!sku)continue;const card=cards.find(card=>String((market==='wb'?card.vendorCode:card.offer_id)||'').trim()===sku);if(!card)continue;const id=Number(market==='wb'?card.subjectID:card.description_category_id),typeId=Number(card.type_id);let changed=false;
 if(Number.isSafeInteger(id)&&id>0&&(market==='wb'||Number.isSafeInteger(typeId)&&typeId>0)){const existing=product.marketplaceCategories?.[market],found=categories.find(row=>row.id===id&&(market==='wb'||row.typeId===typeId));const label=found?.label||(market==='wb'?card.subjectName:card.category_name)||(existing?.id===id&&(market==='wb'||existing.typeId===typeId)?existing.label:'')||'Категория '+id;product.marketplaceCategories={...product.marketplaceCategories,[market]:{id,...(market==='ozon'?{typeId}:{}),label}};changed=true;}
 const values=cardMeasurementValues(market,card);if(Object.keys(values).length){product.measurements={...product.measurements,...values,...(values.packaged?{packaged:{...product.measurements?.packaged,...values.packaged}}:{}),...(values.product?{product:{...product.measurements?.product,...values.product}}:{})};changed=true;}if(changed)updated++;
 }return updated;
}
export async function refreshCatalogueCards(database,credentials,{request=marketRequest,onSaved=()=>{}}={}){
 const results=[];
 for(const market of ['wb','ozon']){
  if(market==='wb'?!credentials.wbToken:!credentials.ozonKey||!credentials.ozonClient){results.push({market,error:'Ключ не настроен'});continue;}
  try{
   let cards;
   if(market==='wb')cards=await readAllWBCards((op,body)=>request(market,op,credentials,body));
   else{cards=[];let cursor=null;const seen=new Set();for(;;){const result=await request(market,'list',credentials,listBody(market,'',cursor)),batch=result.result?.items;if(!Array.isArray(batch))throw Error('Не удалось прочитать список карточек Ozon');cards.push(...batch);const next=result.result?.last_id;if(batch.length<100)break;if(!next||seen.has(next))throw Error('Ozon повторил страницу: сохранён прежний список');seen.add(next);cursor=next;}}
   rememberCatalogueCards(database,market,cards,true);let metadataCount=0,warning='';
   try{let metadata=cards,categories=[];if(market==='ozon'){metadata=[];const wanted=new Set((database.products||[]).map(p=>String(p.sku||'').trim()).filter(Boolean)),offers=[...new Set(cards.map(card=>String(card.offer_id||'').trim()).filter(sku=>wanted.has(sku)))];for(let offset=0;offset<offers.length;offset+=100){const result=await request(market,'details',credentials,{filter:{offer_id:offers.slice(offset,offset+100),visibility:'ALL'},limit:100});const batch=Array.isArray(result.result)?result.result:result.result?.items||result.items;if(!Array.isArray(batch))throw Error('Не удалось прочитать параметры карточек Ozon');metadata.push(...batch);}if(metadata.length){try{categories=normalizeCategories('ozon',await request(market,'categories',credentials,{language:'DEFAULT'}));}catch{warning='Названия категорий Ozon не получены, сохранены коды';}}}
    metadataCount=applyCatalogueCardMetadata(database,market,metadata,categories);
   }catch(error){warning='Параметры карточек не обновлены: '+error.message;}
   await onSaved(market);results.push({market,count:cards.length,metadataCount,...(warning?{warning}:{})});
  }catch(error){results.push({market,error:error.message});}
 }
 return results;
}
export function catalogueStatusMatches(database,product,filters={},modelState=null){
 const states={wb:catalogueCardPresence(database,product,'wb'),ozon:catalogueCardPresence(database,product,'ozon'),label:!!product.labelPdf?.data?.startsWith('data:application/pdf;base64,'),model:modelState};
 return Object.entries(filters).every(([key,value])=>!value||(value==='yes'?states[key]===true:value==='no'?states[key]===false:states[key]===null));
}
