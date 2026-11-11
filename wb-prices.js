export async function readWBPrice(request,nmID){const result=await request('prices',{nmID});const goods=result.data?.listGoods;if(!Array.isArray(goods))throw Error('WB не вернул список цен');const item=goods.find(item=>Number(item.nmID)===Number(nmID));if(!item)throw Error('Цена ещё не найдена. Для новой карточки дождитесь обработки WB.');return item;}
export function wbPriceValue(item){const prices=[...new Set((item?.sizes||[]).map(size=>size.price))];return prices.length===1&&Number.isFinite(prices[0])?prices[0]:null;}
export function wbPriceBody(item,price,discount=item.discount){if(!Number.isSafeInteger(Number(item?.nmID))||Number(item.nmID)<=0)throw Error('Нет nmID товара');if(item.editableSizePrice||wbPriceValue(item)===null)throw Error('У товара цены по размерам. Измените их в кабинете WB.');if(!Number.isSafeInteger(price)||price<=0)throw Error('Цена WB должна быть целым числом рублей больше нуля');if(!Number.isInteger(discount)||discount<0||discount>99)throw Error('Скидка WB должна быть целым процентом от 0 до 99');return {data:[{nmID:Number(item.nmID),price,discount}]};}

// WB applies the wider FBS dispatch window through January 2027, Moscow time.
const wbFbsTemporaryWindowEnd=Date.parse('2027-02-01T00:00:00+03:00');
export function wbFbsDispatchHours(hours){
 return Number.isFinite(hours)&&hours>0?hours:24;
}
export function wbFbsCommission(base,dispatchHours,now=Date.now()){
 if(!Number.isFinite(base))return base;
 const hours=wbFbsDispatchHours(dispatchHours);
 const discountWindow=now<wbFbsTemporaryWindowEnd?42:18;
 const discount=hours<=13?5:hours<=discountWindow?3.5:0;
 return discount?Math.max(1,base-discount):base;
}
