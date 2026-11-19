// คำนวณสถิติ / DNA กลิ่น / แนะนำ / เหรียญ — ทำงานในเครื่อง ไม่ต้องใช้เน็ต
import { state } from './store.js';
import { statusKey, num, norm, daysSince, daysUntil, addMonths, todayStr, dateStr, parseDate, isBlank } from './util.js';

// ---------- แกนกลิ่น (accords) ----------
export const AXES = [
  { k: 'fresh', th: 'สดชื่น/ซิตรัส', e: '🍋', c: '#F5CF5B', w: ['citrus', 'bergamot', 'lemon', 'orange', 'grapefruit', 'mandarin', 'lime', 'yuzu', 'neroli', 'fresh', 'aquatic', 'marine', 'sea', 'ozonic', 'water', 'petitgrain'] },
  { k: 'floral', th: 'ดอกไม้', e: '🌸', c: '#FF9EC4', w: ['floral', 'rose', 'jasmine', 'tuberose', 'violet', 'lily', 'peony', 'magnolia', 'ylang', 'blossom', 'gardenia', 'freesia', 'orchid', 'osmanthus', 'mimosa', 'lotus', 'flower'] },
  { k: 'fruity', th: 'ผลไม้', e: '🍑', c: '#FFB98F', w: ['fruity', 'fruit', 'apple', 'pear', 'peach', 'berry', 'raspberry', 'strawberry', 'pineapple', 'plum', 'cherry', 'blackcurrant', 'cassis', 'lychee', 'mango', 'fig', 'apricot', 'melon', 'passion'] },
  { k: 'sweet', th: 'หวาน/ขนม', e: '🍰', c: '#E9A6F2', w: ['vanilla', 'tonka', 'caramel', 'praline', 'honey', 'chocolate', 'cacao', 'cocoa', 'coffee', 'sugar', 'sweet', 'gourmand', 'almond', 'dates', 'coconut', 'marshmallow', 'candy', 'rum', 'milk'] },
  { k: 'woody', th: 'ไม้', e: '🌲', c: '#B8946A', w: ['wood', 'woody', 'cedar', 'sandalwood', 'vetiver', 'patchouli', 'oud', 'agarwood', 'guaiac', 'cashmeran', 'cypress', 'pine', 'moss', 'oakmoss'] },
  { k: 'amber', th: 'เครื่องเทศ/อำพัน', e: '🔥', c: '#E58F65', w: ['amber', 'spicy', 'spice', 'cinnamon', 'cardamom', 'pepper', 'saffron', 'clove', 'nutmeg', 'ginger', 'incense', 'resin', 'labdanum', 'myrrh', 'oriental', 'benzoin', 'olibanum', 'warm'] },
  { k: 'green', th: 'สมุนไพร/เขียว', e: '🌿', c: '#7FD6B6', w: ['aromatic', 'green', 'lavender', 'sage', 'rosemary', 'basil', 'tea', 'herbal', 'grass', 'fougere', 'geranium', 'mint', 'violet leaf', 'galbanum', 'thyme', 'artemisia', 'fern'] },
  { k: 'musky', th: 'มัสก์/แป้ง', e: '☁️', c: '#B9A3F5', w: ['musk', 'musky', 'powdery', 'powder', 'ambrette', 'aldehyde', 'iris', 'orris', 'heliotrope', 'ambroxan', 'ambergris', 'clean', 'soap', 'cotton', 'white'] },
  { k: 'leather', th: 'หนัง/ควัน', e: '🖤', c: '#8E7F9E', w: ['leather', 'suede', 'smoky', 'smoke', 'tobacco', 'birch', 'tar', 'animalic', 'castoreum'] }
];

const axesCache = new WeakMap();
export function perfumeAxes(p) {
  if (axesCache.has(p)) return axesCache.get(p);
  const cat = norm(p.category), notes = norm([p.topNotes, p.midNotes, p.baseNotes].join(', '));
  const out = {}; let total = 0;
  AXES.forEach(a => {
    let s = 0;
    a.w.forEach(word => { if (cat.includes(word)) s += 2.5; if (notes.includes(word)) s += 1; });
    out[a.k] = s; total += s;
  });
  if (total) AXES.forEach(a => out[a.k] /= total);
  axesCache.set(p, out);
  return out;
}
export const mainAxis = (p) => { const a = perfumeAxes(p); return AXES.reduce((b, x) => a[x.k] > (a[b.k] || 0) ? x : b, AXES[0]); };

