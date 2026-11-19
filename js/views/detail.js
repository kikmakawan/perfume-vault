// 🔎 หน้ารายละเอียดขวด
import * as store from '../store.js';
import { registerActions, go } from '../nav.js';
import { esc, imgTag, money, stars, statusKey, STATUS, STATUS_UI, isBlank, num, thDate, relDay, occLabel, confirmDialog, toast, debounce, daysUntil, addMonths, todayStr } from '../util.js';
import { perfumeStats, paoInfo, mainAxis, wornToday } from '../analytics.js';
import { openWearSheet } from './diary.js';
import { perfumeCard } from '../share.js';

const saveFill = debounce((id, v) => store.patch('perfumes', id, { fillLevel: v }), 600);

registerActions({
  pStatus: async (d) => {
    const p = store.perfume(d.id); if (!p) return;
    const changes = { status: STATUS[d.v] };
    if (d.v === 'rotation' && !p.openedDate) changes.openedDate = todayStr();   // เริ่มใช้ = แกะวันนี้
    if (d.v === 'empty') changes.fillLevel = 0;
    await store.patch('perfumes', d.id, changes);
    if (d.v === 'empty') toast('🫙 ใช้หมดขวดแล้ว เก่งมาก!');
  },
  pWear: (d) => { const p = store.perfume(d.id); if (p) openWearSheet(p); },
  pShare: (d) => { const p = store.perfume(d.id); if (p) perfumeCard(p, perfumeStats(p)); },
  pDelete: async (d) => {
    const p = store.perfume(d.id); if (!p) return;
    if (await confirmDialog({ emoji: '🗑️', title: 'ลบขวดนี้?', text: `<b>${esc(p.name)}</b> จะถูกลบออกจากตู้ (บันทึกการฉีดเดิมยังอยู่)`, ok: 'ลบเลย', danger: true })) {
      await store.remove('perfumes', d.id); toast('ลบแล้ว'); go('vault');
    }
  }
});

