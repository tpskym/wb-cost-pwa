export function installNumberControls(doc=globalThis.document){
 const enhance=()=>{for(const input of doc.querySelectorAll('input[type="number"]')){
  if(input.hasAttribute('data-no-stepper')||input.closest('.number-control,.dimension-stepper'))continue;
  const row=doc.createElement('div');row.className='number-control';const host=input.parentElement?.classList.contains('input-unit')?input.parentElement:input;
  host.before(row);row.append(host);
  for(const [delta,symbol,label] of [[-1,'−','Уменьшить'],[1,'+','Увеличить']]){const button=doc.createElement('button');button.type='button';button.textContent=symbol;button.className='number-control-button';button.setAttribute('aria-label',label+': '+(input.getAttribute('aria-label')||input.closest('label')?.childNodes[0]?.textContent?.trim()||'значение'));button.title=label;button.onclick=()=>{if(input.disabled||input.readOnly)return;const step=Number(input.step)>0?Number(input.step):1;const min=input.min===''?-Infinity:Number(input.min),max=input.max===''?Infinity:Number(input.max);let value=Number(input.value||0);if(input.step&&input.step!=='any'){input[delta>0?'stepUp':'stepDown']();}else{value=Math.max(min,Math.min(max,Number((value+delta*step).toPrecision(12))));input.value=String(value);}input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));input.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));};row.append(button);}
 }
 for(const row of doc.querySelectorAll('.number-control')){const input=row.querySelector('input');for(const button of row.querySelectorAll('.number-control-button')){const disabled=input.disabled||input.readOnly;if(button.disabled!==disabled)button.disabled=disabled;}}
 };
 enhance();const observer=new doc.defaultView.MutationObserver(enhance);observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly','type']});return ()=>observer.disconnect();
}
