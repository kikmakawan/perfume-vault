// 🧪 อัลกอริทึมกลิ่น: ความเข้ากับฤดู / ความคล้าย / แผนที่ 2 มิติ / จัดกระเป๋าไปเที่ยว (ทำงานในเครื่อง)
import { state } from './store.js';
import { AXES, perfumeAxes, mainAxis, wearIndex, perfumeStats } from './analytics.js';
import { statusKey, num, norm, isBlank, clamp } from './util.js';

// ---------- ฤดู ----------
export const SEASONS = {
  hot: { th: 'หน้าร้อน', e: '☀️', months: 'มี.ค.–พ.ค.', w: { fresh: 1, green: .8, fruity: .6, floral: .5, musky: .5, woody: -.2, sweet: -.8, amber: -.9, leather: -.7 } },
  rainy: { th: 'หน้าฝน', e: '🌧️', months: 'มิ.ย.–ต.ค.', w: { woody: .8, green: .7, musky: .7, fresh: .3, floral: .2, leather: .2, amber: .1, fruity: 0, sweet: -.4 } },
  cool: { th: 'หน้าหนาว', e: '❄️', months: 'พ.ย.–ก.พ.', w: { amber: 1, sweet: .9, woody: .7, leather: .6, musky: .3, floral: 0, fruity: -.2, green: -.3, fresh: -.6 } }
};
export function thaiSeason(date = new Date()) {
  const m = date.getMonth() + 1;
  return m >= 3 && m <= 5 ? 'hot' : m >= 6 && m <= 10 ? 'rainy' : 'cool';
}
export function seasonFromWeather({ tMax, rainProb }) {
  if (rainProb >= 55) return 'rainy';
  if (tMax >= 28) return 'hot';
  if (tMax <= 22) return 'cool';
  return 'rainy';
}
export const hasNotes = (p) => Object.values(perfumeAxes(p)).some(v => v > 0);
/** 0-100 ยิ่งสูงยิ่งเข้ากับฤดู (null = ไม่มีข้อมูลโน้ต) */
export function seasonFit(p, key) {
  if (!hasNotes(p)) return null;
  const a = perfumeAxes(p), w = SEASONS[key].w;
  const x = AXES.reduce((s, ax) => s + a[ax.k] * (w[ax.k] || 0), 0);
  return Math.round(clamp((x + 0.9) / 1.8, 0, 1) * 100);
}

// ---------- ความคล้าย ----------
const noteSet = (p) => new Set([p.topNotes, p.midNotes, p.baseNotes].join(',').split(/[,/]/).map(x => norm(x)).filter(x => x && x.length < 30));
export function similarity(a, b) {
  const A = perfumeAxes(a), B = perfumeAxes(b);
  let dot = 0, na = 0, nb = 0;
  AXES.forEach(x => { dot += A[x.k] * B[x.k]; na += A[x.k] ** 2; nb += B[x.k] ** 2; });
  const cos = na && nb ? dot / Math.sqrt(na * nb) : 0;
  const sa = noteSet(a), sb = noteSet(b);
  const inter = [...sa].filter(x => sb.has(x)).length, uni = new Set([...sa, ...sb]).size;
  const jac = uni ? inter / uni : 0;
  return Math.round((cos * 0.7 + jac * 0.3) * 100);
}
export function similarInCollection(target, { limit = 3, min = 55 } = {}) {
  if (!hasNotes(target)) return [];
  return state.perfumes.filter(p => p.uid !== target.uid && hasNotes(p) && norm(p.name) !== norm(target.name))
    .map(p => ({ p, s: similarity(target, p) })).filter(x => x.s >= min).sort((a, b) => b.s - a.s).slice(0, limit);
}

