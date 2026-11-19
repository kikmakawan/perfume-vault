// ✨ ให้ AI เติมโน้ตกลิ่นเบื้องหลัง — บันทึกขวดได้ทันที ไม่ต้องรอ AI
import * as store from './store.js';
import { ai, isConfigured, isOnline } from './api.js';
import { isBlank, toast, GROUPS } from './util.js';

const KEY = 'pv_enrich', ATT = 'pv_enrich_att';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
const getQ = () => read(KEY, []);
const setQ = (q) => localStorage.setItem(KEY, JSON.stringify(q));
let running = false;

export const isEnriching = (uid) => getQ().includes(uid);
export const enrichCount = () => getQ().length;

export function queueEnrich(uid) {
  const q = getQ();
  if (!q.includes(uid)) { q.push(uid); setQ(q); }
  store.emit('enrich');
  setTimeout(runEnrich, 300);
}

export async function runEnrich() {
  if (running || !isConfigured() || !isOnline()) return;
  running = true; store.emit('enrich');
  try {
    let q = getQ();
    while (q.length) {
      const uid = q[0];
      const p = store.perfume(uid);
      if (!p || !p.name) { setQ(q = getQ().filter(x => x !== uid)); continue; }
      try {
        const r = await ai('identify', { name: p.name, brand: p.brand, format: p.format }, { quiet: true });
        const cur = store.perfume(uid);
        if (cur) {
          const ch = {};
          ['brand', 'category', 'topNotes', 'midNotes', 'baseNotes'].forEach(k => { if (isBlank(cur[k]) && !isBlank(r[k])) ch[k] = r[k]; });
          if (isBlank(cur.brandGroup) && GROUPS.includes(r.brandGroup)) ch.brandGroup = r.brandGroup;
          if (Object.keys(ch).length) { await store.patch('perfumes', uid, ch); toast(`✨ AI เติมโน้ตกลิ่นของ ${cur.name} ให้แล้ว`, 3000); }
        }
        setQ(q = getQ().filter(x => x !== uid));
      } catch (e) {
        if (e.network) break;                       // หลุดเน็ต: ไว้ทำต่อทีหลัง
        const att = read(ATT, {}); att[uid] = (att[uid] || 0) + 1; localStorage.setItem(ATT, JSON.stringify(att));
        if (att[uid] >= 3) setQ(q = getQ().filter(x => x !== uid)); // ลองแล้ว 3 รอบ ข้าม
        else break;                                 // Gemini ยุ่ง: ไว้ลองใหม่รอบหน้า
      }
    }
  } finally { running = false; store.emit('enrich'); }
}
