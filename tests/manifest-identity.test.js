import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Workshop installation identity is separate from other GitHub Pages applications',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
 const origin='https://tpskym.github.io',manifestURL=origin+'/wb-cost-pwa/manifest.webmanifest';
 // Manifest IDs resolve against the origin, unlike start_url and scope.
 const id=new URL(manifest.id,origin+'/').href;
 assert.equal(id,origin+'/wb-cost-pwa/');assert.notEqual(id,origin+'/');
 assert.equal(new URL(manifest.start_url,manifestURL).href,id);
 assert.equal(new URL(manifest.scope,manifestURL).href,id);
});
