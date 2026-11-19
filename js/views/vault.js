// 🧴 ตู้น้ำหอม: รายการ / ชั้นวาง + ค้นหา + ตัวกรอง
import * as store from '../store.js';
import { registerActions } from '../nav.js';
import { esc, imgTag, money, stars, statusKey, STATUS_UI, debounce, norm, isBlank, num, openSheet, GROUPS, daysUntil } from '../util.js';
import { wearIndex, perfumeStats, wornToday } from '../analytics.js';

const F = { q: '', status: 'all', group: 'all', brand: 'all', category: 'all', location: 'all', tag: 'all', missing: 'none', sort: 'newest' };
let mode = localStorage.getItem('pv_vault_mode') || 'list';

const MISSING = [['none', 'ไม่กรอง'], ['any', '▶ ขาดช่องใดช่องหนึ่ง'], ['pic', 'รูปภาพ'], ['brandGroup', 'กลุ่มแบรนด์'], ['category', 'หมวดหมู่'],
  ['topNotes', 'Top Notes'], ['midNotes', 'Mid Notes'], ['baseNotes', 'Base Notes'], ['volume', 'ปริมาณ'], ['price', 'ราคา'], ['rating', 'คะแนน'],
  ['purchaseDate', 'วันที่ซื้อ'], ['location', 'สถานที่ซื้อ'], ['batchCode', 'Batch Code'], ['mfgDate', 'วันผลิต'], ['expDate', 'วันหมดอายุ'], ['pao', 'PAO']];
const ANY_FIELDS = ['pic', 'brandGroup', 'category', 'topNotes', 'midNotes', 'baseNotes', 'volume', 'price', 'rating', 'purchaseDate'];
const SORTS = [['newest', 'เพิ่มล่าสุด'], ['name', 'ชื่อ A→Z'], ['rating', 'คะแนนสูงสุด'], ['wears', 'ฉีดบ่อยสุด'], ['lastWorn', 'ไม่ได้ฉีดนานสุด'],
  ['priceDesc', 'ราคาสูง→ต่ำ'], ['cpw', 'คุ้มสุด (ต้นทุน/ครั้ง)'], ['exp', 'ใกล้หมดอายุ'], ['fill', 'เหลือน้อยสุด']];

function activeFilterCount() {
  return ['group', 'brand', 'category', 'location', 'tag'].filter(k => F[k] !== 'all').length + (F.missing !== 'none' ? 1 : 0);
}

function filtered() {
  const idx = wearIndex();
  const q = norm(F.q);
  let list = store.state.perfumes.filter(p => {
    if (q && !norm([p.name, p.brand, p.category, p.topNotes, p.midNotes, p.baseNotes, p.notes, p.tags].join(' ')).includes(q)) return false;
    if (F.status !== 'all' && statusKey(p.status) !== F.status) return false;
    if (F.group !== 'all' && p.brandGroup !== F.group) return false;
    if (F.brand !== 'all' && p.brand !== F.brand) return false;
    if (F.category !== 'all' && p.category !== F.category) return false;
    if (F.location !== 'all' && p.location !== F.location) return false;
    if (F.tag !== 'all' && !String(p.tags || '').split(',').map(t => t.trim()).includes(F.tag)) return false;
    if (F.missing === 'any' && !ANY_FIELDS.some(k => k === 'pic' ? !(p.pic || p.picLocal) : isBlank(p[k]))) return false;
    if (F.missing !== 'none' && F.missing !== 'any' && !(F.missing === 'pic' ? !(p.pic || p.picLocal) : isBlank(p[F.missing]))) return false;
    return true;
  }).map(p => ({ p, s: perfumeStats(p, idx) }));
  const S = {
    newest: (a, b) => String(b.p.updatedAt || '').localeCompare(String(a.p.updatedAt || '')) || num(b.p.id) - num(a.p.id),
    name: (a, b) => String(a.p.name).localeCompare(String(b.p.name)),
    rating: (a, b) => num(b.p.rating) - num(a.p.rating),
    wears: (a, b) => b.s.wears - a.s.wears,
    lastWorn: (a, b) => (b.s.daysSince ?? 9999) - (a.s.daysSince ?? 9999),
    priceDesc: (a, b) => num(b.p.price) - num(a.p.price),
    cpw: (a, b) => (a.s.costPerWear ?? 1e9) - (b.s.costPerWear ?? 1e9),
    exp: (a, b) => (daysUntil(a.p.expDate) ?? 1e9) - (daysUntil(b.p.expDate) ?? 1e9),
    fill: (a, b) => (isBlank(a.p.fillLevel) ? 999 : num(a.p.fillLevel)) - (isBlank(b.p.fillLevel) ? 999 : num(b.p.fillLevel))
  };
  return list.sort(S[F.sort] || S.newest);
}

