// 📔 สมุดบันทึกการฉีด + sheet บันทึก/เลือกขวด (ใช้ร่วมกับหน้าอื่น)
import * as store from '../store.js';
import { registerActions, go } from '../nav.js';
import { esc, imgTag, openSheet, toast, todayStr, OCCASIONS, occLabel, relDay, statusKey, norm, confirmDialog, num, thMonth } from '../util.js';
import { heatmap, streak, bestStreak, wornToday } from '../analytics.js';
import { heatmapHtml } from '../charts.js';
import { getWeather } from '../weather.js';

let lastOccasion = localStorage.getItem('pv_last_occ') || 'daily';

// ---------- บันทึกด่วน 1 แตะ ----------
export async function quickWear(p) {
  if (wornToday(p.uid)) {
    const w = store.state.wears.find(x => x.perfumeUid === p.uid && x.date === todayStr());
    return openWearSheet(p, w);
  }
  const wx = await getWeather();
  await store.logWear(p, { occasion: lastOccasion, weather: wx ? `${wx.emoji} ${wx.text}` : '', tempC: wx ? wx.temp : '' });
  toast(`💖 บันทึกว่าวันนี้ฉีด ${p.name} แล้ว`);
}

// ---------- sheet บันทึกแบบละเอียด ----------
export async function openWearSheet(p, wear = null) {
  const wx = wear ? null : await getWeather();
  const w = wear || {
    date: todayStr(), occasion: lastOccasion, sprays: 3, compliments: 0, longevity: '', note: '',
    weather: wx ? `${wx.emoji} ${wx.text}` : '', tempC: wx ? wx.temp : ''
  };
  const LONG = ['', 1, 2, 3, 4, 5, 6, 8, 10, 12];
  const s = openSheet(`
    <div class="flex" style="gap:12px">${imgTag(p, 'p-img')}<div class="grow"><h3 class="trunc">${esc(p.name || w.perfumeName)}</h3><div class="sub">${esc(p.brand || '')}</div></div></div>
    <label class="lbl">วันที่</label><input type="date" class="inp" id="wDate" value="${esc(w.date)}">
    <label class="lbl">โอกาส</label>
    <div class="chips wrap" id="wOcc">${OCCASIONS.map(([k, l]) => `<button class="chip-btn ${w.occasion === k ? 'active' : ''}" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="row mt">
      <div><label class="lbl" style="margin-top:0">ฉีดกี่ปั๊ม</label>
        <div class="flex"><button class="icon-btn" data-step="wSpray:-1">−</button><b id="wSpray" class="grow center">${num(w.sprays) || 3}</b><button class="icon-btn" data-step="wSpray:1">＋</button></div></div>
      <div><label class="lbl" style="margin-top:0">มีคนชม 🥰</label>
        <div class="flex"><button class="icon-btn" data-step="wComp:-1">−</button><b id="wComp" class="grow center">${num(w.compliments)}</b><button class="icon-btn" data-step="wComp:1">＋</button></div></div>
    </div>
    <label class="lbl">ติดทนกี่ชั่วโมง (กรอกทีหลังได้)</label>
    <div class="chips wrap" id="wLong">${LONG.map(h => `<button class="chip-btn ${String(w.longevity) === String(h) ? 'active' : ''}" data-v="${h}">${h === '' ? 'ยังไม่รู้' : h + (h === 12 ? '+' : '') + ' ชม.'}</button>`).join('')}</div>
    <label class="lbl">โน้ตสั้นๆ</label><input class="inp" id="wNote" value="${esc(w.note)}" placeholder="เช่น ฉีดก่อนไปงานแต่งเพื่อน หอมมาก">
    ${w.weather ? `<div class="hint">อากาศ: ${esc(w.weather)} ${w.tempC !== '' ? esc(w.tempC) + '°C' : ''}</div>` : ''}
    <div class="row mt">
      ${wear ? '<button class="btn btn-danger" id="wDel" style="flex:0 0 auto">🗑️</button>' : ''}
      <button class="btn btn-main" id="wSave">💖 บันทึก</button>
    </div>`);
  const el = s.el;
  const chipSel = (id) => el.querySelector(`#${id}`).addEventListener('click', e => {
    const b = e.target.closest('.chip-btn'); if (!b) return;
    el.querySelectorAll(`#${id} .chip-btn`).forEach(x => x.classList.remove('active')); b.classList.add('active');
  });
  chipSel('wOcc'); chipSel('wLong');
  el.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
    const [id, d] = b.dataset.step.split(':'); const t = el.querySelector('#' + id);
    t.textContent = Math.max(0, Math.min(id === 'wSpray' ? 20 : 99, num(t.textContent) + Number(d)));
  }));
  el.querySelector('#wSave').addEventListener('click', async () => {
    const occ = el.querySelector('#wOcc .active'); const lg = el.querySelector('#wLong .active');
    const rec = {
      ...w, perfumeUid: p.uid || w.perfumeUid, perfumeName: p.name || w.perfumeName,
      date: el.querySelector('#wDate').value || todayStr(), occasion: occ ? occ.dataset.v : '',
      sprays: num(el.querySelector('#wSpray').textContent), compliments: num(el.querySelector('#wComp').textContent),
      longevity: lg ? lg.dataset.v : '', note: el.querySelector('#wNote').value.trim()
    };
    if (rec.occasion) { lastOccasion = rec.occasion; localStorage.setItem('pv_last_occ', rec.occasion); }
    await store.save('wears', rec);
    s.close(); toast(wear ? 'อัปเดตบันทึกแล้ว ✨' : '💖 บันทึกการฉีดแล้ว');
  });
  const del = el.querySelector('#wDel');
  if (del) del.addEventListener('click', async () => {
    if (await confirmDialog({ emoji: '🗑️', title: 'ลบบันทึกนี้?', ok: 'ลบ', danger: true })) { await store.remove('wears', wear.uid); s.close(); }
  });
}

