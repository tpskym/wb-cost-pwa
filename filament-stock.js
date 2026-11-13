import {actionIcon} from './listing-fields.js?v=0.2.383';

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const filamentTypes=['PLA Basic','PLA Lite','PETG Basic'];
// Screen previews are approximate; the stored colour names remain authoritative.
export function filamentSwatch(row){
 const name=String(row.originalColorName||row.colorName||'').trim().toLocaleLowerCase();
 const colors=[[/white|бел/,'#f3f1df'],[/black|черн|чёрн/,'#252525'],[/silver|gray|grey|сер/,'#a6a9aa'],[/gold|золот/,'#d9b640'],[/yellow|желт|жёлт/,'#f2cf36'],[/red|красн/,'#c93632'],[/green|зелен|зелён/,'#16894b'],[/blue|син|голуб/,'#3976ba'],[/orange|оранж/,'#ed852b'],[/purple|фиолет/,'#8759a4'],[/pink|розов/,'#e3a0b5'],[/brown|коричнев/,'#916345']];
 return colors.find(([pattern])=>pattern.test(name))?.[1]||null;
}
export function addFilamentSpools(stock,colorCode,quantity,material='PLA Basic',details={}){
 const colorName=String(details.colorName||'').trim(),originalColorName=String(details.originalColorName||'').trim();if(colorName.length>120||originalColorName.length>120)throw Error('Название цвета слишком длинное');
 if(!filamentTypes.includes(material))throw Error('Выберите тип пластика');
 const code=String(colorCode||'').trim();if(!code)throw Error('Введите код цвета');if(code.length>100)throw Error('Код цвета слишком длинный');if(!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)throw Error('Укажите целое количество мотков от 1 до 1 000 000');
 const existing=stock.find(row=>row.colorCode.toLocaleLowerCase()===code.toLocaleLowerCase()&&(row.material||'')===material);if(existing){if(existing.quantity+quantity>1000000)throw Error('Слишком большое количество мотков');existing.quantity+=quantity;if(colorName)existing.colorName=colorName;if(originalColorName)existing.originalColorName=originalColorName;return existing;}
 const row={id:crypto.randomUUID(),colorCode:code,quantity,purchasedQuantity:0,material,colorName,originalColorName};stock.push(row);return row;
}
export function filamentNormalSpools(row){return row.normalSpools!==undefined?row.normalSpools:Number.isSafeInteger(row.purchaseSpools)&&Number.isSafeInteger(row.minimumSpools)?Math.min(1000000,row.minimumSpools+row.purchaseSpools):null;}
export function filamentPurchasePlan(stock){return stock.filter(row=>{const normal=filamentNormalSpools(row);return (row.purchasedQuantity||0)>0||Number.isSafeInteger(row.minimumSpools)&&row.minimumSpools>=0&&Number.isSafeInteger(normal)&&normal>row.minimumSpools&&row.quantity<=row.minimumSpools;}).map(row=>{const normal=filamentNormalSpools(row),purchasedQuantity=row.purchasedQuantity||0,hasNorm=Number.isSafeInteger(row.minimumSpools)&&Number.isSafeInteger(normal)&&normal>row.minimumSpools;return {...row,purchasedQuantity,normalSpools:normal,toBuy:hasNorm?Math.max(0,normal-row.quantity-purchasedQuantity):0};}).sort((a,b)=>(a.material||'').localeCompare(b.material||'','ru')||a.colorCode.localeCompare(b.colorCode,'ru',{numeric:true}));}

