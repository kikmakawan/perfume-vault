// แหล่งข้อมูลกลางของแอป (local-first): แก้ในเครื่องทันที แล้วเข้าคิวรอซิงค์
import * as db from './db.js';
import { uid, nowIso, norm } from './util.js';

export const state = { perfumes: [], wishlist: [], wears: [], outboxCount: 0, ready: false };
export const ENTITIES = ['perfumes', 'wishlist', 'wears'];

// ---------- events ----------
const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const emit = (what) => listeners.forEach(f => { try { f(what); } catch (e) { console.error(e); } });

// sync.js ตั้งค่าตัวนี้ เพื่อให้ซิงค์อัตโนมัติหลังแก้ไข
export const hooks = { afterEnqueue: () => {} };
export const inflight = new Set();

export async function load() {
  const [p, w, r, o] = await Promise.all(ENTITIES.map(e => db.all(e)).concat([db.all('outbox')]));
  state.perfumes = p; state.wishlist = w; state.wears = r; state.outboxCount = o.length;
  state.ready = true;
  emit('all');
}

export const find = (entity, id) => state[entity].find(x => x.uid === id);
export const perfume = (id) => find('perfumes', id);
export const findPerfumeByName = (name) => {
  const n = norm(name); if (!n) return null;
  return state.perfumes.find(p => norm(p.name) === n)
    || state.perfumes.find(p => norm(p.name).includes(n) || n.includes(norm(p.name)) && norm(p.name).length > 3) || null;
};

function wire(rec) {
  const o = { ...rec };
  delete o.picLocal;
  return o;
}

async function enqueue(op) {
  op.opId = uid();
  op.at = nowIso();
  if (op.kind === 'upsert' || op.kind === 'delete') {
    // รวมคำสั่งซ้ำของรายการเดียวกันที่ยังไม่ได้ส่ง (ประหยัด และไม่อัปรูปซ้ำ)
    const outbox = await db.all('outbox');
    for (const o of outbox) {
      if (inflight.has(o.seq) || o.entity !== op.entity || o.uid !== op.uid) continue;
      if (op.kind === 'upsert' && o.kind === 'upsert' && o.rec && o.rec._picData && !op.rec._picData) {
        op.rec._picData = o.rec._picData; op.rec._picName = o.rec._picName;
      }
      await db.del('outbox', o.seq);
    }
  }
  await db.put('outbox', op);
  state.outboxCount = (await db.all('outbox')).length;
  emit('outbox');
  hooks.afterEnqueue();
}

/** เพิ่ม/แก้ไข (picB64 = รูปใหม่) */
export async function save(entity, rec, { picB64 } = {}) {
  rec = { ...rec };
  if (!rec.uid) rec.uid = uid();
  rec.updatedAt = nowIso();
  if (picB64) rec.picLocal = 'data:image/jpeg;base64,' + picB64;
  const arr = state[entity];
  const i = arr.findIndex(x => x.uid === rec.uid);
  if (i > -1) arr[i] = rec; else arr.push(rec);
  await db.put(entity, rec);

  const w = wire(rec);
  if (picB64) { w._picData = picB64; w._picName = String(rec.name || 'perfume').replace(/[^\w฀-๿]+/g, '_') + '.jpg'; }
  await enqueue({ kind: 'upsert', entity, uid: rec.uid, rec: w });
  emit(entity);
  return rec;
}

export async function patch(entity, id, changes) {
  const cur = find(entity, id);
  if (!cur) return null;
  return save(entity, { ...cur, ...changes });
}

export async function remove(entity, id) {
  state[entity] = state[entity].filter(x => x.uid !== id);
  await db.del(entity, id);
  await enqueue({ kind: 'delete', entity, uid: id });
  emit(entity);
}

/** รวมข้อมูลจากเซิร์ฟเวอร์ โดยรักษารายการที่ยังรอซิงค์อยู่ในเครื่อง */
export async function applyServer(data) {
  const pending = await db.all('outbox');
  for (const ent of ENTITIES) {
    const map = new Map((data[ent] || []).map(r => [r.uid, r]));
    for (const op of pending) {
      if (op.entity !== ent) continue;
      if (op.kind === 'delete') map.delete(op.uid);
      else { const local = find(ent, op.uid); if (local) map.set(op.uid, local); }
    }
    state[ent] = [...map.values()];
    await db.replaceAll(ent, state[ent]);
  }
  state.outboxCount = pending.length;
  emit('all');
}

/** นำเข้าข้อมูลจากไฟล์สำรอง (แทนที่ในเครื่อง และส่งขึ้นชีตทั้งหมด) */
export async function importAll(data) {
  for (const ent of ENTITIES) {
    for (const r of (data[ent] || [])) {
      if (!r.uid) r.uid = uid();
      await save(ent, r);
    }
  }
}

export async function wipeLocal() {
  for (const s of [...ENTITIES, 'outbox']) await db.clear(s);
  state.perfumes = []; state.wishlist = []; state.wears = []; state.outboxCount = 0;
  emit('all');
}

// ---------- ทางลัดของโดเมน ----------
export function wearsOf(pid) { return state.wears.filter(w => w.perfumeUid === pid); }

export async function logWear(p, extra = {}) {
  return save('wears', {
    perfumeUid: p.uid, perfumeName: p.name, date: extra.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
    occasion: extra.occasion || '', weather: extra.weather || '', tempC: extra.tempC ?? '', longevity: extra.longevity ?? '',
    compliments: extra.compliments ?? 0, sprays: extra.sprays ?? '', note: extra.note || ''
  });
}
