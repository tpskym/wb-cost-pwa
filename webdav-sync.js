import {createFullBackup, parseFullBackup} from './full-backup.js?v=0.2.344';
import {validateDB} from './calc.js?v=0.2.344';
import {stripBackupSecrets} from './google-drive-backup.js?v=0.2.344';
import {equal, mergeSyncSnapshots} from './sync-merge.js?v=0.2.344';

export const initialArchiveName = 'workshop-initial-transfer.zip';
const seedMarkerName = 'workshop-sync-source.json';
export const syncRecordId = '__workshop-webdav-sync';
const idPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const markerPattern = /^workshop-sync-([0-9a-f-]{36})\.json$/;
const historyLimit = 8;
const ancestryLimit = 64;
const markerName = device => 'workshop-sync-' + device + '.json';
const archiveName = device => 'workshop-sync-' + device + '.zip';

export function needsAction(message) {
  return Object.assign(Error(message), {retryable: false});
}

export async function writeCloudFile(folder, name, content) {
  if (folder.write) return folder.write(name, content);
  const handle = await folder.getFileHandle(name, {create: true});
  const writer = await handle.createWritable({mode: 'exclusive'});
  try {
    await writer.write(content);
    await writer.close();
  } catch (error) {
    await writer.abort().catch(() => {});
    throw error;
  }
}

export async function readCloudFile(folder, name) {
  if (folder.read) return folder.read(name);
  return (await folder.getFileHandle(name)).getFile();
}

function mapReferences(database, toFileId) {
  for (const product of database.products) {
    if (product.printModel) {
      const fileId = toFileId(product.printModel.fileId);
      if (fileId) product.printModel.fileId = fileId;
      else delete product.printModel;
    }
    for (const draft of Object.values(product.listingDrafts || {})) {
      if (!Array.isArray(draft.photos)) continue;
      draft.photos = draft.photos.filter(photo => {
        if (photo.kind !== 'local') return true;
        const fileId = toFileId(photo.fileId);
        if (fileId) photo.fileId = fileId;
        return Boolean(fileId);
      });
    }
  }
}

export function localSnapshot(database, records, epoch) {
  const clean = validateDB(stripBackupSecrets(database));
  clean.id = epoch;
  delete clean.revision;
  delete clean.updatedAt;
  delete clean.backupMode;
  delete clean.webDavVersion;
  const ids = new Map(records.map(file => [file.id, file.syncId || file.id]));
  mapReferences(clean, id => ids.get(id));
  const files = records.map(file => ({
    id: ids.get(file.id), productId: file.owner.slice(database.id.length + 1),
    category: file.category, name: file.name, createdAt: file.createdAt,
    size: file.blob.size, type: file.blob.type,
    ...(file.sku ? {sku: file.sku} : {}),
    ...(file.plateQuantity ? {plateQuantity: file.plateQuantity} : {}),
  })).sort((a, b) => a.id.localeCompare(b.id));
  return {data: {database: clean, files}, blobs: new Map(records.map(file => [ids.get(file.id), file.blob])), records};
}

export function materializeSnapshot(snapshot, blobs, databaseId, allocate = crypto.randomUUID.bind(crypto)) {
  const database = structuredClone(snapshot.database);
  database.id = databaseId;
  const ids = new Map(snapshot.files.map(file => [file.id, allocate(file.id)]));
  mapReferences(database, id => ids.get(id));
  const records = snapshot.files.map(file => {
    const {id, productId, size, type, ...metadata} = file;
    const blob = blobs.get(id);
    if (!blob || blob.size !== size || blob.type !== type) throw Error('В снимке отсутствует файл «' + file.name + '»');
    return {...metadata, id: ids.get(id), syncId: id, owner: databaseId + ':' + productId, blob};
  });
  return {database, records};
}

export function seedSync(folder, snapshot, device = crypto.randomUUID()) {
  const version = {id: snapshot.database.id, ancestors: []};
  return {folder, device, epoch: version.id, lastShared: version.id, head: version, history: [{version, snapshot}]};
}

export async function encodeSyncArchive(snapshot, blobs, version, onProgress) {
  const {database, records} = materializeSnapshot(snapshot, blobs, snapshot.database.id, id => id);
  database.webDavVersion = version;
  return createFullBackup(database, records, {replaceAll: true, onProgress});
}

export async function decodeSyncArchive(blob, onProgress) {
  const parsed = await parseFullBackup(blob, {onProgress});
  if (!parsed.replaceAll || !idPattern.test(parsed.database.id) ||
    !idPattern.test(parsed.database.webDavVersion?.id || '')) throw Error('Файл не является снимком WebDAV Мастерской');
  const version = parsed.database.webDavVersion;
  const records = parsed.files.map(file => ({
    ...file, id: file.fileId, owner: parsed.database.id + ':' + (file.productId ?? 'marketplace-photos'),
  }));
  if (records.some(file => typeof file.id !== 'string' || !file.id) ||
    new Set(records.map(file => file.id)).size !== records.length) throw Error('В архиве повреждены ссылки на файлы');
  return {...localSnapshot(parsed.database, records, parsed.database.id), version};
}

async function readMarker(file) {
  if (file.size > 16000) throw Error('Повреждён указатель версии WebDAV');
  return JSON.parse(await file.text());
}

async function* cloudFileNames(folder) {
  if (folder.names) {
    yield* await folder.names();
    return;
  }
  for await (const handle of folder.values()) {
    if (handle.kind === 'file') yield handle.name;
  }
}