function filamentIdentity(row){
 const color=filamentSwatch(row);
 const editLabel='Редактировать филамент '+row.colorCode;
 return `<div class="filament-identity">
  <span class="filament-color-swatch ${color?'':'unknown'}" ${color?`style="background-color:${color}"`:''} role="img" aria-label="${escape('Цвет: '+(row.colorName||row.originalColorName||'не указан'))}"></span>
  <div><strong>${escape(row.colorCode)} · ${escape(row.material||'Тип не указан')}</strong><span>${escape(row.colorName||'—')}</span><small>${escape(row.originalColorName||'—')}</small></div>
  <button type="button" class="filament-edit-button" data-filament-edit="${escape(row.id)}" aria-haspopup="dialog" aria-label="${escape(editLabel)}" title="${escape(editLabel)}">${actionIcon('edit')}</button>
 </div>`;
}

function openFilamentEditor(root,row,{apply,onClose}){
 if(root.querySelector('.filament-edit-dialog[open]'))return;
 const dialog=root.ownerDocument.createElement('dialog');
 dialog.className='filament-edit-dialog';
 dialog.setAttribute('aria-labelledby','filament-edit-title');
 dialog.innerHTML=`<h2 id="filament-edit-title">Редактировать филамент</h2>
 <form>
  <div class="form-grid">
   <label>Тип пластика<select class="ui-select" name="material"><option value="">Тип не указан</option>${filamentTypes.map(type=>`<option>${type}</option>`).join('')}</select></label>
   <label>Код цвета<input name="colorCode" type="text" maxlength="100" required autofocus></label>
   <label>Название цвета по-русски<input name="colorName" maxlength="120"></label>
   <label>Оригинальное название цвета<input name="originalColorName" maxlength="120"></label>
  </div>
  <p data-filament-edit-status role="status"></p>
  <div class="sync-actions"><button type="submit" class="primary">Сохранить</button><button type="button" data-cancel-filament-edit>Отмена</button></div>
 </form>`;
 const form=dialog.querySelector('form');
 const fields=['material','colorCode','colorName','originalColorName'].map(name=>form.elements.namedItem(name));
 for(const field of fields)field.value=row[field.name]||'';
 const submit=form.querySelector('[type="submit"]');
 const cancel=form.querySelector('[data-cancel-filament-edit]');
 const status=form.querySelector('[data-filament-edit-status]');
 cancel.onclick=()=>dialog.close();
 dialog.oncancel=event=>{if(submit.disabled)event.preventDefault();};
 dialog.onclose=()=>{dialog.remove();onClose();};
 form.onsubmit=async event=>{
  event.preventDefault();
  if(submit.disabled)return;
  const changes=Object.fromEntries(fields.map(field=>[field.name,field.value]));
  const controls=[...fields,submit,cancel];
  controls.forEach(control=>{control.disabled=true;});
  status.textContent='';
  try{
   await apply(changes);
   dialog.close();
  }catch(error){
   status.textContent=error.message;
  }finally{
   controls.forEach(control=>{control.disabled=false;});
  }
 };
 root.append(dialog);
 dialog.showModal();
}

async function saveFilamentDetails(database,row,changes,save){
 const previous={...row};
 const products=[];
 editFilamentDetails(database.filamentStock,row.id,changes,{merge:false});
 try{
  for(const product of database.products??[]){
   const slots=product.filamentSlots;
   if(!slots?.some(slot=>slot.filamentId===row.id))continue;
   products.push({product,slots,colorCode:product.colorCode});
   product.filamentSlots=slots.slice();
   slots.forEach((slot,index)=>{
    if(slot.filamentId===row.id)setMaterialColorSlot(product,index,row);
   });
  }
  if(await save()===false)throw Error('Не удалось сохранить изменения филамента');
 }catch(error){
  Object.assign(row,previous);
  for(const {product,slots,colorCode} of products){
   product.filamentSlots=slots;
   product.colorCode=colorCode;
  }
  throw error;
 }
}

