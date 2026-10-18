const HOSTS={wb:'https://content-api.wildberries.ru',ozon:'https://api-seller.ozon.ru'};
const OPERATIONS={
 wb:{list:['POST','/content/v2/get/cards/list'],create:['POST','/content/v2/cards/upload'],update:['POST','/content/v2/cards/update'],errors:['POST','/content/v2/cards/error/list'],categories:['GET','/content/v2/object/all'],attributes:['GET','/content/v2/object/charcs/'],pictures:['POST','/content/v3/media/save']},
 ozon:{roles:['POST','/v1/roles'],list:['POST','/v3/product/list'],info:['POST','/v3/product/info/list'],details:['POST','/v4/product/info/attributes'],create:['POST','/v3/product/import'],update:['POST','/v3/product/import'],status:['POST','/v1/product/import/info'],categories:['POST','/v1/description-category/tree'],attributes:['POST','/v1/description-category/attribute'],values:['POST','/v1/description-category/attribute/values'],searchValues:['POST','/v1/description-category/attribute/values/search']}
};
export function redact(text,credentials){let output=String(text);for(const value of [credentials?.wbToken,credentials?.ozonKey])if(value)output=output.split(value).join('[скрыто]');return output;}
export function statusHint(status){return status===401?'Проверьте Client-Id и API-ключ Ozon или токен WB и нажмите «Применить ключи».':status===403?'Проверьте права ключа на работу с товарами и категориями.':status===429?'Лимит запросов. Подождите перед повтором.':status>=500?'Временная ошибка площадки. Повторите позже.':'';}
// Role names match the Ozon Seller key settings. A 403 alone does not prove a role is absent.
export function ozonPermissionHint(operation,confirmedMissing=false){
 const role=['categories','attributes','values','searchValues'].includes(operation)?'Description Category':['list','info','details','create','update','status'].includes(operation)?'Product':null;
 if(!role)return 'Не удалось проверить права ключа. Проверьте роли в настройках Ozon Seller.';
 const path=OPERATIONS.ozon[operation][1];
 return (confirmedMissing?'Не хватает доступа к методу ':'Проверьте доступ к методу ')+path+'. Нужная роль Ozon: «'+role+'». Откройте Ozon Seller → настройки Seller API → роли ключа, включите «'+role+'» и сохраните. Если создали новый ключ, замените его в приложении и нажмите «Применить ключи». Затем повторите запрос.';
}
export async function marketRequest(market,operation,credentials,body={},fetcher=fetch){
 const route=OPERATIONS[market]?.[operation];if(!route)throw Error('Недопустимая операция API');
 if(market==='wb'&&!credentials.wbToken)throw Error('Введите API-токен WB и нажмите «Применить ключи»');
 if(market==='ozon'&&(!credentials.ozonKey||!credentials.ozonClient))throw Error('Введите Client-Id и API-ключ Ozon и нажмите «Применить ключи»');
 let [method,path]=route;
 if(market==='wb'&&operation==='attributes'){if(!Number.isSafeInteger(body.subjectID)||body.subjectID<=0)throw Error('Укажите ID предмета WB');path+=body.subjectID;}
 if(market==='wb'&&operation==='categories')path+='?limit=1000&offset='+Number(body.offset||0)+'&locale=ru'+(body.name?'&name='+encodeURIComponent(body.name):'');
 const headers={'Content-Type':'application/json',...(market==='wb'?{Authorization:credentials.wbToken}:{'Client-Id':credentials.ozonClient,'Api-Key':credentials.ozonKey})};
 let response;
 try{response=await fetcher(HOSTS[market]+path,{method,headers,...(method==='POST'?{body:JSON.stringify(body)}:{}),credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(45000)});}catch{throw Error('Нет ответа API. Проверьте сеть и разрешения браузера. Если отправляли карточку — сначала проверьте её состояние на площадке, не повторяйте отправку автоматически.');}
 const raw=redact(await response.text(),credentials);const hint=response.status===403&&market==='ozon'?ozonPermissionHint(operation,/missing a required role/i.test(raw)):statusHint(response.status);let data;try{data=raw?JSON.parse(raw):{};}catch{throw Error('API вернул ответ, который не удалось прочитать (HTTP '+response.status+'). '+hint);}
 if(!response.ok||data.error===true)throw Error('API '+market.toUpperCase()+': '+response.status+' · '+String(data.errorText||data.message||data.error||'Запрос отклонён').slice(0,800)+(hint?' · '+hint:''));
 return data;
}
export function listBody(market,search='',cursor=null){return market==='wb'?{settings:{sort:{ascending:true},filter:{withPhoto:-1,...(search?{textSearch:search}:{})},cursor:{limit:100,...(cursor||{})}}}:{filter:{...(search?{offer_id:[search]}:{}),visibility:'ALL'},last_id:cursor||'',limit:100};}
export function blankListing(market,product){return market==='wb'?[{subjectID:null,variants:[{vendorCode:product.sku||'',title:product.name,description:'',brand:'',dimensions:{length:null,width:null,height:null,weightBrutto:null},characteristics:[],sizes:[{techSize:'0',skus:[]}]}]}]:{items:[{offer_id:product.sku||'',name:product.name,description_category_id:null,type_id:null,price:String(product.marketplaces?.ozon?.price||''),currency_code:'RUB',vat:'0',barcode:'',height:null,width:null,depth:null,dimension_unit:'mm',weight:null,weight_unit:'g',attributes:[],images:[]}]};}
export function wbUpdateDraft(card){
 if(!card?.nmID||!Array.isArray(card.sizes)||!card.sizes.length||card.sizes.some(s=>!s.chrtID))throw Error('У карточки нет nmID или chrtID размеров. Автоматическое обновление заблокировано');
 const keys=['nmID','vendorCode','brand','title','description','dimensions','characteristics','sizes','wholesale','kizMarked'];const result={};for(const key of keys)if(key in card)result[key]=structuredClone(card[key]);
 // Do not copy read-only size names/IDs from responses into write requests.
 result.sizes=card.sizes.map(size=>Object.fromEntries(['chrtID','techSize','wbSize','skus'].filter(key=>key in size).map(key=>[key,structuredClone(size[key])])));
 return [result];
}
export function ozonUpdateDraft(info,details){
 if(!info?.offer_id||!details)throw Error('Не удалось получить все сведения товара Ozon');
 const product={...details,...info};const keys=['offer_id','name','description_category_id','type_id','price','old_price','vat','barcode','height','width','depth','dimension_unit','weight','weight_unit','attributes','complex_attributes','pdf_list','color_image','images','currency_code'];
 const item={};for(const key of keys)if(product[key]!==undefined)item[key]=structuredClone(product[key]);
 for(const key of ['height','width','depth','dimension_unit','weight','weight_unit','attributes','complex_attributes'])if(details[key]!==undefined)item[key]=structuredClone(details[key]);
 item.currency_code||='RUB';item.attributes=(item.attributes||[]).map(a=>({id:a.id,complex_id:a.complex_id||0,values:(a.values||[]).map(v=>({...(v.dictionary_value_id?{dictionary_value_id:v.dictionary_value_id}:{}),...(v.value!==undefined?{value:v.value}:{})}))}));
 const imageUrl=image=>typeof image==='string'?image:image?.file_name||image?.url;
 const array=value=>Array.isArray(value)?value:value?[value]:[];const images=[...array(info.primary_image),...array(info.images||details.images)].map(imageUrl).filter(Boolean);if(images.length)item.images=[...new Set(images)];
 return {items:[item]};
}
export function validateListing(market,mode,body){
 const errors=[];let items;
 if(market==='wb'){items=mode==='create'?body?.[0]?.variants:body;if(!Array.isArray(body)||body.length!==1||!Array.isArray(items)||items.length!==1)return ['Отправляется ровно один товар за раз'];if(mode==='create'&&!(body[0].subjectID>0))errors.push('Укажите ID предмета WB');}
 else {items=body?.items;if(!Array.isArray(items)||items.length!==1)return ['Отправляется ровно один товар за раз'];}
 const item=items[0];if(!item||typeof item!=='object')return ['Некорректный товар'];
 const nonempty=(key,title)=>{if(typeof item[key]!=='string'||!item[key].trim())errors.push('Заполните '+title);};
 nonempty(market==='wb'?'vendorCode':'offer_id','артикул продавца');nonempty(market==='wb'?'title':'name','название');
 if(market==='wb'){
  if(mode==='update'&&!(item.nmID>0))errors.push('Для обновления нужен nmID');
  if(!Array.isArray(item.sizes)||!item.sizes.length)errors.push('Укажите размеры и штрихкоды');
  else for(const size of item.sizes){if(mode==='update'&&!(size.chrtID>0))errors.push('Нельзя обновлять без исходных chrtID');if(!Array.isArray(size.skus)||!size.skus.length)errors.push('Укажите штрихкод');}
  if(!Array.isArray(item.characteristics))errors.push('Характеристики должны быть массивом');
  for(const key of ['length','width','height','weightBrutto'])if(!(Number(item.dimensions?.[key])>0))errors.push('Укажите габариты и массу WB');
 }else{
  for(const key of ['description_category_id','type_id','height','width','depth','weight'])if(!(Number(item[key])>0))errors.push('Укажите '+key);
  if(!(Number(item.price)>0))errors.push('Укажите цену Ozon');
  if(!Array.isArray(item.attributes))errors.push('Укажите характеристики Ozon');
  if(!Array.isArray(item.images)||!item.images.length)errors.push('Укажите изображения Ozon');
  if(!['mm','cm','in'].includes(item.dimension_unit)||!['g','kg','lb'].includes(item.weight_unit))errors.push('Проверьте единицы габаритов и массы');
  if(typeof item.vat!=='string'||!item.currency_code)errors.push('Укажите НДС и валюту');
 }
 if(market==='ozon'&&Array.isArray(item.images)&&item.images.some(url=>{try{return new URL(url).protocol!=='https:';}catch{return true;}}))errors.push('Изображения должны иметь доступные HTTPS-ссылки');
 return [...new Set(errors)];
}