async function peersFor(state) {
  const peers = [];
  for await (const name of cloudFileNames(state.folder)) {
    const device = name.match(markerPattern)?.[1];
    if (!device || device === state.device) continue;
    const marker = await readMarker(await readCloudFile(state.folder, name));
    if (marker.epoch !== state.epoch) continue;
    if (!idPattern.test(device) || !idPattern.test(marker.id) || !Array.isArray(marker.ancestors) ||
      marker.ancestors.length > ancestryLimit || marker.ancestors.some(id => !idPattern.test(id))) {
      throw Error('Повреждён указатель версии WebDAV');
    }
    peers.push({device, id: marker.id, ancestors: marker.ancestors});
  }
  if (peers.length > 1) throw needsAction('Для этой базы найдено больше двух компьютеров. Автообмен приостановлен.');
  return peers;
}

export async function registerSyncDevice(state) {
  await peersFor(state);
  await publishMarker(state, state.head);
}

const markerBlob = value => new Blob([JSON.stringify(value)], {type: 'application/json'});

export async function publishSyncSeed(state, zip) {
  await writeCloudFile(state.folder, initialArchiveName, zip);
  await registerSyncDevice(state);
  await writeCloudFile(state.folder, seedMarkerName, markerBlob({epoch: state.epoch}));
}

export async function readSyncSeed(folder, onProgress) {
  const marker = await readMarker(await readCloudFile(folder, seedMarkerName));
  const seed = await decodeSyncArchive(await readCloudFile(folder, initialArchiveName), onProgress);
  if (marker.epoch !== seed.version.id || seed.version.id !== seed.data.database.id) {
    throw Error('Исходный архив ещё записывается или повреждён. Повторите загрузку.');
  }
  return seed;
}

async function publishMarker(state, version) {
  await writeCloudFile(state.folder, markerName(state.device), markerBlob({...version, epoch: state.epoch}));
}

const includes = (version, id) => version.id === id || version.ancestors.includes(id);

function withCheckpoint(state, head, entries) {
  const history = [...new Map([...entries, ...state.history].map(entry => [entry.version.id, entry])).values()];
  const shared = history.find(entry => entry.version.id === state.lastShared);
  const recent = history.filter(entry => entry !== shared).slice(0, historyLimit - 1);
  return {...state, head, history: shared ? [...recent, shared] : recent};
}

export async function synchronizeFolder(state, local, {resolution} = {}) {
  const seed = await readMarker(await readCloudFile(state.folder, seedMarkerName));
  if (seed.epoch !== state.epoch) throw needsAction('В облаке другая исходная база. Выполните полную загрузку из нужной папки.');
  const [peer] = await peersFor(state);
  const known = state.history.find(entry => entry.version.id === state.head.id);
  if (!known) throw needsAction('Утеряна локальная версия для сравнения. Обмен приостановлен.');
  const isNewPeer = peer && !includes(state.head, peer.id);
  if (!isNewPeer && equal(local.data, known.snapshot)) return {state};

  let snapshot = local.data;
  let remote;
  let blobs = local.blobs;
  if (isNewPeer) {
    remote = await decodeSyncArchive(await readCloudFile(state.folder, archiveName(peer.device)));
    if (remote.version.id !== peer.id || remote.data.database.id !== state.epoch) {
      throw Error('Другой компьютер ещё записывает данные. Проверка повторится автоматически.');
    }
    const base = state.history.find(entry => includes(state.head, entry.version.id) && includes(peer, entry.version.id));
    if (!base) throw needsAction('Общая версия для сравнения не найдена. Обмен приостановлен, локальная база сохранена.');
    const choices = resolution?.peer === peer.id && equal(local.data, resolution.local) ? resolution.choices : undefined;
    const merged = mergeSyncSnapshots(base.snapshot, local.data, remote.data, choices);
    if (merged.conflicts.length) return {conflicts: merged.conflicts, peer: peer.id, local: local.data};
    snapshot = merged.candidate;
    const localFiles = new Map(local.data.files.map(file => [file.id, file]));
    const remoteFiles = new Map(remote.data.files.map(file => [file.id, file]));
    blobs = new Map(snapshot.files.map(file => {
      if (equal(file, localFiles.get(file.id))) return [file.id, local.blobs.get(file.id)];
      if (equal(file, remoteFiles.get(file.id))) return [file.id, remote.blobs.get(file.id)];
      throw needsAction('У одного файла изменились метаданные на обоих компьютерах. Обмен приостановлен.');
    }));
    if (equal(snapshot, remote.data) && (includes(peer, state.head.id) || equal(local.data, remote.data))) {
      return {state: withCheckpoint({...state,lastShared:peer.id}, peer, [{version: peer, snapshot}]), snapshot, blobs};
    }
  }

  const ancestors = [...new Set([
    state.head.id, state.epoch, state.lastShared,
    ...(peer ? [peer.id] : []), ...state.head.ancestors, ...(peer?.ancestors || []),
  ])].slice(0, ancestryLimit);
  const version = {id: crypto.randomUUID(), ancestors};
  const head = {version, snapshot};
  return {
    state: withCheckpoint(remote?{...state,lastShared:peer.id}:state, version, [head, ...(remote ? [{version: peer, snapshot: remote.data}] : [])]),
    snapshot, blobs,
    preparePublication: () => encodeSyncArchive(snapshot, blobs, version),
  };
}

export async function publishSyncVersion(state, archive) {
  const seed = await readMarker(await readCloudFile(state.folder, seedMarkerName));
  if (seed.epoch !== state.epoch) throw needsAction('В облаке появилась другая исходная база. Автообмен остановлен.');
  await writeCloudFile(state.folder, archiveName(state.device), archive);
  await publishMarker(state, state.head);
}