export function mountFilamentStock({root,database,save,toast}){
 root.classList.add('filament-layout');database.filamentStock??=[];for(const row of database.filamentStock){row.purchasedQuantity??=0;if(row.normalSpools===undefined)row.normalSpools=filamentNormalSpools(row);}let editNorms=false;const pendingRows=new Set();const $=selector=>root.querySelector(selector);
 root.innerHTML=`<section class="panel filament-stock-entry"><h2>Добавить нераспакованные мотки</h2><p>Здесь учитываются только целые нераспакованные мотки. Для одинакового типа пластика и кода цвета количество суммируется.</p><form id="filament-add-form"><div class="filament-stock-form"><label>Тип пластика<select id="filament-material">${filamentTypes.map(type=>`<option>${type}</option>`).join('')}</select></label><label>Код цвета<input id="filament-color-code" type="text" maxlength="100" placeholder="Например, 10100" required></label><label>Название цвета по-русски<input id="filament-color-name" maxlength="120" placeholder="Например, Белый"></label><label>Оригинальное название цвета<input id="filament-original-color-name" maxlength="120" placeholder="Например, Jade White"></label><label>Количество мотков<input data-buttons-only id="filament-add-quantity" type="number" min="1" max="1000000" step="1" value="1" required></label><button type="submit">Добавить мотки</button></div><p id="filament-add-status" role="status"></p></form></section><section class="panel filament-purchase-panel"><div class="filament-stock-heading"><h2>Нужно докупить</h2><strong id="filament-purchase-total"></strong></div><p>Если остаток меньше или равен минимуму, количество для покупки рассчитывается до нормы за вычетом наличия и закупленного. Закупленные мотки остаются здесь до переноса в наличие.</p><div id="filament-purchase-list" aria-live="polite"></div></section><section class="panel filament-stock-list"><div class="filament-stock-heading"><h2>Остатки по цветам</h2><strong id="filament-stock-total"></strong></div><label>Найти цвет<input id="filament-stock-search" type="search" placeholder="Код, название или тип пластика"></label><button type="button" id="filament-toggle-norms" aria-expanded="false">Настроить нормы закупки</button><p class="filament-norm-hint" hidden>Задайте минимум и норму мотков в таблице. Норма должна быть больше минимума. Докупить = норма − в наличии − закуплено (не меньше нуля). Пустое поле отключает напоминание для этого цвета.</p><div id="filament-stock-rows"></div></section>`;
 const draw=(updateOnly=false)=>{const stock=database.filamentStock,plan=filamentPurchasePlan(stock),query=$('#filament-stock-search').value.trim().toLocaleLowerCase(),rows=stock.filter(row=>[row.material,row.colorCode,row.colorName,row.originalColorName].join(' ').toLocaleLowerCase().includes(query)).sort((a,b)=>a.colorCode.localeCompare(b.colorCode,'ru',{numeric:true}));$('#filament-stock-total').textContent='Всего мотков: '+stock.reduce((sum,row)=>sum+row.quantity,0)+' · закуплено: '+stock.reduce((sum,row)=>sum+row.purchasedQuantity,0)+' · позиций: '+stock.length;
 const toBuyTotal=plan.reduce((sum,row)=>sum+row.toBuy,0),purchasedTotal=plan.reduce((sum,row)=>sum+row.purchasedQuantity,0);$('#filament-purchase-total').textContent=plan.length?(toBuyTotal?'Докупить мотков: '+toBuyTotal:'Докупать не нужно')+(purchasedTotal?' · закуплено: '+purchasedTotal:''):'Всё в норме';
 $('#filament-purchase-list').innerHTML=plan.length?`<div class="filament-stock-table"><table class="filament-purchase-table"><thead><tr><th>Пластик / код цвета</th><th>Цвет</th><th>В наличии / минимум / норма</th><th>Докупить</th></tr></thead><tbody>${plan.map(row=>`<tr><th scope="row"><strong>${escape(row.colorCode)}</strong><small>${escape(row.material||'Тип не указан')}</small></th><td><span class="filament-purchase-color"><span class="filament-color-swatch ${filamentSwatch(row)?'':'unknown'}" ${filamentSwatch(row)?`style="background-color:${filamentSwatch(row)}"`:''} aria-hidden="true"></span><span>${escape(row.colorName||'—')}<small>${escape(row.originalColorName||'')}</small></span></span></td><td>В наличии: ${row.quantity} · минимум: ${row.minimumSpools??'—'} · норма: ${row.normalSpools??'—'}${row.purchasedQuantity?`<small class="filament-purchased-note">Закуплено: ${row.purchasedQuantity} мотк.</small>`:''}</td><td><strong class="filament-to-buy ${row.toBuy===0?'covered':''}">${row.toBuy?'Докупить: '+row.toBuy+' мотк.':'Докупать не нужно'}</strong></td></tr>`).join('')}</tbody></table></div>`:stock.some(row=>row.minimumSpools!==null&&row.minimumSpools!==undefined&&row.normalSpools>0)?'<p>По заданным минимумам докупать пока ничего не нужно.</p>':'<p>Задайте минимальный остаток и норму мотков в таблице ниже.</p>';
 if(updateOnly===true){for(const row of stock){for(const el of root.querySelectorAll('[data-filament-quantity]'))if(el.dataset.filamentQuantity===row.id)el.textContent=row.quantity;for(const el of root.querySelectorAll('[data-filament-purchased-quantity]'))if(el.dataset.filamentPurchasedQuantity===row.id)el.textContent=row.purchasedQuantity;for(const el of root.querySelectorAll('[data-filament-step],[data-filament-purchased-step],[data-filament-transfer]')){if((el.dataset.filamentStep||el.dataset.filamentPurchasedStep||el.dataset.filamentTransfer)!==row.id)continue;const count=el.dataset.filamentPurchasedStep?row.purchasedQuantity:row.quantity;el.disabled=pendingRows.has(row.id)||(el.dataset.filamentTransfer?row.purchasedQuantity===0||row.quantity+row.purchasedQuantity>1000000:Number(el.dataset.delta)<0?count===0:count===1000000);}}return;}
 $('#filament-stock-rows').innerHTML=rows.length?`<div class="filament-stock-table"><table><thead><tr><th>Филамент</th><th>Мотков в наличии</th><th>Закуплено, мотков</th>${editNorms?'<th>Минимум, мотков</th><th>Норма, мотков</th>':''}</tr></thead><tbody>${rows.map(row=>`<tr><td>${filamentIdentity(row)}</td><td><div class="filament-quantity-counter" role="group" aria-label="Количество мотков ${escape(row.colorCode)}"><button type="button" data-filament-step="${escape(row.id)}" data-delta="-1" aria-label="Уменьшить количество мотков ${escape(row.colorCode)}" ${row.quantity===0?'disabled':''}>−</button><output data-filament-quantity="${escape(row.id)}" aria-live="polite">${row.quantity}</output><button type="button" data-filament-step="${escape(row.id)}" data-delta="1" aria-label="Увеличить количество мотков ${escape(row.colorCode)}" ${row.quantity===1000000?'disabled':''}>+</button></div></td><td><div class="filament-purchased-controls"><button type="button" class="filament-transfer-button" data-filament-transfer="${escape(row.id)}" aria-label="Перенести закупленные мотки ${escape(row.colorCode)} в наличие" title="Перенести все закупленные мотки в наличие" ${row.purchasedQuantity===0||row.quantity+row.purchasedQuantity>1000000?'disabled':''}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M19 12H5m7-7-7 7 7 7"/></svg></button><div class="filament-quantity-counter" role="group" aria-label="Закуплено мотков ${escape(row.colorCode)}"><button type="button" data-filament-purchased-step="${escape(row.id)}" data-delta="-1" aria-label="Уменьшить закупленное количество мотков ${escape(row.colorCode)}" ${row.purchasedQuantity===0?'disabled':''}>−</button><output data-filament-purchased-quantity="${escape(row.id)}" aria-live="polite">${row.purchasedQuantity}</output><button type="button" data-filament-purchased-step="${escape(row.id)}" data-delta="1" aria-label="Увеличить закупленное количество мотков ${escape(row.colorCode)}" ${row.purchasedQuantity===1000000?'disabled':''}>+</button></div></div></td>${editNorms?[['minimumSpools','Минимум'],['normalSpools','Норма мотков']].map(([key,label])=>`<td class="filament-norm-cell"><input data-buttons-only type="number" min="${key==='minimumSpools'?0:1}" max="1000000" step="1" data-filament-norm="${escape(row.id)}" data-norm-key="${key}" aria-label="${label} ${escape(row.material)} ${escape(row.colorCode)}" placeholder="Не задано" value="${row[key]??''}"></td>`).join(''):''}</tr>`).join('')}</tbody></table></div>`:stock.length?'<p>Такой код цвета не найден.</p>':'<p>Пока нет запасов. Добавьте код цвета и количество нераспакованных мотков выше.</p>';
 for(const button of root.querySelectorAll('[data-filament-edit]')){
  button.onclick=()=>{
   const row=stock.find(item=>item.id===button.dataset.filamentEdit);
   if(!row||pendingRows.has(row.id))return;
   openFilamentEditor(root,row,{
    apply:async changes=>{
     await saveFilamentDetails(database,row,changes,save);
     draw();
     toast('Данные филамента сохранены · '+row.colorCode);
    },
    onClose:()=>{
     const current=[...root.querySelectorAll('[data-filament-edit]')].find(control=>control.dataset.filamentEdit===row.id);
     (current||$('#filament-stock-search'))?.focus({preventScroll:true});
    }
   });
  };
 }
 root.querySelectorAll('[data-filament-norm]').forEach(input=>input.onchange=()=>{const row=stock.find(row=>row.id===input.dataset.filamentNorm),key=input.dataset.normKey,value=input.value.trim()===''?null:Number(input.value),min=key==='minimumSpools'?0:1;if(value!==null&&(!Number.isSafeInteger(value)||value<min||value>1000000)){input.value=String(row[key]??'');toast('Введите целое число от '+min+' до 1 000 000 или оставьте поле пустым');return;}row[key]=value;save();draw();if(row.minimumSpools!==null&&row.normalSpools!==null&&row.normalSpools<=row.minimumSpools)toast('Норма мотков должна быть больше минимума');});
 root.querySelectorAll('[data-filament-transfer]').forEach(button=>button.onclick=async()=>{const row=stock.find(row=>row.id===button.dataset.filamentTransfer);if(!row||row.purchasedQuantity<1||row.quantity+row.purchasedQuantity>1000000||button.disabled||pendingRows.has(row.id))return;const previous={quantity:row.quantity,purchasedQuantity:row.purchasedQuantity};pendingRows.add(row.id);row.quantity+=row.purchasedQuantity;row.purchasedQuantity=0;draw(true);let transferred=false;try{const result=await save();if(result===false)throw Error('Не удалось сохранить перенос мотков');transferred=true;toast('Перенесено в наличие: '+previous.purchasedQuantity+' мотк. · '+row.colorCode);}catch(error){Object.assign(row,previous);toast(error.message);}pendingRows.delete(row.id);draw(true);if(transferred){const output=[...root.querySelectorAll('[data-filament-purchased-quantity]')].find(el=>el.dataset.filamentPurchasedQuantity===row.id);if(output){output.classList.add('filament-transfer-flash');output.addEventListener('animationend',()=>output.classList.remove('filament-transfer-flash'),{once:true});}}});
 root.querySelectorAll('[data-filament-step],[data-filament-purchased-step]').forEach(button=>button.onclick=async()=>{const purchased=!!button.dataset.filamentPurchasedStep,key=purchased?'purchasedQuantity':'quantity',attribute=purchased?'filamentPurchasedStep':'filamentStep',row=stock.find(row=>row.id===button.dataset[attribute]),quantity=row[key]+Number(button.dataset.delta);if(pendingRows.has(row.id)||button.disabled)return;if(!Number.isSafeInteger(quantity)||quantity<0||quantity>1000000)return;const previous=row[key];row[key]=quantity;draw(true);try{var saveResult=save();if(saveResult?.then){pendingRows.add(row.id);draw(true);saveResult=await saveResult;}if(saveResult===false)throw Error('Не удалось сохранить количество мотков');}catch(error){row[key]=previous;toast(error.message);}pendingRows.delete(row.id);draw(true);});
 };
 $('#filament-toggle-norms').onclick=()=>{editNorms=!editNorms;$('#filament-toggle-norms').textContent=editNorms?'Закончить настройку норм':'Настроить нормы закупки';$('#filament-toggle-norms').setAttribute('aria-expanded',String(editNorms));$('.filament-norm-hint').hidden=!editNorms;draw();}; $('#filament-stock-search').oninput=draw;$('#filament-add-form').onsubmit=event=>{event.preventDefault();try{const code=$('#filament-color-code').value,quantity=Number($('#filament-add-quantity').value),row=addFilamentSpools(database.filamentStock,code,quantity,$('#filament-material').value,{colorName:$('#filament-color-name').value,originalColorName:$('#filament-original-color-name').value});save();$('#filament-add-status').textContent='Добавлено мотков: '+quantity+'. Остаток '+row.colorCode+': '+row.quantity;$('#filament-color-code').value='';$('#filament-color-name').value='';$('#filament-original-color-name').value='';$('#filament-add-quantity').value='1';$('#filament-stock-search').value='';draw();}catch(error){$('#filament-add-status').textContent=error.message;}};draw();
}

