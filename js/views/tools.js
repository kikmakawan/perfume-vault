// 🧰 เครื่องมือ: ✈️ จัดกระเป๋าไปเที่ยว · 🍂 สลับขวดตามฤดู · 🛫 โหมดดิวตี้ฟรี · 🗺️ แผนที่กลิ่น
import * as store from '../store.js';
import { registerActions, go } from '../nav.js';
import { esc, imgTag, toast, money, num, norm, statusKey, STATUS, todayStr, dateStr, loadingHtml, openSheet, isBlank } from '../util.js';
import { AXES, mainAxis, wearIndex, perfumeStats } from '../analytics.js';
import { SEASONS, thaiSeason, seasonFromWeather, seasonFit, hasNotes, similarity, similarInCollection, scentMap, travelPicks } from '../scent.js';
import { getWeather } from '../weather.js';
import { quickWear } from './diary.js';
import { queueEnrich } from '../enrich.js';
import { openTesterSheet } from './testers.js';

const fitBar = (f) => f === null ? '<span class="tag">ไม่มีข้อมูลโน้ต</span>'
  : `<div class="fit"><div class="sim-bar"><i style="width:${f}%;background:${f >= 70 ? 'var(--grad-2)' : f >= 45 ? 'var(--grad)' : 'var(--grad-3)'}"></i></div><small>${f}%</small></div>`;

// =======================================================
//  ✈️ TRAVEL
// =======================================================
const T = { place: null, start: dateStr(new Date(Date.now() + 7 * 86400000)), days: 4, occ: ['travel'], result: null, wx: null, loading: false, manualSeason: null };
const TRIP_OCC = [['travel', '🚶 เดินเที่ยว'], ['beach', '🏖️ ทะเล'], ['date', '🍷 ดินเนอร์/เดท'], ['party', '🥂 ออกงาน'], ['work', '💼 ทำงาน']];
const QUICK = [['โตเกียว', 35.68, 139.69], ['โอซาก้า', 34.69, 135.5], ['โซล', 37.57, 126.98], ['ไทเป', 25.03, 121.57], ['ฮ่องกง', 22.32, 114.17], ['สิงคโปร์', 1.35, 103.82], ['เชียงใหม่', 18.79, 98.98], ['ภูเก็ต', 7.88, 98.39], ['ปารีส', 48.86, 2.35], ['ลอนดอน', 51.51, -0.13]];

async function tripWeather(place, start, days) {
  const s = new Date(start + 'T00:00:00'); const e = new Date(s); e.setDate(e.getDate() + days - 1);
  const ahead = Math.round((s - new Date()) / 86400000);
  try {
    let url, src;
    if (ahead <= 14 && ahead >= -1) {
      const end = new Date(Math.min(e, Date.now() + 15 * 86400000));
      url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${dateStr(s)}&end_date=${dateStr(end)}`;
      src = 'พยากรณ์อากาศ';
    } else {
      const ly = (d) => { const x = new Date(d); x.setFullYear(x.getFullYear() - 1); return dateStr(x); };
      url = `https://archive-api.open-meteo.com/v1/archive?latitude=${place.lat}&longitude=${place.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${ly(s)}&end_date=${ly(e)}`;
      src = 'อากาศช่วงเดียวกันของปีที่แล้ว';
    }
    const j = await (await fetch(url)).json();
    const d = j.daily; if (!d) throw new Error('no data');
    const avg = (a) => a.filter(x => x != null).reduce((p, c) => p + c, 0) / Math.max(1, a.filter(x => x != null).length);
    const tMax = Math.round(avg(d.temperature_2m_max)), tMin = Math.round(avg(d.temperature_2m_min));
    const rainProb = d.precipitation_probability_max ? Math.round(avg(d.precipitation_probability_max))
      : Math.round(d.precipitation_sum.filter(x => x > 1).length / d.precipitation_sum.length * 100);
    return { tMax, tMin, rainProb, src };
  } catch (err) { return null; }
}

async function runTravel() {
  if (!T.place) return toast('เลือกปลายทางก่อนนะ');
  T.loading = true; drawTravel();
  T.wx = T.manualSeason ? null : await tripWeather(T.place, T.start, T.days);
  const season = T.manualSeason || (T.wx ? seasonFromWeather(T.wx) : null);
  T.loading = false;
  if (!season) { T.result = { needSeason: true }; drawTravel(); return; }
  T.result = { season, picks: travelPicks({ season, days: T.days, occasions: T.occ }) };
  drawTravel();
}

