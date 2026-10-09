export const groups = [
 ['production','Производство','Материалы, оборудование и время'],
 ['packaging','Упаковка','На изделие и на отправляемую партию'],
 ['sales','Продажа и доставка','Расходы выбранной площадки'],
 ['overhead','Накладные расходы','Постоянные затраты и прочее']
];
export const fields = [
 ['grams','Расход материала с отходами','г','production'],['kgPrice','Цена материала','₽/кг','production'],['minutes','Время одной печати','мин','production'],['yield','Изделий за печать','шт.','production'],['printerPrice','Стоимость 3D-принтера','₽','production'],['printerLife','Ресурс принтера','ч','production'],['watts','Средняя мощность · оценка','Вт','production'],['tariff','Тариф электричества','₽/кВт·ч','production'],['labor','Труд на изделие','₽','production'],['maintenance','Обслуживание на изделие','₽','production'],['defect','Производственный брак','%','production'],['components','Комплектующие','₽/шт.','production'],['design','Разработка модели на изделие','₽','production'],
 ['box','Индивидуальная коробка','₽/шт.','packaging'],['outer','Общая коробка','₽','packaging'],['capacity','Изделий в общей коробке','шт.','packaging'],['labelPack','Стоимость партии этикеток','₽','packaging'],['labelCount','Этикеток в купленной партии','шт.','packaging'],['labels','Этикеток на изделие','шт.','packaging'],['outerLabels','Этикеток на общую коробку','шт.','packaging'],['labelPrinter','Стоимость принтера этикеток','₽','packaging'],['labelLife','Ресурс принтера этикеток','этикеток','packaging'],['bubblePrice','Стоимость купленной плёнки','₽','packaging'],['bubbleYield','На сколько изделий хватит плёнки · план','шт.','packaging'],['card','Карточка приветствия','₽/шт.','packaging'],['tape','Скотч, пакет, прочая упаковка','₽/шт.','packaging'],
 ['commission','Комиссия площадки','% цены','sales'],['acquiring','Эквайринг · если отдельно','% цены','sales'],['ads','Реклама','% цены','sales'],['wbDelivery','Готовая доставка из калькулятора WB','₽/продажа','sales'],['deliveryPercent','Доставка WB · доля при исходной цене','% цены','sales'],['logistics','Прямая логистика на отправку','₽','sales'],['reverse','Обратная логистика на невыкуп','₽','sales'],['delivery','Доставка общей коробки до приёмки','₽/коробка','sales'],['acceptance','Приёмка','₽/шт.','sales'],['storage','Хранение','₽/шт.','sales'],['penalties','Штрафы, прочие удержания','₽/шт.','sales'],['buyout','Плановый выкуп','%','sales'],['loss','Потеря стоимости при невыкупе','%','sales'],
 ['rent','Аренда за месяц','₽','overhead'],['software','Сервисы за месяц','₽','overhead'],['bank','Банк за месяц','₽','overhead'],['otherMonthly','Другие постоянные затраты','₽/мес.','overhead'],['volume','Продажи за месяц','шт.','overhead'],['otherUnit','Прочие затраты','₽/шт.','overhead']
];
export function blankProduct(){return {id:crypto.randomUUID(),name:'Новый товар',sku:'',platform:'WB · свой склад',printer:'Bambu Lab P2S Combo',material:'PLA',values:{...Object.fromEntries(fields.map(([k])=>[k,null])),watts:200,tariff:5,yield:1,labels:1,outerLabels:1},shippingMode:'rubles',custom:[],price:null,target:30,tax:4,taxMode:'НПД',history:[]};}
export function calculate(p){
 const v=p.values, missing=[], invalid=[];
 const n=k=>{if(v[k]===null||v[k]===''||v[k]===undefined){missing.push(k);return 0;} if(!Number.isFinite(v[k])||v[k]<0){invalid.push(k);return 0;}return v[k];};
 const div=(a,b,k)=>{if(b<=0){if(!missing.includes(k))invalid.push(k);return 0;}return a/b;};
 const grams=n('grams'),kg=n('kgPrice'),mins=n('minutes'),y=n('yield'),hours=div(mins,60,'minutes');
 const material=div(grams*kg/1000,y,'yield');
 const amort=div(n('printerPrice'),n('printerLife'),'printerLife')*div(hours,y,'yield');
 const energy=n('watts')/1000*n('tariff')*div(hours,y,'yield');
 const labor=n('labor'),maint=n('maintenance'),components=n('components'),design=n('design'),defect=n('defect');
 if(defect>=100)invalid.push('defect');
 const raw=material+amort+energy+labor+maint+components+design;
 const defectCost=defect<100?raw/(1-defect/100)-raw:0;
 const count=n('capacity'),outer=div(n('outer'),count,'capacity');
 const labelUnit=div(n('labelPack'),n('labelCount'),'labelCount'),numLabels=n('labels')+div(n('outerLabels'),count,'capacity');
 const labels=labelUnit*numLabels,lp=n('labelPrinter'),ll=n('labelLife');
 const labelAmort=lp===0?0:div(lp,ll,'labelLife')*numLabels;
 const packaging=n('box')+outer+labels+labelAmort+div(n('bubblePrice'),n('bubbleYield'),'bubbleYield')+n('card')+n('tape');
 const monthly=n('rent')+n('software')+n('bank')+n('otherMonthly'),volume=n('volume');
 const overhead=(monthly?div(monthly,volume,'volume'):0)+n('otherUnit');
 const production=raw+defectCost,cost=production+packaging+overhead;
 for(const key of ['commission','acquiring','ads','deliveryPercent'])if(v[key]>100)invalid.push(key);
 for(const key of ['yield','capacity','labelCount','labels','outerLabels','bubbleYield','volume'])if(v[key]!==null&&!Number.isInteger(v[key]))invalid.push(key);
 const buy=n('buyout');if((v.buyout!==null&&buy<=0)||buy>100)invalid.push('buyout');const b=buy/100;
 const loss=n('loss');if(loss>100)invalid.push('loss');
 const percentShipping=p.shippingMode==='percent',wbShipping=p.shippingMode==='wb-total',aggregateShipping=percentShipping||wbShipping;
 const logistics=aggregateShipping?0:n('logistics'),reverse=aggregateShipping?0:n('reverse'),delivery=n('delivery'),accept=n('acceptance'),storage=n('storage'),penalties=n('penalties');
 const deliveryPct=percentShipping?n('deliveryPercent'):0,wbDelivery=wbShipping?n('wbDelivery'):0;
 const extra=p.custom.reduce((s,c)=>{if(c.amount===null){missing.push('custom:'+c.id);return s;}if(!Number.isFinite(c.amount)||c.amount<0){invalid.push('custom:'+c.id);return s;}return s+(c.mode==='percent'?0:c.amount);},0);
 const commission=n('commission'),acquiring=n('acquiring'),ads=n('ads');
 const pct=commission+acquiring+ads+deliveryPct+p.custom.filter(c=>c.mode==='percent').reduce((s,c)=>s+(c.amount||0),0);
 if(!Number.isFinite(p.target)||p.target<0||p.target>=100)invalid.push('target');
 const tax=Number(p.tax);if(!Number.isFinite(tax)||tax<0||tax>=100)invalid.push('tax');
 const platformFixed=wbDelivery+(b>0?(logistics+(1-b)*reverse)/b:0)+accept+storage+penalties;
 const salesFixed=platformFixed+(b>0?(1-b)/b*(production+packaging)*loss/100:0)+div(delivery,count,'capacity')+extra;
 const fixed=cost+salesFixed,rate=(pct+tax)/100;
 const price=Number(p.price)||0,profit=price*(1-rate)-fixed;
 const min=rate<1?fixed/(1-rate):null,targetRate=(Number(p.target)||0)/100;
 const target=rate+targetRate<1?fixed/(1-rate-targetRate):null;
 const platformFees=price*(commission+acquiring+deliveryPct)/100+platformFixed;
 const detailRows=[
 ['Материал',material],['Амортизация 3D-принтера',amort],['Электричество',energy],['Труд',labor],['Обслуживание',maint],['Комплектующие',components],['Разработка модели',design],['Резерв производственного брака',defectCost],
 ['Индивидуальная коробка',v.box??0],['Общая коробка на изделие',outer],['Этикетки',labels],['Амортизация принтера этикеток',labelAmort],['Пупырчатая плёнка',(v.bubblePrice??0)/(v.bubbleYield>0?v.bubbleYield:Infinity)],['Карточка приветствия',v.card??0],['Прочая упаковка',v.tape??0],
 ...['rent','software','bank','otherMonthly'].map(k=>[fields.find(f=>f[0]===k)[1]+' на изделие',volume>0?(v[k]??0)/volume:0]),['Прочие затраты на изделие',v.otherUnit??0],
 ['Доставка площадки',wbDelivery+price*deliveryPct/100+(b>0?(logistics+(1-b)*reverse)/b:0)],['Доставка партии до приёмки',delivery/(count>0?count:Infinity)],['Приёмка',accept],['Хранение',storage],['Штрафы и удержания',penalties],['Резерв потерь при невыкупе',b>0?(1-b)/b*(production+packaging)*loss/100:0],
 ['Комиссия площадки',price*commission/100],['Эквайринг',price*acquiring/100],['Реклама',price*ads/100],
 ...p.custom.map(c=>[c.name,c.mode==='percent'?price*(c.amount||0)/100:c.amount||0]),['Налог',price*tax/100]
 ];
 const detailKeys=['grams','printerPrice','watts','labor','maintenance','components','design','defect','box','outer','labelPack','labelPrinter','bubblePrice','card','tape','rent','software','bank','otherMonthly','otherUnit','logistics','delivery','acceptance','storage','penalties','loss','commission','acquiring','ads',...p.custom.map(c=>'custom:'+c.id),'tax'];
 detailRows.forEach((row,i)=>row.push(detailKeys[i]));
 return {detailRows,platformFees,platformPayout:price-platformFees,commissionCost:price*commission/100,deliveryCost:wbDelivery+price*deliveryPct/100+(b>0?(logistics+(1-b)*reverse)/b:0),totalExpenses:fixed+price*rate,totalExpensesPercent:price?(fixed+price*rate)/price*100:null,costPercent:price?cost/price*100:null,platformPercent:price?platformFees/price*100:null,missing:[...new Set(missing)],invalid:[...new Set(invalid)],production,packaging,overhead,cost,salesFixed,fixed,rate,min,target,profit,price,margin:price?profit/price*100:null,markup:cost? (price-cost)/cost*100:null,roi:fixed?profit/fixed*100:null,tax:price*tax/100,fees:price*pct/100,payout:price*(1-pct/100)-salesFixed,monthlyProfit:volume?profit*volume:null,breakVolume:price*(1-rate)-(fixed-(volume?monthly/volume:0))>0?monthly/(price*(1-rate)-(fixed-(volume?monthly/volume:0))):null,rows:[['Материал',material],['Амортизация 3D-принтера',amort],['Электричество',energy],['Труд',labor],['Обслуживание',maint],['Комплектующие и разработка',components+design],['Резерв брака',defectCost],['Упаковка и этикетки',packaging],['Накладные',overhead],['Доставка, невыкуп и прочее',salesFixed]]};
}
export function validateDB(x){
 if(!x||x.schema!==1||typeof x.id!=='string'||!Array.isArray(x.products)||!x.products.length||x.products.length>1000)throw Error('Неверный формат базы или версия файла');
 const ids=new Set();
 for(const p of x.products){if(!p||typeof p.id!=='string'||ids.has(p.id)||typeof p.name!=='string'||!p.values||!Array.isArray(p.custom)||!Array.isArray(p.history))throw Error('Повреждена карточка товара');ids.add(p.id);
 if(!('shippingMode' in p))p.shippingMode='rubles';
 if(!['rubles','percent','wb-total'].includes(p.shippingMode))throw Error('Некорректный режим доставки');
 if(!('wbDelivery' in p.values))p.values.wbDelivery=null;
 if(!('deliveryPercent' in p.values))p.values.deliveryPercent=null;
 for(const [k] of fields){if(!(k in p.values)||!(p.values[k]===null||(typeof p.values[k]==='number'&&Number.isFinite(p.values[k])&&p.values[k]>=0)))throw Error('Некорректное поле '+k);}
 for(const c of p.custom){if(typeof c.id!=='string'||typeof c.name!=='string'||!['unit','percent'].includes(c.mode)||!(c.amount===null||(typeof c.amount==='number'&&Number.isFinite(c.amount)&&c.amount>=0)))throw Error('Некорректная дополнительная статья');}
 if(typeof p.tax!=='number'||p.tax<0||p.tax>=100||!(p.price===null||(typeof p.price==='number'&&p.price>=0))||typeof p.target!=='number'||p.target<0||p.target>=100)throw Error('Некорректные параметры цены или налога');
 }
 return x;
}
