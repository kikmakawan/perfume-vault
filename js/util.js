// ---------- พื้นฐาน ----------
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
export const nowIso = () => new Date().toISOString();
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
export const money = (n) => Math.round(Number(n) || 0).toLocaleString('th-TH');
export const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
export const norm = (s) => String(s ?? '').trim().toLowerCase();

// ---------- วันที่ ----------
export function dateStr(d = new Date()) {
  const x = new Date(d); return new Date(x - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export const todayStr = () => dateStr();
export function parseDate(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(String(s))) return null;
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
  return isNaN(d) ? null : d;
}
export function daysUntil(s) {
  const d = parseDate(s); if (!d) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
export const daysSince = (s) => { const d = daysUntil(s); return d === null ? null : -d; };
export function addMonths(s, m) {
  const d = parseDate(s); if (!d) return null;
  d.setMonth(d.getMonth() + Number(m)); return dateStr(d);
}
export function timeAgo(iso) {
  if (!iso) return 'ยังไม่เคยซิงค์';
  const s = Math.round((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'เมื่อสักครู่';
  if (s < 3600) return Math.floor(s / 60) + ' นาทีที่แล้ว';
  if (s < 86400) return Math.floor(s / 3600) + ' ชม.ที่แล้ว';
  return Math.floor(s / 86400) + ' วันที่แล้ว';
}
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const thMonth = (i) => TH_MONTHS[i];
export function thDate(s, withYear = false) {
  const d = parseDate(s); if (!d) return s || '-';
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]}${withYear ? ' ' + (d.getFullYear() + 543 - 2500) : ''}`;
}
export function relDay(s) {
  const d = daysSince(s);
  if (d === 0) return 'วันนี้';
  if (d === 1) return 'เมื่อวาน';
  if (d !== null && d < 7 && d > 0) return d + ' วันก่อน';
  return thDate(s, true);
}

// ---------- โดเมน ----------
export const STATUS = { rotation: 'กำลังใช้ (In Rotation)', sealed: 'ยังไม่แกะ (Sealed)', empty: 'หมดแล้ว (Empty)' };
export const STATUS_UI = { rotation: '✨ ใช้อยู่', sealed: '📦 ยังไม่แกะ', empty: '🫙 หมดแล้ว' };
export function statusKey(st) {
  st = String(st || '');
  if (st.includes('กำลังใช้') || /rotation/i.test(st)) return 'rotation';
  if (st.includes('ยังไม่แกะ') || /sealed/i.test(st)) return 'sealed';
  if (st.includes('หมดแล้ว') || /empty/i.test(st)) return 'empty';
  return '';
}
export const OCCASIONS = [
  ['daily', '☀️ ทั่วไป'], ['work', '💼 ทำงาน'], ['date', '💘 เดท'], ['party', '🥂 ออกงาน'],
  ['home', '🏠 อยู่บ้าน'], ['sport', '🏃 ออกกำลัง'], ['travel', '✈️ เที่ยว']
];
export const occLabel = (k) => (OCCASIONS.find(o => o[0] === k) || [k, k || '-'])[1];
export const PRESET_TAGS = ['หน้าร้อน', 'หน้าฝน', 'หน้าหนาว', 'กลางวัน', 'กลางคืน', 'ทำงาน', 'เดท', 'ออกงาน', 'ขวดโปรด', 'ซิกเนเจอร์'];
export const FORMATS = ['EDP', 'EDT', 'Parfum', 'Extrait', 'EDC', 'Mist', 'Oil'];
export const GROUPS = ['Middle Eastern', 'Designer', 'Niche', 'Thai'];

export function stars(r) {
  const n = clamp(Math.round(num(r)), 0, 5);
  return n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '';
}
export const FALLBACK_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE6F0"/><stop offset="1" stop-color="#EFE9FF"/></linearGradient></defs><rect width="100" height="120" fill="url(#g)"/><rect x="40" y="22" width="20" height="12" rx="3" fill="#FFD1E3"/><rect x="44" y="33" width="12" height="10" fill="#fff"/><rect x="26" y="42" width="48" height="56" rx="12" fill="#fff"/><rect x="31" y="62" width="38" height="31" rx="8" fill="#D6C4FF"/></svg>');
export function imgUrl(p) {
  if (!p) return FALLBACK_IMG;
  if (p.picLocal) return p.picLocal;
  let s = String(p.pic || '');
  if (!s) return FALLBACK_IMG;
  if (s.includes('uc?id=')) s = s.replace('uc?id=', 'thumbnail?id=') + '&sz=w600';
  return s;
}
export const imgTag = (p, cls = '') => `<img src="${esc(imgUrl(p))}" class="${cls}" loading="lazy" alt="" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">`;

// ---------- UI: toast ----------
export function toast(msg, ms = 2000) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  $('#toastRoot').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
}

// ---------- UI: bottom sheet / dialog ----------
let sheetStack = [];
export function openSheet(html, { dialog = false, onClose } = {}) {
  const root = $('#sheetRoot');
  const back = document.createElement('div'); back.className = 'sheet-backdrop';
  const el = document.createElement('div'); el.className = 'sheet' + (dialog ? ' dialog' : '');
  el.innerHTML = (dialog ? '' : '<div class="grab"></div>') + html;
  root.append(back, el);
  const close = () => {
    back.remove(); el.remove();
    sheetStack = sheetStack.filter(s => s.el !== el);
    onClose && onClose();
  };
  back.addEventListener('click', close);
  el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  sheetStack.push({ el, close });
  return { el, close };
}
export const closeAllSheets = () => [...sheetStack].forEach(s => s.close());

export function confirmDialog({ emoji = '🤔', title, text = '', ok = 'ตกลง', cancel = 'ยกเลิก', danger = false }) {
  return new Promise(resolve => {
    let done = false;
    const s = openSheet(`
      <div class="e">${emoji}</div><h3>${esc(title)}</h3><div class="sub">${text}</div>
      <div class="btns"><button class="btn btn-soft" data-x="0">${esc(cancel)}</button><button class="btn ${danger ? 'btn-danger' : 'btn-main'}" data-x="1">${esc(ok)}</button></div>`,
      { dialog: true, onClose: () => { if (!done) resolve(false); } });
    s.el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => { done = true; s.close(); resolve(b.dataset.x === '1'); }));
  });
}
export function alertDialog({ emoji = '💡', title, text = '' }) {
  return confirmDialog({ emoji, title, text, ok: 'โอเค', cancel: 'ปิด' });
}

