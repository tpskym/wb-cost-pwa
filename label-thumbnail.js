export async function mountLabelThumbnail({root,label,loadPdf=()=>import('./pdfjs/pdf.min.mjs')}){
 if(!root||!label?.data?.startsWith('data:application/pdf;base64,'))return;
 root.hidden=false;root.textContent='Загрузка предпросмотра…';
 let pdf;
 try{
  const api=await loadPdf();if(!root.isConnected)return;
  api.GlobalWorkerOptions.workerSrc=new URL('./pdfjs/pdf.worker.min.mjs',import.meta.url).href;
  const bytes=Uint8Array.from(atob(label.data.split(',')[1]),c=>c.charCodeAt(0));
  pdf=await api.getDocument({data:bytes,wasmUrl:new URL('./pdfjs/wasm/',import.meta.url).href,standardFontDataUrl:new URL('./pdfjs/standard_fonts/',import.meta.url).href,cMapUrl:new URL('./pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,isEvalSupported:false}).promise;
  if(!root.isConnected)return;
  const page=await pdf.getPage(1),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(3,640/base.width)}),canvas=document.createElement('canvas');
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Этикетка: '+(label.name||'PDF'));await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise;
  if(root.isConnected){root.replaceChildren(canvas);if(pdf.numPages>1){const note=document.createElement('small');note.textContent='Первая страница из '+pdf.numPages;root.append(note);}}
 }catch{if(root.isConnected)root.textContent='Не удалось построить изображение. Откройте «Предпросмотр» для просмотра PDF.';}
 finally{await pdf?.destroy();}
}
