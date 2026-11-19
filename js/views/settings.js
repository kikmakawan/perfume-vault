// ⚙️ ตั้งค่า: เชื่อม Sheet / ธีม / ตำแหน่ง / สำรองข้อมูล
import * as store from '../store.js';
import * as db from '../db.js';
import { registerActions, go } from '../nav.js';
import { getConfig, setConfig, call, isConfigured } from '../api.js';
import { sync, syncState } from '../sync.js';
import { esc, toast, confirmDialog, timeAgo, todayStr } from '../util.js';
import { CITIES, getLocation, setLocation, useGps } from '../weather.js';
import { parseConnectLink, connectWith } from './welcome.js';

export const APP_VERSION = '2.2.0';

function applyTheme(t) {
  localStorage.setItem('pv_theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function toCsv(rows) {
  if (!rows.length) return '';
  const keys = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => k !== 'picLocal');
  const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [keys.join(','), ...rows.map(r => keys.map(k => cell(r[k])).join(','))].join('\n');
}

registerActions({
  setTheme: (d, el) => { applyTheme(d.v); el.parentElement.querySelectorAll('.chip-btn').forEach(b => b.classList.toggle('active', b === el)); },
  useGps: async () => { try { const l = await useGps(); toast('📍 ใช้ตำแหน่งปัจจุบันแล้ว'); go('settings?t=' + Date.now()); } catch (e) { toast(e.message); } },
  exportJson: () => {
    const data = { app: 'Perfume Vault', version: APP_VERSION, exportedAt: new Date().toISOString(), perfumes: store.state.perfumes.map(p => { const o = { ...p }; delete o.picLocal; return o; }), wishlist: store.state.wishlist, wears: store.state.wears, testers: store.state.testers };
    download(`perfume-vault-${todayStr()}.json`, JSON.stringify(data, null, 2), 'application/json');
  },
  exportCsv: () => { download(`perfumes-${todayStr()}.csv`, toCsv(store.state.perfumes), 'text/csv'); download(`wears-${todayStr()}.csv`, toCsv(store.state.wears), 'text/csv'); },
  importJson: () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      try {
        const data = JSON.parse(await inp.files[0].text());
        const n = ['perfumes', 'wishlist', 'wears', 'testers'].reduce((s2, k) => s2 + (data[k] || []).length, 0);
        if (!n) return toast('ไฟล์นี้ไม่มีข้อมูล');
        if (!await confirmDialog({ emoji: '📥', title: `นำเข้า ${n} รายการ?`, text: 'รายการที่ UID ซ้ำจะถูกแทนที่ และจะซิงค์ขึ้น Google Sheet ด้วย', ok: 'นำเข้า' })) return;
        await store.importAll(data); toast('📥 นำเข้าเรียบร้อย');
      } catch (e) { toast('อ่านไฟล์ไม่ได้: ' + e.message); }
    };
    inp.click();
  },
  repull: async () => {
    if (store.state.outboxCount && !await confirmDialog({ emoji: '⚠️', title: 'มีรายการที่ยังไม่ซิงค์', text: `${store.state.outboxCount} รายการจะหายไป ถ้าดึงใหม่ตอนนี้`, ok: 'ดึงใหม่เลย', danger: true })) return;
    await store.wipeLocal(); await sync({ silent: false });
  },
  wipe: async () => {
    if (await confirmDialog({ emoji: '🧹', title: 'ล้างข้อมูลในเครื่องนี้?', text: 'ข้อมูลใน Google Sheet จะไม่หาย แต่รายการที่ยังไม่ซิงค์จะหายไป', ok: 'ล้างเลย', danger: true })) {
      await store.wipeLocal(); toast('ล้างแล้ว');
    }
  }
});

