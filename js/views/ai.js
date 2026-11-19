// 🧠 หน้าฟีเจอร์ AI: แชท / ก่อนซื้อ / Layering / Dupe
import * as store from '../store.js';
import { registerActions, go } from '../nav.js';
import { ai, isConfigured, isOnline } from '../api.js';
import { esc, imgTag, toast, loadingHtml, scoreRing, norm, FORMATS, money } from '../util.js';
import { buildContext } from '../analytics.js';
import { getWeather, weatherText } from '../weather.js';
import { pickPerfume } from './diary.js';

function guard() {
  if (!isConfigured()) return '<div class="card setup-card"><b>🔗 ต้องเชื่อม Google Sheet ก่อน</b><div class="sub" style="color:inherit">AI ทำงานผ่าน Apps Script ของคุณ เพื่อเก็บ API key ไว้อย่างปลอดภัย</div><a href="#/settings" class="btn btn-main btn-sm mt">ไปตั้งค่า</a></div>';
  if (!isOnline()) return '<div class="card"><b>📡 ออฟไลน์อยู่</b><div class="sub">ฟีเจอร์ AI ต้องใช้อินเทอร์เน็ต กลับมาใหม่ตอนต่อเน็ตนะ</div></div>';
  return '';
}
const metaHtml = (m) => m ? `<div class="ai-info">🤖 ${esc(m.model)}${m.tokens ? ` · ${esc(m.tokens)} tokens` : ''}${(m.sources || []).map(s => `<a href="${esc(s.uri)}" target="_blank" rel="noopener">🔗 ${esc(s.title)}</a>`).join('')}</div>` : '';
const mention = (name) => {
  const p = store.findPerfumeByName(name);
  return p ? `<a class="mention" href="#/p/${esc(p.uid)}">${imgTag(p)}${esc(p.name)}</a>` : `<span class="tag">${esc(name)}</span>`;
};

// =======================================================
//  💬 CHAT
// =======================================================
const CHAT_KEY = 'pv_chat';
let chat = (() => { try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || []; } catch (e) { return []; } })();
let thinking = false;
const saveChat = () => { chat = chat.slice(-40); try { localStorage.setItem(CHAT_KEY, JSON.stringify(chat)); } catch (e) {} };
const SUGGEST = ['วันนี้ไปทำงาน ใส่ขวดไหนดี?', 'เย็นนี้มีเดท แนะนำหน่อย 💘', 'ขวดไหนในตู้ที่ฉันลืมไปแล้ว?', 'ฉันชอบกลิ่นแนวไหน ควรซื้ออะไรต่อ?', 'ขวดไหนเหมาะกับหน้าฝนบ้าง?'];

function bubbles() {
  if (!chat.length) return `<div class="bubble ai">สวัสดี! 🫧 ฉันรู้จักตู้น้ำหอมของคุณทุกขวด ถามอะไรก็ได้เลยนะ</div>
    <div class="suggest">${SUGGEST.map(s => `<button class="chip-btn" data-act="chatSuggest" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  return chat.map(m => `<div class="bubble ${m.role === 'user' ? 'me' : 'ai'}">${esc(m.text)}${m.mentioned && m.mentioned.length ? `<div class="mentions">${m.mentioned.map(mention).join('')}</div>` : ''}</div>`).join('')
    + (thinking ? '<div class="bubble ai"><span class="typing"><i></i><i></i><i></i></span></div>' : '');
}
function redrawChat() {
  const el = document.getElementById('chatWrap'); if (!el) return;
  el.innerHTML = bubbles(); window.scrollTo(0, document.body.scrollHeight);
}
async function sendChat(text) {
  text = String(text || '').trim(); if (!text || thinking) return;
  if (guard()) { toast('ต้องออนไลน์และเชื่อม Sheet ก่อนนะ'); return; }
  chat.push({ role: 'user', text }); thinking = true; saveChat(); redrawChat();
  try {
    const wx = await getWeather();
    const r = await ai('chat', { messages: chat.map(m => ({ role: m.role, text: m.text })), context: buildContext(), weather: weatherText(wx) });
    chat.push({ role: 'model', text: r.reply || '...', mentioned: (r.mentioned || []).filter(n => store.findPerfumeByName(n)).slice(0, 6) });
  } catch (e) {
    chat.push({ role: 'model', text: '😵 ขอโทษนะ ตอนนี้ตอบไม่ได้: ' + e.message });
  } finally { thinking = false; saveChat(); redrawChat(); }
}
registerActions({
  chatSuggest: (d) => sendChat(d.q),
  chatClear: () => { chat = []; saveChat(); redrawChat(); }
});