// ---------- sheet เลือกขวด ----------
export function pickPerfume({ title = 'เลือกน้ำหอม', filter = (p) => statusKey(p.status) !== 'empty' } = {}) {
  return new Promise(resolve => {
    let picked = null;
    const list = store.state.perfumes.filter(filter).sort((a, b) => String(a.name).localeCompare(b.name));
    const s = openSheet(`<h3>${esc(title)}</h3>
      <div class="search-box" style="box-shadow:none;background:var(--soft)"><span>🔍</span><input id="pkQ" placeholder="ค้นหา..."></div>
      <div class="picker-list" id="pkList"></div>`, { onClose: () => resolve(picked) });
    const draw = (q = '') => {
      const items = list.filter(p => !q || norm(p.name + ' ' + p.brand).includes(norm(q)));
      s.el.querySelector('#pkList').innerHTML = items.length ? items.map(p => `
        <button class="picker-item" data-u="${esc(p.uid)}">${imgTag(p)}<div class="grow"><div class="trunc"><b>${esc(p.name)}</b></div><div class="sub trunc">${esc(p.brand || '')}</div></div></button>`).join('')
        : '<div class="empty">ไม่พบขวด</div>';
    };
    draw();
    s.el.querySelector('#pkQ').addEventListener('input', e => draw(e.target.value));
    s.el.querySelector('#pkList').addEventListener('click', e => {
      const b = e.target.closest('[data-u]'); if (!b) return;
      picked = store.perfume(b.dataset.u); s.close();
    });
  });
}

registerActions({
  wearQuick: (d) => { const p = store.perfume(d.id); if (p) quickWear(p); },
  wearSheet: (d) => { const p = store.perfume(d.id); if (p) openWearSheet(p); },
  wearEdit: (d) => {
    const w = store.find('wears', d.id); if (!w) return;
    openWearSheet(store.perfume(w.perfumeUid) || { name: w.perfumeName, uid: w.perfumeUid }, w);
  },
  wearNew: async () => { const p = await pickPerfume({ title: 'วันนี้ฉีดขวดไหน?' }); if (p) openWearSheet(p); },
  diaryMore: () => { diaryLimit += 40; go('diary?n=' + diaryLimit); }
});
let diaryLimit = 40;