function listHtml(items) {
  if (!items.length) {
    return store.state.perfumes.length
      ? '<div class="empty"><div class="big">🔍</div>ไม่พบขวดที่ตรงกับเงื่อนไข</div>'
      : '<div class="empty"><div class="big">🧴</div>ตู้ยังว่างอยู่<br>กดปุ่ม ＋ ด้านล่าง หรือถ่ายรูปขวดให้ AI ช่วยกรอก</div>';
  }
  const pend = new Set(); // แสดงป้ายรอซิงค์
  if (mode === 'shelf') {
    const rows = [];
    for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
    return rows.map(r => `<div class="shelf"><div class="shelf-row">${r.map(({ p }) => {
      const sk = statusKey(p.status);
      return `<a class="bottle st-${sk}" href="#/p/${esc(p.uid)}" style="text-decoration:none;color:inherit">
        ${sk === 'sealed' ? '<span class="st">📦</span>' : wornToday(p.uid) ? '<span class="st">💖</span>' : ''}
        ${imgTag(p)}<div class="bn">${esc(p.name)}</div></a>`;
    }).join('')}</div><div class="shelf-plank"></div></div>`).join('');
  }
  return items.map(({ p, s }) => {
    const sk = statusKey(p.status);
    const d = daysUntil(p.expDate);
    const tags = [
      p.format ? `<span class="tag sky">${esc(p.format)}</span>` : '',
      sk ? `<span class="tag ${sk === 'rotation' ? 'mint' : sk === 'sealed' ? 'lilac' : ''}">${STATUS_UI[sk]}</span>` : '',
      s.wears ? `<span class="tag pink">💖 ${s.wears}</span>` : '',
      sk !== 'empty' && d !== null && d <= 90 ? `<span class="tag lemon">${d < 0 ? 'หมดอายุ' : 'ใกล้หมดอายุ'}</span>` : '',
      p.picLocal ? '<span class="tag peach">☁️ รอซิงค์รูป</span>' : ''
    ].join('');
    const done = wornToday(p.uid);
    return `<div class="p-card st-${sk}" data-href="#/p/${esc(p.uid)}">
      ${imgTag(p, 'p-img')}
      <div class="p-body">
        <div class="p-name trunc">${esc(p.name)}</div>
        <div class="p-sub trunc">${esc(p.brand || '')}${p.category ? ' · ' + esc(p.category) : ''}</div>
        ${p.rating ? `<span class="stars">${stars(p.rating)}</span>` : ''} ${p.price ? `<span class="sub">฿${money(p.price)}</span>` : ''}
        <div class="tags">${tags}</div>
        ${!isBlank(p.fillLevel) ? `<div class="fill-mini"><i style="width:${num(p.fillLevel)}%"></i></div>` : ''}
      </div>
      ${sk !== 'empty' ? `<button class="quick-wear ${done ? 'done' : ''}" data-act="wearQuick" data-id="${esc(p.uid)}" title="ฉีดวันนี้">${done ? '✓' : '💖'}</button>` : ''}
    </div>`;
  }).join('');
}

function draw() {
  const items = filtered();
  const el = document.getElementById('vaultList'); if (!el) return;
  el.innerHTML = listHtml(items);
  document.getElementById('vaultCount').textContent = `${items.length} จาก ${store.state.perfumes.length} ขวด`;
  const c = activeFilterCount(); const pill = document.getElementById('fCount');
  pill.textContent = c; pill.hidden = !c;
}

