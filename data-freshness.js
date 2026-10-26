const LIMIT=20*60*1000;
const timers=new WeakMap();
export function freshnessState(updatedAt,now=Date.now()){
 const timestamp=Date.parse(updatedAt);
 return !Number.isFinite(timestamp)?'missing':now-timestamp>LIMIT?'stale':'fresh';
}
export function renderFreshness(updatedAt,now=Date.now()){
 const state=freshnessState(updatedAt,now);
 if(state==='missing')return '<span class="data-freshness" data-freshness-state="missing">Ещё не обновлялось</span>';
 const iso=new Date(updatedAt).toISOString(),label=new Date(iso).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 return `<span class="data-freshness" data-updated-at="${iso}" data-freshness-state="${state}"><time datetime="${iso}">Последнее обновление: ${label} МСК</time><strong class="freshness-reminder"${state==='stale'?'':' hidden'}>Пора обновить · данные старше 20 минут</strong></span>`;
}
export function updateFreshness(root,now=Date.now()){
 for(const item of root.querySelectorAll('.data-freshness[data-updated-at]')){
  const state=freshnessState(item.dataset.updatedAt,now);
  item.dataset.freshnessState=state;
  item.querySelector('.freshness-reminder').hidden=state!=='stale';
 }
}
export function mountFreshness(root){
 updateFreshness(root);
 if(timers.has(root))return;
 const timer=setInterval(()=>{if(!root.isConnected){clearInterval(timer);timers.delete(root);return;}updateFreshness(root);},15000);
 timer.unref?.();timers.set(root,timer);
}
