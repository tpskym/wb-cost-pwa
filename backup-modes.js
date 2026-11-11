import {databaseForCloud,preserveLocalPrintQueue,stripBackupSecrets} from './google-drive-backup.js?v=0.2.353';
export const backupModes={full:'Полный бэкап',costs:'Только себестоимость'};
export function backupMode(database){const mode=database.backupMode??'full';if(!Object.hasOwn(backupModes,mode))throw Error('Неизвестный режим бэкапа');return mode;}
export function createBackupSnapshot(database,mode=database.backupMode??'full'){if(!Object.hasOwn(backupModes,mode))throw Error('Неизвестный режим бэкапа');const clean=databaseForCloud(database);if(mode==='full')return {...clean,backupMode:'full'};return {schema:clean.schema,id:clean.id,revision:clean.revision??0,updatedAt:clean.updatedAt,backupMode:'costs',products:clean.products.map(product=>{const copy={...product};delete copy.stockTargets;delete copy.listingDrafts;return copy;}),templates:clean.templates||[]};}
export const costsDataFormat='workshop-costs-data-v1';

function costProductData(source,{includeLabel=false}={}){
 const {stockTargets,listingDrafts,sharedListingChanges,labelPdf,printModel,plateCapacity,transferParts,history,...product}=source;
 if(includeLabel&&labelPdf)product.labelPdf=labelPdf;
 if(Array.isArray(history)){
  product.history=history.map(snapshot=>snapshot?.inputs&&typeof snapshot.inputs==='object'
   ? {...snapshot,inputs:costProductData(snapshot.inputs)}
   : snapshot);
 }
 return product;
}

export function createCostsDataSnapshot(database){
 const {schema,id,revision=0,updatedAt,products,templates=[],costPrices}=database;
 return stripBackupSecrets({
  schema,id,revision,updatedAt,backupMode:'costs',format:costsDataFormat,
  products:products.map(product=>costProductData(product,{includeLabel:true})),
  templates:templates.map(template=>({...template,inputs:costProductData(template.inputs)})),
  ...(costPrices&&{costPrices}),
 });
}

function uniqueProductsBySku(products){
 const bySku=new Map();
 for(const product of products){
  const sku=product.sku?.trim();
  if(sku)bySku.set(sku,bySku.has(sku)?null:product);
 }
 return bySku;
}

function costsDataProductIds(incoming,local){
 const sourceBySku=uniqueProductsBySku(incoming.products);
 const localBySku=uniqueProductsBySku(local.products);
 const incomingIds=new Set(incoming.products.map(product=>product.id));
 const localIds=new Set(local.products.map(product=>product.id));
 return new Map(incoming.products.map(product=>{
  if(localIds.has(product.id))return [product.id,product.id];
  const sku=product.sku?.trim();
  const matching=sourceBySku.get(sku)?localBySku.get(sku):null;
  return [product.id,matching&&!incomingIds.has(matching.id)?matching.id:product.id];
 }));
}

function mergeCostPrices(local,incoming){
 const merge=(kind,key)=>[...new Map([...(local?.[kind]??[]),...incoming[kind]].map(row=>[row[key],row])).values()];
 return {printers:merge('printers','model'),filaments:merge('filaments','key')};
}

export function costProductIds(incoming,local){return new Map(incoming.products.map(product=>{const current=local.products?.find(row=>row.id===product.id)||local.products?.find(row=>product.sku?.trim()&&row.sku?.trim()===product.sku.trim());return [product.id,current?.id||product.id];}));}
export function applyBackupSnapshot(incoming,local,{modelReferences=false}={}){
const mode=backupMode(incoming);
const costsData=incoming.format===costsDataFormat;
if(costsData){
 if(mode!=='costs')throw Error('Неверный формат файла себестоимости');
 incoming=createCostsDataSnapshot(incoming);
}
if(mode==='full'){const result=preserveLocalPrintQueue(incoming,local);for(const product of result.products||[]){const source=(incoming.products||[]).find(row=>row.id===product.id);if(source?.stockTargets!==undefined)product.stockTargets=structuredClone(source.stockTargets);else delete product.stockTargets;}delete result.backupMode;return result;}
const result=structuredClone(local),ids=costsData?costsDataProductIds(incoming,local):costProductIds(incoming,local);result.products??=[];for(const source of incoming.products){const id=ids.get(source.id),index=result.products.findIndex(row=>row.id===id),current=index<0?null:result.products[index],copy=structuredClone(source);delete copy.stockTargets;delete copy.listingDrafts;
const parts=copy.transferParts;
delete copy.transferParts;
const product=parts?.parameters===false&&current?{...current,id}:{...current,...copy,id};
if(parts?.label===false){
 if(current?.labelPdf)product.labelPdf=structuredClone(current.labelPdf);
 else delete product.labelPdf;
}else if(copy.labelPdf)product.labelPdf=structuredClone(copy.labelPdf);if(!copy.labelPdf&&current?.labelPdf)product.labelPdf=structuredClone(current.labelPdf);if(modelReferences&&copy.printModel)product.printModel={...copy.printModel,ownerId:ids.get(copy.printModel.ownerId)||copy.printModel.ownerId};else if(current?.printModel)product.printModel=structuredClone(current.printModel);else delete product.printModel;if(index<0)result.products.push(product);else result.products[index]=product;}
result.templates??=[];for(const template of incoming.templates||[]){const index=result.templates.findIndex(row=>row.id===template.id||row.name===template.name);if(index<0)result.templates.push(structuredClone(template));else result.templates[index]=structuredClone(template);}
if(costsData&&incoming.costPrices)result.costPrices=mergeCostPrices(result.costPrices,incoming.costPrices);
return result;}
