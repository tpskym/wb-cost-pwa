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
