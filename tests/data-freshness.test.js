import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {freshnessState,renderFreshness,updateFreshness} from '../data-freshness.js';
test('freshness distinguishes missing dates and the strict 20 minute threshold',()=>{
 const now=Date.parse('2026-10-26T09:00:00Z');
 assert.equal(freshnessState(undefined,now),'missing');
 assert.equal(freshnessState('invalid',now),'missing');
 assert.equal(freshnessState('2026-10-26T08:40:00Z',now),'fresh');
 assert.equal(freshnessState('2026-10-26T08:39:59Z',now),'stale');
});
test('time turns stale without redrawing the table and a new timestamp resets the reminder',()=>{
 const stamp='2026-10-26T09:00:00Z',now=Date.parse(stamp),root=new JSDOM(renderFreshness(stamp,now)).window.document;
 assert.match(root.querySelector('time').textContent,/26\.10\.2026, 12:00 МСК/);
 assert.equal(root.querySelector('.freshness-reminder').hidden,true);
 updateFreshness(root,now+20*60*1000+1);
 assert.equal(root.querySelector('.data-freshness').dataset.freshnessState,'stale');
 assert.equal(root.querySelector('.freshness-reminder').hidden,false);
 root.querySelector('.data-freshness').dataset.updatedAt=new Date(now+21*60*1000).toISOString();
 updateFreshness(root,now+21*60*1000);
 assert.equal(root.querySelector('.freshness-reminder').hidden,true);
 assert.match(renderFreshness(null,now),/Ещё не обновлялось/);
});
test('stale reminder is prominent above the main table and clears after a successful refresh',()=>{
 for(const [id,label] of [['stock-table','Остатки WB / Ozon'],['orders-table','Продажи']]){
 const stamp='2026-10-26T09:00:00Z',now=Date.parse(stamp),root=new JSDOM('<aside>'+renderFreshness(stamp,now)+'</aside><div class="table-results"><div id="'+id+'"></div></div>').window.document;
 updateFreshness(root,now+21*60*1000);
 const alert=root.querySelector('.table-results').firstElementChild;
 assert.equal(alert.querySelector('.freshness-alert-title').textContent,label+' · Пора обновить');assert.equal(alert.hidden,false);
 updateFreshness(root,now);assert.equal(alert.hidden,true);
 assert.equal(root.querySelectorAll('.table-freshness-alert').length,1);
 }
});

test('banner refresh uses the existing action in both sections and prevents repeat requests',async()=>{
 for(const id of ['stock','orders']){
 const doc=new JSDOM('<button id="'+id+'-refresh">Основная кнопка</button>'+renderFreshness('2026-10-26T09:00:00Z')+'<div class="table-results"><div id="'+id+'-table"></div></div>').window.document;
 updateFreshness(doc);const primary=doc.querySelector('#'+id+'-refresh'),button=doc.querySelector('.freshness-refresh');let calls=0,finish;primary.onclick=async()=>{calls++;primary.disabled=true;await new Promise(resolve=>finish=resolve);primary.disabled=false;};
 const pending=button.onclick();assert.equal(calls,1);assert.equal(button.disabled,true);await button.onclick();assert.equal(calls,1);finish();await pending;assert.equal(button.disabled,false);assert.equal(button.textContent,'Обновить');assert.equal(primary.textContent,'Основная кнопка');assert.equal(primary.isConnected,true);
 primary.disabled=true;await button.onclick();assert.equal(calls,1);
 }
});

test('refresh banner names only stale or missing schemes and removes recovered ones',()=>{const now=Date.parse('2026-10-30T10:00:00Z'),fresh='2026-10-30T09:55:00Z',old='2026-10-30T08:00:00Z',doc=new JSDOM(renderFreshness(fresh,now,'WB · FBS')+renderFreshness(old,now,'Ozon · FBO')+renderFreshness(null,now,'WB · FBW')+'<div class="table-results"><div id="stock-table"></div></div>').window.document;updateFreshness(doc,now);const title=doc.querySelector('.freshness-alert-title');assert.match(title.textContent,/Ozon · FBO/);assert.match(title.textContent,/WB · FBW/);assert.doesNotMatch(title.textContent,/WB · FBS/);doc.querySelector('[data-freshness-label="Ozon · FBO"]').dataset.updatedAt=fresh;updateFreshness(doc,now);assert.doesNotMatch(title.textContent,/Ozon · FBO/);});

test('refresh schemes are separate safely escaped visual chips',()=>{const now=Date.parse('2026-10-30T10:00:00Z'),doc=new JSDOM(renderFreshness(null,now,'Ozon · FBO')+renderFreshness(null,now,'WB · FBW')+'<div class="table-results"><div id="stock-table"></div></div>').window.document;updateFreshness(doc,now);assert.deepEqual([...doc.querySelectorAll('.freshness-scheme')].map(e=>e.textContent),['Ozon · FBO','WB · FBW']);assert.equal(doc.querySelector('.freshness-alert-heading').textContent,'Остатки WB / Ozon · Обновите: ');});