export function editFilamentDetails(stock,id,changes,{merge=true}={}){
 const row=stock.find(row=>row.id===id);if(!row)throw Error('Остаток не найден');const next={...row,...changes};next.colorCode=String(next.colorCode||'').trim();next.colorName=String(next.colorName||'').trim();next.originalColorName=String(next.originalColorName||'').trim();if(!next.colorCode||next.colorCode.length>100)throw Error('Введите код цвета до 100 символов');if(next.colorName.length>120||next.originalColorName.length>120)throw Error('Название цвета слишком длинное');if(!['',...filamentTypes].includes(next.material||''))throw Error('Выберите тип пластика');
 const other=stock.find(other=>other.id!==id&&(other.material||'')===(next.material||'')&&other.colorCode.toLocaleLowerCase()===next.colorCode.toLocaleLowerCase());
 if(other&&!merge)throw Error('Филамент с таким типом пластика и кодом цвета уже есть');
 if(other){if(other.quantity+row.quantity>1000000||(other.purchasedQuantity||0)+(row.purchasedQuantity||0)>1000000)throw Error('Слишком большое количество мотков');other.quantity+=row.quantity;other.purchasedQuantity=(other.purchasedQuantity||0)+(row.purchasedQuantity||0);if(next.colorName)other.colorName=next.colorName;if(next.originalColorName)other.originalColorName=next.originalColorName;stock.splice(stock.indexOf(row),1);}else Object.assign(row,next);
}
export function setFilamentType(stock,id,material){if(!filamentTypes.includes(material))throw Error('Выберите тип пластика');editFilamentDetails(stock,id,{material});}