function openFilters() {
  const P = store.state.perfumes;
  const uniq = (k) => [...new Set(P.map(p => String(p[k] ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const tags = [...new Set(P.flatMap(p => String(p.tags || '').split(',').map(t => t.trim())).filter(Boolean))].sort();
  const sel = (key, label, opts) => `<label class="lbl">${label}</label><select class="sel" data-f="${key}">
    ${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${F[key] === v ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  const s = openSheet(`<h3>ตัวกรอง & เรียง</h3>
    ${sel('sort', '↕️ เรียงตาม', SORTS)}
    <div class="grid2">
      <div>${sel('group', 'กลุ่มแบรนด์', [['all', 'ทั้งหมด'], ...GROUPS])}</div>
      <div>${sel('brand', 'แบรนด์', [['all', 'ทั้งหมด'], ...uniq('brand')])}</div>
      <div>${sel('category', 'หมวดหมู่', [['all', 'ทั้งหมด'], ...uniq('category')])}</div>
      <div>${sel('location', 'ซื้อที่', [['all', 'ทั้งหมด'], ...uniq('location')])}</div>
    </div>
    ${sel('tag', '🏷️ แท็ก', [['all', 'ทั้งหมด'], ...tags])}
    ${sel('missing', '🧩 ข้อมูลที่ยังขาด', MISSING.map(([v, l]) => [v, v === 'none' || v === 'any' ? l : 'ขาด: ' + l]))}
    <div class="row mt"><button class="btn btn-soft" id="fClear">ล้างทั้งหมด</button><button class="btn btn-main" data-close>เสร็จ</button></div>`);
  s.el.querySelectorAll('[data-f]').forEach(x => x.addEventListener('change', () => { F[x.dataset.f] = x.value; draw(); }));
  s.el.querySelector('#fClear').addEventListener('click', () => {
    Object.assign(F, { group: 'all', brand: 'all', category: 'all', location: 'all', tag: 'all', missing: 'none', sort: 'newest' });
    s.close(); draw();
  });
}

registerActions({
  vaultFilters: openFilters,
  vaultMode: () => { mode = mode === 'list' ? 'shelf' : 'list'; localStorage.setItem('pv_vault_mode', mode); document.getElementById('modeBtn').textContent = mode === 'list' ? '🗄️' : '📋'; draw(); },
  vaultStatus: (d, el) => { F.status = d.v; el.parentElement.querySelectorAll('.chip-btn').forEach(b => b.classList.toggle('active', b === el)); draw(); }
});

export function render() {
  const html = `
    <div class="top-tabs"><a href="#/vault" class="on">🧴 ตู้ของฉัน</a><a href="#/wishlist" class="">💖 Wishlist</a></div>
    <div class="search-row">
      <div class="search-box"><span>🔍</span><input type="search" id="vq" placeholder="ชื่อ แบรนด์ โน้ต แท็ก..." value="${esc(F.q)}"></div>
      <button class="sq-btn" data-act="vaultFilters">⚙️<span class="count-pill" id="fCount" hidden></span></button>
      <button class="sq-btn" id="modeBtn" data-act="vaultMode" title="สลับมุมมอง">${mode === 'list' ? '🗄️' : '📋'}</button>
    </div>
    <div class="chips mb">${[['all', 'ทั้งหมด'], ['rotation', '✨ ใช้อยู่'], ['sealed', '📦 ยังไม่แกะ'], ['empty', '🫙 หมดแล้ว']]
      .map(([v, l]) => `<button class="chip-btn ${F.status === v ? 'active' : ''}" data-act="vaultStatus" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="list-meta"><span id="vaultCount"></span><a href="#/add" class="btn-ghost" style="text-decoration:none">＋ เพิ่มขวด</a></div>
    <div id="vaultList"></div>`;
  return {
    html, title: 'ตู้น้ำหอม', tab: 'vault',
    mount: (root) => {
      draw();
      root.querySelector('#vq').addEventListener('input', debounce(e => { F.q = e.target.value; draw(); }, 150));
      root.querySelector('#vaultList').addEventListener('click', e => {
        if (e.target.closest('[data-act]')) return;
        const c = e.target.closest('[data-href]'); if (c) location.hash = c.dataset.href;
      });
    }
  };
}
