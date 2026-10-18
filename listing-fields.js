export function listingItem(market,draft){const body=JSON.parse(draft.body);const item=market==='wb'?(draft.mode==='create'?body?.[0]?.variants?.[0]:body?.[0]):body?.items?.[0];if(!item||typeof item!=='object')throw Error('Не удалось прочитать черновик. Создайте новый или загрузите карточку площадки.');return {body,item};}
export function categoryOf(market,draft){const {body,item}=listingItem(market,draft);return market==='wb'?{id:draft.subjectID||draft.subjectId||body[0].subjectID||item.subjectID||null,typeId:null,label:draft.categoryLabel||''}:{id:draft.referenceCategory?.id||item.description_category_id||null,typeId:draft.referenceCategory?.typeId||item.type_id||null,label:draft.referenceCategory?.label||draft.categoryLabel||''};}
export function normalizeCategories(market,response){
 if(market==='wb')return (response.data||[]).map(row=>({id:row.subjectID,typeId:null,label:[row.parentName,row.subjectName].filter(Boolean).join(' / ')}));
 const result=[];function visit(nodes,path=[],categoryId=null,disabled=false){for(const node of nodes||[]){const current=node.description_category_id||categoryId,title=node.category_name||node.type_name,parts=title?[...path,title]:path,blocked=disabled||node.disabled;if(node.type_id&&!blocked)result.push({id:current,typeId:node.type_id,label:parts.join(' / ')});if(node.children)visit(node.children,parts,current,blocked);}}visit(response.result);return result;
}
export function normalizeAttributes(market,response){return (market==='wb'?response.data||[]:response.result||[]).map(a=>({id:market==='wb'?a.charcID:a.id,name:a.name||a.charcName||'Характеристика',required:!!(a.required||a.is_required),type:market==='wb'?(a.charcType===4?'number':'string'):String(a.type||'string').toLowerCase(),multiple:market==='wb'?(a.charcType!==4&&a.maxCount!==1):!!a.is_collection,maxCount:market==='wb'?a.maxCount||0:0,dictionary:market==='ozon'&&!!a.dictionary_id,complexId:market==='ozon'?a.attribute_complex_id||0:0,unit:a.unitName||'',description:a.description||'',dictionaryId:a.dictionary_id||null,isAspect:a.is_aspect??null,categoryDependent:a.category_dependent??null,popular:a.popular??null,source:market}));}
export function getAttribute(market,item,def,groupIndex=0){if(market==='wb'){const value=(item.characteristics||[]).find(a=>a.id===def.id)?.value;return value===undefined?[]:(Array.isArray(value)?value:[value]).map(value=>({value:String(value)}));}return (def.complexId?item.complex_attributes?.[groupIndex]?.attributes||[]:item.attributes||[]).find(a=>a.id===def.id&&(a.complex_id||0)===def.complexId)?.values||[];}
export function setAttribute(market,item,def,values,groupIndex=0){
 if(market==='wb'){const list=item.characteristics??=[];const index=list.findIndex(a=>a.id===def.id);if(index>=0)list.splice(index,1);if(values.length)list.push({id:def.id,value:def.type==='number'?Number(values[0].value):values.map(v=>v.value)});}
 else {const list=def.complexId?(item.complex_attributes??=[])[groupIndex]?.attributes:(item.attributes??=[]);if(!list)throw Error('Нет группы характеристик');const index=list.findIndex(a=>a.id===def.id&&(a.complex_id||0)===def.complexId);if(index>=0)list.splice(index,1);if(values.length)list.push({id:def.id,complex_id:def.complexId,values:structuredClone(values)});}
}
export function setCategory(market,draft,category){const {body,item}=listingItem(market,draft);if(draft.mode==='update'){if(market==='wb')draft.subjectID=category.id;else draft.referenceCategory={...category};draft.categoryLabel=category.label;draft.categorySource='manual';draft.attributeSchema=[];draft.attributesLoaded=false;return;}if(market==='wb'){body[0].subjectID=category.id;item.characteristics=[];}else{item.description_category_id=category.id;item.type_id=category.typeId;item.attributes=[];delete item.complex_attributes;}draft.subjectID=category.id;draft.categoryLabel=category.label;draft.attributeSchema=[];draft.attributesLoaded=false;draft.body=JSON.stringify(body);}
export function validateAttributes(market,draft){const {item}=listingItem(market,draft),errors=[];for(const def of draft.attributeSchema||[]){const indexes=def.complexId?(item.complex_attributes||[]).map((group,index)=>(group.attributes||[]).some(a=>(a.complex_id||0)===def.complexId)?index:null).filter(i=>i!==null):[0];if(def.required&&!indexes.length)errors.push('Добавьте группу характеристик «'+def.name+'»');for(const index of indexes){const values=getAttribute(market,item,def,index);if(def.required&&(!values.length||values.every(v=>!String(v.value??v.dictionary_value_id??'').trim())))errors.push('Заполните характеристику «'+def.name+'»');if(def.maxCount&&values.length>def.maxCount)errors.push('Слишком много значений: '+def.name);if(['number','integer','decimal'].includes(def.type)&&values.some(v=>!String(v.value).trim()||!Number.isFinite(Number(v.value))||(def.type==='integer'&&!Number.isInteger(Number(v.value)))))errors.push('Укажите '+(def.type==='integer'?'целое число':'число')+': '+def.name);if(def.dictionary&&values.some(v=>!v.dictionary_value_id))errors.push('Выберите значение из справочника: '+def.name);}}if(!draft.attributesLoaded&&!(draft.attributeSchema||[]).length)errors.push('Загрузите характеристики выбранной категории перед отправкой');return errors;}
export function sourceMatches(photo,file){return file.id===photo.fileId||(file.name===photo.name&&file.createdAt===photo.createdAt&&file.category===photo.category);}
export function isPhoto(file){return /\.(jpe?g|png|webp)$/i.test(file.name)||['image/jpeg','image/png','image/webp'].includes(file.blob.type);}
export function sourcePhoto(file){return {kind:'local',fileId:file.id,name:file.name,createdAt:file.createdAt,category:file.category,url:''};}
export function photoURLs(photos){return photos.map(photo=>photo.kind==='remote'?photo.url:photo.url).filter(Boolean);}
export function validPublicPhotoURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}