const emptyMaterialSlot=()=>({filamentId:'',code:'',material:'',colorName:'',originalColorName:''});
export function materialColorSlots(product){if(!Array.isArray(product.filamentSlots))product.filamentSlots=[{...emptyMaterialSlot(),code:product.colorCode||''},emptyMaterialSlot(),emptyMaterialSlot()];return product.filamentSlots;}
export function setMaterialColorSlot(product,index,rowOrCode){if(!Number.isInteger(index)||index<0||index>2)throw Error('Неверный номер цвета');const slot=typeof rowOrCode==='string'?{...emptyMaterialSlot(),code:rowOrCode}:{filamentId:rowOrCode.id,code:rowOrCode.colorCode,material:rowOrCode.material||'',colorName:rowOrCode.colorName||'',originalColorName:rowOrCode.originalColorName||''};if(typeof slot.code!=='string'||slot.code.length>500)throw Error('Код цвета слишком длинный');materialColorSlots(product)[index]=slot;product.colorCode=product.filamentSlots.filter(s=>s.code).map(s=>[s.code,s.originalColorName||s.colorName].filter(Boolean).join(' ')).join(' / ');return slot;}
export function mountProductFilaments({root,product,stock,save}){
 const slots=materialColorSlots(product),label=row=>[row.material||'Тип не указан',row.colorCode,row.colorName,row.originalColorName].filter(Boolean).join(' · '),sorted=[...stock].sort((a,b)=>(a.material||'').localeCompare(b.material||'','ru')||a.colorCode.localeCompare(b.colorCode,'ru',{numeric:true}));
 const swatch=(row,index)=>{const color=filamentSwatch(row);return `<span class="filament-color-swatch ${color?'':'unknown'}" data-material-color-swatch="${index}" ${color?`style="background-color:${color}"`:''} role="img" aria-label="${escape(color?'Примерный цвет: '+(row.colorName||row.originalColorName):'Цвет не определён')}" title="${color?'Примерный оттенок на экране':'Цвет не определён'}"></span>`;};
 const paint=(index)=>{const slot=slots[index],row=stock.find(r=>r.id===slot.filamentId)||slot,color=filamentSwatch(row),el=root.querySelector('[data-material-color-swatch="'+index+'"]');el.style.backgroundColor=color||'';el.classList.toggle('unknown',!color);el.setAttribute('aria-label',color?'Примерный цвет: '+(row.colorName||row.originalColorName):'Цвет не определён');el.title=color?'Примерный оттенок на экране':'Цвет не определён';const select=root.querySelector('[data-material-color-slot="'+index+'"]');root.querySelector('[data-material-spool-current="'+index+'"]').textContent=select.selectedOptions[0]?.textContent||'Не выбран';};
 root.innerHTML=`<fieldset class="product-material-colors"><legend>Коды цветов материала</legend><p>Выберите до трёх катушек из «Остатков филамента» или введите код вручную.</p><div class="product-material-color-grid">${slots.map((slot,index)=>{const found=stock.find(r=>r.id===slot.filamentId),manual=!slot.filamentId&&!!slot.code,missing=slot.filamentId&&!found;return `<div class="product-material-color-slot"><label>Цвет ${index+1}<span class="product-material-picker"><select hidden tabindex="-1" aria-hidden="true" data-material-color-slot="${index}"><option value="" ${!slot.code&&!slot.filamentId?'selected':''}>Не выбран</option>${missing?`<option value="__missing__" selected>${escape([slot.material,slot.code,slot.colorName,slot.originalColorName].filter(Boolean).join(' · '))} · нет в списке</option>`:''}${sorted.map(row=>`<option value="${escape(row.id)}" ${found?.id===row.id?'selected':''}>${escape(label(row))} · ${row.quantity} мотк.</option>`).join('')}<option value="__manual__" ${manual?'selected':''}>Ввести код вручную</option></select><button type="button" class="material-spool-picker-button" data-open-material-spool="${index}" aria-label="Катушка для цвета ${index+1}" aria-haspopup="dialog"><span data-material-spool-current="${index}"></span><span aria-hidden="true">⌄</span></button>${swatch(found||slot,index)}</span></label><input type="text" maxlength="500" data-material-color-manual="${index}" aria-label="Код цвета ${index+1} вручную" value="${escape(manual?slot.code:'')}" placeholder="Код производителя" ${manual?'':'hidden'}><small data-material-color-info="${index}">${found?escape([found.colorCode,found.colorName,found.originalColorName].filter(Boolean).join(' · '))+' · в наличии '+found.quantity+' мотк.':missing?'Сохранённый цвет оставлен. Выберите катушку для новой привязки.':manual?'Сохранён ручной код':'Необязательное поле'}</small></div>`;}).join('')}</div></fieldset>`;
 for(const select of root.querySelectorAll('[data-material-color-slot]'))select.onchange=()=>{const index=Number(select.dataset.materialColorSlot),input=root.querySelector('[data-material-color-manual="'+index+'"]'),info=root.querySelector('[data-material-color-info="'+index+'"]');if(select.value==='__missing__')return;if(select.value==='__manual__'){input.hidden=false;input.value=slots[index].code;setMaterialColorSlot(product,index,input.value);info.textContent='Введите код производителя';input.focus();}else{const row=stock.find(r=>r.id===select.value);input.hidden=true;setMaterialColorSlot(product,index,row||'');info.textContent=row?[row.colorCode,row.colorName,row.originalColorName].filter(Boolean).join(' · ')+' · в наличии '+row.quantity+' мотк.':'Необязательное поле';}paint(index);save();};
 for(const button of root.querySelectorAll('[data-open-material-spool]')){const index=Number(button.dataset.openMaterialSpool);paint(index);button.onclick=()=>openMaterialSpoolPicker({root,select:root.querySelector('[data-material-color-slot="'+index+'"]'),stock:sorted,index});}
 for(const input of root.querySelectorAll('[data-material-color-manual]'))input.oninput=()=>{setMaterialColorSlot(product,Number(input.dataset.materialColorManual),input.value);paint(Number(input.dataset.materialColorManual));save();};
}