export function renderChat() {
  const tools = `<div class="ai-tools">
      <a href="#/purchase" class="t-pink"><span>🛒</span>ก่อนซื้อ</a>
      <a href="#/layer" class="t-peach"><span>🧪</span>Layering</a>
      <a href="#/dupe" class="t-sky"><span>🔍</span>หา Dupe</a>
      <a href="#/home" class="t-lilac"><span>🎯</span>เลือกให้วันนี้</a>
    </div>`;
  const html = `${guard()}${tools}
    <div class="flex between mb"><span class="sub">💬 คุยกับผู้ช่วยที่รู้จักตู้ของคุณทุกขวด</span>${chat.length ? '<button class="btn-ghost" data-act="chatClear">🧹 ล้างแชท</button>' : ''}</div>
    <div class="chat-wrap" id="chatWrap">${bubbles()}</div>
    <form class="chat-input" id="chatForm"><input class="inp" id="chatIn" placeholder="ถามอะไรก็ได้ เช่น เดทเย็นนี้ใส่อะไรดี" autocomplete="off"><button class="btn btn-main">ส่ง</button></form>`;
  return {
    html, title: 'ผู้ช่วย AI', tab: 'ai', live: false,
    mount: (root) => {
      window.scrollTo(0, document.body.scrollHeight);
      root.querySelector('#chatForm').addEventListener('submit', (e) => {
        e.preventDefault(); const i = root.querySelector('#chatIn'); const t = i.value; i.value = ''; sendChat(t);
      });
    }
  };
}

// =======================================================
//  🛒 PURCHASE
// =======================================================
let lastPurchase = null;
function purchaseResult(r) {
  if (!r) return '';
  const owned = store.findPerfumeByName(r._q.name);
  const inWish = store.state.wishlist.some(w => norm(w.name) === norm(r._q.name) && w.status !== 'ซื้อแล้ว');
  return `<div class="card">
    <div class="flex" style="gap:14px">${scoreRing(r.matchScore)}
      <div class="grow"><div class="p-name">${esc(r._q.name)}</div><div class="p-sub">${esc(r.brand || r._q.brand)} · ${esc(r._q.format)}</div>
      <div class="tags">${r.category ? `<span class="tag sky">${esc(r.category)}</span>` : ''}${r.brandGroup ? `<span class="tag">${esc(r.brandGroup)}</span>` : ''}${r.priceRange ? `<span class="tag lemon">💰 ${esc(r.priceRange)}</span>` : ''}</div></div></div>
    ${owned ? `<div class="tip" style="background:var(--peach-soft);color:var(--peach-ink);margin-top:12px">📦 คุณมีขวดชื่อคล้ายกันในตู้แล้ว: <a href="#/p/${esc(owned.uid)}">${esc(owned.name)}</a></div>` : ''}
    <div class="notes-box mt">
      <div><span class="dot d-top"></span><b>Top:</b> ${esc(r.topNotes || '-')}</div>
      <div><span class="dot d-mid"></span><b>Heart:</b> ${esc(r.midNotes || '-')}</div>
      <div><span class="dot d-base"></span><b>Base:</b> ${esc(r.baseNotes || '-')}</div>
      ${r.longevity ? `<div>⏱️ ${esc(r.longevity)}</div>` : ''}${r.bestFor ? `<div>🌤️ ${esc(r.bestFor)}</div>` : ''}
    </div>
    <div class="sec-title">💚 จุดเด่น</div><div class="sec-text">${esc(r.pros || '-')}</div>
    <div class="sec-title">🚩 ข้อควรระวัง</div><div class="sec-text">${esc(r.redFlags || '-')}</div>
    <div class="sec-title">🗄️ กลิ่นใกล้เคียงในตู้ (${(r.similarOwned || []).length})</div>
    <div class="tags">${(r.similarOwned || []).length ? r.similarOwned.map(mention).join('') : '<span class="sec-text">ไม่ซ้ำกับขวดไหนเลย 👍</span>'}</div>
    <div class="verdict">📌 ${esc(r.finalVerdict || '-')}</div>
    ${metaHtml(r._meta)}
    <div class="row mt">
      <button class="btn btn-soft" onclick="location.hash='#/dupe?name=${encodeURIComponent(r._q.name)}&brand=${encodeURIComponent(r.brand || r._q.brand)}'">🔍 หา Dupe</button>
      <button class="btn btn-main" data-act="purchaseSave" ${inWish ? 'disabled' : ''}>${inWish ? '✔️ อยู่ใน Wishlist' : '💖 เก็บเข้า Wishlist'}</button>
    </div></div>`;
}
registerActions({
  purchaseSave: async () => {
    const r = lastPurchase; if (!r) return;
    await store.save('wishlist', {
      name: r._q.name, brand: r.brand || r._q.brand, brandGroup: r.brandGroup || '', format: r._q.format, category: r.category,
      topNotes: r.topNotes, midNotes: r.midNotes, baseNotes: r.baseNotes, status: 'ยังไม่ซื้อ',
      sourceUrl: 'https://www.google.com/search?q=' + encodeURIComponent('fragrantica ' + (r.brand || r._q.brand) + ' ' + r._q.name),
      modelUsed: r._meta ? r._meta.model : '', matchScore: r.matchScore, pros: r.pros, redFlags: r.redFlags, finalVerdict: r.finalVerdict,
      similarCount: (r.similarOwned || []).length, targetPrice: '', prices: '[]', wishNotes: r.priceRange ? 'ราคาโดยประมาณ: ' + r.priceRange : ''
    });
    toast('💖 เก็บเข้า Wishlist แล้ว');
  }
});

