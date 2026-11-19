// Perfume Vault 2.0 — ตัวหลักของแอป (router + header + service worker)
import * as store from './store.js';
import { initSync, sync, syncState } from './sync.js';
import { isConfigured, isOnline } from './api.js';
import { $, $$, timeAgo, closeAllSheets, toast } from './util.js';
import { actions, registerActions, go, goBack } from './nav.js';

import * as home from './views/home.js';
import * as vault from './views/vault.js';
import * as detail from './views/detail.js';
import * as form from './views/form.js';
import * as diary from './views/diary.js';
import * as aiv from './views/ai.js';
import * as wish from './views/wishlist.js';
import * as insights from './views/insights.js';
import * as settings from './views/settings.js';
import * as me from './views/me.js';
import * as welcome from './views/welcome.js';
import * as tools from './views/tools.js';
import * as testers from './views/testers.js';
import { runEnrich } from './enrich.js';
import { checkBadges } from './fx.js';

const ROUTES = [
  ['home', home.render], ['vault', vault.render], ['p/:id', detail.render],
  ['add', form.render], ['edit/:id', form.render],
  ['diary', diary.render], ['more', me.render], ['me', me.render], ['welcome', welcome.render],
  ['ai', aiv.renderChat], ['chat', aiv.renderChat], ['purchase', aiv.renderPurchase], ['layer', aiv.renderLayer], ['dupe', aiv.renderDupe],
  ['wishlist', wish.render], ['wish/:id', wish.renderOne],
  ['dna', insights.renderDna], ['stats', insights.renderStats], ['wrapped', insights.renderWrapped], ['badges', insights.renderBadges],
  ['settings', settings.render],
  ['travel', tools.renderTravel], ['season', tools.renderSeason], ['dutyfree', tools.renderDutyFree], ['map', tools.renderMap], ['testers', testers.render]
];

// ---------- actions (data-act) ----------
registerActions({
  sync: () => sync({ silent: false }),
  back: () => goBack()
});
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); e.stopPropagation(); fn(el.dataset, el, e); }
});

// ---------- router ----------
let current = null;
function parseHash() {
  const raw = (location.hash || '#/home').slice(2);
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const [pat, fn] of ROUTES) {
    const pp = pat.split('/'), hp = path.split('/');
    if (pp.length !== hp.length) continue;
    const params = {}; let ok = true;
    pp.forEach((seg, i) => { if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(hp[i]); else if (seg !== hp[i]) ok = false; });
    if (ok) return { name: pat, path, params, query, fn };
  }
  return { name: 'home', path: 'home', params: {}, query: {}, fn: home.render };
}


async function render({ keepScroll = false } = {}) {
  const r = parseHash();
  const y = window.scrollY;
  if (current && current.unmount) try { current.unmount(); } catch (e) {}
  closeAllSheets();
  const view = await r.fn({ params: r.params, query: r.query });
  current = { ...view, route: r };
  const root = $('#view');
  root.innerHTML = view.html;
  root.classList.remove('view-enter'); void root.offsetWidth; if (!keepScroll) root.classList.add('view-enter');
  $('#pageTitle').textContent = view.title || 'Perfume Vault';
  $('#backBtn').hidden = !view.back;
  $('#brand .logo').hidden = !!view.back;
  const tab = view.tab || r.name.split('/')[0];
  $$('.nav-btn').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  if (view.mount) await view.mount(root);
  window.scrollTo(0, keepScroll ? y : 0);
}

// กันออกจากหน้าที่ยังไม่ได้บันทึก (หน้าที่มี canLeave)
let lastHash = location.hash, skipGuard = false;
window.addEventListener('hashchange', async () => {
  if (skipGuard) { skipGuard = false; lastHash = location.hash; return; }
  if (current && current.canLeave && !(await current.canLeave())) { skipGuard = true; location.hash = lastHash; return; }
  lastHash = location.hash;
  sessionStorage.setItem('pv_nav', '1'); render();
});
$('#backBtn').addEventListener('click', () => goBack(current && current.parent || 'home'));

// วาดใหม่เมื่อข้อมูลเปลี่ยน (เฉพาะหน้าที่ไม่มีฟอร์มให้พิมพ์)
let rerenderT;
const badgeCheck = (() => { let t; return () => { clearTimeout(t); t = setTimeout(checkBadges, 900); }; })();
store.subscribe((what) => {
  updateHeader();
  if (['perfumes', 'wears', 'wishlist', 'testers'].includes(what)) badgeCheck();
  if (['outbox', 'sync', 'net'].includes(what)) { if (current && current.liveSync) scheduleRerender(); return; }
  if (current && current.live !== false) scheduleRerender();
});
function scheduleRerender() { clearTimeout(rerenderT); rerenderT = setTimeout(() => render({ keepScroll: true }), 60); }

// ---------- header ----------
export function updateHeader() {
  const chip = $('#netChip');
  const configured = isConfigured();
  if (!configured) { chip.textContent = '● ในเครื่อง'; chip.className = 'net-chip local'; }
  else if (!isOnline()) { chip.textContent = '● ออฟไลน์'; chip.className = 'net-chip offline'; }
  else { chip.textContent = '● ออนไลน์'; chip.className = 'net-chip'; }
  $('#syncBtn').classList.toggle('spinning', syncState.syncing);
  const n = store.state.outboxCount;
  $('#syncBadge').textContent = n; $('#syncBadge').hidden = !n || !configured;
  $('#syncInfo').textContent = !configured ? 'โหมดในเครื่อง · ยังไม่ได้เชื่อม Sheet'
    : syncState.syncing ? 'กำลังซิงค์...'
    : syncState.lastError ? 'ซิงค์ไม่สำเร็จ · แตะ ⟳ เพื่อลองใหม่'
    : n ? `รอซิงค์ ${n} รายการ · ${timeAgo(syncState.lastSync)}`
    : `ซิงค์ล่าสุด ${timeAgo(syncState.lastSync)}`;
}
setInterval(updateHeader, 60000);

// ---------- service worker ----------
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.update().catch(() => {});
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(nw);
      });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}
function showUpdateBar(worker) {
  const bar = document.createElement('div');
  bar.className = 'update-bar';
  bar.innerHTML = '✨ มีเวอร์ชันใหม่ <button>อัปเดต</button>';
  bar.querySelector('button').onclick = () => worker.postMessage('skipWaiting');
  document.body.appendChild(bar);
}

document.addEventListener('pv-toast', (e) => toast(e.detail, 3500));

// ---------- start ----------
(async function start() {
  if (!location.hash) history.replaceState(null, '', '#/home');
  await store.load();
  await initSync();
  updateHeader();

  // ลิงก์เชื่อมต่อแบบแตะเดียว: …/#/connect?u=<exec url>&t=<token>
  let connected = false;
  if (location.hash.startsWith('#/connect')) {
    const cfg = welcome.parseConnectLink(location.hash);
    history.replaceState(null, '', '#/home');
    if (cfg) { localStorage.setItem('pv_welcomed', '1'); connected = await welcome.connectWith(cfg); }
  } else if (!localStorage.getItem('pv_welcomed') && !store.state.perfumes.length && !isConfigured()) {
    history.replaceState(null, '', '#/welcome');
  }

  await render();
  registerSW();
  if (!connected) await sync();
  runEnrich();
  checkBadges();
  window.addEventListener('online', () => setTimeout(runEnrich, 2500));
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
