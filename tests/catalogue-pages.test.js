import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paginateProductGroups} from '../calc.js';
test('catalogue pagination never splits a named group even if it exceeds page size',()=>{const products=[...Array.from({length:11},(_,i)=>({id:'a'+i,productGroup:'A'})),...Array.from({length:11},(_,i)=>({id:'b'+i,productGroup:'B'})),...Array.from({length:25},(_,i)=>({id:'c'+i,productGroup:'C'}))],pages=paginateProductGroups(products);assert.deepEqual(pages.map(p=>p.length),[11,11,25]);assert.equal(pages.flat().length,47);assert.equal(new Set(pages.flat().map(p=>p.id)).size,47);});
test('ungrouped products retain ordinary pagination and empty catalogues render one empty page',()=>{assert.deepEqual(paginateProductGroups(Array.from({length:45},(_,i)=>({id:String(i)}))).map(p=>p.length),[20,20,5]);assert.deepEqual(paginateProductGroups([]),[[]]);});
