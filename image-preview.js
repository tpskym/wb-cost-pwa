const installed=new WeakMap();
function photoSource(image){const value=image.dataset.fullImage||image.currentSrc||image.src;if(!value||image.hidden)return '';try{const url=new URL(value,image.ownerDocument.baseURI);return ['https:','http:','blob:'].includes(url.protocol)||url.protocol==='data:'&&value.startsWith('data:image/')?url.href:'';}catch{return '';}}
export function openImagePreview(source){
 const doc=source.ownerDocument,url=photoSource(source);if(!url)return null;
 const existing=doc.querySelector('.full-image-viewer');if(existing){existing.close();}
 const dialog=doc.createElement('dialog');dialog.className='full-image-viewer';dialog.setAttribute('aria-label','Фото товара в полном размере');
 dialog.innerHTML='<header><div><strong>Просмотр фотографии</strong><small data-image-caption></small></div><div class="full-image-actions"><button type="button" data-image-zoom aria-pressed="false">Увеличить 1:1</button><button type="button" data-image-close aria-label="Закрыть фотографию">×</button></div></header><div class="full-image-stage"><img alt=""></div>';
 const image=dialog.querySelector('img'),stage=dialog.querySelector('.full-image-stage'),zoom=dialog.querySelector('[data-image-zoom]');image.referrerPolicy='no-referrer';image.src=url;image.alt=source.alt||'Фото товара';dialog.querySelector('[data-image-caption]').textContent=image.alt;
 const toggleZoom=()=>{const active=dialog.classList.toggle('is-zoomed');zoom.textContent=active?'Вписать в окно':'Увеличить 1:1';zoom.setAttribute('aria-pressed',String(active));stage.scrollTop=0;stage.scrollLeft=0;};zoom.onclick=toggleZoom;image.onclick=toggleZoom;
 dialog.querySelector('[data-image-close]').onclick=()=>dialog.close();dialog.onclick=event=>{if(event.target===dialog)dialog.close();};
 image.onerror=()=>{image.hidden=true;const error=doc.createElement('p');error.className='full-image-error';error.textContent='Не удалось открыть фото. Закройте просмотр и повторите попытку.';stage.append(error);zoom.disabled=true;};
 dialog.addEventListener('close',()=>{dialog.remove();if(source.isConnected)source.focus({preventScroll:true});},{once:true});doc.body.append(dialog);dialog.showModal();return dialog;
}
// Capture the photo click before row buttons, labels and selectors can change a selection.
export function installImagePreview(doc=globalThis.document){
 if(installed.has(doc))return installed.get(doc);
 const eligible=image=>image?.tagName==='IMG'&&!image.closest('.full-image-viewer,[data-no-image-preview]')&&photoSource(image);
 const decorate=root=>{for(const image of [...(root.tagName==='IMG'?[root]:[]),...(root.querySelectorAll?.('img')||[])])if(eligible(image)){image.tabIndex=0;image.setAttribute('role','button');image.setAttribute('aria-label','Открыть фото в полном размере'+(image.alt?': '+image.alt:''));image.title='Открыть фото в полном размере';image.classList.add('zoomable-product-photo');}};
 const activate=event=>{const image=event.target;if(!eligible(image))return;if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopImmediatePropagation();openImagePreview(image);};
 doc.addEventListener('click',activate,true);doc.addEventListener('keydown',activate,true);decorate(doc);
 const observer=new doc.defaultView.MutationObserver(records=>{for(const record of records){if(record.type==='attributes')decorate(record.target);else for(const node of record.addedNodes)if(node.nodeType===1)decorate(node);}});observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','hidden','data-full-image']});
 const dispose=()=>{observer.disconnect();doc.removeEventListener('click',activate,true);doc.removeEventListener('keydown',activate,true);installed.delete(doc);};installed.set(doc,dispose);return dispose;
}