export function renderPurchase({ query }) {
  const html = `${guard()}
    <form class="card" id="paForm">
      <div class="sub mb">AI จะดูว่าขวดนี้เข้ากับรสนิยมคุณไหม (จากคะแนนและความถี่ที่ฉีด) และซ้ำกับขวดไหนในตู้</div>
      <label class="lbl" style="margin-top:0">ชื่อน้ำหอม *</label><input class="inp" name="name" value="${esc(query.name || (lastPurchase ? lastPurchase._q.name : ''))}" required>
      <div class="grid2">
        <div><label class="lbl">แบรนด์</label><input class="inp" name="brand" value="${esc(query.brand || (lastPurchase ? lastPurchase._q.brand : ''))}"></div>
        <div><label class="lbl">ความเข้มข้น</label><select class="sel" name="format">${FORMATS.map(f => `<option>${f}</option>`).join('')}</select></div>
      </div>
      <button class="btn btn-main btn-block mt" id="paBtn">🔍 วิเคราะห์เลย</button>
    </form>
    <div id="paOut">${purchaseResult(lastPurchase)}</div>`;
  return {
    html, title: 'ช่วยคิดก่อนซื้อ', back: true, parent: 'ai', tab: 'ai', live: false,
    mount: (root) => {
      root.querySelector('#paForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.target));
        if (guard()) { toast('ต้องออนไลน์และเชื่อม Sheet ก่อนนะ'); return; }
        const out = root.querySelector('#paOut'); const btn = root.querySelector('#paBtn');
        btn.disabled = true; out.innerHTML = loadingHtml('AI กำลังวิเคราะห์เทียบกับตู้ของคุณ...');
        try {
          const r = await ai('purchase', { ...fd, context: buildContext() });
          r._q = fd; lastPurchase = r; out.innerHTML = purchaseResult(r);
        } catch (err) { out.innerHTML = `<div class="card">😵 ${esc(err.message)}</div>`; }
        finally { btn.disabled = false; }
      });
    }
  };
}

// =======================================================
//  🧪 LAYERING
// =======================================================
let layerBase = null, layerRes = null;
function layerResult() {
  if (!layerRes) return '';
  return `<div class="card"><div class="card-head">✨ คู่ที่แนะนำ</div>
    ${(layerRes.combos || []).map(c => {
      const q = store.findPerfumeByName(c.partner);
      return `<div class="combo">
        <div class="combo-head">${imgTag(layerBase)}<span class="plus">＋</span>${q ? `<a href="#/p/${esc(q.uid)}">${imgTag(q)}</a>` : ''}<span class="grow trunc">${esc(q ? q.name : c.partner)}</span></div>
        <div class="sec-text mt">🎯 <b>วิธีฉีด:</b> ${esc(c.how)}</div>
        <div class="sec-text">🌈 <b>ได้กลิ่น:</b> ${esc(c.result)}</div>
        <div class="sec-text">💫 <b>เหมาะกับ:</b> ${esc(c.vibe)}</div>
      </div>`;
    }).join('') || '<div class="sub">AI ไม่พบคู่ที่เหมาะ</div>'}
    ${layerRes.avoid ? `<div class="tip" style="background:var(--pink-soft);color:var(--pink-ink)">🙅 ${esc(layerRes.avoid)}</div>` : ''}
    ${metaHtml(layerRes._meta)}</div>`;
}
async function runLayer() {
  const out = document.getElementById('lyOut'); if (!out || !layerBase) return;
  if (guard()) { toast('ต้องออนไลน์และเชื่อม Sheet ก่อนนะ'); return; }
  out.innerHTML = loadingHtml('กำลังผสมกลิ่นในจินตนาการ...');
  try { layerRes = await ai('layering', { base: `${layerBase.name} (${layerBase.brand || ''})`, context: buildContext({ activeOnly: true }) }); out.innerHTML = layerResult(); }
  catch (e) { out.innerHTML = `<div class="card">😵 ${esc(e.message)}</div>`; }
}
registerActions({
  layerPick: async () => { const p = await pickPerfume({ title: 'เลือกขวดหลัก' }); if (p) { layerBase = p; layerRes = null; go('layer?id=' + p.uid); } },
  layerRun: runLayer
});
export function renderLayer({ query }) {
  if (query.id && (!layerBase || layerBase.uid !== query.id)) { layerBase = store.perfume(query.id); layerRes = null; }
  const html = `${guard()}
    <div class="card">
      <div class="sub mb">เลือกขวดหลัก แล้ว AI จะหาขวดในตู้ที่ฉีดซ้อนแล้วเข้ากัน 🧪</div>
      ${layerBase ? `<div class="wear-row" style="box-shadow:none;background:var(--soft)" data-act="layerPick">${imgTag(layerBase)}<div class="grow"><b>${esc(layerBase.name)}</b><div class="sub">${esc(layerBase.brand || '')} · แตะเพื่อเปลี่ยน</div></div></div>
        <button class="btn btn-main btn-block mt" data-act="layerRun">✨ หาคู่ Layering</button>`
      : `<button class="btn btn-main btn-block" data-act="layerPick">เลือกขวดหลัก</button>`}
    </div><div id="lyOut">${layerResult()}</div>`;
  return { html, title: 'Layering', back: true, parent: 'ai', tab: 'ai', live: false };
}

