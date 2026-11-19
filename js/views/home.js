// 🏠 หน้าวันนี้: ฉีดอะไรดี + สภาพอากาศ + แจ้งเตือน + สถิติ
import * as store from '../store.js';
import { registerActions, go } from '../nav.js';
import { ai, isConfigured, isOnline } from '../api.js';
import { esc, imgTag, money, toast, OCCASIONS, statusKey, todayStr, num } from '../util.js';
import { localPicks, alerts, streak, buildContext, recentWearsText, dna } from '../analytics.js';
import { getWeather, weatherText } from '../weather.js';
import { quickWear } from './diary.js';
import { vaultCard } from '../share.js';

let occasion = localStorage.getItem('pv_last_occ') || 'daily';
let picks = null; // { list:[{p, reason}], tip, source }
let weather = null;
let loadingAi = false;

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return ['ดึกแล้วนะ', '🌙']; if (h < 12) return ['อรุณสวัสดิ์', '☀️'];
  if (h < 17) return ['สวัสดีตอนบ่าย', '🌤️']; return ['สวัสดีตอนเย็น', '🌆'];
}

function picksHtml() {
  if (loadingAi) return `<div class="tip center"><span class="typing"><i></i><i></i><i></i></span> AI กำลังเลือกให้...</div>`;
  if (!picks) return '';
  if (!picks.list.length) return '<div class="tip">ยังไม่มีขวดสถานะ "ใช้อยู่" ให้เลือก ลองเพิ่มขวดหรือเปลี่ยนสถานะในตู้ดูนะ</div>';
  return `<div class="pick-list">${picks.list.map(({ p, reason }) => `
      <div class="pick">
        <a href="#/p/${esc(p.uid)}">${imgTag(p)}</a>
        <div class="grow"><b class="trunc" style="display:block">${esc(p.name)}</b><div class="why">${esc(reason)}</div></div>
        <button class="wear-btn" data-act="pickWear" data-id="${esc(p.uid)}">💖 ฉีดเลย</button>
      </div>`).join('')}</div>
    ${picks.tip ? `<div class="tip">💡 ${esc(picks.tip)}</div>` : ''}
    <div class="hint" style="color:rgba(255,255,255,.85)">${picks.source === 'ai' ? '✨ เลือกโดย AI' : '🎲 เลือกจากสถิติในเครื่อง (ใช้ได้แม้ออฟไลน์)'}</div>`;
}
function refreshPicks() { const el = document.getElementById('picksArea'); if (el) el.innerHTML = picksHtml(); }

registerActions({
  setOcc: (d, el) => {
    occasion = d.v; localStorage.setItem('pv_last_occ', occasion);
    el.parentElement.querySelectorAll('.chip-btn').forEach(b => b.classList.toggle('active', b === el));
  },
  pickLocal: () => {
    picks = { list: localPicks({ weather, occasion }), source: 'local' };
    refreshPicks();
  },
  pickAi: async () => {
    if (!isConfigured()) { toast('เชื่อม Google Sheet ในหน้า ตั้งค่า ก่อนนะ'); return; }
    if (!isOnline()) { toast('AI ต้องใช้อินเทอร์เน็ต ลองใช้ 🎲 สุ่มแบบฉลาดแทนนะ'); return; }
    loadingAi = true; refreshPicks();
    try {
      const h = new Date().getHours();
      const r = await ai('recommend', {
        context: buildContext({ activeOnly: true }), weather: weatherText(weather),
        occasion: OCCASIONS.find(o => o[0] === occasion)[1], timeOfDay: h < 12 ? 'เช้า' : h < 17 ? 'บ่าย' : 'เย็น/กลางคืน',
        recent: recentWearsText(7)
      });
      const list = (r.picks || []).map(x => ({ p: store.findPerfumeByName(x.name), reason: x.reason })).filter(x => x.p).slice(0, 3);
      picks = { list: list.length ? list : localPicks({ weather, occasion }), tip: r.tip, source: list.length ? 'ai' : 'local' };
    } catch (e) {
      toast('AI ไม่ตอบ (ใช้แบบในเครื่องแทน): ' + e.message, 6000);
      picks = { list: localPicks({ weather, occasion }), source: 'local' };
    } finally { loadingAi = false; refreshPicks(); }
  },
  pickWear: (d) => { const p = store.perfume(d.id); if (p) quickWear(p); },
  shareVault: () => {
    const P = store.state.perfumes;
    const top = [...P].filter(p => statusKey(p.status) !== 'empty').sort((a, b) => num(b.rating) - num(a.rating)).slice(0, 6);
    vaultCard({ total: P.length, brands: new Set(P.map(p => p.brand).filter(Boolean)).size, value: P.reduce((s, p) => s + num(p.price), 0), top, persona: dna().title });
  }
});

