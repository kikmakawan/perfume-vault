// IndexedDB แบบเรียบง่าย — เก็บข้อมูลทั้งหมดไว้ในเครื่อง
const DB_NAME = 'perfume-vault';
const DB_VER = 1;
export const STORES = ['perfumes', 'wishlist', 'wears', 'outbox', 'meta'];

let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      ['perfumes', 'wishlist', 'wears'].forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'uid' }); });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const all = (store) => tx(store, 'readonly', s => req2p(s.getAll()));
export const get = (store, key) => tx(store, 'readonly', s => req2p(s.get(key)));
export const put = (store, val) => tx(store, 'readwrite', s => req2p(s.put(val)));
export const del = (store, key) => tx(store, 'readwrite', s => req2p(s.delete(key)));
export const clear = (store) => tx(store, 'readwrite', s => req2p(s.clear()));
export const replaceAll = (store, items) => tx(store, 'readwrite', s => { s.clear(); items.forEach(i => s.put(i)); });

export async function getMeta(key, def = null) {
  const r = await get('meta', key);
  return r ? r.value : def;
}
export const setMeta = (key, value) => put('meta', { key, value });
