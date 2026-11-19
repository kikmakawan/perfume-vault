// ซิงค์คิวในเครื่อง ↔ Google Sheet
import * as db from './db.js';
import * as store from './store.js';
import { call, isConfigured, isOnline } from './api.js';
import { debounce, nowIso, toast, esc, alertDialog } from './util.js';

export const syncState = { syncing: false, lastSync: null, lastError: null };

export async function initSync() {
  syncState.lastSync = await db.getMeta('lastSync', null);
  store.hooks.afterEnqueue = scheduleSync;
  window.addEventListener('online', () => { store.emit('net'); sync(); });
  window.addEventListener('offline', () => store.emit('net'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - new Date(syncState.lastSync || 0) > 5 * 60000) sync();
  });
}

export const scheduleSync = debounce(() => sync(), 1500);

export async function sync({ silent = true } = {}) {
  if (syncState.syncing) return;
  if (!isConfigured()) { if (!silent) toast('ยังไม่ได้เชื่อม Google Sheet — ไปที่ ตั้งค่า'); return; }
  if (!isOnline()) { if (!silent) toast('ออฟไลน์อยู่ จะซิงค์ให้เมื่อกลับมาออนไลน์ ☁️'); return; }

  syncState.syncing = true; store.emit('sync');
  let ops = [];
  try {
    ops = await db.all('outbox');
    ops.forEach(o => store.inflight.add(o.seq));
    const data = ops.length
      ? await call('sync', { ops: ops.map(o => ({ opId: o.opId, kind: o.kind, entity: o.entity, uid: o.uid, rec: o.rec })) }, { timeout: 180000 })
      : await call('pull');

    for (const o of ops) await db.del('outbox', o.seq);
    await store.applyServer(data);
    syncState.lastSync = nowIso(); syncState.lastError = null;
    await db.setMeta('lastSync', syncState.lastSync);

    const bad = (data.results || []).filter(r => !r.ok || r.warning);
    if (bad.length) {
      alertDialog({ emoji: '⚠️', title: 'ซิงค์แล้ว แต่บางรายการมีปัญหา', text: bad.map(b => '• ' + esc(b.label || '') + ' ' + esc(b.error || b.warning)).join('<br>') });
    } else if (!silent) {
      toast(ops.length ? `ซิงค์ ${ops.length} รายการแล้ว ✨` : 'ข้อมูลเป็นปัจจุบันแล้ว ✨');
    }
  } catch (e) {
    syncState.lastError = e.message;
    if (!silent || e.auth) toast('ซิงค์ไม่สำเร็จ: ' + e.message, 3500);
  } finally {
    store.inflight.clear();
    syncState.syncing = false;
    store.state.outboxCount = (await db.all('outbox')).length;
    store.emit('sync');
    // มีรายการใหม่เข้าคิวระหว่างซิงค์ → ซิงค์ต่อ
    if (!syncState.lastError && store.state.outboxCount) scheduleSync();
  }
}
