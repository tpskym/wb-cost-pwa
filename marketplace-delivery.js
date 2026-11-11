export const ozonSalePriceLimit=300;

// Ozon workbook dated 30.10.2026, «Логистика РФ», Moscow cluster to itself, up to 300 ₽.
// https://cdn.ozone.ru/s3/ozon-disk-api/Seller-edu/files/commissions-tariffs/commissions/logistika-fbo-fbs-30102026_1789376537.xlsx
const ozonMoscowTiers=[
 [0.2,20],[0.4,22],[0.6,23],[0.8,23],[1,25],
 [1.25,27],[1.5,28],[1.75,29],[2,30],[3,34],[4,38],[5,42],
 [6,47],[7,69],[8,76],[9,83],[10,85],[11,97],[12,101],[13,108],
 [14,117],[15,125],[17,131],[20,142],[25,152],[30,172],[35,190],
 [40,211],[45,216],[50,235],[60,261],[70,290],[80,321],[90,358],
 [100,385],[125,449],[150,501],[175,578],[200,654],[400,800],
 [600,1112],[800,1386],[Infinity,1688]
];

// WB published Russian warehouse coefficient and small-item volume rates.
// https://seller.wildberries.ru/instructions/ru/ru/material/logistics-types-and-cost-calculation
const wbSmallTiers=[[0.2,23],[0.4,26],[0.6,29],[0.8,30],[1,32]];
const wbRussianWarehouseCoefficient=1.7;

function packageSize(measurements){
 const {width,height,depth}=measurements?.packaged??{};
 const sides=[width,height,depth];
 const liters=width*height*depth/1_000_000;
 if(!sides.every(side=>Number.isFinite(side)&&side>0)||!Number.isFinite(liters)||liters<=0){
  throw Error('Заполните три размера в разделе «Размеры и вес» → «Товар в упаковке».');
 }
 return {sides,liters};
}

export function wbFbsDelivery(measurements){
 const {sides,liters}=packageSize(measurements);
 if(Math.max(...sides)>1200||sides.reduce((sum,side)=>sum+side,0)>2000||measurements.packagingWeight>25_000){
  throw Error('Для крупногабаритного товара укажите тариф за одну отправку вручную.');
 }
 const base=wbSmallTiers.find(([max])=>liters<=max)?.[1]??46+14*(liters-1);
 // Keep sub-kopeck precision until the tariff is divided by the buyout rate.
 const delivery=Number((base*wbRussianWarehouseCoefficient).toFixed(8));
 return {liters,delivery};
}

export function wbFbsDeliveryPerSale(delivery,buyout){
 if(!Number.isFinite(delivery)||!Number.isFinite(buyout)||buyout<=0)return null;
 const perSale=delivery/(buyout/100);
 return Number.isFinite(perSale)?Number(perSale.toFixed(2)):null;
}

export function ozonMoscowDelivery(measurements,price){
 if(price>ozonSalePriceLimit)throw Error('Укажите цену Ozon до 300 ₽ для расчёта по этому тарифу.');
 const {liters}=packageSize(measurements);
 const logistics=ozonMoscowTiers.find(([max])=>liters<=max)[1];
 // Calculator scenario: partner pickup point and employee acceptance, one item per shipment.
 const pickup=25,handling=10;
 return {liters,logistics,pickup,handling,fbo:logistics+pickup,fbs:logistics+pickup+handling};
}
