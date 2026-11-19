// 🧬 DNA / 📈 สถิติ & งบ / 🎁 Wrapped / 🏅 Badges
import * as store from '../store.js';
import { registerActions, go } from '../nav.js';
import { esc, imgTag, money, num, statusKey, occLabel, thMonth, openSheet, toast } from '../util.js';
import { dna, spendByMonth, wearIndex, perfumeStats, badges, wrapped, mainAxis, AXES } from '../analytics.js';
import { radar, hbars, vbars, donut } from '../charts.js';
import { dnaCard, wrappedCard } from '../share.js';

// =======================================================
//  🧬 DNA
// =======================================================
registerActions({ shareDna: () => dnaCard(dna()) });

export function renderDna() {
  const d = dna();
  const byAxis = {};
  store.state.perfumes.forEach(p => { const a = mainAxis(p); (byAxis[a.k] = byAxis[a.k] || []).push(p); });
  const html = `
    <div class="card center">
      <div style="font-size:2.6rem">${d.title.e}</div>
      <div class="dna-title">${esc(d.title.name)}</div>
      <div class="sub">${esc(d.title.sub)}</div>
      <div class="radar-wrap mt">${radar(d.axes)}</div>
      <div class="hint">คำนวณจากโน้ตของทุกขวด ถ่วงน้ำหนักด้วยคะแนนที่ให้และจำนวนครั้งที่ฉีด</div>
      <button class="btn btn-main mt" data-act="shareDna">📸 แชร์ DNA ของฉัน</button>
    </div>
    <div class="card"><div class="card-head">💗 โน้ตที่คุณหลงรัก</div>
      <div class="tags">${d.notes.map((n, i) => `<span class="tag ${['pink', 'lilac', 'mint', 'sky', 'peach', 'lemon'][i % 6]}" style="font-size:${(.95 - i * .02).toFixed(2)}rem;padding:4px 12px">${esc(n.name)}</span>`).join('') || '<span class="sub">ยังไม่มีข้อมูลโน้ต</span>'}</div>
    </div>
    <div class="card"><div class="card-head">🗂️ ขวดในแต่ละสาย</div>
      ${[...d.axes].sort((a, b) => b.v - a.v).filter(a => byAxis[a.k]).map(a => `
        <div class="sec-title">${a.e} ${esc(a.th)} <span class="sub">(${byAxis[a.k].length})</span></div>
        <div class="tags">${byAxis[a.k].slice(0, 12).map(p => `<a class="mention" href="#/p/${esc(p.uid)}">${imgTag(p)}${esc(p.name)}</a>`).join('')}</div>`).join('')}
    </div>
    <div class="card"><div class="card-head">💡 ลองสายใหม่ไหม?</div>
      <div class="sec-text">คุณยังมีขวดสาย <b>${esc([...d.axes].sort((a, b) => a.v - b.v)[0].th)}</b> น้อยที่สุด ถ้าอยากเปิดโลกกลิ่นใหม่ ลองให้ AI แนะนำดู</div>
      <a class="btn btn-lilac btn-sm mt" href="#/chat">💬 ถาม AI</a>
    </div>`;
  return { html, title: 'DNA กลิ่นของฉัน', back: true, parent: 'more', tab: 'more' };
}

// =======================================================
//  📈 STATS & BUDGET
// =======================================================
registerActions({
  setBudget: () => {
    const s = openSheet(`<h3>💰 งบซื้อน้ำหอมต่อเดือน</h3><input class="inp" id="bg" type="number" inputmode="decimal" value="${esc(localStorage.getItem('pv_budget') || '')}" placeholder="เช่น 3000">
      <div class="hint">ใส่ 0 เพื่อปิดเส้นงบ</div><button class="btn btn-main btn-block mt" id="bgs">บันทึก</button>`);
    s.el.querySelector('#bgs').addEventListener('click', () => { localStorage.setItem('pv_budget', s.el.querySelector('#bg').value || '0'); s.close(); go('stats?t=' + Date.now()); });
  }
});

