export function installNumberControls(doc=globalThis.document){
 const sync=row=>{
  const input=row.querySelector('input');if(!input)return;
  const buttonsOnly=input.hasAttribute('data-buttons-only'),output=row.querySelector('output');
  if(output&&output.textContent!==(input.value||'—'))output.textContent=input.value||'—';
  for(const button of row.querySelectorAll('.number-control-button')){
   const decrease=button.dataset.delta==='-1',value=Number(input.value),disabled=input.disabled||(input.readOnly&&!buttonsOnly)||(buttonsOnly&&input.value!==''&&(decrease?input.min!==''&&value<=Number(input.min):input.max!==''&&value>=Number(input.max)));
   if(button.disabled!==disabled)button.disabled=disabled;
  }
 };
 const enhance=()=>{
  for(const input of doc.querySelectorAll('input[type="number"]')){
   const buttonsOnly=input.hasAttribute('data-buttons-only');
   if(input.hasAttribute('data-no-stepper')&&!buttonsOnly||input.closest('.number-control,.dimension-stepper'))continue;
   const row=doc.createElement('div');row.className='number-control'+(buttonsOnly?' quantity-control':'');
   const host=input.parentElement?.classList.contains('input-unit')?input.parentElement:input;
   host.before(row);row.append(host);
   if(buttonsOnly){
    input.readOnly=true;input.tabIndex=-1;input.setAttribute('aria-hidden','true');
    const output=doc.createElement('output');output.className='quantity-control-value';output.setAttribute('aria-live','polite');row.append(output);
    // Programmatic updates and form resets must update the visible number as well.
    const descriptor=Object.getOwnPropertyDescriptor(doc.defaultView.HTMLInputElement.prototype,'value');
    Object.defineProperty(input,'value',{configurable:true,get(){return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);sync(row);}});
   }
   for(const [delta,symbol,label] of [[-1,'−','Уменьшить'],[1,'+','Увеличить']]){
    const button=doc.createElement('button');button.type='button';button.textContent=symbol;button.className='number-control-button';button.dataset.delta=String(delta);
    button.setAttribute('aria-label',label+': '+(input.getAttribute('aria-label')||input.closest('label')?.childNodes[0]?.textContent?.trim()||'количество'));button.title=label;
    button.onclick=()=>{
     if(input.disabled||(input.readOnly&&!buttonsOnly))return;
     const step=Number(input.step)>0?Number(input.step):1,min=input.min===''?-Infinity:Number(input.min),max=input.max===''?Infinity:Number(input.max);
     if(input.step&&input.step!=='any')input[delta>0?'stepUp':'stepDown']();
     else input.value=String(Math.max(min,Math.min(max,Number((Number(input.value||0)+delta*step).toPrecision(12)))));
     input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));input.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));sync(row);
    };row.append(button);
   }
   input.addEventListener('input',()=>sync(row));input.addEventListener('change',()=>sync(row));sync(row);
  }
  for(const row of doc.querySelectorAll('.number-control'))sync(row);
 };
 const reset=()=>queueMicrotask(enhance);doc.addEventListener('reset',reset);
 enhance();const observer=new doc.defaultView.MutationObserver(enhance);observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly','type','value','min','max']});
 return ()=>{observer.disconnect();doc.removeEventListener('reset',reset);};
}
