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
export function hoverPreviewPosition(rect,viewport,aspect=0.75){
 const gap=16,pad=12,scale=Math.min(300,(viewport.width-pad*2),400*aspect,(viewport.height-pad*2)*aspect),width=Math.max(1,scale),height=width/aspect;
 const side=rect.right+gap+width<=viewport.width-pad?'right':'left';const left=Math.max(pad,Math.min(side==='right'?rect.right+gap:rect.left-gap-width,viewport.width-width-pad));
 const top=Math.max(pad,Math.min(rect.top+rect.height/2-height/2,viewport.height-height-pad));return {left,top,width,height,side};
}
// Capture the photo click before row buttons, labels and selectors can change a selection.
export function installImagePreview(doc=globalThis.document,{hoverDelay=180}={}){
 if(installed.has(doc))return installed.get(doc);
 const eligible=image=>image?.tagName==='IMG'&&!image.closest('.full-image-viewer,.thumbnail-hover-preview,[data-no-image-preview]')&&photoSource(image);
 const decorate=root=>{for(const image of [...(root.tagName==='IMG'?[root]:[]),...(root.querySelectorAll?.('img')||[])])if(eligible(image)){image.tabIndex=0;image.setAttribute('role','button');image.setAttribute('aria-label','Открыть фото в полном размере'+(image.alt?': '+image.alt:''));image.removeAttribute('title');image.classList.add('zoomable-product-photo');}};
 let hoverSource=null,hoverTimer=null,hoverPanel=null;
 const hideHover=()=>{clearTimeout(hoverTimer);hoverTimer=null;hoverSource=null;if(hoverPanel){hoverPanel.remove();hoverPanel=null;}};
 const showHover=image=>{if(!image.isConnected||!eligible(image)||hoverSource!==image)return;const rect=image.getBoundingClientRect();if(rect.width>240||rect.height>320||!rect.width||!rect.height)return;const view=doc.defaultView,aspect=image.naturalWidth&&image.naturalHeight?image.naturalWidth/image.naturalHeight:0.75,position=hoverPreviewPosition(rect,{width:view.innerWidth,height:view.innerHeight},aspect);const panel=doc.createElement('div');panel.className='thumbnail-hover-preview';panel.setAttribute('popover','manual');panel.setAttribute('aria-hidden','true');panel.dataset.side=position.side;Object.assign(panel.style,{left:position.left+'px',top:position.top+'px',width:position.width+'px',height:position.height+'px'});panel.style.setProperty('--preview-arrow-top',Math.max(20,Math.min(position.height-20,rect.top+rect.height/2-position.top))+'px');const photo=doc.createElement('img');photo.alt='';photo.referrerPolicy='no-referrer';photo.src=photoSource(image);photo.onerror=()=>{if(hoverPanel===panel)hideHover();};panel.append(photo);(image.closest('dialog')||doc.body).append(panel);hoverPanel=panel;try{panel.showPopover?.();}catch{} };
 const over=event=>{const image=event.target;if(event.pointerType==='touch'||!eligible(image)||hoverSource===image)return;hideHover();hoverSource=image;hoverTimer=setTimeout(()=>showHover(image),hoverDelay);hoverTimer.unref?.();};
 const out=event=>{if(event.target===hoverSource)hideHover();};
 const dismiss=event=>{if(event.key==='Escape')hideHover();};
 doc.addEventListener('pointerover',over,true);doc.addEventListener('pointerout',out,true);doc.addEventListener('scroll',hideHover,true);doc.addEventListener('keydown',dismiss,true);doc.defaultView.addEventListener('resize',hideHover);
 const activate=event=>{const image=event.target;if(!eligible(image))return;if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopImmediatePropagation();hideHover();openImagePreview(image);};
 doc.addEventListener('click',activate,true);doc.addEventListener('keydown',activate,true);decorate(doc);
 const observer=new doc.defaultView.MutationObserver(records=>{for(const record of records){if(record.type==='attributes')decorate(record.target);else for(const node of record.addedNodes)if(node.nodeType===1)decorate(node);}if(hoverSource&&!hoverSource.isConnected)hideHover();});observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','hidden','data-full-image']});
 const dispose=()=>{hideHover();doc.removeEventListener('pointerover',over,true);doc.removeEventListener('pointerout',out,true);doc.removeEventListener('scroll',hideHover,true);doc.removeEventListener('keydown',dismiss,true);doc.defaultView.removeEventListener('resize',hideHover);observer.disconnect();doc.removeEventListener('click',activate,true);doc.removeEventListener('keydown',activate,true);installed.delete(doc);};installed.set(doc,dispose);return dispose;
}
