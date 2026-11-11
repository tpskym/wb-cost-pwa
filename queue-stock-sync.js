import {freshnessState} from './data-freshness.js?v=0.2.369';
import {loadWarehouseStocks} from './warehouse-stocks.js?v=0.2.369';
import {marketRequest,redact} from './marketplace-api.js?v=0.2.369';
export const queueStockSources={'wb-fbs':'WB · FBS','wb-fbw':'WB · FBW','ozon-fbs':'Ozon · FBS','ozon-fbo':'Ozon · FBO'};
export function queueStockFreshness(database,now=Date.now()){return Object.entries(queueStockSources).map(([source,label])=>{const snapshot=database.stockSnapshots?.find(snapshot=>snapshot.source===source);return {source,label,updatedAt:snapshot?.updatedAt,state:freshnessState(snapshot?.updatedAt,now)};});}
export function renderQueueStockFreshness(database,now=Date.now()){
 const states=queueStockFreshness(database,now),outdated=states.filter(item=>item.state!=='fresh'),stale=states.some(item=>item.state==='stale'),missing=states.some(item=>item.state==='missing');
 return `<div class="queue-stock-freshness ${outdated.length?'needs-refresh':'is-fresh'}" role="status"><strong>${stale?'Остатки старше 20 минут — обновите перед планированием печати.':missing?'Часть остатков ещё не загружена — обновите данные.':'Остатки актуальны · не старше 20 минут'}</strong><div>${states.map(item=>`<span data-queue-stock-source="${item.source}" data-state="${item.state}" title="${item.updatedAt?'Последнее обновление: '+new Date(item.updatedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}):'Ещё не загружено'}">${item.label} · ${item.state==='fresh'?'актуально':item.state==='stale'?'обновить':'нет данных'}</span>`).join('')}</div></div>`;
}
export async function refreshQueueStocks({database,credentials,save,load=loadWarehouseStocks,onProgress=()=>{},isAlive=()=>true}){
 const messages=[];let updated=0;for(const [source,label] of Object.entries(queueStockSources)){if(!isAlive())break;const market=source.startsWith('wb')?'wb':'ozon';if(market==='wb'?!credentials.wbToken:!credentials.ozonKey||!credentials.ozonClient){messages.push(label+': настройте API-доступ');continue;}
 try{onProgress('Обновляю '+label+'…');const rows=await load(source,(operation,body)=>marketRequest(market,operation,credentials,body),{onProgress:message=>{if(!isAlive())throw Error('Раздел закрыт');onProgress(message);}});if(!isAlive())break;
 const before=database.stockSnapshots||[];database.stockSnapshots=before.filter(snapshot=>snapshot.source!==source).concat({source,updatedAt:new Date().toISOString(),rows});try{if(await save()===false)throw Error('Не удалось сохранить обновлённые остатки');}catch(error){database.stockSnapshots=before;throw error;}updated++;messages.push(label+': обновлено');
 }catch(error){messages.push(label+': '+redact(error.message,credentials)+'. Прежние данные сохранены.');}}
 return {updated,messages};
}
