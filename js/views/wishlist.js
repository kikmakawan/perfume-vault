// 💖 Wishlist + ราคาเป้าหมาย + บันทึกราคาที่เจอ
import * as store from '../store.js';
import { topTabs } from './testers.js';
import { registerActions, go } from '../nav.js';
import { esc, scoreRing, money, num, openSheet, toast, confirmDialog, todayStr, thDate, isBlank, FORMATS } from '../util.js';

let filter = 'open';

const prices = (w) => { try { const a = JSON.parse(w.prices || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const lowest = (w) => { const a = prices(w); return a.length ? a.reduce((m, x) => num(x.price) < num(m.price) ? x : m) : null; };
const hitTarget = (w) => { const l = lowest(w); return l && num(w.targetPrice) && num(l.price) <= num(w.targetPrice); };

registerActions({
  wishFilter: (d, el) => { filter = d.v; el.parentElement.querySelectorAll('.chip-btn').forEach(b => b.classList.toggle('active', b === el)); draw(); },
  wishAdd: () => {
    const s = openSheet(`<h3>💭 เพิ่มเข้า Wishlist</h3>
      <label class="lbl">ชื่อน้ำหอม *</label><input class="inp" id="wn">
      <div class="grid2"><div><label class="lbl">แบรนด์</label><input class="inp" id="wb"></div>
      <div><label class="lbl">ความเข้มข้น</label><select class="sel" id="wf">${FORMATS.map(f => `<option>${f}</option>`).join('')}</select></div></div>
      <label class="lbl">ราคาเป้าหมาย (฿)</label><input class="inp" id="wt" type="number" inputmode="decimal">
      <button class="btn btn-main btn-block mt" id="wsave">บันทึก</button>
      <div class="hint center">อยากรู้ว่าเข้ากับตู้ไหม? ใช้ 🛒 ช่วยคิดก่อนซื้อ แล้วกดเก็บเข้า Wishlist ได้เลย</div>`);
    s.el.querySelector('#wsave').addEventListener('click', async () => {
      const name = s.el.querySelector('#wn').value.trim(); if (!name) return toast('ใส่ชื่อก่อนนะ');
      await store.save('wishlist', { name, brand: s.el.querySelector('#wb').value.trim(), format: s.el.querySelector('#wf').value, targetPrice: s.el.querySelector('#wt').value, status: 'ยังไม่ซื้อ', prices: '[]' });
      s.close(); toast('💖 เพิ่มแล้ว');
    });
  },
  wishPrice: (d) => {
    const w = store.find('wishlist', d.id); if (!w) return;
    const s = openSheet(`<h3>💸 บันทึกราคาที่เจอ</h3>
      <label class="lbl">ร้าน</label><input class="inp" id="ps" list="shops" placeholder="เช่น King Power, Shopee">
      <datalist id="shops">${['King Power', 'Shopee', 'Lazada', 'Central', 'Sephora', 'Duty Free', 'Nose Shop', 'IG ร้านพรีออเดอร์'].map(x => `<option value="${x}">`).join('')}</datalist>
      <div class="grid2"><div><label class="lbl">ราคา (฿) *</label><input class="inp" id="pp" type="number" inputmode="decimal"></div>
      <div><label class="lbl">ขนาด (ml)</label><input class="inp" id="pv" type="number" inputmode="decimal"></div></div>
      <button class="btn btn-main btn-block mt" id="psave">บันทึก</button>`);
    s.el.querySelector('#psave').addEventListener('click', async () => {
      const price = s.el.querySelector('#pp').value; if (!price) return toast('ใส่ราคาก่อนนะ');
      const list = prices(w); list.push({ shop: s.el.querySelector('#ps').value.trim() || '-', price: Number(price), ml: s.el.querySelector('#pv').value, date: todayStr() });
      await store.patch('wishlist', w.uid, { prices: JSON.stringify(list) });
      s.close();
      if (num(w.targetPrice) && Number(price) <= num(w.targetPrice)) toast('🎯 ถึงราคาเป้าหมายแล้ว! ได้เวลาจัด', 3000); else toast('บันทึกราคาแล้ว');
    });
  },
  wishTarget: (d) => {
    const w = store.find('wishlist', d.id); if (!w) return;
    const s = openSheet(`<h3>🎯 ราคาเป้าหมาย</h3><input class="inp" id="tp" type="number" inputmode="decimal" value="${esc(w.targetPrice || '')}">
      <label class="lbl">โน้ต</label><textarea class="inp" id="tn" rows="2">${esc(w.wishNotes || '')}</textarea>
      <button class="btn btn-main btn-block mt" id="tsave">บันทึก</button>`);
    s.el.querySelector('#tsave').addEventListener('click', async () => {
      await store.patch('wishlist', w.uid, { targetPrice: s.el.querySelector('#tp').value, wishNotes: s.el.querySelector('#tn').value.trim() }); s.close();
    });
  },
  wishBought: async (d) => {
    const w = store.find('wishlist', d.id); if (!w) return;
    if (await confirmDialog({ emoji: '🎉', title: 'ซื้อแล้ว! เพิ่มเข้าตู้เลยไหม?', text: 'ข้อมูลโน้ตกลิ่นจะถูกเติมให้อัตโนมัติ', ok: 'เพิ่มเข้าตู้', cancel: 'แค่ทำเครื่องหมาย' })) go('add?from=' + w.uid);
    else { await store.patch('wishlist', w.uid, { status: 'ซื้อแล้ว' }); toast('🛍️ ทำเครื่องหมายว่าซื้อแล้ว'); }
  },
  wishUndo: (d) => store.patch('wishlist', d.id, { status: 'ยังไม่ซื้อ' }),
  wishDel: async (d) => {
    const w = store.find('wishlist', d.id); if (!w) return;
    if (await confirmDialog({ emoji: '🗑️', title: 'ลบออกจาก Wishlist?', text: esc(w.name), ok: 'ลบ', danger: true })) { await store.remove('wishlist', w.uid); go('wishlist'); }
  }
});

function cardHtml(w) {
  const l = lowest(w); const bought = w.status === 'ซื้อแล้ว';
  return `<a class="p-card" href="#/wish/${esc(w.uid)}" style="text-decoration:none;color:inherit;${bought ? 'opacity:.7' : ''}">
    ${scoreRing(w.matchScore, 58)}
    <div class="p-body"><div class="p-name trunc">${esc(w.name)}</div><div class="p-sub trunc">${esc(w.brand || '')} · ${esc(w.format || '')}</div>
      <div class="tags">${w.category ? `<span class="tag sky">${esc(w.category)}</span>` : ''}
        ${bought ? '<span class="tag mint">🛍️ ซื้อแล้ว</span>' : ''}
        ${num(w.targetPrice) ? `<span class="tag lilac">🎯 ฿${money(w.targetPrice)}</span>` : ''}
        ${l ? `<span class="tag ${hitTarget(w) ? 'mint' : 'lemon'}">${hitTarget(w) ? '✅' : '💸'} ต่ำสุด ฿${money(l.price)}</span>` : ''}</div></div></a>`;
}
function draw() {
  const el = document.getElementById('wishList'); if (!el) return;
  const list = store.state.wishlist.filter(w => filter === 'all' || (filter === 'open' ? w.status !== 'ซื้อแล้ว' : filter === 'hit' ? hitTarget(w) : w.status === 'ซื้อแล้ว'))
    .sort((a, b) => num(b.matchScore) - num(a.matchScore));
  el.innerHTML = list.length ? list.map(cardHtml).join('') : '<div class="empty"><div class="big">💭</div>ยังไม่มีรายการ<br>ลองใช้ 🛒 ช่วยคิดก่อนซื้อ แล้วกดเก็บไว้</div>';
}

export function render() {
  const W = store.state.wishlist.filter(w => w.status !== 'ซื้อแล้ว');
  const sumTarget = W.reduce((s, w) => s + (num(w.targetPrice) || num((lowest(w) || {}).price)), 0);
  const html = `
    ${topTabs('wish')}
    <div class="grid2 mb">
      <div class="stat t-pink"><div class="stat-num">${W.length}</div><div class="stat-label">รายการที่เล็งไว้</div></div>
      <div class="stat t-lilac"><div class="stat-num">${sumTarget ? '฿' + money(sumTarget) : '-'}</div><div class="stat-label">ถ้าซื้อครบ (ตามเป้า)</div></div>
    </div>
    <div class="flex between mb">
      <div class="chips">${[['open', '⏳ ยังไม่ซื้อ'], ['hit', '🎯 ถึงราคาเป้า'], ['bought', '🛍️ ซื้อแล้ว'], ['all', 'ทั้งหมด']].map(([v, l]) => `<button class="chip-btn ${filter === v ? 'active' : ''}" data-act="wishFilter" data-v="${v}">${l}</button>`).join('')}</div>
    </div>
    <div class="row mb"><button class="btn btn-soft btn-sm" data-act="wishAdd">＋ เพิ่มเอง</button><a class="btn btn-lilac btn-sm" href="#/purchase">🛒 วิเคราะห์ก่อนซื้อ</a></div>
    <div id="wishList"></div>`;
  return { html, title: 'Wishlist', tab: 'vault', mount: draw };
}

export function renderOne({ params }) {
  const w = store.find('wishlist', params.id);
  if (!w) return { html: '<div class="empty">ไม่พบรายการนี้</div>', title: 'Wishlist', back: true, parent: 'wishlist' };
  const P = prices(w).sort((a, b) => num(a.price) - num(b.price));
  const bought = w.status === 'ซื้อแล้ว';
  const html = `
    <div class="card"><div class="flex" style="gap:14px">${scoreRing(w.matchScore)}
      <div class="grow"><div class="p-name">${esc(w.name)}</div><div class="p-sub">${esc(w.brand || '')} · ${esc(w.format || '')}</div>
      <div class="tags">${w.category ? `<span class="tag sky">${esc(w.category)}</span>` : ''}${bought ? '<span class="tag mint">🛍️ ซื้อแล้ว</span>' : ''}</div></div></div>
      ${w.finalVerdict ? `<div class="verdict">📌 ${esc(w.finalVerdict)}</div>` : ''}
    </div>

    <div class="card"><div class="card-head">💸 ราคา <span class="sub">${num(w.targetPrice) ? '🎯 เป้า ฿' + money(w.targetPrice) : ''}</span></div>
      ${P.length ? P.map((x, i) => `<div class="price-row"><span>${i === 0 ? '🏆 ' : ''}${esc(x.shop)}${x.ml ? ` · ${esc(x.ml)}ml` : ''} <span class="sub">${esc(thDate(x.date))}</span></span><b style="color:${num(w.targetPrice) && num(x.price) <= num(w.targetPrice) ? 'var(--mint-ink)' : 'inherit'}">฿${money(x.price)}</b></div>`).join('') : '<div class="sub">ยังไม่มีราคาที่บันทึก</div>'}
      ${w.wishNotes ? `<div class="notes-box mt">📝 ${esc(w.wishNotes)}</div>` : ''}
      <div class="row mt"><button class="btn btn-lilac btn-sm" data-act="wishPrice" data-id="${esc(w.uid)}">＋ ราคาที่เจอ</button><button class="btn btn-soft btn-sm" data-act="wishTarget" data-id="${esc(w.uid)}">🎯 ตั้งเป้า/โน้ต</button></div>
    </div>

    ${w.topNotes || w.midNotes || w.baseNotes ? `<div class="card"><div class="card-head">🫧 โน้ตกลิ่น</div><div class="pyramid">
      ${w.topNotes ? `<div class="pyr top"><b>TOP</b>${esc(w.topNotes)}</div>` : ''}${w.midNotes ? `<div class="pyr mid"><b>HEART</b>${esc(w.midNotes)}</div>` : ''}${w.baseNotes ? `<div class="pyr base"><b>BASE</b>${esc(w.baseNotes)}</div>` : ''}</div></div>` : ''}

    ${w.pros || w.redFlags ? `<div class="card">${w.pros ? `<div class="sec-title" style="margin-top:0">💚 จุดเด่น</div><div class="sec-text">${esc(w.pros)}</div>` : ''}
      ${w.redFlags ? `<div class="sec-title">🚩 ข้อควรระวัง</div><div class="sec-text">${esc(w.redFlags)}</div>` : ''}
      ${!isBlank(w.similarCount) ? `<div class="hint mt">🗄️ ตอนวิเคราะห์ มีกลิ่นใกล้เคียงในตู้ ${esc(w.similarCount)} ขวด</div>` : ''}</div>` : ''}

    <div class="action-grid mb">
      <button onclick="location.hash='#/purchase?name=${encodeURIComponent(w.name)}&brand=${encodeURIComponent(w.brand || '')}'"><span>🔄</span>วิเคราะห์ใหม่</button>
      <button onclick="location.hash='#/dupe?name=${encodeURIComponent(w.name)}&brand=${encodeURIComponent(w.brand || '')}'"><span>🔍</span>หา Dupe</button>
      ${w.sourceUrl ? `<button onclick="window.open('${esc(w.sourceUrl)}','_blank')"><span>🌐</span>อ้างอิง</button>` : '<button disabled style="opacity:.4"><span>🌐</span>อ้างอิง</button>'}
      <button data-act="wishDel" data-id="${esc(w.uid)}"><span>🗑️</span>ลบ</button>
    </div>
    ${bought ? `<button class="btn btn-soft btn-block" data-act="wishUndo" data-id="${esc(w.uid)}">↩️ ยังไม่ได้ซื้อ</button>`
      : `<button class="btn btn-main btn-block" data-act="wishBought" data-id="${esc(w.uid)}">🛍️ ซื้อแล้ว!</button>`}`;
  return { html, title: w.name, back: true, parent: 'wishlist', tab: 'vault' };
}