// ---------- การฉีด ----------
export function wearIndex() {
  const idx = {};
  state.wears.forEach(w => {
    const i = idx[w.perfumeUid] || (idx[w.perfumeUid] = { count: 0, last: '', compliments: 0, longSum: 0, longN: 0, occ: {} });
    i.count++;
    if (String(w.date) > i.last) i.last = String(w.date);
    i.compliments += num(w.compliments);
    if (!isBlank(w.longevity)) { i.longSum += num(w.longevity); i.longN++; }
    if (w.occasion) i.occ[w.occasion] = (i.occ[w.occasion] || 0) + 1;
  });
  return idx;
}
export function perfumeStats(p, idx = wearIndex()) {
  const i = idx[p.uid] || { count: 0, last: '', compliments: 0, longN: 0, longSum: 0, occ: {} };
  return {
    wears: i.count, last: i.last, daysSince: i.last ? daysSince(i.last) : null, compliments: i.compliments,
    avgLongevity: i.longN ? (i.longSum / i.longN) : null,
    costPerWear: num(p.price) && i.count ? num(p.price) / i.count : null,
    occ: i.occ
  };
}
export const wornToday = (pid) => state.wears.some(w => w.perfumeUid === pid && w.date === todayStr());

export function streak() {
  const days = new Set(state.wears.map(w => String(w.date)));
  let n = 0; const d = new Date();
  if (!days.has(dateStr(d))) d.setDate(d.getDate() - 1); // ยังไม่ฉีดวันนี้ ยังไม่ขาด
  while (days.has(dateStr(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function bestStreak() {
  const days = [...new Set(state.wears.map(w => String(w.date)))].sort();
  let best = 0, cur = 0, prev = null;
  days.forEach(s => {
    const d = parseDate(s); if (!d) return;
    cur = prev && (d - prev) === 86400000 ? cur + 1 : 1;
    best = Math.max(best, cur); prev = d;
  });
  return best;
}

export function heatmap(weeks = 26) {
  const counts = {};
  state.wears.forEach(w => { counts[w.date] = (counts[w.date] || 0) + 1; });
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - (weeks * 7 - 1));
  start.setDate(start.getDate() - start.getDay()); // เริ่มที่วันอาทิตย์
  const out = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const s = dateStr(d); out.push({ date: s, n: counts[s] || 0 });
  }
  return out;
}

// ---------- แจ้งเตือน ----------
export function paoInfo(p) {
  if (!p.openedDate || !num(p.pao)) return null;
  const until = addMonths(p.openedDate, num(p.pao));
  return { until, days: daysUntil(until) };
}
export function alerts() {
  const idx = wearIndex(); const out = [];
  state.perfumes.forEach(p => {
    const sk = statusKey(p.status);
    if (sk === 'empty') return;
    const d = daysUntil(p.expDate);
    if (d !== null && d <= 90) out.push({ p, type: 'exp', pri: d, ic: '⏰', cls: d < 0 ? 't-pink' : 't-lemon', text: d < 0 ? `หมดอายุมาแล้ว ${-d} วัน` : `จะหมดอายุในอีก ${d} วัน` });
    const pao = paoInfo(p);
    if (pao && pao.days <= 60) out.push({ p, type: 'pao', pri: pao.days, ic: '🧪', cls: 't-peach', text: pao.days < 0 ? `เปิดใช้เกินอายุ PAO แล้ว` : `อายุหลังเปิดเหลือ ${pao.days} วัน` });
    if (sk === 'rotation') {
      const s = perfumeStats(p, idx);
      const since = s.last ? s.daysSince : (p.purchaseDate ? daysSince(p.purchaseDate) : null);
      if (since !== null && since >= 45) out.push({ p, type: 'forgot', pri: 200 - since / 10, ic: '🥺', cls: 't-lilac', text: `ไม่ได้ฉีดมา ${since} วันแล้ว คิดถึงนะ` });
    }
    if (!isBlank(p.fillLevel) && num(p.fillLevel) <= 15 && sk === 'rotation') out.push({ p, type: 'low', pri: 100, ic: '🪫', cls: 't-sky', text: `เหลืออีกประมาณ ${num(p.fillLevel)}% เตรียมหาขวดใหม่` });
  });
  return out.sort((a, b) => a.pri - b.pri);
}

// ---------- DNA ----------
export function dna() {
  const idx = wearIndex();
  const score = {}; AXES.forEach(a => score[a.k] = 0);
  const noteW = {};
  let n = 0;
  state.perfumes.forEach(p => {
    const s = perfumeStats(p, idx);
    let w = 1 + (isBlank(p.rating) ? 0 : (num(p.rating) - 3) * 0.6) + Math.min(s.wears, 30) * 0.25;
    if (statusKey(p.status) === 'empty') w += 0.5; // ใช้จนหมด = ชอบจริง
    w = Math.max(0.15, w);
    const ax = perfumeAxes(p);
    AXES.forEach(a => score[a.k] += ax[a.k] * w);
    [p.topNotes, p.midNotes, p.baseNotes].join(',').split(/[,/]/).map(x => x.trim()).filter(x => x && x.length < 30).forEach(note => {
      const key = note.toLowerCase(); noteW[key] = noteW[key] || { name: note, w: 0, n: 0 };
      noteW[key].w += w; noteW[key].n++;
    });
    n++;
  });
  const max = Math.max(...Object.values(score), 0.0001);
  const axes = AXES.map(a => ({ ...a, v: Math.round(score[a.k] / max * 100) }));
  const sorted = [...axes].sort((a, b) => b.v - a.v);
  const notes = Object.values(noteW).filter(x => x.n >= 1).sort((a, b) => b.w - a.w).slice(0, 12);
  return { axes, top: sorted.slice(0, 3), notes, title: personaTitle(sorted), count: n };
}
const PERSONA = {
  fresh: ['สายสดชื่น', '🍋'], floral: ['สายดอกไม้', '🌸'], fruity: ['สายผลไม้ฉ่ำ', '🍑'], sweet: ['สายหวานละมุน', '🍰'],
  woody: ['สายไม้ลุ่มลึก', '🌲'], amber: ['สายอุ่นเครื่องเทศ', '🔥'], green: ['สายสมุนไพร', '🌿'], musky: ['สายสะอาดละมุน', '☁️'], leather: ['สายเท่ดาร์ก', '🖤']
};
function personaTitle(sorted) {
  if (!sorted.length || !sorted[0].v) return { name: 'ยังไม่มีข้อมูลพอ', e: '🫧', sub: 'เพิ่มโน้ตกลิ่นให้ขวดในตู้ก่อนนะ' };
  const [a, b] = sorted;
  const pa = PERSONA[a.k], pb = b && b.v > 55 ? PERSONA[b.k] : null;
  return { name: pa[0] + (pb ? ' × ' + pb[0].replace('สาย', '') : ''), e: pa[1] + (pb ? pb[1] : ''), sub: `ชอบ${a.th}เป็นพิเศษ` + (pb ? ` ตามด้วย${b.th}` : '') };
}

// ---------- แนะนำแบบออฟไลน์ ----------
export function localPicks({ weather, occasion } = {}, n = 3) {
  const idx = wearIndex();
  const hour = new Date().getHours();
  const temp = weather ? weather.temp : 30;
  const hot = temp >= 29, cool = temp <= 23, night = hour >= 18 || hour < 5, rainy = weather && weather.rainy;
  const cand = state.perfumes.filter(p => statusKey(p.status) === 'rotation');
  const scored = cand.map(p => {
    const a = perfumeAxes(p); const s = perfumeStats(p, idx);
    let sc = (isBlank(p.rating) ? 3 : num(p.rating)) * 8;
    const reasons = [];
    const since = s.last ? s.daysSince : 60;
    if (since <= 1) sc -= 40; else sc += Math.min(since, 40) * 0.6;
    if (since >= 30) reasons.push(`ไม่ได้ฉีดมา ${since} วัน`);
    if (hot && !night) { const f = (a.fresh + a.green + a.floral + a.fruity + a.musky * .5) * 30 - (a.sweet + a.amber + a.leather) * 22; sc += f; if (f > 10) reasons.push('สดชื่น เหมาะกับอากาศร้อน'); }
    if (cool || night) { const f = (a.sweet + a.amber + a.woody + a.leather) * 24; sc += f; if (f > 10) reasons.push(night ? 'อบอุ่น เหมาะกับกลางคืน' : 'อุ่นๆ เข้ากับอากาศเย็น'); }
    if (rainy) { const f = (a.woody + a.musky + a.green) * 14; sc += f; if (f > 6) reasons.push('เข้ากับวันฝนพรำ'); }
    if (occasion) {
      const tags = norm(p.tags);
      const occMap = { work: ['ทำงาน', 'work'], date: ['เดท', 'date'], party: ['ออกงาน', 'party', 'กลางคืน'], sport: ['ออกกำลัง'], home: ['อยู่บ้าน'], travel: ['เที่ยว'] };
      if ((occMap[occasion] || []).some(t => tags.includes(t))) { sc += 20; reasons.push('ติดแท็กโอกาสนี้ไว้'); }
      if (s.occ[occasion]) { sc += Math.min(s.occ[occasion], 5) * 4; reasons.push('เคยใส่โอกาสนี้แล้วเวิร์ก'); }
      if (occasion === 'date') sc += (a.sweet + a.amber + a.musky) * 15;
      if (occasion === 'work' || occasion === 'sport') sc += (a.fresh + a.musky + a.green) * 15 - a.sweet * 10;
    }
    if (s.compliments) { sc += Math.min(s.compliments, 6) * 2; if (s.compliments >= 2) reasons.push(`ได้คำชมมาแล้ว ${s.compliments} ครั้ง`); }
    sc += Math.random() * 14;
    if (!reasons.length) reasons.push(num(p.rating) >= 4 ? 'ขวดโปรดคะแนนสูงของคุณ' : 'ลองหยิบขวดนี้ดูบ้าง');
    return { p, sc, reason: reasons.slice(0, 2).join(' · ') };
  });
  return scored.sort((a, b) => b.sc - a.sc).slice(0, n);
}

// ---------- context ให้ AI ----------
export function buildContext({ activeOnly = false, limit = 160 } = {}) {
  const idx = wearIndex();
  return state.perfumes
    .filter(p => !activeOnly || statusKey(p.status) !== 'empty')
    .slice(0, limit)
    .map(p => {
      const s = perfumeStats(p, idx);
      let notes = [p.topNotes, p.midNotes, p.baseNotes].filter(Boolean).join(' / ');
      if (notes.length > 130) notes = notes.slice(0, 130) + '…';
      const st = { rotation: 'in-use', sealed: 'sealed', empty: 'empty' }[statusKey(p.status)] || '-';
      return `- ${p.name} | ${p.brand || ''} | ${p.category || ''} | ${notes} | ${p.rating || '-'}★ | ${st} | ${s.wears} | ${s.last || '-'} | ${p.tags || ''}`;
    }).join('\n');
}
export function recentWearsText(days = 7) {
  return state.wears.filter(w => daysSince(w.date) !== null && daysSince(w.date) <= days)
    .sort((a, b) => String(b.date).localeCompare(a.date))
    .map(w => `${w.date}: ${w.perfumeName}`).join(', ') || '-';
}

// ---------- เงิน ----------
export function spendByMonth(months = 12) {
  const out = []; const d = new Date(); d.setDate(1);
  for (let i = months - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
    const items = state.perfumes.filter(p => String(p.purchaseDate || '').startsWith(key));
    out.push({ key, m: x.getMonth(), y: x.getFullYear(), total: items.reduce((s, p) => s + num(p.price), 0), n: items.length });
  }
  return out;
}

// ---------- เหรียญ ----------
export function badges() {
  const P = state.perfumes, W = state.wears;
  const g = (k) => P.filter(p => p.brandGroup === k).length;
  const totalCompl = W.reduce((s, w) => s + num(w.compliments), 0);
  const cats = new Set(P.map(p => norm(p.category)).filter(Boolean)).size;
  const best = bestStreak();
  const occ = new Set(W.map(w => w.occasion).filter(Boolean)).size;
  const B = (id, e, title, desc, cur, target) => ({ id, e, title, desc, cur: Math.min(cur, target), target, done: cur >= target });
  return [
    B('first', '🧴', 'ขวดแรก', 'เพิ่มน้ำหอมขวดแรก', P.length, 1),
    B('c10', '🛍️', 'นักสะสม', 'มีน้ำหอม 10 ขวด', P.length, 10),
    B('c25', '👑', 'ตู้ระดับเทพ', 'มีน้ำหอม 25 ขวด', P.length, 25),
    B('c50', '🏰', 'พิพิธภัณฑ์กลิ่น', 'มีน้ำหอม 50 ขวด', P.length, 50),
    B('arab', '🕌', 'สายอาหรับ', 'แบรนด์ตะวันออกกลาง 10 ขวด', g('Middle Eastern'), 10),
    B('thai', '🐘', 'ไทยแลนด์โอนลี่', 'แบรนด์ไทย 5 ขวด', g('Thai'), 5),
    B('niche', '💎', 'นักล่า Niche', 'แบรนด์ Niche 5 ขวด', g('Niche'), 5),
    B('explore', '🧭', 'นักสำรวจกลิ่น', 'มีหมวดกลิ่นต่างกัน 10 แบบ', cats, 10),
    B('w1', '📔', 'บันทึกแรก', 'บันทึกการฉีดครั้งแรก', W.length, 1),
    B('w100', '💯', 'ร้อยฉีด', 'บันทึกการฉีด 100 ครั้ง', W.length, 100),
    B('s7', '🔥', 'ไฟลุก 7 วัน', 'ฉีดติดต่อกัน 7 วัน', best, 7),
    B('s30', '🌋', 'วินัยเหล็ก', 'ฉีดติดต่อกัน 30 วัน', best, 30),
    B('compl', '🥰', 'คนหอมประจำออฟฟิศ', 'ได้คำชม 10 ครั้ง', totalCompl, 10),
    B('occ', '🎭', 'ครบทุกโอกาส', 'ใส่ครบ 5 โอกาสที่ต่างกัน', occ, 5),
    B('empty', '🫙', 'ใช้จนหยดสุดท้าย', 'ใช้หมดขวดแรก', P.filter(p => statusKey(p.status) === 'empty').length, 1),
    B('photo', '📸', 'ช่างภาพตู้หอม', 'ใส่รูปครบ 15 ขวด', P.filter(p => p.pic || p.picLocal).length, 15),
    B('wish', '💭', 'นักฝัน', 'มี Wishlist 5 รายการ', state.wishlist.length, 5),
    B('rate', '⭐', 'นักวิจารณ์', 'ให้คะแนนครบ 10 ขวด', P.filter(p => !isBlank(p.rating)).length, 10)
  ];
}

// ---------- Wrapped ----------
export function wrapped(year = new Date().getFullYear()) {
  const ys = String(year);
  const W = state.wears.filter(w => String(w.date).startsWith(ys));
  const byP = {}; W.forEach(w => { byP[w.perfumeUid] = byP[w.perfumeUid] || { n: 0, c: 0, name: w.perfumeName }; byP[w.perfumeUid].n++; byP[w.perfumeUid].c += num(w.compliments); });
  const ranked = Object.entries(byP).map(([uid, v]) => ({ uid, ...v, p: state.perfumes.find(p => p.uid === uid) })).sort((a, b) => b.n - a.n);
  const occ = {}; W.forEach(w => { if (w.occasion) occ[w.occasion] = (occ[w.occasion] || 0) + 1; });
  const favOcc = Object.entries(occ).sort((a, b) => b[1] - a[1])[0];
  const bought = state.perfumes.filter(p => String(p.purchaseDate || '').startsWith(ys));
  const longs = W.filter(w => !isBlank(w.longevity)).map(w => num(w.longevity));
  const mostCompl = [...ranked].sort((a, b) => b.c - a.c)[0];
  const months = Array(12).fill(0); W.forEach(w => { const d = parseDate(w.date); if (d) months[d.getMonth()]++; });
  return {
    year, wears: W.length, days: new Set(W.map(w => w.date)).size, top: ranked.slice(0, 5),
    favOcc: favOcc ? favOcc[0] : null, mostCompl: mostCompl && mostCompl.c ? mostCompl : null,
    bought: bought.length, spend: bought.reduce((s, p) => s + num(p.price), 0),
    avgLong: longs.length ? (longs.reduce((a, b) => a + b, 0) / longs.length) : null,
    bestMonth: months.indexOf(Math.max(...months)), months, dna: dna(), streak: bestStreak()
  };
}