export function render() {
  const c = getConfig();
  const theme = localStorage.getItem('pv_theme') || 'auto';
  const loc = getLocation();
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  const html = `
    <div class="card">
      <div class="card-head">🔗 เชื่อมกับ Google Sheet ${isConfigured() ? '<span class="tag mint" style="margin-left:auto">เชื่อมแล้ว</span>' : ''}</div>
      <div class="sub">ใส่ URL ของ Apps Script (Deploy เป็น Web app) และรหัส APP_TOKEN ดูวิธีตั้งค่าได้ใน README</div>
      <label class="lbl">⚡ วิธีง่าย: วางลิงก์เชื่อมต่อจาก setupToken</label>
      <div class="input-btn"><input class="inp" id="magic" placeholder="https://…/#/connect?u=…&t=…" autocapitalize="off"><button class="btn btn-main btn-sm" id="magicBtn" type="button">เชื่อม</button></div>
      <details class="mt"><summary class="sub">หรือกรอกเอง</summary>
      <form id="cfg">
        <label class="lbl">Web app URL</label><input class="inp" name="url" value="${esc(c.url)}" placeholder="https://script.google.com/macros/s/.../exec" inputmode="url" autocapitalize="off">
        <label class="lbl">APP_TOKEN</label><input class="inp" name="token" value="${esc(c.token)}" type="password" autocapitalize="off" autocomplete="off">
        <button class="btn btn-main btn-block mt" id="cfgBtn">🔌 ทดสอบ & บันทึก</button>
      </form></details>
      ${isConfigured() ? `<div class="kv mt"><span>ซิงค์ล่าสุด</span><b>${esc(timeAgo(syncState.lastSync))}</b></div><div class="kv"><span>รอซิงค์</span><b>${store.state.outboxCount} รายการ</b></div>
        ${syncState.lastError ? `<div class="kv"><span>ข้อผิดพลาดล่าสุด</span><b style="color:var(--rose)">${esc(syncState.lastError)}</b></div>` : ''}` : ''}
    </div>

    <div class="card"><div class="card-head">🎨 ธีม</div>
      <div class="chips">${[['auto', '🌗 ตามระบบ'], ['light', '☀️ สว่าง'], ['dark', '🌙 Pastel Night']].map(([v, l]) => `<button class="chip-btn ${theme === v ? 'active' : ''}" data-act="setTheme" data-v="${v}">${l}</button>`).join('')}</div>
    </div>

    <div class="card"><div class="card-head">📍 ตำแหน่งสำหรับสภาพอากาศ</div>
      <select class="sel" id="citySel">${CITIES.map((x, i) => `<option value="${i}" ${x.name === loc.name ? 'selected' : ''}>${x.name}</option>`).join('')}${CITIES.some(x => x.name === loc.name) ? '' : `<option selected>${esc(loc.name)}</option>`}</select>
      <button class="btn btn-soft btn-sm mt" data-act="useGps">📍 ใช้ GPS ตอนนี้</button>
    </div>

    <div class="card"><div class="card-head">💾 ข้อมูล</div>
      <div class="kv"><span>น้ำหอม</span><b>${store.state.perfumes.length}</b></div>
      <div class="kv"><span>บันทึกการฉีด</span><b>${store.state.wears.length}</b></div>
      <div class="kv"><span>Wishlist</span><b>${store.state.wishlist.length}</b></div>
      <div class="grid2 mt">
        <button class="btn btn-lilac btn-sm" data-act="exportJson">📤 สำรอง (JSON)</button>
        <button class="btn btn-lilac btn-sm" data-act="exportCsv">📊 Export CSV</button>
        <button class="btn btn-soft btn-sm" data-act="importJson">📥 นำเข้าไฟล์</button>
        ${isConfigured() ? '<button class="btn btn-soft btn-sm" data-act="repull">🔄 ดึงจาก Sheet ใหม่</button>' : ''}
      </div>
      <button class="btn btn-danger btn-sm btn-block mt" data-act="wipe">🧹 ล้างข้อมูลในเครื่องนี้</button>
    </div>

    ${standalone ? '' : `<div class="card"><div class="card-head">📲 ติดตั้งเป็นแอป</div>
      <div class="sec-text">${ios ? 'เปิดใน <b>Safari</b> → กดปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศร) → <b>เพิ่มไปยังหน้าจอโฮม</b>' : 'กดเมนู <b>⋮</b> ของ Chrome → <b>ติดตั้งแอป</b> หรือ <b>เพิ่มลงในหน้าจอหลัก</b>'}</div>
      <div class="hint">ติดตั้งแล้วจะเปิดได้แม้ไม่มีเน็ต และข้อมูลในเครื่องจะไม่ถูกล้างง่ายๆ</div>
      <button class="btn btn-main btn-sm mt" id="installBtn" hidden>📲 ติดตั้งเลย</button></div>`}

    <div class="center sub mt">Perfume Vault v${APP_VERSION} · ทำด้วย 💖</div>`;

  return {
    html, title: 'ตั้งค่า', back: true, parent: 'me', tab: 'me', live: false,
    mount: (root) => {
      root.querySelector('#cfg').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.target));
        const btn = root.querySelector('#cfgBtn');
        if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(fd.url.trim())) return toast('URL ต้องขึ้นต้นด้วย https://script.google.com/...');
        const old = getConfig();
        setConfig(fd); btn.disabled = true; btn.textContent = 'กำลังทดสอบ...';
        try {
          const r = await call('ping');
          toast(`✅ เชื่อมต่อสำเร็จ (API v${r.version})`);
          store.emit('net');
          await sync({ silent: false });
          go('settings?ok=' + Date.now());
        } catch (err) {
          setConfig(old); toast('❌ ' + err.message, 4000);
        } finally { btn.disabled = false; btn.textContent = '🔌 ทดสอบ & บันทึก'; }
      });
      root.querySelector('#magicBtn').addEventListener('click', async (e) => {
        const cfg = parseConnectLink(root.querySelector('#magic').value);
        if (!cfg) return toast('ลิงก์ไม่ถูกต้อง ลองคัดลอกใหม่จาก log ของ setupToken');
        e.currentTarget.disabled = true;
        if (await connectWith(cfg)) go('settings?ok=' + Date.now()); else e.currentTarget.disabled = false;
      });
      root.querySelector('#citySel').addEventListener('change', (e) => { const c2 = CITIES[Number(e.target.value)]; if (c2) { setLocation(c2); toast('📍 ' + c2.name); } });
      const ib = root.querySelector('#installBtn');
      if (ib && window.__pvInstall) { ib.hidden = false; ib.onclick = async () => { window.__pvInstall.prompt(); window.__pvInstall = null; ib.hidden = true; }; }
    }
  };
}

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__pvInstall = e; });
