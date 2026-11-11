const batchSize=24;

export function openFbsPriceReport({trigger,products,renderPrices,getPhoto}){
 const doc=trigger.ownerDocument;
 const existing=doc.querySelector('.fbs-price-report[open]');
 if(existing)return;

 const groups=new Map();
 for(const product of products){
  const group=product.productGroup?.trim()||'';
  if(!groups.has(group))groups.set(group,[]);
  groups.get(group).push(product);
 }
 const compare=new Intl.Collator('ru',{numeric:true,sensitivity:'base'}).compare;
 const names=[...groups.keys()].sort((a,b)=>Number(!a)-Number(!b)||compare(a,b));
 for(const rows of groups.values()){
  rows.sort((a,b)=>compare(a.sku||a.name,b.sku||b.name));
 }

 const dialog=doc.createElement('dialog');
 dialog.className='fbs-price-report';
 dialog.setAttribute('aria-labelledby','fbs-price-report-title');
 dialog.innerHTML=`<div class="fbs-report-header">
  <div class="modal-head"><h2 id="fbs-price-report-title">Цены всех товаров</h2><button type="button" data-report-close>Закрыть</button></div>
  <div class="fbs-report-filters">
   <label>Группа товаров<select class="ui-select" data-report-group autofocus><option value="">Все группы</option></select></label>
   <p data-report-count role="status"></p>
  </div>
 </div>
 <div class="fbs-report-scroll" role="region" tabindex="0" aria-label="Расчётные цены по товарам">
  <div data-report-groups></div>
  <button type="button" data-report-more hidden>Показать ещё товары</button>
 </div>`;
 const select=dialog.querySelector('[data-report-group]');
 const count=dialog.querySelector('[data-report-count]');
 const scroller=dialog.querySelector('.fbs-report-scroll');
 const list=dialog.querySelector('[data-report-groups]');
 const more=dialog.querySelector('[data-report-more]');
 names.forEach((name,index)=>{
  const option=doc.createElement('option');
  option.value=String(index);
  option.textContent=name||'Без группы';
  select.append(option);
 });

 const objectUrls=new Set();
 const clearPhotos=()=>{
  for(const url of objectUrls)URL.revokeObjectURL(url);
  objectUrls.clear();
 };
 const loadPhoto=async(photo,product)=>{
  if(!photo.isConnected)return;
  const img=photo.querySelector('img');
  const placeholder=photo.querySelector('span');
  try{
   const source=await getPhoto(product);
   if(!img.isConnected||!source)return;
   const urls=Array.isArray(source)?[...source]:[URL.createObjectURL(source)];
   if(!Array.isArray(source))objectUrls.add(urls[0]);
   const showNext=()=>{
    if(!img.isConnected)return;
    const url=urls.shift();
    img.hidden=true;
    placeholder.hidden=false;
    if(url)img.src=url;
    else{
     img.onerror=null;
     img.removeAttribute('src');
    }
   };
   img.onload=()=>{
    img.hidden=false;
    placeholder.hidden=true;
   };
   img.onerror=showNext;
   showNext();
  }catch{}
 };
 const pendingPhotos=new WeakMap();
 const Observer=doc.defaultView.IntersectionObserver;
 const photos=Observer?new Observer(entries=>{
  for(const {target,isIntersecting} of entries){
   if(!isIntersecting)continue;
   photos.unobserve(target);
   loadPhoto(target,pendingPhotos.get(target));
  }
 },{root:scroller,rootMargin:'180px'}):null;
 const loadMore=Observer?new Observer(entries=>{
  if(entries.some(entry=>entry.isIntersecting))appendBatch();
 },{root:scroller,rootMargin:'160px'}):null;

 const sections=new Map();
 let matches=[],rendered=0;
 function appendBatch(){
  if(!dialog.open||rendered>=matches.length)return;
  const end=Math.min(rendered+batchSize,matches.length);
  for(const {name,product} of matches.slice(rendered,end)){
   if(!sections.has(name)){
    const section=doc.createElement('section');
    section.className='fbs-report-group';
    const heading=doc.createElement('h3');
    heading.textContent=name||'Без группы';
    section.append(heading);
    sections.set(name,section);
    list.append(section);
   }
   const row=doc.createElement('article');
   row.className='fbs-report-product';
   row.innerHTML=`<div class="fbs-report-product-info">
    <div class="fbs-report-photo"><span>Нет фото</span><img hidden referrerpolicy="no-referrer"></div>
    <div><h4></h4><p></p></div>
   </div>`;
   const title=product.name||product.sku||'Товар без названия';
   row.querySelector('h4').textContent=title;
   const details=row.querySelector('p');
   details.textContent=[product.sku,product.variantNote,product.colorCode].filter(Boolean).join(' · ');
   details.hidden=!details.textContent;
   const img=row.querySelector('img');
   img.alt=title;
   row.insertAdjacentHTML('beforeend',renderPrices(product));
   sections.get(name).append(row);
   const photo=img.parentElement;
   if(photos){
    pendingPhotos.set(photo,product);
    photos.observe(photo);
   }else loadPhoto(photo,product);
  }
  rendered=end;
  count.textContent=`Показано товаров: ${rendered} из ${matches.length}`;
  more.hidden=rendered===matches.length;
  if(more.hidden){
   loadMore?.unobserve(more);
   if(doc.activeElement===more)scroller.focus({preventScroll:true});
  }
 }

 const draw=()=>{
  photos?.disconnect();
  loadMore?.disconnect();
  list.replaceChildren();
  clearPhotos();
  sections.clear();
  rendered=0;
  const chosen=select.value===''?names:[names[Number(select.value)]];
  matches=chosen.flatMap(name=>groups.get(name).map(product=>({name,product})));
  scroller.scrollTop=0;
  count.textContent=matches.length?'':'Нет товаров';
  more.hidden=true;
  appendBatch();
  if(!more.hidden)loadMore?.observe(more);
 };
 select.onchange=draw;
 more.onclick=appendBatch;
 dialog.querySelector('[data-report-close]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{
  photos?.disconnect();
  loadMore?.disconnect();
  dialog.remove();
  clearPhotos();
  if(trigger.isConnected)trigger.focus({preventScroll:true});
 },{once:true});
 doc.body.append(dialog);
 dialog.showModal();
 draw();
}