export function render({ query }) {
  if (query.n) diaryLimit = Number(query.n) || 40;
  const W = [...store.state.wears].sort((a, b) => String(b.date).localeCompare(a.date) || String(b.updatedAt).localeCompare(a.updatedAt));
  const now = new Date(); const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const month = W.filter(w => String(w.date).startsWith(ym));
  const compl = month.reduce((s, w) => s + num(w.compliments), 0);
  const topMonth = Object.entries(month.reduce((m, w) => (m[w.perfumeName] = (m[w.perfumeName] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1])[0];

  const groups = {};
  W.slice(0, diaryLimit).forEach(w => (groups[w.date] = groups[w.date] || []).push(w));

  const html = `
    <div class="card">
      <div class="card-head">🗓️ ปฏิทินความหอม <span class="sub">26 สัปดาห์ล่าสุด</span></div>
      ${heatmapHtml(heatmap(26))}
    </div>
    <div class="stat-grid">
      <div class="stat t-pink"><div class="e">🔥</div><div class="stat-num">${streak()}</div><div class="stat-label">วันติดกัน</div></div>
      <div class="stat t-lilac"><div class="e">📅</div><div class="stat-num">${month.length}</div><div class="stat-label">ครั้งใน${thMonth(now.getMonth())}</div></div>
      <div class="stat t-mint"><div class="e">🥰</div><div class="stat-num">${compl}</div><div class="stat-label">คำชมเดือนนี้</div></div>
    </div>
    ${topMonth ? `<div class="card flex" style="gap:12px"><div style="font-size:1.8rem">👑</div><div class="grow"><div class="sub">ขวดประจำเดือนนี้</div><b>${esc(topMonth[0])}</b> <span class="sub">· ${topMonth[1]} ครั้ง</span></div><div class="sub">สถิติสูงสุด ${bestStreak()} วัน</div></div>` : ''}
    <button class="btn btn-main btn-block mb" data-act="wearNew">＋ บันทึกการฉีด</button>
    ${W.length ? Object.entries(groups).map(([date, ws]) => `
      <div class="day-group"><div class="day-label">${esc(relDay(date))}</div>
        ${ws.map(w => {
          const p = store.perfume(w.perfumeUid) || { name: w.perfumeName };
          return `<div class="wear-row" data-act="wearEdit" data-id="${esc(w.uid)}">
            ${imgTag(p)}
            <div class="grow"><b class="trunc" style="display:block">${esc(p.name || w.perfumeName)}</b>
              <div class="tags">${w.occasion ? `<span class="tag lilac">${esc(occLabel(w.occasion))}</span>` : ''}${w.longevity !== '' && w.longevity != null ? `<span class="tag sky">⏱️ ${esc(w.longevity)} ชม.</span>` : ''}${num(w.compliments) ? `<span class="tag pink">🥰 ${esc(w.compliments)}</span>` : ''}${w.weather ? `<span class="tag">${esc(w.weather)}</span>` : ''}</div>
              ${w.note ? `<div class="sub trunc">${esc(w.note)}</div>` : ''}</div>
          </div>`;
        }).join('')}
      </div>`).join('') + (W.length > diaryLimit ? `<button class="btn btn-soft btn-block" data-act="diaryMore">ดูเพิ่ม</button>` : '')
    : `<div class="empty"><div class="big">📔</div>ยังไม่มีบันทึก<br>กด "ฉีดวันนี้" ที่ขวดไหนก็ได้ เพื่อเริ่มเก็บสถิติ</div>`}`;
  return { html, title: 'สมุดบันทึกการฉีด', tab: 'diary' };
}