export async function uploadWBPhoto(credentials,nmId,number,file,fetcher=fetch){
 if(!credentials.wbToken)throw Error('Введите API-токен WB и нажмите «Применить ключи»');if(!Number.isSafeInteger(nmId)||nmId<=0||!Number.isSafeInteger(number)||number<1)throw Error('Нет идентификатора карточки или позиции фото');
 const form=new FormData();form.append('uploadfile',file,file.name||'photo.jpg');let response;
 try{response=await fetcher(HOSTS.wb+'/content/v3/media/file',{method:'POST',headers:{Authorization:credentials.wbToken,'X-Nm-Id':String(nmId),'X-Photo-Number':String(number)},body:form,credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(60000)});}catch{const error=Error('Результат загрузки фото неизвестен. Проверьте фотографии в WB перед повтором.');error.uncertain=true;throw error;}
 const raw=redact(await response.text(),credentials);const hint=response.status===403&&market==='ozon'?ozonPermissionHint(operation,/missing a required role/i.test(raw)):statusHint(response.status);let data;try{data=raw?JSON.parse(raw):{};}catch{const error=Error('Не удалось прочитать ответ загрузки WB. Проверьте фотографии перед повтором.');error.uncertain=true;throw error;}if(!response.ok||data.error===true)throw Error('WB отклонил фото: '+String(data.errorText||response.status));return data;
}

export function describeOzonRoles(data){const roles=data.roles||data.result?.roles||(Array.isArray(data.result)?data.result:[]);if(!Array.isArray(roles)||!roles.length)return 'Ozon не вернул список ролей в ожидаемом формате. Проверьте роли ключа в кабинете Ozon Seller.';const lines=[];for(const role of roles){lines.push('Роль: '+String(role.name||role.role_name||role.id));for(const method of role.methods||[]){const label=typeof method==='string'?method:method.path||method.name||method.method;if(label)lines.push('  '+label);}}return lines.join('\n');}