export function render({ params }) {
  const p = store.perfume(params.id);
  if (!p) return { html: '<div class="empty"><div class="big">🫥</div>ไม่พบขวดนี้ (อาจถูกลบไปแล้ว)<br><a href="#/vault">กลับไปที่ตู้</a></div>', title: 'ไม่พบข้อมูล', back: true, parent: 'vault' };
  const s = perfumeStats(p);
  const sk = statusKey(p.status);
  const pao = paoInfo(p);
  const exp = daysUntil(p.expDate);
  const ax = mainAxis(p);
  const wears = store.wearsOf(p.uid).sort((a, b) => String(b.date).localeCompare(a.date));
  const tags = String(p.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  const info = [
    ['ความเข้มข้น', p.format], ['ปริมาณ', p.volume ? p.volume + ' ml' : ''], ['ราคา', p.price ? '฿' + money(p.price) : ''],
    ['ซื้อที่', p.location], ['วันที่ซื้อ', p.purchaseDate ? thDate(p.purchaseDate, true) : ''], ['กลุ่มแบรนด์', p.brandGroup],
    ['Batch', p.batchCode], ['ผลิต (MFG)', p.mfgDate ? thDate(p.mfgDate, true) : ''],
    ['หมดอายุ (EXP)', p.expDate ? thDate(p.expDate, true) + (exp !== null && exp <= 90 ? (exp < 0 ? ' ⚠️' : ' ⏰') : '') : ''],
    ['แกะใช้เมื่อ', p.openedDate ? thDate(p.openedDate, true) : ''],
    ['PAO', p.pao ? p.pao + ' เดือน' + (pao ? ` (${pao.days < 0 ? 'เกินแล้ว' : 'เหลือ ' + pao.days + ' วัน'})` : '') : '']
  ].filter(x => !isBlank(x[1]));

  const html = `
    <div class="d-hero">${imgTag(p)}
      <div class="over"><h2>${esc(p.name)}</h2><div class="b">${esc(p.brand || '')}${p.category ? ' · ' + esc(p.category) : ''}</div>
        ${p.rating ? `<div class="stars" style="font-size:1rem">${stars(p.rating)}</div>` : ''}</div>
    </div>

    <div class="seg mb">${['rotation', 'sealed', 'empty'].map(k => `<button class="${sk === k ? 'on' : ''}" data-act="pStatus" data-id="${esc(p.uid)}" data-v="${k}">${STATUS_UI[k]}</button>`).join('')}</div>

    ${sk !== 'empty' ? `<button class="btn btn-main btn-block mb" data-act="pWear" data-id="${esc(p.uid)}">${wornToday(p.uid) ? '✓ ฉีดแล้ววันนี้ · บันทึกเพิ่ม' : '💖 ฉีดวันนี้'}</button>` : ''}

    <div class="grid3 mb">
      <div class="stat t-pink"><div class="stat-num">${s.wears}</div><div class="stat-label">ครั้งที่ฉีด</div></div>
      <div class="stat t-lilac"><div class="stat-num">${s.costPerWear ? '฿' + money(s.costPerWear) : '-'}</div><div class="stat-label">ต้นทุน/ครั้ง</div></div>
      <div class="stat t-mint"><div class="stat-num">${s.avgLongevity ? s.avgLongevity.toFixed(1) + 'ช' : '-'}</div><div class="stat-label">ติดทนเฉลี่ย</div></div>
    </div>

    ${sk !== 'empty' ? `
    <div class="card">
      <div class="card-head">🧪 เหลือในขวด <span class="sub" id="fillVal">${isBlank(p.fillLevel) ? 'ยังไม่ระบุ' : num(p.fillLevel) + '%'}</span></div>
      <input type="range" min="0" max="100" step="5" value="${isBlank(p.fillLevel) ? 100 : num(p.fillLevel)}" id="fillRange">
      ${!isBlank(p.fillLevel) && num(p.price) ? `<div class="hint">มูลค่าคงเหลือประมาณ ฿${money(num(p.price) * num(p.fillLevel) / 100)}</div>` : ''}
    </div>` : ''}

    <div class="card">
      <div class="card-head">🫧 โครงสร้างกลิ่น <span class="sub">${ax.e} ${esc(ax.th)}</span></div>
      ${p.topNotes || p.midNotes || p.baseNotes ? `<div class="pyramid">
        ${p.topNotes ? `<div class="pyr top"><b>TOP · กลิ่นแรก</b>${esc(p.topNotes)}</div>` : ''}
        ${p.midNotes ? `<div class="pyr mid"><b>HEART · กลิ่นกลาง</b>${esc(p.midNotes)}</div>` : ''}
        ${p.baseNotes ? `<div class="pyr base"><b>BASE · กลิ่นติดผิว</b>${esc(p.baseNotes)}</div>` : ''}
      </div>` : `<div class="sub">ยังไม่มีข้อมูลโน้ต <a href="#/edit/${esc(p.uid)}">แตะเพื่อให้ AI ช่วยเติม</a></div>`}
      ${tags.length ? `<div class="tags mt">${tags.map(t => `<span class="tag lilac">#${esc(t)}</span>`).join('')}</div>` : ''}
    </div>

    <div class="action-grid mb">
      <button onclick="location.hash='#/edit/${esc(p.uid)}'"><span>✏️</span>แก้ไข</button>
      <button onclick="location.hash='#/layer?id=${esc(p.uid)}'"><span>🧪</span>Layering</button>
      <button onclick="location.hash='#/dupe?id=${esc(p.uid)}'"><span>🔍</span>หา Dupe</button>
      <button data-act="pShare" data-id="${esc(p.uid)}"><span>📸</span>แชร์</button>
    </div>

    ${info.length ? `<div class="card"><div class="card-head">📋 ข้อมูลขวด</div><div class="info-grid">
      ${info.map(([k, v]) => `<div class="info"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>
      ${p.notes ? `<div class="notes-box mt">📝 ${esc(p.notes)}</div>` : ''}</div>` : ''}

    <div class="card">
      <div class="card-head">📔 ประวัติการฉีด <span class="sub">${s.compliments ? `🥰 ได้คำชม ${s.compliments} ครั้ง` : ''}</span></div>
      ${wears.length ? wears.slice(0, 8).map(w => `
        <div class="kv" data-act="wearEdit" data-id="${esc(w.uid)}" style="cursor:pointer">
          <span>${esc(relDay(w.date))} ${w.occasion ? '· ' + esc(occLabel(w.occasion)) : ''}</span>
          <span class="sub">${w.longevity !== '' && w.longevity != null ? '⏱️' + esc(w.longevity) + 'ช ' : ''}${num(w.compliments) ? '🥰' + esc(w.compliments) : ''}</span>
        </div>`).join('') + (wears.length > 8 ? `<div class="hint">และอีก ${wears.length - 8} ครั้ง</div>` : '')
      : '<div class="sub">ยังไม่เคยบันทึก กด 💖 ฉีดวันนี้ เพื่อเริ่มเก็บสถิติ</div>'}
    </div>

    <button class="btn btn-danger btn-block" data-act="pDelete" data-id="${esc(p.uid)}">🗑️ ลบขวดนี้</button>`;

  return {
    html, title: p.name, back: true, parent: 'vault', tab: 'vault',
    mount: (root) => {
      const r = root.querySelector('#fillRange');
      if (r) r.addEventListener('input', () => { root.querySelector('#fillVal').textContent = r.value + '%'; saveFill(p.uid, Number(r.value)); });
    }
  };
}