export function render() {
  const P = store.state.perfumes;
  const [hello, e] = greeting();
  const todayWears = store.state.wears.filter(w => w.date === todayStr());
  const al = alerts().slice(0, 5);
  const total = P.reduce((s, p) => s + num(p.price), 0);
  const ym = todayStr().slice(0, 7);

  const html = `
    <div class="page-title" style="margin-bottom:10px">${hello} ${e}</div>

    ${!isConfigured() ? `
      <a class="card setup-card flex" href="#/settings" style="text-decoration:none;gap:12px">
        <div style="font-size:2rem">🔗</div>
        <div class="grow"><b>เชื่อมกับ Google Sheet</b><div style="font-size:.8rem">ตอนนี้เก็บข้อมูลแค่ในเครื่อง แตะเพื่อตั้งค่าซิงค์และเปิดใช้ AI</div></div><div>›</div>
      </a>` : ''}

    <div class="hero">
      <div class="hero-title">วันนี้ฉีดอะไรดี? 🌷</div>
      <div class="weather-pill" id="wxPill">${weather ? `${weather.emoji} ${weather.temp}° ${esc(weather.text)} · ${esc(weather.place)}` : '🌡️ กำลังดูอากาศ...'}</div>
      <div class="chips">${OCCASIONS.map(([k, l]) => `<button class="chip-btn ${k === occasion ? 'active' : ''}" data-act="setOcc" data-v="${k}">${l}</button>`).join('')}</div>
      <div id="picksArea">${picksHtml()}</div>
      <div class="hero-btns">
        <button data-act="pickLocal">🎲 สุ่มแบบฉลาด</button>
        <button class="ghost" data-act="pickAi">✨ ให้ AI เลือก</button>
      </div>
    </div>

    ${todayWears.length ? `
      <div class="card"><div class="card-head">💖 วันนี้หอมด้วย</div>
        ${todayWears.map(w => { const p = store.perfume(w.perfumeUid) || { name: w.perfumeName }; return `
          <div class="wear-row" style="box-shadow:none;background:var(--soft)" data-act="wearEdit" data-id="${esc(w.uid)}">${imgTag(p)}
            <div class="grow"><b>${esc(p.name)}</b><div class="sub">แตะเพื่อเพิ่มความติดทน / คำชม</div></div><span>✏️</span></div>`; }).join('')}
      </div>` : ''}

    ${al.length ? `
      <div class="card"><div class="card-head">🔔 เรื่องที่ควรรู้</div>
        ${al.map(a => `<a class="alert-item" href="#/p/${esc(a.p.uid)}" style="text-decoration:none;color:inherit">
          <div class="ic ${a.cls}">${a.ic}</div><div class="grow"><b class="trunc" style="display:block">${esc(a.p.name)}</b><div class="sub">${esc(a.text)}</div></div></a>`).join('')}
      </div>` : ''}

    <div class="stat-grid">
      <div class="stat t-pink"><div class="e">🧴</div><div class="stat-num">${P.length}</div><div class="stat-label">ขวดทั้งหมด</div></div>
      <div class="stat t-lilac"><div class="e">✨</div><div class="stat-num">${P.filter(p => statusKey(p.status) === 'rotation').length}</div><div class="stat-label">ใช้อยู่</div></div>
      <div class="stat t-mint"><div class="e">💰</div><div class="stat-num">${total >= 100000 ? Math.round(total / 1000) + 'k' : money(total)}</div><div class="stat-label">มูลค่ารวม ฿</div></div>
      <div class="stat t-sky"><div class="e">📅</div><div class="stat-num">${store.state.wears.filter(w => String(w.date).startsWith(ym)).length}</div><div class="stat-label">ฉีดเดือนนี้</div></div>
      <div class="stat t-peach"><div class="e">🔥</div><div class="stat-num">${streak()}</div><div class="stat-label">วันติดกัน</div></div>
      <div class="stat t-lemon"><div class="e">💭</div><div class="stat-num">${store.state.wishlist.filter(w => w.status !== 'ซื้อแล้ว').length}</div><div class="stat-label">Wishlist</div></div>
    </div>

    <div class="hub">
      <a href="#/dna" class="t-lilac"><span class="e">🧬</span><div><b>DNA กลิ่น</b><small>คุณเป็นสายไหน?</small></div></a>
      <a href="#/wrapped" class="t-pink"><span class="e">🎁</span><div><b>Wrapped ${new Date().getFullYear()}</b><small>สรุปทั้งปี</small></div></a>
      <a href="#/badges" class="t-lemon"><span class="e">🏅</span><div><b>เหรียญรางวัล</b><small>${store.state.perfumes.length ? 'ดูความสำเร็จ' : 'เริ่มสะสม'}</small></div></a>
      <a href="#" data-act="shareVault" class="t-mint"><span class="e">📸</span><div><b>แชร์ตู้ของฉัน</b><small>การ์ดสำหรับ IG Story</small></div></a>
    </div>`;

  return {
    html, title: 'Perfume Vault', tab: 'home',
    mount: async () => {
      if (!weather) {
        weather = await getWeather();
        const pill = document.getElementById('wxPill');
        if (pill) pill.textContent = weather ? `${weather.emoji} ${weather.temp}° ${weather.text} · ${weather.place}${weather.stale ? ' (ข้อมูลเก่า)' : ''}` : '🌡️ ไม่มีข้อมูลอากาศ (ออฟไลน์)';
      }
    }
  };
}
