import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {blankProduct} from '../calc.js';
import {enqueuePrint} from '../print-queue-state.js';
import {
  encodeSyncArchive, localSnapshot, materializeSnapshot, publishSyncSeed, publishSyncVersion,
  readSyncSeed, registerSyncDevice, seedSync, synchronizeFolder,
} from '../webdav-sync.js';
import {createSyncScheduler} from '../sync-scheduler.js';

function directory(path) {
  return {
    async getFileHandle(name) {
      const target = join(path, name);
      return {
        name, kind: 'file',
        async getFile() { return new Blob([await readFile(target)]); },
        async createWritable() {
          const temporary = target + '.tmp';
          return {
            async write(blob) { await writeFile(temporary, new Uint8Array(await blob.arrayBuffer())); },
            async close() { await rename(temporary, target); },
            async abort() { await rm(temporary, {force:true}); },
          };
        },
      };
    },
    async *values() {
      for (const name of await readdir(path)) yield await this.getFileHandle(name);
    },
  };
}

async function publish(result) {
  const archive = await result.preparePublication?.();
  if (archive) await publishSyncVersion(result.state, archive);
  return result.state;
}

test('two computers transfer the full database, merge independent fields and resolve same-field conflicts', async t => {
  const path = await mkdtemp(join(process.env.WORKSHOP_WEBDAV_TEST_ROOT || tmpdir(), 'workshop-webdav-'));
  t.after(() => rm(path, {recursive:true, force:true}));
  const folder = directory(path);
  const product = {...blankProduct(), name:'Подставка', sku:'stand_white'};
  const db = {schema:1,id:crypto.randomUUID(),revision:5,products:[product],
    filamentStock:[{id:crypto.randomUUID(),material:'PETG Basic',colorCode:'10100',colorName:'Белый',originalColorName:'White',quantity:3}],
    credentials:{wbToken:'should-not-sync'}};
  enqueuePrint(db,product,2);
  const modelId = crypto.randomUUID();
  product.printModel = {fileId:modelId,ownerId:product.id};
  const model = {id:modelId,owner:db.id+':'+product.id,category:'model',name:'model.3mf',createdAt:new Date().toISOString(),blob:new Blob(['model'])};
  const photo = {...model,id:crypto.randomUUID(),category:'product-image',name:'photo.png',blob:new Blob(['photo'],{type:'image/png'})};
  const original = localSnapshot(db,[model,photo],crypto.randomUUID());
  let mac = seedSync(folder,original.data);
  await publishSyncSeed(mac,await encodeSyncArchive(original.data,original.blobs,mac.head));

  const loaded = await readSyncSeed(folder);
  assert.deepEqual(loaded.data,original.data);
  assert.equal(loaded.data.database.credentials,undefined);
  assert.equal(loaded.data.database.printQueue[0].quantity,2);
  assert.equal(loaded.data.database.filamentStock[0].quantity,3);
  const restored = materializeSnapshot(loaded.data,loaded.blobs,crypto.randomUUID());
  assert.notEqual(restored.database.id,db.id);
  assert.notEqual(restored.database.products[0].printModel.fileId,modelId);
  assert.equal(await restored.records.find(file=>file.category==='model').blob.text(),'model');
  assert.equal(await restored.records.find(file=>file.category==='product-image').blob.text(),'photo');
  let windows = seedSync(folder,loaded.data);
  await registerSyncDevice(windows);
  await assert.rejects(registerSyncDevice(seedSync(folder,loaded.data)),/больше двух компьютеров/);

  const left = structuredClone(original);
  left.data.database.products[0].name = 'Подставка для часов';
  const right = localSnapshot(restored.database,restored.records,mac.epoch);
  right.data.database.products[0].variantNote = 'Белая';
  mac = await publish(await synchronizeFolder(mac,left));
  const combined = await synchronizeFolder(windows,right);
  windows = await publish(combined);
  assert.equal(combined.snapshot.database.products[0].name,'Подставка для часов');
  assert.equal(combined.snapshot.database.products[0].variantNote,'Белая');
  const adopted = await synchronizeFolder(mac,left);
  assert.deepEqual(adopted.snapshot,combined.snapshot);
  mac = adopted.state;
  assert.equal((await synchronizeFolder(mac,{data:adopted.snapshot,blobs:adopted.blobs})).snapshot,undefined);

  const macEdit = {data:structuredClone(adopted.snapshot),blobs:adopted.blobs};
  const windowsEdit = {data:structuredClone(combined.snapshot),blobs:combined.blobs};
  macEdit.data.database.products[0].name = 'Правка на Mac';
  windowsEdit.data.database.products[0].name = 'Правка на Windows';
  mac = await publish(await synchronizeFolder(mac,macEdit));
  const conflict = await synchronizeFolder(windows,windowsEdit);
  assert.deepEqual(conflict.conflicts.map(item=>item.path),[['database','products',product.id,'name']]);
  assert.equal(conflict.snapshot,undefined);
  const choices = new Map([[JSON.stringify(conflict.conflicts[0].path),'remote']]);
  const resolved = await synchronizeFolder(windows,windowsEdit,{resolution:{...conflict,choices}});
  assert.equal(resolved.snapshot.database.products[0].name,'Правка на Mac');
  const published = await publish(resolved);
  assert.equal((await synchronizeFolder(published,{data:resolved.snapshot,blobs:resolved.blobs})).snapshot,undefined);
});

test('a cancelled or skipped scheduler cycle preserves the previous error until a successful retry', async t => {
  let attempts=0;
  const issue=Error('offline');
  let finish;
  const done=new Promise(resolve=>{finish=resolve;});
  const changes=[];
  const scheduler=createSyncScheduler({
    delay:5,
    synchronize:()=>{
      attempts++;
      if(attempts===1)throw issue;
      if(attempts===2)return false;
    },
    onIssue:value=>{changes.push(value);if(!value)finish();},
  });
  t.after(()=>scheduler.stop());
  await done;
  assert.equal(attempts,3);
  assert.deepEqual(changes,[{error:issue,requiresAction:false},null]);
});
