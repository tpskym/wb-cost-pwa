import {chartPeriodKey, orderPeriodStatistics} from './marketplace-orders.js?v=0.2.367';

const markets = {all:'Все площадки', wb:'Wildberries', ozon:'Ozon'};
const periods = {days:'По дням', weeks:'По неделям', months:'По месяцам', years:'По годам', all:'Всего'};
const moneyFormat = new Intl.NumberFormat('ru-RU', {style:'currency', currency:'RUB'});
const dayFormat = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Moscow', year:'numeric', month:'2-digit', day:'2-digit'});
const dateFormat = new Intl.DateTimeFormat('ru-RU', {timeZone:'UTC'});
const money = value => Number.isFinite(value) ? moneyFormat.format(value) : '—';

const promotionReserve = profit => Math.round(Math.max(0,profit)*10)/100;

export function mountFinance(root, snapshots, profitForRow, products = [], categoriesForProduct = () => ({})) {
 const rows = snapshots.flatMap(snapshot => snapshot.rows);
 const catalogue = new Map(products.filter(product => product.sku?.trim()).map(product => [
  product.sku.trim(), {product, categories: categoriesForProduct(product)}
 ]));
 const categoryKey = category => category ? category.id+':'+(category.typeId||'') : '';
 const options = {sku:new Map(), group:new Map(), wb:new Map(), ozon:new Map()};
 for (const [sku, {product, categories}] of catalogue) {
  options.sku.set(sku, sku);
  if (product.productGroup) options.group.set(product.productGroup, product.productGroup);
  for (const market of ['wb','ozon']) {
   const category = categories[market];
   if (category) options[market].set(categoryKey(category), category.label);
  }
 }
 const costs = new WeakMap();
 const lookup = (row, returned) => {
  if (!costs.has(row)) costs.set(row, profitForRow(row, returned));
  return costs.get(row);
 };
 root.innerHTML = `<div class="panel finance-panel"><h1>Финансы</h1>
 <p>По загруженным заказам WB и Ozon. Периоды определяются по дате заказа, недели начинаются в понедельник.</p>
 <p>База для распределения — расчётная прибыль по выкупленным заказам за вычетом логистики возвратов и отмен. На продвижение резервируется 10% положительной прибыли. Остаток показан в колонке «Можно забрать». Это оценка по заказам. Фактические выплаты площадок и снятия средств учитываются отдельно.</p>
 <div class="orders-chart-types" role="group" aria-label="Площадка">${Object.entries(markets).map(([key,label])=>`<button type="button" data-finance-market="${key}">${label}</button>`).join('')}</div>
 <div class="finance-filters"></div>
 <section class="finance-reserve"><h2>Резерв на продвижение</h2><strong></strong><small>10% положительной прибыли за всё время по выбранным фильтрам</small></section>
 <div class="orders-chart-types" role="group" aria-label="Период">${Object.entries(periods).map(([key,label])=>`<button type="button" data-finance-period="${key}">${label}</button>`).join('')}</div>
 <div class="finance-table"></div></div>`;
 const filters = {};
 const filterRoot = root.querySelector('.finance-filters');
 for (const [key, label, placeholder] of [
  ['sku','Модель','Все модели'], ['group','Группа моделей','Все группы'],
  ['wb','Категория WB','Все категории'], ['ozon','Категория Ozon','Все категории']
 ]) {
  const field = root.ownerDocument.createElement('label');
  field.textContent = label;
  const select = root.ownerDocument.createElement('select');
  select.className = 'ui-select';
  for (const [value, name] of [['',placeholder], ...[...options[key]].sort((a,b)=>a[1].localeCompare(b[1],'ru'))]) {
   const option = root.ownerDocument.createElement('option');
   option.value = value;
   option.textContent = name;
   select.append(option);
  }
  filters[key] = select;
  field.append(select);
  filterRoot.append(field);
 }
 const table = root.querySelector('.finance-table');
 const buttons = root.querySelectorAll('[data-finance-period]');
 const marketButtons = root.querySelectorAll('[data-finance-market]');
 let market = 'all', period = 'all';
 const draw = () => {
  for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.financePeriod===period));
  for (const button of marketButtons) button.setAttribute('aria-pressed', String(button.dataset.financeMarket===market));
  const filteredRows = rows.filter(row => {
   const sku = row.sku?.trim();
   const entry = catalogue.get(sku);
   return (market==='all'||row.source?.startsWith(market+'-'))
    && (!filters.sku.value||sku===filters.sku.value)
    && (!filters.group.value||entry?.product.productGroup===filters.group.value)
    && ['wb','ozon'].every(key=>!filters[key].value||categoryKey(entry?.categories[key])===filters[key].value);
  });
  const now = new Date();
  const {money:total} = orderPeriodStatistics(filteredRows,now,true,lookup)[2];
  const reserve = !filteredRows.length || total.missingPurchasedProfit || total.missingReturnLoss ? null : promotionReserve(total.purchasedProfit+total.returnLoss);
  root.querySelector('.finance-reserve strong').textContent = money(reserve);
  const groups = new Map();
  const today = dayFormat.format(now);
  for (const row of filteredRows) {
   const raw = row.orderedAt;
   const stamp = raw ? new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(raw) ? raw : raw+'+03:00') : null;
   const day = stamp && Number.isFinite(stamp.getTime()) ? dayFormat.format(stamp) : '';
   if (day > today || (!day && period !== 'all')) continue;
   const key = period==='all' ? '' : period==='years' ? day.slice(0,4) : chartPeriodKey(day,period);
   if (!groups.has(key)) groups.set(key,[]);
   groups.get(key).push(row);
  }
  if (!groups.size) {
   table.innerHTML = '<p>По выбранным фильтрам заказов нет.</p>';
   return;
  }
  const body = [...groups.keys()].sort().reverse().map(key => {
   const {money:m} = orderPeriodStatistics(groups.get(key),now,true,lookup)[2];
   const available = m.missingPurchasedProfit || m.missingReturnLoss ? null : m.purchasedProfit+m.returnLoss;
   const promotion = available === null ? null : promotionReserve(available);
   const personal = available === null ? null : Math.max(0,available-promotion);
   const other = m.cost-m.labor-m.printing-m.materials-m.electricity-m.packaging;
   const label = !key ? 'Всего' : period==='years' ? key : period==='months' ? key.slice(0,7).split('-').reverse().join('.') : (period==='weeks' ? 'С ' : '')+dateFormat.format(new Date(key+'T00:00:00Z'));
   return `<tr><th scope="row">${label}</th><td>${money(m.missingRevenue===m.saleLines && m.missingRevenue ? null : m.revenue)}${m.missingRevenue?`<small>Без цены: ${m.missingRevenue}</small>`:''}</td>
   <td>${money(m.missingProfit===m.lines && m.lines ? null : m.profit)}${m.missingProfit?`<small>Без расчёта: ${m.missingProfit}</small>`:''}</td>
   <td>${money(m.missingPurchasedProfit===m.purchasedLines && m.purchasedLines ? null : m.purchasedProfit)}</td>
   <td><strong>${money(available)}</strong>${available===null?'<small>Неполный расчёт</small>':''}</td>
   <td class="finance-promotion"><strong>${money(promotion)}</strong><small>10% прибыли</small></td><td><strong>${money(personal)}</strong></td>
   ${[m.cost,m.labor,m.printing,m.materials,m.electricity,m.packaging,other].map(value=>`<td>${money(m.missingCost===m.saleLines && m.missingCost ? null : value)}</td>`).join('')}</tr>`;
  }).join('');
  table.innerHTML = `<table><thead><tr>${['Период','Сумма заказов','Расчётная прибыль','Прибыль по выкупленным','К распределению','Продвижение','Можно забрать','Себестоимость','Труд','Амортизация принтера','Филамент','Электричество','Упаковка','Прочее'].map(label=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
 };
 for (const button of buttons) button.onclick = () => { period = button.dataset.financePeriod; draw(); };
 for (const button of marketButtons) button.onclick = () => { market = button.dataset.financeMarket; draw(); };
 for (const select of Object.values(filters)) select.onchange = draw;
 draw();
}
