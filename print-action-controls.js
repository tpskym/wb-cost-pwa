const paths={model:'<path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8M7.5 5.5l9 5"/>',label:'<path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z"/><path d="M17 11h.01"/>'};
export function printActionIcon(kind){return `<svg class="print-action-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[kind]||''}</svg>`;}
export function installPrintActionControls(doc=globalThis.document){
 const decorate=button=>{const text=button.textContent.trim(),kind=/^Печать модели/.test(text)?'model':/^(?:Печать этикет|Этикетк[аи]$)/.test(text)?'label':null;
  if(!kind)return;
  button.classList.add('print-action','print-action--'+kind);
  if(button.querySelector('.print-action-icon'))return;
  const template=doc.createElement('template');template.innerHTML=printActionIcon(kind);button.prepend(template.content.firstChild);
 };
 const enhance=root=>{if(root.nodeType===3)root=root.parentElement;if(!root)return;if(root.matches?.('button'))decorate(root);else if(root.closest?.('button'))decorate(root.closest('button'));root.querySelectorAll?.('button').forEach(decorate);};
 enhance(doc);const observer=new doc.defaultView.MutationObserver(records=>{for(const record of records)enhance(record.target);});observer.observe(doc.body,{childList:true,subtree:true,characterData:true});return ()=>observer.disconnect();
}
