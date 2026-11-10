import {stripBackupSecrets} from './google-drive-backup.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function equal(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => equal(item, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length &&
    keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
}

function indexedRows(rows) {
  if (!Array.isArray(rows) || !rows.every(row => isRecord(row) && typeof row.id === 'string' && row.id)) return null;
  const byId = new Map(rows.map(row => [row.id, row]));
  return byId.size === rows.length ? byId : null;
}

// Use the last mutually applied snapshot as the base. Conflicts must be
// resolved before persisting the returned candidate or publishing it.
export function mergeSyncSnapshots(base, local, remote, choices = new Map()) {
  const conflicts = [];

  function merge(original, left, right, path) {
    if (equal(left, right) || equal(original, right)) return left;
    if (equal(original, left)) return right;
    if (isRecord(original) && isRecord(left) && isRecord(right)) {
      const keys = new Set([...Object.keys(original), ...Object.keys(left), ...Object.keys(right)]);
      return Object.fromEntries([...keys].map(key => [
        key,
        merge(Object.hasOwn(original, key) ? original[key] : undefined,
          Object.hasOwn(left, key) ? left[key] : undefined,
          Object.hasOwn(right, key) ? right[key] : undefined, [...path, key]),
      ]).filter(([, value]) => value !== undefined));
    }
    const [before, ours, theirs] = [original, left, right].map(indexedRows);
    if (before && ours && theirs) {
      const ids = new Set([...ours.keys(), ...theirs.keys(), ...before.keys()]);
      const rows = new Map([...ids].map(id => [id, merge(before.get(id), ours.get(id), theirs.get(id), [...path, id])])
        .filter(([, value]) => value !== undefined));
      const shared = [...before.keys()].filter(id => ours.has(id) && theirs.has(id) && rows.has(id));
      const sharedSet = new Set(shared);
      const sharedOrder = order => [...order.keys()].filter(id => sharedSet.has(id));
      const orderPath = [...path, '$order'];
      const order = merge(shared, sharedOrder(ours), sharedOrder(theirs), orderPath);
      const preferred = equal(order, sharedOrder(ours)) ? ours : theirs;
      return [...new Set([...preferred.keys(), ...[...rows.keys()].sort()])]
        .filter(id => rows.has(id)).map(id => rows.get(id));
    }
    const choice = choices.get(JSON.stringify(path));
    if (choice === 'local') return left;
    if (choice === 'remote') return right;
    conflicts.push({path, base: original, local: left, remote: right});
    return left;
  }

  const candidate = merge(...[base, local, remote].map(stripBackupSecrets), []);
  return structuredClone({candidate, conflicts});
}