// ---------- แผนที่กลิ่น (PCA 2 มิติ) ----------
function topEigen(C, n, iters = 80) {
  let v = Array(n).fill(0).map((_, i) => 1 / Math.sqrt(n) + i * 1e-3);
  for (let t = 0; t < iters; t++) {
    const w = C.map(row => row.reduce((s, c, j) => s + c * v[j], 0));
    const len = Math.hypot(...w) || 1; v = w.map(x => x / len);
  }
  const lambda = v.reduce((s, vi, i) => s + vi * C[i].reduce((ss, c, j) => ss + c * v[j], 0), 0);
  return { v, lambda };
}
export function scentMap(items) {
  const keys = AXES.map(a => a.k), n = keys.length;
  const X = items.map(p => { const a = perfumeAxes(p); return keys.map(k => a[k]); });
  const mean = keys.map((_, j) => X.reduce((s, r) => s + r[j], 0) / X.length);
  const Z = X.map(r => r.map((x, j) => x - mean[j]));
  const C = keys.map((_, i) => keys.map((_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) / Math.max(1, Z.length - 1)));
  const e1 = topEigen(C, n);
  const C2 = C.map((row, i) => row.map((c, j) => c - e1.lambda * e1.v[i] * e1.v[j]));
  const e2 = topEigen(C2, n);
  const pts = Z.map((r, i) => ({ p: items[i], x: r.reduce((s, z, j) => s + z * e1.v[j], 0), y: r.reduce((s, z, j) => s + z * e2.v[j], 0) }));
  const axes = AXES.map((a, j) => ({ ...a, x: e1.v[j], y: e2.v[j] }));
  return { pts, axes };
}

// ---------- จัดกระเป๋าไปเที่ยว ----------
export function travelPicks({ season, days, occasions = [] }) {
  const idx = wearIndex();
  const cand = state.perfumes.filter(p => statusKey(p.status) !== 'empty');
  const scored = cand.map(p => {
    const a = perfumeAxes(p), s = perfumeStats(p, idx);
    const fit = seasonFit(p, season);
    const base = (isBlank(p.rating) ? 3 : num(p.rating)) * 9 + Math.min(s.wears, 20) * .6 + (fit === null ? 30 : fit * .5);
    const day = base + (a.fresh + a.green + a.musky + a.floral * .6 + a.fruity * .5) * 30 - (season === 'hot' ? (a.sweet + a.amber) * 20 : 0);
    let night = base + (a.amber + a.sweet + a.woody + a.leather + a.musky * .5) * 30;
    if (occasions.includes('party') || occasions.includes('date')) night += (a.amber + a.sweet) * 10;
    if (occasions.includes('beach')) return { p, fit, day: day + (a.fresh + a.fruity) * 25, night: night - 10, base };
    return { p, fit, day, night, base };
  });
  const out = [];
  const take = (key, why) => {
    const best = scored.filter(x => !out.some(o => o.p.uid === x.p.uid)).sort((a, b) => b[key] - a[key])[0];
    if (best) out.push({ p: best.p, fit: best.fit, role: why });
  };
  take('day', '☀️ ขวดกลางวัน: สดชื่น ใส่เดินเที่ยวทั้งวันได้');
  take('night', '🌙 ขวดกลางคืน: อบอุ่นขึ้น ใส่ไปดินเนอร์หรือออกงาน');
  if (days >= 4 || occasions.length >= 2) {
    const used = out.map(o => mainAxis(o.p).k);
    const third = scored.filter(x => !out.some(o => o.p.uid === x.p.uid) && !used.includes(mainAxis(x.p).k)).sort((a, b) => b.base - a.base)[0];
    if (third) out.push({ p: third.p, fit: third.fit, role: '🎲 ขวดเปลี่ยนอารมณ์: กลิ่นต่างแนว ไว้สลับไม่ให้เบื่อ' });
  }
  // ปริมาณที่ควรแบ่ง: ราว 4 ปั๊ม × 0.1ml ต่อครั้ง
  const per = Math.max(2, Math.ceil(days * 4 * 0.1 / Math.max(1, out.length) * 1.6));
  return out.map(o => ({ ...o, ml: per, bigBottle: num(o.p.volume) > 100 }));
}
