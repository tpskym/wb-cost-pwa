import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installPrintActionControls} from '../print-action-controls.js';
test('printing actions receive accessible decorative icons without changing labels or click handlers',()=>{
 const dom=new JSDOM('<body><button>Печать модели</button><button disabled>Печать этикетки</button><button>Печать этикеток этой партии</button><button>Открыть товар</button></body>'),doc=dom.window.document,buttons=doc.querySelectorAll('button');let calls=0;buttons[0].onclick=()=>calls++;const stop=installPrintActionControls(doc);buttons[0].click();assert.equal(calls,1);assert.equal(buttons[0].textContent,'Печать модели');assert.equal(buttons[0].querySelector('svg').getAttribute('aria-hidden'),'true');assert.ok(buttons[0].classList.contains('print-action--model'));assert.ok(buttons[1].classList.contains('print-action--label'));assert.equal(buttons[1].disabled,true);assert.equal(doc.querySelectorAll('.print-action-icon').length,3);stop();dom.window.close();
});
test('newly rendered and renamed print buttons are decorated once across workspace redraws',async()=>{
 const dom=new JSDOM('<body><div></div></body>'),doc=dom.window.document,stop=installPrintActionControls(doc);doc.querySelector('div').innerHTML='<button>Печать модели</button>';await new Promise(r=>setTimeout(r,0));const button=doc.querySelector('button');assert.equal(button.querySelectorAll('svg').length,1);button.textContent='Печать модели';await new Promise(r=>setTimeout(r,0));assert.equal(button.querySelectorAll('svg').length,1);stop();dom.window.close();
});
