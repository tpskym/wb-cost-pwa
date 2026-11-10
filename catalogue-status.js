import {loadedListingForSku,normalizeDescriptionBreaks} from './calc.js?v=0.2.347';
import {listBody,marketRequest,readAllWBCards} from './marketplace-api.js?v=0.2.347';
import {normalizeCategories,normalizeAttributes,dimensionTriple,splitDimensions,categoryOf} from './listing-fields.js?v=0.2.347';
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
 const values={},dimensions={},axes={product:{},packaged:{}},scale=market==='wb'?10:({mm:1,cm:10,in:25.4}[card.dimension_unit]),weightScale=market==='wb'?1000:({g:1,kg:1000,lb:453.59237}[card.weight_unit]);
 for(const key of ['width','height','depth']){const value=market==='wb'?card.dimensions?.[key==='depth'?'length':key]:card[key],n=scale?positive(value,scale):null;if(n!==null)dimensions[key]=n;}
 if(Object.keys(dimensions).length)values.packaged=dimensions;
 const weight=weightScale?positive(market==='wb'?card.dimensions?.weightBrutto:card.weight,weightScale):null;if(weight!==null)values.packagingWeight=weight;
 // Resolve category attribute IDs through their schema. Shipping dimensions never become item dimensions.
 for(const attribute of card.characteristics||card.attributes||[]){const def=(card.measurementSchema||[]).find(def=>Number(def.id)===Number(attribute.id))||{},name=String(attribute.name||def.name||'').toLowerCase().replace(/ё/g,'е').trim(),unit=String(def.unit||'').toLowerCase().trim(),text=name+' '+String(def.description||'').toLowerCase(),raw=Array.isArray(attribute.value)?attribute.value[0]:attribute.value??attribute.values?.[0]?.value,value=typeof raw==='string'?raw.replace(',','.'):raw;let key;
 const packed=/упаковк/.test(name)&&!/без упаковк/.test(name),part=packed?'packaged':'product';
 if(dimensionTriple({...def,name})&&/размер|габарит/.test(name)&&(/без упаковк/.test(text)||/товар|предмет/.test(name))){const parts=splitDimensions(raw),factor=/мм|миллиметр/.test(name+' '+unit+' '+text)?1:/см|сантиметр/.test(name+' '+unit+' '+text)?10:null;if(factor&&parts.every(v=>positive(v)!==null)){values[part]={...values[part],depth:positive(parts[0],factor),width:positive(parts[1],factor),height:positive(parts[2],factor)};}continue;}
 const axis=name.match(/^(ширина|высота|глубина|длина)(?:$|[ ,(])/);if(axis&&(!/упаков/.test(name)||packed||/без упаков/.test(name))){key={ширина:'width',высота:'height',глубина:'depth',длина:'length'}[axis[1]];}
 const units=name+' '+unit;if(key){const factor=/(?:^|[ ,(])мм(?:$|[ )])/.test(units)?1:/(?:^|[ ,(])см(?:$|[ )])/.test(units)?10:null,n=factor?positive(value,factor):null;if(n!==null)axes[part][key]=n;}
 if(/^(вес|масса) (товара|предмета)(?:$|[ ,(])/.test(name)){const factor=/(?:^|[ ,(])кг(?:$|[ )])/.test(units)?1000:/(?:^|[ ,(])г(?:$|[ )])/.test(units)?1:null,n=factor?positive(value,factor):null;if(n!==null)values[packed?'packagingWeight':'productWeight']=n;}
 }
 for(const part of ['product','packaged']){const a=axes[part],out={};if(a.length!=null)out.depth=a.length;else if(a.depth!=null)out.depth=a.depth;if(a.width!=null)out.width=a.width;else if(a.length!=null&&a.depth!=null)out.width=a.depth;if(a.height!=null)out.height=a.height;if(Object.keys(out).length)values[part]={...values[part],...out};}
 return values;
}
export function cardDescription(market,card){let text=typeof card.description==='string'?card.description:'';if(!text.trim()&&market==='ozon'){const ids=new Set([4191,...(card.measurementSchema||[]).filter(def=>/описание|аннотация/i.test(def.name)&&!/rich|рич|json/i.test(def.name)).map(def=>Number(def.id))]);text=(card.attributes||[]).filter(attribute=>ids.has(Number(attribute.id))).flatMap(attribute=>attribute.values||[]).map(value=>typeof value.value==='string'?value.value:'').filter(value=>value.trim()).join('\n');}return normalizeDescriptionBreaks(text).trim();}
export function cardClassificationCodes(card){const result={},put=(key,value)=>{if(typeof value==='string'&&value.trim())result[key]=value.trim();};for(const key of ['tnved','tn_ved','tnved_code','tn_ved_code'])put('tnved',card[key]);for(const key of ['okpd2','okpd_2','okpd2_code','okpd_2_code'])put('okpd2',card[key]);for(const attr of card.characteristics||card.attributes||[]){const def=(card.measurementSchema||[]).find(def=>Number(def.id)===Number(attr.id)),name=String(attr.name||def?.name||'').toLowerCase().replace(/[^а-яa-z0-9]/g,''),key=name.includes('тнвэд')||name.includes('tnved')?'tnved':name.includes('окпд2')||name.includes('okpd2')?'okpd2':null;if(!key)continue;const values=attr.values?.map(v=>v.value)??(Array.isArray(attr.value)?attr.value:[attr.value]);const value=values.find(v=>typeof v==='string'&&v.trim());put(key,value);}return result;}
export function applyCatalogueCardMetadata(database,market,cards,categories=[]){let updated=0;
 for(const product of database.products||[]){const sku=String(product.sku||'').trim();if(!sku)continue;const card=cards.find(card=>String((market==='wb'?card.vendorCode:card.offer_id)||'').trim()===sku);if(!card)continue;const id=Number(market==='wb'?card.subjectID:card.description_category_id),typeId=Number(card.type_id);let changed=false;
 if(Number.isSafeInteger(id)&&id>0&&(market==='wb'||Number.isSafeInteger(typeId)&&typeId>0)){const existing=product.marketplaceCategories?.[market],found=categories.find(row=>row.id===id&&(market==='wb'||row.typeId===typeId));const label=found?.label||(market==='wb'?card.subjectName:card.category_name)||(existing?.id===id&&(market==='wb'||existing.typeId===typeId)?existing.label:'')||'Категория '+id;product.marketplaceCategories={...product.marketplaceCategories,[market]:{id,...(market==='ozon'?{typeId}:{}),label}};changed=true;}
 const codes=cardClassificationCodes(card);if(Object.keys(codes).length){product.marketplaceCodes={...product.marketplaceCodes,[market]:{...product.marketplaceCodes?.[market],...codes}};changed=true;}const description=cardDescription(market,card);if(description){product.description=description;changed=true;}const values=cardMeasurementValues(market,card);if(Object.keys(values).length){product.measurements={...product.measurements,...values,...(values.packaged?{packaged:{...product.measurements?.packaged,...values.packaged}}:{}),...(values.product?{product:{...product.measurements?.product,...values.product}}:{})};changed=true;}if(changed)updated++;
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
    const schemas=new Map(),wanted=new Set((database.products||[]).map(p=>String(p.sku||'').trim()));for(const card of metadata){const sku=String((market==='wb'?card.vendorCode:card.offer_id)||'').trim();if(!wanted.has(sku))continue;const id=Number(market==='wb'?card.subjectID:card.description_category_id),typeId=Number(card.type_id),key=id+':'+(market==='ozon'?typeId:'');if(!(id>0)||(market==='ozon'&&!(typeId>0)))continue;if(!schemas.has(key)){try{schemas.set(key,normalizeAttributes(market,await request(market,'attributes',credentials,market==='wb'?{subjectID:id}:{description_category_id:id,type_id:typeId,language:'DEFAULT'})));}catch{const cached=(database.products||[]).find(p=>{const draft=p.listingDrafts?.[market];if(!draft?.attributeSchema?.length)return false;try{const category=categoryOf(market,draft);return Number(category.id)===id&&(market==='wb'||Number(category.typeId)===typeId);}catch{return false;}})?.listingDrafts?.[market]?.attributeSchema||[];schemas.set(key,cached);warning=[warning,'Не удалось обновить справочник характеристик '+(market==='wb'?'WB':'Ozon')+'; использованы сохранённые сведения'].filter(Boolean).join(' · ');}}card.measurementSchema=schemas.get(key);}
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
