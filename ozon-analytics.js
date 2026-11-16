// Ozon Seller API: GetFinanceAccrualByDay / GetFinanceAccrualTypes.
// Amounts are already accrued totals: never multiply them by product quantity.
export const analyticsGroups = [
 ['sales','Продажи'], ['returns','Возвраты'], ['commission','Вознаграждение Ozon'],
 ['delivery','Услуги доставки'], ['partners','Услуги партнёров'],
 ['promotion','Продвижение и реклама'], ['other','Другие услуги и штрафы'],
 ['unclassified','Не распределено по статьям']
];
export const dayKey = date => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(date);
export function validDay(day) {
 return typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0,10)===day;
}
export function dateRange(from,to) {
 if(!validDay(from)||!validDay(to)||from<'2022-01-01'||from>to)throw Error('Укажите корректный период начиная с 1 января 2022 года.');
 const count=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
 if(count>366)throw Error('Выберите не больше 366 дней за одну загрузку.');
 return Array.from({length:count},(_,i)=>new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10));
}
function cents(money,optional=false) {
 if(money==null&&optional)return 0;
 if(!money||typeof money!=='object'||!['RUB','RUR'].includes(money.currency)||!/^[-+]?\d+(\.\d+)?$/.test(String(money.amount)))throw Error('Ozon вернул неизвестный формат суммы или валюту. День не сохранён.');
 const result=Math.round(Number(money.amount)*100);
 if(!Number.isSafeInteger(result))throw Error('Сумма Ozon выходит за допустимые границы.');
 return result;
}
export function parseAccrualTypes(response) {
 if(!Array.isArray(response?.accrual_types))throw Error('Ozon не вернул справочник начислений.');
 return new Map(response.accrual_types.map(type=>[String(type.id),{name:String(type.name||''),description:String(type.description||'')} ]));
}
export function feeGroup(name) {
 const text=name.toLocaleLowerCase('ru');
 if(/эквайр|acquiring|drop.?off|партн[её]р.*(обработ|достав|упаков)|(?:обработ|достав|упаков).*партн[её]р/.test(text))return 'partners';
 if(/реклам|продвиж|promotion|advertis|cpc|cpo/.test(text))return 'promotion';
 if(/логист|logistic|достав.*мест.*выдач|last.?mile/.test(text))return 'delivery';
 return 'other';
}
export function summarizeAccruals(date,accruals,types,updatedAt=new Date().toISOString()) {
 const rows=new Map(); let total=0, count=0;
 const seen=new Map();
 const add=(group,label,amount)=>{
  if(!amount)return;
  const key=group+'\0'+label;
  const row=rows.get(key)||{group,label,amount:0}; row.amount+=amount; rows.set(key,row);
 };
 const fee=entry=>{
  if(!entry)return;
  const type=types.get(String(entry.type_id));
  const label=type?.description||type?.name||`Начисление Ozon · тип ${entry.type_id}`;
  add(feeGroup(label+' '+(type?.name||'')),label,cents(entry.accrued));
 };
 for(const accrual of accruals) {
  if(accrual.date!==date)throw Error('Ozon вернул начисление за другую дату. День не сохранён.');
  if(accrual.accrual_id==null)throw Error('В начислении Ozon отсутствует идентификатор.');
  const id=String(accrual.accrual_id),signature=JSON.stringify(accrual);
  if(seen.has(id)) {
   if(seen.get(id)!==signature)throw Error('Ozon вернул разные данные для одного начисления. Повторите загрузку дня.');
   continue;
  }
  seen.set(id,signature);
  count++; total+=cents(accrual.total_amount);
  for(const product of accrual.posting?.products||[]) {
   const c=product.commission;
   if(c) {
    const revenue=cents(c.sale_amount,true),bonus=cents(c.bonus,true),partner=cents(c.coinvestment,true);
    const group=revenue+bonus+partner<0?'returns':'sales';
    add(group,group==='returns'?'Возврат выручки':'Выручка',revenue);
    add(group,'Баллы за скидки',bonus); add(group,'Программы партнёров',partner);
    const commission=cents(c.commission,true);
    add('commission',commission>0?'Возврат вознаграждения':'Вознаграждение за продажу',commission);
   }
   for(const service of product.delivery?.services||[])fee(service);
  }
  for(const item of accrual.item_fees?.fees||[])for(const entry of item.fees||[])fee(entry);
  for(const entry of accrual.container_fees?.fees||[])fee(entry);
  fee(accrual.non_item_fee);
 }
 const allocated=[...rows.values()].reduce((sum,row)=>sum+row.amount,0);
 // Preserve the API total even if Ozon adds a new field or an undisclosed adjustment.
 add('unclassified','Разница между итогом Ozon и расшифрованными статьями',total-allocated);
 return {date,updatedAt,count,total,rows:[...rows.values()]};
}
export async function fetchAccrualDay(date,request,types,{signal,onPage=()=>{}}={}) {
 let last_id='';const cursors=new Set(),accruals=[];
 for(let page=1;page<=10000;page++) {
  signal?.throwIfAborted();
  const result=await request('accrualDay',{date,last_id});
  signal?.throwIfAborted();
  if(!Array.isArray(result?.accruals)||typeof result.last_id!=='string')throw Error('Неполный ответ Ozon. День не сохранён.');
  accruals.push(...result.accruals);onPage(page);
  if(!result.last_id)return summarizeAccruals(date,accruals,types);
  if(cursors.has(result.last_id))throw Error('Ozon повторил страницу начислений. День не сохранён.');
  cursors.add(result.last_id);last_id=result.last_id;
 }
 throw Error('Слишком много страниц начислений за день.');
}
export function aggregateDays(days) {
 const rows=new Map();let total=0,count=0;
 for(const day of days){total+=day.total;count+=day.count;for(const row of day.rows){const key=row.group+'\0'+row.label;const old=rows.get(key)||{...row,amount:0};old.amount+=row.amount;rows.set(key,old);}}
 return {total,count,rows:[...rows.values()]};
}
export function periodKey(date,mode) {
 if(mode==='months')return date.slice(0,7);
 if(mode==='weeks'){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
 return date;
}
export function analyticsPeriods(dates,days,mode) {
 const cache=new Map(days.map(day=>[day.date,day])),groups=new Map();
 for(const date of dates){const key=periodKey(date,mode);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(date);}
 return [...groups].map(([key,list])=>{const loaded=list.map(date=>cache.get(date)).filter(Boolean);return {key,from:list[0],to:list.at(-1),expected:list.length,loaded:loaded.length,...aggregateDays(loaded)};}).reverse();
}
export function validateAnalytics(state) {
 if(state===undefined)return;
 if(!state||state.schema!==1||!Array.isArray(state.accounts)||state.accounts.length>100)throw Error('Некорректная аналитика Ozon');
 const clients=new Set();
 for(const account of state.accounts){
  if(typeof account.clientId!=='string'||!account.clientId||clients.has(account.clientId)||!Array.isArray(account.days)||account.days.length>10000)throw Error('Некорректный кабинет аналитики Ozon');
  clients.add(account.clientId);const dates=new Set();
  for(const day of account.days){
   if(!day||!validDay(day.date)||dates.has(day.date)||typeof day.updatedAt!=='string'||!Number.isSafeInteger(day.count)||day.count<0||!Number.isSafeInteger(day.total)||!Array.isArray(day.rows)||day.rows.length>10000)throw Error('Некорректный день аналитики Ozon');
   dates.add(day.date);
   for(const row of day.rows)if(!row||!analyticsGroups.some(([key])=>key===row.group)||typeof row.label!=='string'||row.label.length>2000||!Number.isSafeInteger(row.amount))throw Error('Некорректная статья аналитики Ozon');
   if(day.rows.reduce((sum,row)=>sum+row.amount,0)!==day.total)throw Error('Не совпадает итог аналитики Ozon');
  }
 }
}
