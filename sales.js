import {mountMarketplaceOrders} from './marketplace-orders.js?v=0.2.196';
import {calculateManual} from './calc.js?v=0.2.196';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const rub=value=>value===null?'—':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB'}).format(value),round=value=>Math.round((value+Number.EPSILON)*100)/100;
export function saleAmounts(sale){const revenue=round(sale.quantity*sale.unitPrice),cost=sale.costPerUnit===null?null:round(sale.quantity*sale.costPerUnit);return {revenue,cost,difference:sale.payout===null?null:round(revenue-sale.payout),result:sale.payout===null||cost===null?null:round(sale.payout-cost)};}
export function createSale(product,{date,market,quantity,unitPrice,payout=null}){
 if(!product)throw Error('Выберите товар');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date)))throw Error('Укажите дату продажи');if(!['wb','ozon','other'].includes(market))throw Error('Выберите площадку');if(!Number.isSafeInteger(quantity)||quantity<1)throw Error('Количество должно быть целым числом больше нуля');for(const value of [unitPrice,payout])if(value!==null&&(!Number.isFinite(value)||value<0||value>1e12))throw Error('Укажите корректную сумму');if(unitPrice===null)throw Error('Укажите цену продажи');
 const costs=calculateManual(structuredClone(product)),complete=!costs.missing.length&&!costs.invalid.length;
 return {id:crypto.randomUUID(),date,market,productId:product.id,productName:product.name,sku:product.sku||'',quantity,unitPrice:round(unitPrice),payout:payout===null?null:round(payout),costPerUnit:complete?round(costs.cost):null};
}
export function mountSales({root,database,save,getCredentials,onOpenApi}){
 database.sales??=[];
 root.innerHTML='<div id="marketplace-orders"></div>';
 mountMarketplaceOrders({root:root.querySelector('#marketplace-orders'),database,save,getCredentials,onOpenApi});
 if(database.sales.length){const section=root.ownerDocument.createElement('details');section.className='panel sales-journal';section.innerHTML=`<summary>Ранее введённые вручную продажи · ${database.sales.length} · только чтение</summary><p>Исторические записи сохранены. Новые продажи и статусы загружаются из API площадок выше.</p><div class="sales-table-scroll"><table><thead><tr><th>Дата / площадка</th><th>Товар / артикул</th><th>Кол-во</th><th>Цена за шт.</th><th>Сумма продажи</th><th>Выплата</th></tr></thead><tbody>${[...database.sales].sort((a,b)=>b.date.localeCompare(a.date)).map(sale=>`<tr><td>${escape(sale.date)}<small>${{wb:'WB',ozon:'Ozon',other:'Другая / напрямую'}[sale.market]}</small></td><td>${escape(sale.productName)}<small>${escape(sale.sku)}</small></td><td>${sale.quantity}</td><td>${rub(sale.unitPrice)}</td><td>${rub(saleAmounts(sale).revenue)}</td><td>${rub(sale.payout)}</td></tr>`).join('')}</tbody></table></div>`;root.append(section);}
}