export function renderStats() {
  const P = store.state.perfumes;
  const idx = wearIndex();
  const budget = num(localStorage.getItem('pv_budget'));
  const months = spendByMonth(12);
  const thisM = months[months.length - 1];
  const yearSpend = months.reduce((s, m) => s + m.total, 0);
  const total = P.reduce((s, p) => s + num(p.price), 0);
  const remain = P.reduce((s, p) => s + (statusKey(p.status) === 'empty' ? 0 : num(p.price) * (p.fillLevel === '' || p.fillLevel == null ? 1 : num(p.fillLevel) / 100)), 0);
  const withS = P.map(p => ({ p, s: perfumeStats(p, idx) }));
  const best = withS.filter(x => x.s.costPerWear).sort((a, b) => a.s.costPerWear - b.s.costPerWear).slice(0, 5);
  const idle = withS.filter(x => num(x.p.price) && statusKey(x.p.status) !== 'empty' && x.s.wears <= 1).sort((a, b) => num(b.p.price) - num(a.p.price)).slice(0, 5);
  const count = (k) => Object.entries(P.reduce((m, p) => { const v = String(p[k] || '').trim() || 'ไม่ระบุ'; m[v] = (m[v] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  const spendBy = (k) => Object.entries(P.reduce((m, p) => { const v = String(p[k] || '').trim() || 'ไม่ระบุ'; m[v] = (m[v] || 0) + num(p.price); return m; }, {})).filter(e => e[1]).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const row = ({ p, s }, right) => `<a class="kv" href="#/p/${esc(p.uid)}" style="text-decoration:none;color:inherit"><span class="trunc" style="max-width:65%">${esc(p.name)}</span><b>${right}</b></a>`;
  const html = `
    <div class="stat-grid">
      <div class="stat t-pink"><div class="stat-num">${total >= 100000 ? Math.round(total / 1000) + 'k' : money(total)}</div><div class="stat-label">มูลค่ารวม ฿</div></div>
      <div class="stat t-mint"><div class="stat-num">${remain >= 100000 ? Math.round(remain / 1000) + 'k' : money(remain)}</div><div class="stat-label">มูลค่าคงเหลือ ฿</div></div>
      <div class="stat t-lilac"><div class="stat-num">${money(yearSpend)}</div><div class="stat-label">ใช้ไป 12 เดือน</div></div>
    </div>
    <div class="card"><div class="card-head">🗓️ ใช้จ่ายรายเดือน <button class="btn-ghost" style="margin-left:auto" data-act="setBudget">${budget ? 'งบ ฿' + money(budget) : '＋ ตั้งงบ'}</button></div>
      ${vbars(months, { budget })}
      ${budget ? `<div class="hint">เดือนนี้ใช้ไป ฿${money(thisM.total)} จากงบ ฿${money(budget)} ${thisM.total > budget ? '😱 เกินงบแล้ว!' : `(เหลือ ฿${money(budget - thisM.total)})`}</div>` : ''}
    </div>
    <div class="card"><div class="card-head">🏷️ กลุ่มแบรนด์</div>${donut(count('brandGroup'))}</div>
    <div class="card"><div class="card-head">💎 แบรนด์ที่จ่ายเยอะสุด</div>${hbars(spendBy('brand'), { fmt: n => '฿' + (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : money(n)) })}</div>
    <div class="card"><div class="card-head">🏆 คุ้มที่สุด <span class="sub">ต้นทุนต่อการฉีด</span></div>
      ${best.length ? best.map(x => row(x, '฿' + money(x.s.costPerWear) + '/ครั้ง')).join('') : '<div class="sub">บันทึกการฉีดก่อน แล้วจะเห็นว่าขวดไหนคุ้ม</div>'}</div>
    <div class="card"><div class="card-head">😴 ขวดแพงที่ยังไม่ค่อยได้ใช้</div>
      ${idle.length ? idle.map(x => row(x, '฿' + money(x.p.price) + ` · ${x.s.wears} ครั้ง`)).join('') : '<div class="sub">ไม่มี เยี่ยมมาก! 👏</div>'}</div>
    <div class="card"><div class="card-head">🛍️ ซื้อจากที่ไหนบ่อย</div>${hbars(count('location').filter(e => e[0] !== 'ไม่ระบุ').slice(0, 6))}</div>
    <div class="card"><div class="card-head">🌸 หมวดกลิ่น</div>${hbars(count('category').filter(e => e[0] !== 'ไม่ระบุ').slice(0, 8))}</div>`;
  return { html, title: 'สถิติ & งบ', back: true, parent: 'more', tab: 'more' };
}

// =======================================================
//  🎁 WRAPPED
// =======================================================
const GRADS = ['linear-gradient(160deg,#FFA9CB,#C4AEFF)', 'linear-gradient(160deg,#C4AEFF,#8EC5F2)', 'linear-gradient(160deg,#FFB98F,#FF9EC4)',
  'linear-gradient(160deg,#7FD6B6,#8EC5F2)', 'linear-gradient(160deg,#F5CF5B,#FFB98F)', 'linear-gradient(160deg,#B9A3F5,#FF9EC4)', 'linear-gradient(160deg,#8EC5F2,#7FD6B6)'];
let wIdx = 0, wData = null;

function slides(r) {
  const S = [];
  S.push(`<div class="kicker">Perfume Wrapped</div><div class="huge">${r.year}</div><div class="ttl">ปีนี้คุณหอมแค่ไหน? 🫧</div><div class="kicker">แตะขวาเพื่อไปต่อ →</div>`);
  if (!r.wears) {
    S.push(`<div class="huge">📔</div><div class="ttl">ปีนี้ยังไม่มีบันทึกการฉีดเลย</div><div class="kicker">กด 💖 ฉีดวันนี้ ทุกวัน แล้วปลายปีจะได้สรุปสนุกๆ แบบนี้</div>`);
  } else {
    S.push(`<div class="kicker">ปีนี้คุณฉีดน้ำหอมไป</div><div class="huge">${r.wears}</div><div class="ttl">ครั้ง ใน ${r.days} วัน</div><div class="kicker">${r.streak ? `ฉีดติดกันนานสุด ${r.streak} วัน 🔥` : ''}</div>`);
    const t = r.top[0];
    if (t) S.push(`<div class="kicker">ขวดคู่ใจแห่งปี 👑</div>${t.p ? imgTag(t.p, '').replace('<img', '<img style="width:160px;height:160px;border-radius:32px;object-fit:cover;margin:10px 0;box-shadow:0 10px 30px rgba(0,0,0,.15)"') : ''}<div class="ttl">${esc(t.name)}</div><div class="kicker">ฉีดไป ${t.n} ครั้ง</div>`);
    S.push(`<div class="ttl">🏆 Top 5 ประจำปี</div><div class="lst">${r.top.map((t, i) => `<div><b>${i + 1}</b><span class="grow">${esc(t.name)}</span><span>${t.n}×</span></div>`).join('')}</div>`);
    if (r.mostCompl || r.favOcc) S.push(`${r.mostCompl ? `<div class="kicker">ขวดที่ทำให้คนชมบ่อยสุด 🥰</div><div class="ttl">${esc(r.mostCompl.name)}</div><div class="kicker">${r.mostCompl.c} คำชม</div><br>` : ''}${r.favOcc ? `<div class="kicker">โอกาสที่ฉีดบ่อยสุด</div><div class="ttl">${esc(occLabel(r.favOcc))}</div>` : ''}`);
    S.push(`<div class="kicker">เดือนที่หอมที่สุด</div><div class="huge" style="font-size:3rem">${thMonth(r.bestMonth)}</div><div class="kicker">${r.months[r.bestMonth]} ครั้ง${r.avgLong ? ` · ติดทนเฉลี่ย ${r.avgLong.toFixed(1)} ชม.` : ''}</div>`);
  }
  S.push(`<div class="kicker">สายกลิ่นของคุณคือ</div><div class="huge" style="font-size:3.4rem">${r.dna.title.e}</div><div class="ttl">${esc(r.dna.title.name)}</div><div class="kicker">${esc(r.dna.title.sub)}</div>`);
  if (r.bought) S.push(`<div class="kicker">ปีนี้คุณรับน้องใหม่เข้าตู้</div><div class="huge">${r.bought}</div><div class="ttl">ขวด 🛍️</div><div class="kicker">รวม ฿${money(r.spend)}</div>`);
  S.push(`<div class="huge">🎁</div><div class="ttl">ขอบคุณที่หอมมาด้วยกันทั้งปี</div><div class="kicker">กดแชร์เพื่อสร้างรูปสำหรับ IG Story</div>`);
  return S;
}
function drawWrapped() {
  const el = document.getElementById('wrapped'); if (!el || !wData) return;
  const S = slides(wData); wIdx = Math.max(0, Math.min(wIdx, S.length - 1));
  el.style.background = GRADS[wIdx % GRADS.length];
  el.querySelector('.bars-top').innerHTML = S.map((_, i) => `<i class="${i <= wIdx ? 'on' : ''}"></i>`).join('');
  el.querySelector('.slide').outerHTML = `<div class="slide">${S[wIdx]}</div>`;
}
registerActions({
  wNext: () => { wIdx++; drawWrapped(); },
  wPrev: () => { wIdx--; drawWrapped(); },
  wShare: () => wData && wrappedCard(wData),
  wClose: () => go('more')
});

export function renderWrapped({ query }) {
  const year = Number(query.y) || new Date().getFullYear();
  wData = wrapped(year); wIdx = 0;
  const html = `<div class="wrapped" id="wrapped" style="background:${GRADS[0]}">
    <div class="bars-top"></div>
    <button class="close" data-act="wClose">✕</button>
    <div class="slide"></div>
    <div class="nav-zone"><div data-act="wPrev"></div><div data-act="wNext"></div></div>
    <div class="foot"><button data-act="wPrev" style="flex:0 0 56px;background:rgba(255,255,255,.3);color:#fff">‹</button><button data-act="wShare">📸 แชร์</button><button data-act="wNext" style="flex:0 0 56px">›</button></div>
  </div>`;
  return { html, title: 'Wrapped ' + year, back: true, parent: 'more', tab: 'more', live: false, mount: drawWrapped };
}

// =======================================================
//  🏅 BADGES
// =======================================================
export function renderBadges() {
  const B = badges();
  const done = B.filter(b => b.done).length;
  const html = `
    <div class="card center"><div class="big-num">${done} / ${B.length}</div><div class="sub">เหรียญที่ปลดล็อกแล้ว</div>
      <div class="prog mt" style="height:10px"><i style="width:${done / B.length * 100}%"></i></div></div>
    <div class="badge-grid">${B.sort((a, b) => b.done - a.done || (b.cur / b.target) - (a.cur / a.target)).map(b => `
      <div class="badge ${b.done ? '' : 'locked'}"><span class="e">${b.e}</span><b>${esc(b.title)}</b><small>${esc(b.desc)}</small>
        ${b.done ? '<small style="color:var(--mint-ink)">✓ สำเร็จ</small>' : `<div class="prog"><i style="width:${b.cur / b.target * 100}%"></i></div><small>${b.cur}/${b.target}</small>`}</div>`).join('')}
    </div>`;
  return { html, title: 'เหรียญรางวัล', back: true, parent: 'more', tab: 'more' };
}