function travelResult() {
  if (T.loading) return loadingHtml('กำลังเช็คอากาศที่ปลายทาง...');
  const r = T.result; if (!r) return '';
  if (r.needSeason) return `<div class="card"><b>📡 ดูอากาศปลายทางไม่ได้ (ออฟไลน์?)</b><div class="sub mb">บอกหน่อยว่าที่นั่นอากาศเป็นยังไง</div>
    <div class="row">${Object.entries(SEASONS).map(([k, s]) => `<button class="btn btn-soft btn-sm" data-act="trSeason" data-v="${k}">${s.e} ${k === 'hot' ? 'ร้อน' : k === 'rainy' ? 'ฝน/ชื้น' : 'เย็น/หนาว'}</button>`).join('')}</div></div>`;
  const S = SEASONS[r.season];
  const tips = [
    '🧳 ถือขึ้นเครื่องได้ขวดละไม่เกิน 100 ml และรวมกันต้องใส่ถุงใสใบเดียว (ใบละไม่เกิน 1 ลิตร) ถ้าโหลดใต้ท้องเครื่องได้ไม่จำกัด',
    r.season === 'hot' ? '🥵 อากาศร้อนชื้น กลิ่นกระจายแรงขึ้น ลดเหลือ 2-3 ปั๊มพอ' : r.season === 'cool' ? '🧣 อากาศเย็น กลิ่นจะเบาลง ฉีดที่ผ้าพันคอหรือเสื้อด้านในจะติดทนกว่า' : '🌧️ ความชื้นสูง ฉีดที่ชีพจรแล้วเลี่ยงการถู กลิ่นจะอยู่ได้นานกว่า',
    '🧪 ขวดแบ่ง (atomizer) ขนาด 5-10 ml ประหยัดที่สุด และไม่ต้องกลัวขวดจริงแตก'
  ];
  const q = `ช่วยจัดน้ำหอมจากตู้ไปเที่ยว${T.place.name} ${T.days} วัน อากาศประมาณ ${T.wx ? T.wx.tMin + '-' + T.wx.tMax + '°C' : S.th} โอกาส: ${T.occ.map(o => TRIP_OCC.find(x => x[0] === o)[1]).join(', ')}`;
  return `
    <div class="card trip-wx">
      <div class="flex" style="gap:12px"><div style="font-size:2.4rem">${S.e}</div>
        <div class="grow"><b>${esc(T.place.name)} · ${T.days} วัน</b>
          <div class="sub">${T.wx ? `${T.wx.tMin}–${T.wx.tMax}°C · โอกาสฝน ${T.wx.rainProb}% · ${esc(T.wx.src)}` : 'เลือกอากาศเอง'}</div>
          <div class="tags"><span class="tag lilac">จัดแบบ${S.th}</span></div></div></div>
    </div>
    ${r.picks.length ? r.picks.map(x => `
      <div class="card pack">
        <div class="flex" style="gap:12px"><a href="#/p/${esc(x.p.uid)}">${imgTag(x.p, 'p-img')}</a>
          <div class="grow"><div class="sub">${esc(x.role)}</div><div class="p-name trunc">${esc(x.p.name)}</div><div class="p-sub trunc">${esc(x.p.brand || '')}</div>
            ${fitBar(x.fit)}</div></div>
        <div class="tags mt"><span class="tag mint">🧪 แบ่งไปประมาณ ${x.ml} ml</span>${x.bigBottle ? '<span class="tag lemon">ขวดใหญ่เกิน 100ml ถือขึ้นเครื่องไม่ได้</span>' : ''}${statusKey(x.p.status) === 'sealed' ? '<span class="tag peach">📦 ยังไม่แกะ</span>' : ''}</div>
      </div>`).join('') : '<div class="card">ยังไม่มีขวดในตู้ให้เลือก</div>'}
    <div class="card"><div class="card-head">💡 เคล็ดลับ</div>${tips.map(t => `<div class="kv" style="justify-content:flex-start">${t}</div>`).join('')}</div>
    <a class="btn btn-lilac btn-block" href="#/ai?q=${encodeURIComponent(q)}">💬 ให้ AI ช่วยจัดอีกความเห็น</a>`;
}

function drawTravel() {
  const el = document.getElementById('trOut'); if (el) el.innerHTML = travelResult();
  const pl = document.getElementById('trPlace'); if (pl) pl.textContent = T.place ? `📍 ${T.place.name}${T.place.country ? ', ' + T.place.country : ''}` : 'ยังไม่ได้เลือก';
}

registerActions({
  trQuick: (d) => { T.place = { name: d.n, lat: +d.lat, lon: +d.lon }; T.result = null; T.manualSeason = null; drawTravel(); document.querySelectorAll('[data-act=trQuick]').forEach(b => b.classList.toggle('active', b.dataset.n === d.n)); },
  trOcc: (d, el) => { T.occ = T.occ.includes(d.v) ? T.occ.filter(x => x !== d.v) : [...T.occ, d.v]; el.classList.toggle('active', T.occ.includes(d.v)); },
  trGo: () => runTravel(),
  trSeason: (d) => { T.manualSeason = d.v; runTravel(); },
  trDays: (d) => { T.days = Math.max(1, Math.min(21, T.days + Number(d.v))); document.getElementById('trDaysOut').textContent = T.days; }
});

