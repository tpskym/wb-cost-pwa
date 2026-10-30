const LIMIT=20*60*1000;
const timers=new WeakMap();
export function freshnessState(updatedAt,now=Date.now()){
 const timestamp=Date.parse(updatedAt);
 return !Number.isFinite(timestamp)?'missing':now-timestamp>LIMIT?'stale':'fresh';
}
export function renderFreshness(updatedAt,now=Date.now(),sourceLabel=''){
 const labelAttr=sourceLabel?' data-freshness-label="'+String(sourceLabel).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'"':'';
 const state=freshnessState(updatedAt,now);
 if(state==='missing')return '<span class="data-freshness" data-freshness-state="missing"'+labelAttr+'>Ещё не обновлялось</span>';
 const iso=new Date(updatedAt).toISOString(),label=new Date(iso).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 return `<span class="data-freshness" data-updated-at="${iso}" data-freshness-state="${state}"${labelAttr}><time datetime="${iso}">Последнее обновление: ${label} МСК</time><strong class="freshness-reminder"${state==='stale'?'':' hidden'}>Пора обновить · данные старше 20 минут</strong></span>`;
}
export function updateFreshness(root,now=Date.now()){
 for(const item of root.querySelectorAll('.data-freshness[data-updated-at]')){
  const state=freshnessState(item.dataset.updatedAt,now);
  item.dataset.freshnessState=state;
  item.querySelector('.freshness-reminder').hidden=state!=='stale';
 }

 const results=root.querySelector('.table-results');
 if(results){
  let alert=results.querySelector('.table-freshness-alert');
  if(!alert){
   alert=(root.ownerDocument||root).createElement('div');alert.className='table-freshness-alert';alert.setAttribute('role','status');
   const text=(root.ownerDocument||root).createElement('span'),button=(root.ownerDocument||root).createElement('button');
   text.className='freshness-alert-title';button.type='button';button.className='freshness-refresh';button.textContent='Обновить';
   button.onclick=async()=>{const primary=root.querySelector('#stock-refresh, #orders-refresh, #prices-refresh');if(!primary||primary.disabled||button.disabled)return;button.disabled=true;button.textContent='Обновление…';try{await primary.onclick?.();}finally{button.disabled=!!primary.disabled;button.textContent='Обновить';}};
   alert.append(text,button);results.prepend(alert);
  }
  const outdated=[...root.querySelectorAll('[data-freshness-state="stale"], [data-freshness-state="missing"]')],labels=[...new Set(outdated.map(item=>item.dataset.freshnessLabel).filter(Boolean))],stale=outdated.length>0;
  alert.querySelector('.freshness-alert-title').textContent=(root.querySelector('#stock-table')?'Остатки WB / Ozon':root.querySelector('#prices-rows')?'Цены WB / Ozon':'Продажи')+(labels.length?' · Обновите: '+labels.join(', '):' · Пора обновить');
  alert.hidden=!stale;
 }
}
export function mountFreshness(root){
 updateFreshness(root);
 if(timers.has(root))return;
 const timer=setInterval(()=>{if(!root.isConnected){clearInterval(timer);timers.delete(root);return;}updateFreshness(root);},15000);
 timer.unref?.();timers.set(root,timer);
}
