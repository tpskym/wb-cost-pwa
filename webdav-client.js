const bridge = 'http://127.0.0.1:48739';
export const webDavHealthUrl = bridge + '/health';

function loopbackOptions() {
  if (!/Chrom(e|ium)\//.test(globalThis.navigator?.userAgent || '')) return {};
  try {
    const options = {targetAddressSpace: 'loopback'};
    new Request(bridge, options);
    return options;
  } catch {
    return {};
  }
}

async function loopbackAccessDenied() {
  try {
    return (await navigator.permissions.query({name: 'loopback-network'})).state === 'denied';
  } catch {
    return false;
  }
}

async function request(path, {account, method = 'GET', body} = {}) {
  let response;
  try {
    response = await fetch(bridge + path, {
      method, body, cache: 'no-store', redirect: 'error', credentials: 'omit',
      ...loopbackOptions(),
      headers: {'X-Workshop-WebDAV': '1', ...(account && {'X-Workshop-Account': account})},
    });
  } catch {
    if (await loopbackAccessDenied()) {
      throw Error('Разрешите локальные подключения для Мастерской в настройках сайта и повторите проверку.');
    }
    throw Error('Мастерская не может связаться с WebDAV. В разделе «Бэкап» откройте ссылку «Проверить запуск компонента».');
  }
  if (response.ok) return response;
  const message = await response.text();
  const error = Object.assign(Error(message || 'Ошибка WebDAV HTTP ' + response.status), {
    retryAfter: response.headers.get('Retry-After'),
  });
  if ([401, 403, 409].includes(response.status)) error.retryable = false;
  if (response.status === 404) error.name = 'NotFoundError';
  throw error;
}

export async function webDavConnection() {
  return (await (await request('/connection')).json()).account;
}

export async function connectWebDav(account, password) {
  return (await (await request('/connection', {method: 'POST', body: JSON.stringify({account, password})})).json()).account;
}

export function remoteWebDavFolder(account) {
  return {
    async names() {
      return (await request('/files', {account})).json();
    },
    async read(name) {
      return (await request('/files/' + encodeURIComponent(name), {account})).blob();
    },
    async write(name, body) {
      await request('/files/' + encodeURIComponent(name), {account, method: 'PUT', body});
    },
  };
}

async function accessRequest(path, data) {
  const options = data === undefined ? {} : {method: 'POST', body: JSON.stringify(data)};
  return (await request(path, options)).json();
}

export async function hasBackupPassword() {
  return (await accessRequest('/backup-key')).configured;
}

export async function saveBackupPassword(password) {
  await accessRequest('/backup-key', {password});
}

export function encryptBackupAccess(marketplace) {
  return accessRequest('/access/encrypt', marketplace);
}

export function decryptBackupAccess(envelope, password, options) {
  return accessRequest('/access/decrypt', {envelope, password, ...options});
}