export function renderTravel() {
  const html = `
    <div class="card">
      <div class="card-head">✈️ ไปไหนดี?</div>
      <div class="input-btn"><input class="inp" id="trQ" placeholder="พิมพ์ชื่อเมือง เช่น Kyoto, Bali"><button class="btn btn-lilac btn-sm" id="trSearch">ค้นหา</button></div>
      <div id="trResults"></div>
      <div class="chips mt">${QUICK.map(([n, la, lo]) => `<button class="chip-btn ${T.place && T.place.name === n ? 'active' : ''}" data-act="trQuick" data-n="${n}" data-lat="${la}" data-lon="${lo}">${n}</button>`).join('')}</div>
      <div class="sub mt" id="trPlace"></div>
      <div class="grid2">
        <div><label class="lbl">วันเดินทาง</label><input class="inp" type="date" id="trStart" value="${T.start}"></div>
        <div><label class="lbl">กี่วัน</label><div class="flex" style="height:46px"><button class="icon-btn" data-act="trDays" data-v="-1">−</button><b id="trDaysOut" class="grow center">${T.days}</b><button class="icon-btn" data-act="trDays" data-v="1">＋</button></div></div>
      </div>
      <label class="lbl">ไปทำอะไรบ้าง</label>
      <div class="chips wrap">${TRIP_OCC.map(([k, l]) => `<button class="chip-btn ${T.occ.includes(k) ? 'active' : ''}" data-act="trOcc" data-v="${k}">${l}</button>`).join('')}</div>
      <button class="btn btn-main btn-block mt" data-act="trGo">🧳 จัดกระเป๋าน้ำหอม</button>
    </div>
    <div id="trOut"></div>`;
  return {
    html, title: 'จัดกระเป๋าไปเที่ยว', back: true, parent: 'me', tab: 'me', live: false,
    mount: (root) => {
      drawTravel();
      root.querySelector('#trStart').addEventListener('change', e => { T.start = e.target.value; });
      const search = async () => {
        const q = root.querySelector('#trQ').value.trim(); if (!q) return;
        const box = root.querySelector('#trResults'); box.innerHTML = '<div class="hint">กำลังค้นหา...</div>';
        try {
          const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=th&format=json`)).json();
          const r = j.results || [];
          box.innerHTML = r.length ? `<div class="picker-list">${r.map(x => `<button class="picker-item" data-act="trQuick" data-n="${esc(x.name)}" data-lat="${x.latitude}" data-lon="${x.longitude}">📍 <div class="grow"><b>${esc(x.name)}</b><div class="sub">${esc([x.admin1, x.country].filter(Boolean).join(', '))}</div></div></button>`).join('')}</div>` : '<div class="hint">ไม่พบเมืองนี้ ลองพิมพ์ภาษาอังกฤษดู</div>';
        } catch (e) { box.innerHTML = '<div class="hint">ค้นหาไม่ได้ (ออฟไลน์?) เลือกจากเมืองยอดฮิตด้านล่างแทนได้</div>'; }
      };
      root.querySelector('#trSearch').addEventListener('click', search);
      root.querySelector('#trQ').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
      root.querySelector('#trResults').addEventListener('click', () => setTimeout(() => { root.querySelector('#trResults').innerHTML = ''; }, 50));
    }
  };
}

// =======================================================
//  🍂 SEASON
// =======================================================
let seasonKey = null;
registerActions({
  seSet: (d) => { seasonKey = d.v; go('season?s=' + d.v); },
  seOpen: async (d) => { await store.patch('perfumes', d.id, { status: STATUS.rotation, openedDate: todayStr() }); toast('✨ แกะใช้แล้ว ย้ายเข้า "ใช้อยู่"'); },
  seWear: (d) => { const p = store.perfume(d.id); if (p) quickWear(p); },
  seEnrich: () => { const miss = store.state.perfumes.filter(p => !hasNotes(p)); miss.forEach(p => queueEnrich(p.uid)); toast(`✨ ให้ AI เติมโน้ต ${miss.length} ขวด ทำงานเบื้องหลังนะ`); }
});

export function seasonSuggestions(key) {
  const idx = wearIndex();
  const rows = store.state.perfumes.filter(p => statusKey(p.status) !== 'empty')
    .map(p => ({ p, fit: seasonFit(p, key), s: perfumeStats(p, idx), sk: statusKey(p.status) }));
  const bring = rows.filter(r => r.fit !== null && r.fit >= 60 && (r.sk === 'sealed' || (r.s.daysSince ?? 99) >= 21)).sort((a, b) => b.fit - a.fit);
  const rest = rows.filter(r => r.fit !== null && r.fit < 40 && r.sk === 'rotation').sort((a, b) => a.fit - b.fit);
  const stars = rows.filter(r => r.fit !== null).sort((a, b) => b.fit - a.fit).slice(0, 3);
  return { bring, rest, stars, missing: rows.filter(r => r.fit === null).length };
}

export function renderSeason({ query }) {
  const now = thaiSeason();
  const key = query.s || seasonKey || now;
  const S = SEASONS[key];
  const { bring, rest, stars, missing } = seasonSuggestions(key);
  const bestOther = (p) => { const b = Object.keys(SEASONS).map(k => [k, seasonFit(p, k)]).sort((a, c) => c[1] - a[1])[0]; return SEASONS[b[0]]; };
  const row = (r, btn) => `<div class="flex season-row" style="gap:12px">
      <a href="#/p/${esc(r.p.uid)}">${imgTag(r.p, 'p-img sm')}</a>
      <div class="grow"><b class="trunc" style="display:block">${esc(r.p.name)}</b>${fitBar(r.fit)}</div>${btn || ''}</div>`;
  const html = `
    <div class="chips mb">${Object.entries(SEASONS).map(([k, s]) => `<button class="chip-btn ${k === key ? 'active' : ''}" data-act="seSet" data-v="${k}">${s.e} ${s.th}${k === now ? ' (ตอนนี้)' : ''}</button>`).join('')}</div>
    <div class="hero season-hero"><div style="font-size:2.6rem">${S.e}</div><div class="hero-title">${S.th}</div><div class="hero-sub">${S.months} · ${key === 'hot' ? 'เน้นสดชื่น ซิตรัส สมุนไพร' : key === 'rainy' ? 'เน้นไม้ มัสก์ สมุนไพร กลิ่นสะอาด' : 'เน้นหวานอุ่น อำพัน ไม้ หนัง'}</div></div>

    ${stars.length ? `<div class="card"><div class="card-head">👑 ขวดประจำ${S.th}</div><div class="star-row">${stars.map(r => `<a href="#/p/${esc(r.p.uid)}" class="star-b">${imgTag(r.p)}<b class="trunc">${esc(r.p.name)}</b><small>${r.fit}%</small></a>`).join('')}</div></div>` : ''}

    <div class="card"><div class="card-head">✨ ควรเอาออกมาใช้ <span class="sub">${bring.length} ขวด</span></div>
      <div class="hint mb">เข้ากับ${S.th} แต่ยังไม่แกะ หรือไม่ได้ฉีดมาเกิน 3 สัปดาห์</div>
      ${bring.length ? bring.slice(0, 8).map(r => row(r, r.sk === 'sealed'
        ? `<button class="btn btn-mint btn-sm" data-act="seOpen" data-id="${esc(r.p.uid)}">📦→✨ แกะใช้</button>`
        : `<button class="btn btn-pink btn-sm" data-act="seWear" data-id="${esc(r.p.uid)}">💖 ฉีด</button>`)).join('') : '<div class="sub">ขวดที่เหมาะกับฤดูนี้ได้ใช้ครบแล้ว 👍</div>'}
    </div>

    <div class="card"><div class="card-head">😴 พักไว้ก่อน <span class="sub">${rest.length} ขวด</span></div>
      <div class="hint mb">ใช้อยู่ แต่ไม่ค่อยเข้ากับ${S.th}</div>
      ${rest.length ? rest.slice(0, 8).map(r => row(r, `<span class="tag lilac">เหมาะ${bestOther(r.p).th}</span>`)).join('') : '<div class="sub">ไม่มี ตู้ของคุณเข้ากับฤดูนี้ดีมาก</div>'}
    </div>
    ${missing ? `<div class="card flex" style="gap:12px"><div style="font-size:1.8rem">🫧</div><div class="grow"><b>${missing} ขวดยังไม่มีโน้ตกลิ่น</b><div class="sub">เลยยังคำนวณความเข้ากับฤดูไม่ได้</div></div><button class="btn btn-lilac btn-sm" data-act="seEnrich">✨ ให้ AI เติม</button></div>` : ''}`;
  return { html, title: 'สลับขวดตามฤดู', back: true, parent: 'me', tab: 'me' };
}

// =======================================================
//  🛫 DUTY FREE
// =======================================================
const CUR = [['THB', '฿', 'บาท'], ['JPY', '¥', 'เยน'], ['KRW', '₩', 'วอน'], ['USD', '$', 'ดอลลาร์'], ['EUR', '€', 'ยูโร'], ['SGD', 'S$', 'สิงคโปร์'], ['HKD', 'HK$', 'ฮ่องกง'], ['TWD', 'NT$', 'ไต้หวัน'], ['CNY', '¥', 'หยวน'], ['AED', 'د.إ', 'ดิรฮัม']];
const D = { cur: localStorage.getItem('pv_df_cur') || 'JPY', q: '', price: '', ml: '' };
function rates() { try { return JSON.parse(localStorage.getItem('pv_fx')) || null; } catch (e) { return null; } }
async function loadRates(force = false) {
  const r = rates();
  if (!force && r && Date.now() - r.t < 12 * 3600000) return r;
  try {
    const j = await (await fetch('https://open.er-api.com/v6/latest/THB')).json();
    if (j.result !== 'success') throw new Error();
    const out = { t: Date.now(), rates: j.rates, date: j.time_last_update_utc };
    localStorage.setItem('pv_fx', JSON.stringify(out)); return out;
  } catch (e) { return r; }
}
const toThb = (amount, cur) => { if (cur === 'THB') return amount; const r = rates(); const k = r && r.rates[cur]; return k ? amount / k : null; };
const fromThb = (thb, cur) => { if (cur === 'THB') return thb; const r = rates(); const k = r && r.rates[cur]; return k ? thb * k : null; };
const sym = (c) => (CUR.find(x => x[0] === c) || ['', c])[1];
const fmt = (n, c) => n == null ? '-' : sym(c) + Math.round(n).toLocaleString('th-TH');
const wishPrices = (w) => { try { return JSON.parse(w.prices || '[]'); } catch (e) { return []; } };

function dutyResult() {
  const q = norm(D.q);
  const price = num(D.price), ml = num(D.ml);
  const thb = price ? toThb(price, D.cur) : null;
  const perMl = thb && ml ? thb / ml : null;
  let out = '';
  if (price) out += `<div class="card df-price"><div class="flex between"><div><div class="sub">ราคาเป็นเงินบาท</div><div class="big-num">${thb == null ? 'ไม่มีเรทเงิน' : '฿' + money(thb)}</div></div>
      ${perMl ? `<div class="center"><div class="sub">ต่อ ml</div><div class="big-num" style="font-size:1.2rem">฿${perMl.toFixed(1)}</div></div>` : ''}</div></div>`;
  if (!q) return out;
  const own = store.state.perfumes.filter(p => norm(p.name).includes(q) || (q.length > 3 && q.includes(norm(p.name))));
  const wish = store.state.wishlist.filter(w => norm(w.name).includes(q));
  const test = store.state.testers.filter(t => norm(t.name).includes(q));
  if (own.length) out += `<div class="card df-alert"><b>🛑 มีอยู่ในตู้แล้ว!</b>${own.map(p => `<a class="mention mt" href="#/p/${esc(p.uid)}">${imgTag(p)}${esc(p.name)} · ${esc(p.format || '')} ${p.volume ? p.volume + 'ml' : ''}</a>`).join(' ')}</div>`;
  wish.forEach(w => {
    const ps = wishPrices(w); const low = ps.length ? ps.reduce((m, x) => num(x.price) < num(m.price) ? x : m) : null;
    const lowPerMl = ps.filter(x => num(x.ml)).map(x => num(x.price) / num(x.ml)).sort((a, b) => a - b)[0];
    let verdict = '';
    if (thb) {
      if (num(w.targetPrice) && thb <= num(w.targetPrice)) verdict = `<div class="verdict-ok">🎯 ถึงราคาเป้าหมายแล้ว (เป้า ฿${money(w.targetPrice)})</div>`;
      else if (perMl && lowPerMl) verdict = perMl < lowPerMl ? `<div class="verdict-ok">🟢 ถูกกว่าที่เคยเจอ ${Math.round((1 - perMl / lowPerMl) * 100)}% (ต่อ ml)</div>` : `<div class="verdict-no">🔴 แพงกว่าที่เคยเจอ ${Math.round((perMl / lowPerMl - 1) * 100)}% (ต่อ ml)</div>`;
      else if (low) verdict = thb < num(low.price) ? `<div class="verdict-ok">🟢 ถูกกว่าราคาต่ำสุดที่จดไว้ ฿${money(num(low.price) - thb)}</div>` : `<div class="verdict-no">🔴 แพงกว่าราคาต่ำสุดที่จดไว้ (฿${money(low.price)} ที่ ${esc(low.shop)})</div>`;
    }
    out += `<div class="card"><div class="flex between"><b>💖 อยู่ใน Wishlist: ${esc(w.name)}</b>${w.matchScore !== '' && w.matchScore != null ? `<span class="tag mint">Match ${esc(w.matchScore)}%</span>` : ''}</div>
      <div class="sub">${num(w.targetPrice) ? `🎯 เป้า ฿${money(w.targetPrice)} (≈ ${fmt(fromThb(num(w.targetPrice), D.cur), D.cur)})` : 'ยังไม่ได้ตั้งราคาเป้า'}${low ? ` · ต่ำสุดที่จด ฿${money(low.price)}` : ''}</div>${verdict}
      ${thb ? `<button class="btn btn-lilac btn-sm mt" data-act="dfSavePrice" data-id="${esc(w.uid)}">💾 จดราคานี้ลง Wishlist</button>` : ''}</div>`;
    const sim = similarInCollection(w, { limit: 3, min: 60 });
    if (sim.length) out += `<div class="card"><b>🗄️ ในตู้มีกลิ่นคล้ายกัน</b>${sim.map(x => `<div class="kv"><a href="#/p/${esc(x.p.uid)}">${esc(x.p.name)}</a><span class="tag ${x.s >= 80 ? 'pink' : 'lemon'}">คล้าย ${x.s}%</span></div>`).join('')}</div>`;
  });
  test.forEach(t => { out += `<div class="card"><b>🧫 เคยลองแล้ว: ${esc(t.name)}</b><div class="sub">${esc(t.where || '')} · ${t.verdict === 'love' ? '😍 อยากได้' : t.verdict === 'no' ? '🙅 ไม่ใช่' : '🤔 คิดก่อน'}${t.notes ? ' · “' + esc(t.notes) + '”' : ''}</div></div>`; });
  if (!own.length && !wish.length && !test.length) out += `<div class="card"><b>🆕 ยังไม่เคยจดขวดนี้</b><div class="sub">ยังไม่รู้โน้ตกลิ่น เลยเช็คความซ้ำในตู้ไม่ได้ ให้ AI ช่วยวิเคราะห์ได้</div>
    <div class="row mt"><a class="btn btn-lilac btn-sm" href="#/purchase?name=${encodeURIComponent(D.q)}">🛒 AI วิเคราะห์</a><button class="btn btn-soft btn-sm" data-act="dfTester">🧫 จดเป็นเทสเตอร์</button></div></div>`;
  out += `<button class="btn btn-mint btn-block" data-act="dfBought">🛍️ ซื้อแล้ว! เพิ่มเข้าตู้</button>`;
  return out;
}
function drawDuty() { const el = document.getElementById('dfOut'); if (el) el.innerHTML = dutyResult(); }

registerActions({
  dfSavePrice: async (d) => {
    const w = store.find('wishlist', d.id); if (!w) return;
    const ps = wishPrices(w); ps.push({ shop: 'Duty Free (' + D.cur + ')', price: Math.round(toThb(num(D.price), D.cur)), ml: D.ml, date: todayStr() });
    await store.patch('wishlist', w.uid, { prices: JSON.stringify(ps) }); toast('💾 จดราคาแล้ว'); drawDuty();
  },
  dfTester: () => openTesterSheet(null, { name: D.q, where: 'Duty Free', price: num(D.price) ? Math.round(toThb(num(D.price), D.cur)) : '' }),
  dfBought: () => go(`add?name=${encodeURIComponent(D.q)}&price=${num(D.price) ? Math.round(toThb(num(D.price), D.cur)) : ''}&volume=${encodeURIComponent(D.ml)}`)
});

export function renderDutyFree() {
  const r = rates();
  const W = store.state.wishlist.filter(w => w.status !== 'ซื้อแล้ว').sort((a, b) => num(b.matchScore) - num(a.matchScore));
  const html = `
    <div class="hero df-hero"><div class="hero-title">🛫 โหมดดิวตี้ฟรี</div><div class="hero-sub">เจอขวดในร้าน พิมพ์ชื่อกับราคา แอปจะบอกว่ามีแล้วไหม ซ้ำไหม และคุ้มไหม</div></div>
    <div class="card">
      <label class="lbl" style="margin-top:0">ชื่อขวดที่เห็น</label>
      <input class="inp" id="dfQ" value="${esc(D.q)}" placeholder="เช่น Erba Pura" autocomplete="off">
      <div class="grid2">
        <div><label class="lbl">ราคาป้าย</label><input class="inp" id="dfPrice" type="number" inputmode="decimal" value="${esc(D.price)}"></div>
        <div><label class="lbl">ขนาด (ml)</label><input class="inp" id="dfMl" type="number" inputmode="decimal" value="${esc(D.ml)}"></div>
      </div>
      <label class="lbl">สกุลเงิน</label>
      <div class="chips">${CUR.map(([c, s, l]) => `<button class="chip-btn ${D.cur === c ? 'active' : ''}" data-cur="${c}">${s} ${l}</button>`).join('')}</div>
      <div class="hint" id="dfRate">${r ? `เรท: 1 บาท = ${D.cur === 'THB' ? 1 : (r.rates[D.cur] || 0).toFixed(D.cur === 'KRW' || D.cur === 'JPY' ? 2 : 4)} ${D.cur} · อัปเดต ${new Date(r.t).toLocaleDateString('th-TH')}` : 'กำลังโหลดเรทเงิน...'}</div>
    </div>
    <div id="dfOut"></div>
    ${W.length ? `<div class="card"><div class="card-head">💖 Wishlist ที่ควรมองหา</div>
      ${W.slice(0, 10).map(w => `<div class="kv" data-df="${esc(w.name)}" style="cursor:pointer"><span class="trunc" style="max-width:60%">${esc(w.name)}</span><span class="sub">${num(w.targetPrice) ? `🎯 ${fmt(fromThb(num(w.targetPrice), D.cur), D.cur)}` : ''}</span></div>`).join('')}</div>` : ''}`;
  return {
    html, title: 'โหมดดิวตี้ฟรี', back: true, parent: 'me', tab: 'me', live: false,
    mount: async (root) => {
      const bind = (id, k) => root.querySelector(id).addEventListener('input', e => { D[k] = e.target.value; drawDuty(); });
      bind('#dfQ', 'q'); bind('#dfPrice', 'price'); bind('#dfMl', 'ml');
      root.querySelectorAll('[data-cur]').forEach(b => b.addEventListener('click', () => { D.cur = b.dataset.cur; localStorage.setItem('pv_df_cur', D.cur); go('dutyfree?c=' + D.cur); }));
      root.querySelectorAll('[data-df]').forEach(x => x.addEventListener('click', () => { D.q = x.dataset.df; root.querySelector('#dfQ').value = D.q; drawDuty(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
      drawDuty();
      const fresh = await loadRates();
      if (fresh && (!r || fresh.t !== r.t)) { const el = root.querySelector('#dfRate'); if (el) el.textContent = `เรท: 1 บาท = ${D.cur === 'THB' ? 1 : (fresh.rates[D.cur] || 0).toFixed(4)} ${D.cur} · อัปเดตแล้ว`; drawDuty(); }
      else if (!fresh) { const el = root.querySelector('#dfRate'); if (el) el.textContent = '⚠️ โหลดเรทเงินไม่ได้ (ออฟไลน์) ใช้เป็นเงินบาทได้'; }
    }
  };
}

// =======================================================
//  🗺️ SCENT MAP
// =======================================================
let showWish = false;
registerActions({
  mapWish: () => { showWish = !showWish; go('map?w=' + (showWish ? 1 : 0)); },
  mapDot: (d) => {
    const p = store.perfume(d.id) || store.find('wishlist', d.id); if (!p) return;
    const isWish = !store.perfume(d.id);
    const near = similarInCollection(p, { limit: 3, min: 50 });
    openSheet(`<div class="flex" style="gap:12px">${imgTag(p, 'p-img')}<div class="grow"><h3>${esc(p.name)}</h3><div class="sub">${esc(p.brand || '')} · ${mainAxis(p).e} ${esc(mainAxis(p).th)}${isWish ? ' · 💖 Wishlist' : ''}</div></div></div>
      ${near.length ? `<div class="sec-title">ใกล้กันบนแผนที่</div>${near.map(x => `<div class="kv"><a href="#/p/${esc(x.p.uid)}">${esc(x.p.name)}</a><span class="sub">คล้าย ${x.s}%</span></div>`).join('')}` : ''}
      <a class="btn btn-main btn-block mt" href="${isWish ? '#/wish/' : '#/p/'}${esc(p.uid)}" data-close>ดูรายละเอียด</a>`);
  }
});

export function renderMap({ query }) {
  if (query.w !== undefined) showWish = query.w === '1';
  const mine = store.state.perfumes.filter(hasNotes);
  const wish = showWish ? store.state.wishlist.filter(w => w.status !== 'ซื้อแล้ว' && hasNotes(w)) : [];
  if (mine.length < 3) return { html: `<div class="empty"><div class="big">🗺️</div>ต้องมีขวดที่มีโน้ตกลิ่นอย่างน้อย 3 ขวด<br>ตอนนี้มี ${mine.length} ขวด</div>${store.state.perfumes.length > mine.length ? '<button class="btn btn-lilac btn-block" data-act="seEnrich">✨ ให้ AI เติมโน้ตที่ขาด</button>' : ''}`, title: 'แผนที่กลิ่น', back: true, parent: 'me', tab: 'me' };

  const { pts, axes } = scentMap([...mine, ...wish]);
  const W = 340, H = 340, pad = 34;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const sx = (x) => pad + (x - x0) / ((x1 - x0) || 1) * (W - pad * 2), sy = (y) => pad + (y - y0) / ((y1 - y0) || 1) * (H - pad * 2);
  const wishSet = new Set(wish.map(w => w.uid));
  const axLabels = axes.map(a => { const len = Math.hypot(a.x, a.y); return { ...a, len }; }).sort((a, b) => b.len - a.len).slice(0, 6)
    .map(a => { const ang = Math.atan2(a.y, a.x); return `<text x="${W / 2 + Math.cos(ang) * (W / 2 - 14)}" y="${H / 2 + Math.sin(ang) * (H / 2 - 14)}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--muted)">${a.e} ${esc(a.th.split('/')[0])}</text>`; }).join('');
  const dots = pts.map(({ p, x, y }) => {
    const a = mainAxis(p); const w = wishSet.has(p.uid);
    return `<g data-act="mapDot" data-id="${esc(p.uid)}" style="cursor:pointer"><circle cx="${sx(x)}" cy="${sy(y)}" r="${w ? 9 : 11}" fill="${w ? 'var(--card)' : a.c}" stroke="${a.c}" stroke-width="${w ? 3 : 2}" ${w ? 'stroke-dasharray="3 2"' : ''} opacity=".92"/>
      <text x="${sx(x)}" y="${sy(y) + 22}" text-anchor="middle" font-size="8.5" fill="var(--ink)">${esc(String(p.name).slice(0, 14))}</text></g>`;
  }).join('');

  const counts = AXES.map(a => ({ ...a, n: mine.filter(p => mainAxis(p).k === a.k).length })).sort((a, b) => a.n - b.n);
  const gaps = counts.filter(c => c.n === 0).slice(0, 3);
  const crowd = counts.filter(c => c.n >= Math.max(3, mine.length * .35));
  const pairs = [];
  for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) { const s = similarity(mine[i], mine[j]); if (s >= 85) pairs.push([mine[i], mine[j], s]); }
  pairs.sort((a, b) => b[2] - a[2]);

  const html = `
    <div class="card map-card">
      <div class="flex between mb"><span class="sub">ขวดที่กลิ่นคล้ายกันจะอยู่ใกล้กัน · แตะจุดเพื่อดู</span>
        <button class="chip-btn ${showWish ? 'active' : ''}" data-act="mapWish">💖 Wishlist</button></div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" class="scent-map">
        <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="24" fill="var(--soft)"/>
        <line x1="${W / 2}" y1="20" x2="${W / 2}" y2="${H - 20}" stroke="var(--line)" stroke-dasharray="4 4"/><line x1="20" y1="${H / 2}" x2="${W - 20}" y2="${H / 2}" stroke="var(--line)" stroke-dasharray="4 4"/>
        ${axLabels}${dots}
      </svg>
      <div class="tags">${AXES.filter(a => mine.some(p => mainAxis(p).k === a.k)).map(a => `<span class="tag"><span class="dot" style="background:${a.c}"></span>${esc(a.th)}</span>`).join('')}${showWish ? '<span class="tag">◌ = Wishlist</span>' : ''}</div>
    </div>
    ${gaps.length ? `<div class="card"><div class="card-head">🧭 สายที่ยังไม่มีในตู้</div><div class="tags">${gaps.map(g => `<span class="tag lilac">${g.e} ${esc(g.th)}</span>`).join('')}</div>
      <a class="btn btn-lilac btn-sm mt" href="#/ai?q=${encodeURIComponent('ตู้ของฉันยังไม่มีสาย ' + gaps.map(g => g.th).join(', ') + ' แนะนำขวดที่น่าลองหน่อย')}">💬 ให้ AI แนะนำขวดสายนี้</a></div>` : ''}
    ${crowd.length ? `<div class="card"><div class="card-head">📦 สายที่มีเยอะแล้ว</div><div class="sub">${crowd.map(c => `${c.e} ${esc(c.th)} (${c.n} ขวด)`).join(' · ')} ขวดต่อไปลองสายอื่นดูไหม</div></div>` : ''}
    ${pairs.length ? `<div class="card"><div class="card-head">👯 ขวดที่คล้ายกันมาก</div>${pairs.slice(0, 4).map(([a, b, s]) => `<div class="kv"><span class="trunc" style="max-width:75%"><a href="#/p/${esc(a.uid)}">${esc(a.name)}</a> ↔ <a href="#/p/${esc(b.uid)}">${esc(b.name)}</a></span><span class="tag pink">${s}%</span></div>`).join('')}</div>` : ''}`;
  return { html, title: 'แผนที่กลิ่น', back: true, parent: 'me', tab: 'me' };
}
