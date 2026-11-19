// 🧫 สมุดเทสเตอร์ — จดน้ำหอมที่ลองฉีดตามเคาน์เตอร์
import * as store from '../store.js';
import { registerActions, go } from '../nav.js';
import { ai, isConfigured, isOnline } from '../api.js';
import { esc, imgTag, openSheet, toast, confirmDialog, todayStr, thDate, num, norm, stars, compressImage, pickImage, FORMATS } from '../util.js';
import { similarInCollection } from '../scent.js';
import { haptic } from '../fx.js';

export const VERDICTS = { love: ['😍', 'อยากได้'], maybe: ['🤔', 'คิดก่อน'], no: ['🙅', 'ไม่ใช่'] };
let filter = 'all';

export function topTabs(active) {
  const n = store.state.testers.length;
  return `<div class="top-tabs">
    <a href="#/vault" class="${active === 'vault' ? 'on' : ''}">🧴 ตู้</a>
    <a href="#/wishlist" class="${active === 'wish' ? 'on' : ''}">💖 Wishlist</a>
    <a href="#/testers" class="${active === 'testers' ? 'on' : ''}">🧫 เทสเตอร์${n ? ` <small>${n}</small>` : ''}</a></div>`;
}

export function openTesterSheet(t = null, prefill = {}) {
  const r = t ? { ...t } : { date: todayStr(), verdict: 'maybe', rating: '', ...prefill };
  let pic = null;
  const s = openSheet(`<h3>${t ? '✏️ แก้ไขเทสเตอร์' : '🧫 จดเทสเตอร์ใหม่'}</h3>
    <div class="flex" style="gap:12px;align-items:flex-start">
      <button type="button" class="tester-photo" id="tPic">${r.pic || r.picLocal ? imgTag(r) : '📷'}</button>
      <div class="grow">
        <label class="lbl" style="margin-top:0">ชื่อน้ำหอม *</label><input class="inp" id="tName" value="${esc(r.name || '')}" placeholder="เช่น Baccarat Rouge 540">
        <label class="lbl">แบรนด์</label><input class="inp" id="tBrand" value="${esc(r.brand || '')}">
      </div>
    </div>
    <div class="grid2">
      <div><label class="lbl">ลองที่ไหน</label><input class="inp" id="tWhere" list="tWh" value="${esc(r.where || '')}" placeholder="เช่น King Power">
        <datalist id="tWh">${['King Power', 'Sephora', 'Central', 'Siam Paragon', 'Duty Free', 'Nose Shop', 'เพื่อนให้ลอง'].map(x => `<option value="${x}">`).join('')}</datalist></div>
      <div><label class="lbl">วันที่</label><input class="inp" type="date" id="tDate" value="${esc(r.date || todayStr())}"></div>
    </div>
    <label class="lbl">รู้สึกยังไง</label>
    <div class="seg" id="tVerdict">${Object.entries(VERDICTS).map(([k, [e, l]]) => `<button type="button" data-v="${k}" class="${r.verdict === k ? 'on' : ''}">${e} ${l}</button>`).join('')}</div>
    <div class="grid2">
      <div><label class="lbl">คะแนน</label><div class="star-pick" id="tStars">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-v="${i}" class="${num(r.rating) >= i ? 'on' : ''}">★</button>`).join('')}</div></div>
      <div><label class="lbl">ติดผิวกี่ชม.</label><select class="sel" id="tLong">${['', 1, 2, 3, 4, 6, 8, 10, 12].map(h => `<option value="${h}" ${String(r.longevity) === String(h) ? 'selected' : ''}>${h === '' ? '-' : h + ' ชม.'}</option>`).join('')}</select></div>
    </div>
    <label class="lbl">โน้ตที่ได้กลิ่น / ความรู้สึก</label><textarea class="inp" id="tNotes" rows="2" placeholder="เช่น หวานแบบน้ำตาลไหม้ ช่วงท้ายเป็นไม้ หอมมาก">${esc(r.notes || '')}</textarea>
    <div class="flex mt" style="gap:8px"><input class="inp" id="tPrice" type="number" inputmode="decimal" placeholder="ราคาที่เห็น (฿)" value="${esc(r.price || '')}"><button type="button" class="btn btn-lemon btn-sm" id="tAi" style="white-space:nowrap">✨ โน้ตจาก AI</button></div>
    <div class="hint" id="tAiOut">${r.topNotes ? `🫧 ${esc([r.topNotes, r.midNotes, r.baseNotes].filter(Boolean).join(' / '))}` : ''}</div>
    <button class="btn btn-main btn-block mt" id="tSave">💾 บันทึก</button>`);
  const el = s.el;
  const seg = (id, cb) => el.querySelector('#' + id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cb(b); });
  seg('tVerdict', b => { el.querySelectorAll('#tVerdict button').forEach(x => x.classList.toggle('on', x === b)); r.verdict = b.dataset.v; });
  seg('tStars', b => { let v = Number(b.dataset.v); if (num(r.rating) === v) v = 0; r.rating = v || ''; el.querySelectorAll('#tStars button').forEach(x => x.classList.toggle('on', Number(x.dataset.v) <= v)); });
  el.querySelector('#tPic').addEventListener('click', async () => {
    const f = await pickImage(); if (!f) return;
    const c = await compressImage(f, 800, 0.75); pic = c.b64;
    el.querySelector('#tPic').innerHTML = `<img src="${c.dataUrl}">`;
  });
  el.querySelector('#tAi').addEventListener('click', async (e) => {
    const name = el.querySelector('#tName').value.trim();
    if (!name) return toast('ใส่ชื่อก่อนนะ');
    if (!isConfigured() || !isOnline()) return toast('ตอนนี้ใช้ AI ไม่ได้ จดไว้ก่อน แล้วค่อยกดใหม่ทีหลัง');
    const b = e.currentTarget; b.disabled = true; b.textContent = '⏳';
    try {
      const res = await ai('identify', { name, brand: el.querySelector('#tBrand').value.trim() });
      Object.assign(r, { topNotes: res.topNotes || '', midNotes: res.midNotes || '', baseNotes: res.baseNotes || '', category: res.category || '' });
      if (!el.querySelector('#tBrand').value && res.brand) el.querySelector('#tBrand').value = res.brand;
      el.querySelector('#tAiOut').textContent = '🫧 ' + [r.topNotes, r.midNotes, r.baseNotes].filter(Boolean).join(' / ');
    } catch (err) { toast('AI ยังไม่ว่าง: ' + err.message, 3500); }
    finally { b.disabled = false; b.textContent = '✨ โน้ตจาก AI'; }
  });
  el.querySelector('#tSave').addEventListener('click', async () => {
    const name = el.querySelector('#tName').value.trim(); if (!name) return toast('ใส่ชื่อก่อนนะ');
    Object.assign(r, { name, brand: el.querySelector('#tBrand').value.trim(), where: el.querySelector('#tWhere').value.trim(), date: el.querySelector('#tDate').value,
      longevity: el.querySelector('#tLong').value, notes: el.querySelector('#tNotes').value.trim(), price: el.querySelector('#tPrice').value });
    await store.save('testers', r, { picB64: pic });
    haptic(10); s.close(); toast(t ? 'อัปเดตแล้ว ✨' : '🧫 จดเทสเตอร์แล้ว');
  });
}

registerActions({
  testerNew: () => openTesterSheet(),
  testerEdit: (d) => { const t = store.find('testers', d.id); if (t) openTesterSheet(t); },
  testerFilter: (d, el) => { filter = d.v; el.parentElement.querySelectorAll('.chip-btn').forEach(b => b.classList.toggle('active', b === el)); draw(); },
  testerToWish: async (d) => {
    const t = store.find('testers', d.id); if (!t) return;
    if (store.state.wishlist.some(w => norm(w.name) === norm(t.name) && w.status !== 'ซื้อแล้ว')) return toast('อยู่ใน Wishlist แล้ว');
    const prices = t.price ? JSON.stringify([{ shop: t.where || 'เคาน์เตอร์', price: Number(t.price), date: t.date }]) : '[]';
    await store.save('wishlist', { name: t.name, brand: t.brand, format: t.format || '', category: t.category || '', topNotes: t.topNotes || '', midNotes: t.midNotes || '', baseNotes: t.baseNotes || '',
      status: 'ยังไม่ซื้อ', prices, wishNotes: `ลองแล้วที่ ${t.where || '-'} (${thDate(t.date)}): ${t.notes || ''}`.trim() });
    toast('💖 ส่งเข้า Wishlist แล้ว');
  },
  testerBought: (d) => { const t = store.find('testers', d.id); if (t) go(`add?name=${encodeURIComponent(t.name)}&brand=${encodeURIComponent(t.brand || '')}&price=${encodeURIComponent(t.price || '')}&tester=${t.uid}`); },
  testerDel: async (d) => {
    const t = store.find('testers', d.id); if (!t) return;
    if (await confirmDialog({ emoji: '🗑️', title: 'ลบเทสเตอร์นี้?', text: esc(t.name), ok: 'ลบ', danger: true })) await store.remove('testers', t.uid);
  }
});

function draw() {
  const el = document.getElementById('testerList'); if (!el) return;
  const list = store.state.testers.filter(t => filter === 'all' || t.verdict === filter).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  el.innerHTML = list.length ? list.map(t => {
    const [e, l] = VERDICTS[t.verdict] || ['🫧', ''];
    const sim = similarInCollection(t, { limit: 1, min: 70 })[0];
    return `<div class="card tester">
      <div class="flex" style="gap:12px" data-act="testerEdit" data-id="${esc(t.uid)}">
        ${t.pic || t.picLocal ? imgTag(t, 'p-img') : `<div class="p-img tester-ph">${e}</div>`}
        <div class="grow"><div class="p-name trunc">${esc(t.name)}</div><div class="p-sub trunc">${esc(t.brand || '')}${t.where ? ' · ' + esc(t.where) : ''} · ${esc(thDate(t.date))}</div>
          <div class="tags"><span class="tag ${t.verdict === 'love' ? 'pink' : t.verdict === 'no' ? '' : 'lemon'}">${e} ${l}</span>${t.rating ? `<span class="stars">${stars(t.rating)}</span>` : ''}${t.longevity ? `<span class="tag sky">⏱️ ${esc(t.longevity)} ชม.</span>` : ''}</div></div>
      </div>
      ${t.notes ? `<div class="sec-text mt">“${esc(t.notes)}”</div>` : ''}
      ${sim ? `<div class="hint">🗄️ คล้าย <a href="#/p/${esc(sim.p.uid)}">${esc(sim.p.name)}</a> ในตู้ ${sim.s}%</div>` : ''}
      <div class="row mt">
        <button class="btn btn-pink btn-sm" data-act="testerToWish" data-id="${esc(t.uid)}">💖 Wishlist</button>
        <button class="btn btn-mint btn-sm" data-act="testerBought" data-id="${esc(t.uid)}">🛍️ ซื้อแล้ว</button>
        <button class="btn btn-soft btn-sm" data-act="testerDel" data-id="${esc(t.uid)}" style="flex:0 0 auto">🗑️</button>
      </div></div>`;
  }).join('') : '<div class="empty"><div class="big">🧫</div>ยังไม่มีเทสเตอร์<br>เวลาไปลองน้ำหอมตามเคาน์เตอร์ จดไว้ที่นี่ จะได้ไม่ลืมว่าชอบขวดไหน</div>';
}

export function render() {
  const T = store.state.testers;
  const html = `${topTabs('testers')}
    <button class="btn btn-main btn-block mb" data-act="testerNew">＋ จดเทสเตอร์ใหม่</button>
    <div class="chips mb">${[['all', `ทั้งหมด ${T.length}`], ['love', `😍 อยากได้ ${T.filter(t => t.verdict === 'love').length}`], ['maybe', '🤔 คิดก่อน'], ['no', '🙅 ไม่ใช่']]
      .map(([v, l]) => `<button class="chip-btn ${filter === v ? 'active' : ''}" data-act="testerFilter" data-v="${v}">${l}</button>`).join('')}</div>
    <div id="testerList"></div>`;
  return { html, title: 'สมุดเทสเตอร์', tab: 'vault', mount: draw };
}