export function attributeReference(market,def){
 const type={string:'Текст',number:'Число',integer:'Целое число',decimal:'Число с дробной частью',boolean:'Да / нет'}[def.type]||def.type;
 const facts=[['Обязательность',def.required?'Обязательно для выбранной категории':'Не отмечено площадкой как обязательное'],['Формат',def.dictionary?'Выбор из справочника площадки':type],['Количество значений',def.multiple?(def.maxCount?'Не более '+def.maxCount:'Можно несколько значений'):'Одно значение']];
 if(def.unit)facts.push(['Единица измерения',def.unit]);
 if(def.isAspect!==null&&def.isAspect!==undefined)facts.push(['Варианты товара',def.isAspect?'Характеристика варианта (например, цвет или размер)':'Не отмечена как характеристика варианта']);
 if(def.categoryDependent)facts.push(['Справочник','Допустимые значения зависят от категории']);
 if(def.popular===true)facts.push(['Приоритет','Площадка отмечает характеристику как популярную']);
 return {source:market==='wb'?'Wildberries':'Ozon',description:String(def.description||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,''),facts};
}

// Ozon's category type_id and the required “Тип” characteristic are separate fields.
// Only copy a value confirmed by the characteristic's own dictionary.
export async function fillOzonTypeAttribute(draft,request){
 const def=(draft.attributeSchema||[]).find(a=>a.name?.trim().toLowerCase()==='тип'&&!a.complexId);
 const {item}=listingItem('ozon',draft);
 if(!def||getAttribute('ozon',item,def).some(v=>v.dictionary_value_id||String(v.value||'').trim()))return false;
 const category=categoryOf('ozon',draft),label=category.label?.split(' / ').at(-1);
 if(!def.dictionary||!category.id||!category.typeId)return false;
 const base={attribute_id:def.id,description_category_id:Number(category.id),type_id:Number(category.typeId),language:'DEFAULT',limit:100};
 const normalize=value=>String(value||'').trim().toLowerCase().replace(/ё/g,'е');
 let found;
 if(label&&!label.startsWith('Категория №')){const result=await request('searchValues',{...base,value:label});const rows=result.result||[];found=rows.find(v=>Number(v.id)===Number(category.typeId));if(!found){const matches=rows.filter(v=>normalize(v.value)===normalize(label));if(matches.length===1)found=matches[0];}}
 if(!found){let last=0;const seen=new Set();while(true){const result=await request('values',{...base,last_value_id:last});const rows=result.result||[];found=rows.find(v=>Number(v.id)===Number(category.typeId));if(!found&&label){const matches=rows.filter(v=>normalize(v.value)===normalize(label));if(matches.length===1)found=matches[0];}if(found||!result.has_next||!rows.length)break;last=rows.at(-1).id;if(seen.has(last))break;seen.add(last);}}
 if(!found)return false;
 // Re-read the latest draft so other fields edited while loading remain intact.
 const latest=listingItem('ozon',draft);if(getAttribute('ozon',latest.item,def).length||JSON.stringify(categoryOf('ozon',draft))!==JSON.stringify(category))return false;
 setAttribute('ozon',latest.item,def,[{dictionary_value_id:found.id,value:found.value}]);draft.body=JSON.stringify(latest.body);return true;
}