function openMaterialSpoolPicker({root,select,stock,index}){
 const doc=root.ownerDocument,dialog=doc.createElement('dialog');dialog.className='material-spool-dialog';dialog.setAttribute('aria-label','Катушка для цвета '+(index+1));
 const choices=[{value:'',text:'Не выбран'},...stock.map(row=>({value:row.id,text:[row.material,row.colorCode,row.colorName,row.originalColorName].filter(Boolean).join(' · '),row})),{value:'__manual__',text:'Ввести код вручную'}];
 dialog.innerHTML=`<div class="modal-head"><h2>Катушка для цвета ${index+1}</h2><button type="button" data-close-spool aria-label="Закрыть выбор катушки">×</button></div><div class="material-spool-options" role="listbox" aria-label="Катушки по цветам">${choices.map(choice=>{const color=choice.row?filamentSwatch(choice.row):null;return `<button type="button" role="option" aria-selected="${choice.value===select.value}" data-spool-value="${escape(choice.value)}"><span class="filament-color-swatch ${color?'':'unknown'}" ${color?`style="background-color:${color}"`:''} aria-hidden="true"></span><span class="material-spool-option-text">${escape(choice.text)}</span>${choice.row?`<small>${choice.row.quantity} мотк.</small>`:''}<span class="material-spool-check" aria-hidden="true">${choice.value===select.value?'✓':''}</span></button>`;}).join('')}</div>`;
 const close=()=>{if(typeof dialog.close==='function')dialog.close();else dialog.remove();};dialog.querySelector('[data-close-spool]').onclick=close;dialog.onclick=event=>{if(event.target===dialog)close();};dialog.onclose=()=>dialog.remove();
 for(const button of dialog.querySelectorAll('[data-spool-value]'))button.onclick=()=>{const value=button.dataset.spoolValue;close();if(!root.isConnected)return;select.value=value;select.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));};
 dialog.querySelector('[role="listbox"]').onkeydown=event=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const options=[...dialog.querySelectorAll('[role="option"]')],current=options.indexOf(doc.activeElement),next=event.key==='Home'?0:event.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,current+(event.key==='ArrowDown'?1:-1)));options[next]?.focus();};
 doc.body.append(dialog);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');(dialog.querySelector('[aria-selected="true"]')||dialog.querySelector('[role="option"]'))?.focus();return dialog;
}