// =======================================================
//  🔍 DUPE
// =======================================================
let dupeRes = null;
function dupeResult() {
  if (!dupeRes) return '';
  const r = dupeRes;
  return `<div class="card"><div class="card-head">🛍️ ตัวแทนในตลาด</div>
    ${(r.market || []).map(m => `<div class="combo"><div class="flex between"><b>${esc(m.name)}</b><span class="tag mint">${esc(m.similarity || '?')}%</span></div>
      <div class="sub">${esc(m.brand || '')}${m.priceNote ? ' · ' + esc(m.priceNote) : ''}</div>
      <div class="sim-bar"><i style="width:${Number(m.similarity) || 0}%"></i></div>
      ${m.note ? `<div class="sec-text mt">${esc(m.note)}</div>` : ''}
      <button class="btn btn-sm btn-lilac mt" onclick="location.hash='#/purchase?name=${encodeURIComponent(m.name)}&brand=${encodeURIComponent(m.brand || '')}'">🛒 วิเคราะห์ก่อนซื้อ</button></div>`).join('') || '<div class="sub">ไม่พบ</div>'}
    <div class="card-head mt">🗄️ ในตู้ของคุณ</div>
    ${(r.inCollection || []).filter(x => store.findPerfumeByName(x.name)).map(x => `<div class="combo"><div class="flex between">${mention(x.name)}<span class="tag mint">${esc(x.similarity || '?')}%</span></div>${x.note ? `<div class="sec-text mt">${esc(x.note)}</div>` : ''}</div>`).join('') || '<div class="sub">ไม่มีขวดที่ใกล้เคียงในตู้</div>'}
    ${metaHtml(r._meta)}</div>`;
}
export function renderDupe({ query }) {
  const base = query.id ? store.perfume(query.id) : null;
  const name = base ? base.name : (query.name || ''), brand = base ? base.brand : (query.brand || '');
  const html = `${guard()}
    <form class="card" id="dpForm">
      <div class="sub mb">หาน้ำหอมกลิ่นคล้ายที่ราคาถูกกว่า หรือขวดในตู้ที่ใช้แทนได้</div>
      <label class="lbl" style="margin-top:0">ชื่อน้ำหอมต้นฉบับ *</label><input class="inp" name="name" value="${esc(name)}" required>
      <label class="lbl">แบรนด์</label><input class="inp" name="brand" value="${esc(brand)}">
      <button class="btn btn-main btn-block mt" id="dpBtn">🔍 หา Dupe</button>
    </form><div id="dpOut">${dupeResult()}</div>`;
  return {
    html, title: 'หา Dupe', back: true, parent: 'ai', tab: 'ai', live: false,
    mount: (root) => {
      root.querySelector('#dpForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (guard()) { toast('ต้องออนไลน์และเชื่อม Sheet ก่อนนะ'); return; }
        const fd = Object.fromEntries(new FormData(e.target));
        const out = root.querySelector('#dpOut'); out.innerHTML = loadingHtml('กำลังตามหาฝาแฝดกลิ่น...');
        try { dupeRes = await ai('dupe', { ...fd, context: buildContext() }); out.innerHTML = dupeResult(); }
        catch (err) { out.innerHTML = `<div class="card">😵 ${esc(err.message)}</div>`; }
      });
    }
  };
}