// ---------- รูปภาพ ----------
export function compressImage(file, max = 900, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่ได้'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์นี้ไม่ใช่รูปที่รองรับ'));
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = c.toDataURL('image/jpeg', quality);
        resolve({ dataUrl, b64: dataUrl.split(',')[1] });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}
export function pickImage({ capture = false } = {}) {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    if (capture) inp.capture = 'environment';
    inp.onchange = () => resolve(inp.files[0] || null);
    inp.click();
  });
}

export function loadingHtml(text = 'กำลังโหลด...') {
  return `<div class="loading"><div class="dots"><i></i><i></i><i></i></div>${esc(text)}</div>`;
}
export function scoreColor(s) {
  if (isBlank(s) || isNaN(Number(s))) return '#CFC7DB';
  s = Number(s); return s >= 75 ? '#7FD6B6' : s >= 50 ? '#F5CF5B' : '#FF9EC4';
}
export function scoreRing(s, size = 64) {
  const pct = isBlank(s) || isNaN(Number(s)) ? 0 : clamp(Number(s), 0, 100);
  const col = scoreColor(s);
  return `<div class="score-ring" style="width:${size}px;height:${size}px;background:conic-gradient(${col} ${pct * 3.6}deg, var(--soft) 0)"><span style="color:${col};width:${size - 14}px;height:${size - 14}px">${isBlank(s) ? '-' : esc(s)}</span></div>`;
}
