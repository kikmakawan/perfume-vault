// 🌷 หน้าต้อนรับ + เชื่อมต่อด้วยลิงก์เดียว
import * as store from '../store.js';
import { registerActions, go } from '../nav.js';
import { getConfig, setConfig, call, isConfigured } from '../api.js';
import { sync } from '../sync.js';
import { esc, toast } from '../util.js';
import { celebrate } from '../fx.js';

/** แยก URL + token จากลิงก์เชื่อมต่อ (…#/connect?u=…&t=…) */
export function parseConnectLink(text) {
  const s = String(text || '').trim();
  const m = s.match(/[?&]u=([^&\s]+)/), t = s.match(/[?&]t=([^&\s]+)/);
  if (!m || !t) return null;
  return { url: decodeURIComponent(m[1]), token: decodeURIComponent(t[1]) };
}

export async function connectWith({ url, token }) {
  const old = getConfig();
  setConfig({ url, token });
  try {
    await call('ping');
    store.emit('net');
    toast('✅ เชื่อมกับ Google Sheet แล้ว กำลังดึงข้อมูล...', 3000);
    celebrate();
    await sync({ silent: false });
    return true;
  } catch (e) {
    setConfig(old);
    toast('❌ เชื่อมไม่สำเร็จ: ' + e.message, 4500);
    return false;
  }
}

let step = 0;
registerActions({
  wNextStep: () => { step++; go('welcome?s=' + step); },
  wSkip: () => { localStorage.setItem('pv_welcomed', '1'); go('home'); },
  wDone: () => { localStorage.setItem('pv_welcomed', '1'); celebrate(); go('home'); }
});

const STEPS = [
  { e: '🫧', t: 'ยินดีต้อนรับสู่ Perfume Vault', d: 'ตู้น้ำหอมส่วนตัวของคุณ บันทึกทุกขวด รู้ว่าฉีดอะไรไปบ้าง และมีผู้ช่วย AI ช่วยเลือกให้ทุกวัน',
    pts: ['📸 ถ่ายรูปขวด แล้ว AI กรอกข้อมูลให้', '💖 แตะครั้งเดียวเพื่อบันทึกว่าวันนี้ฉีดขวดไหน', '🌤️ แนะนำขวดตามอากาศและโอกาส', '✈️ ใช้ได้แม้ไม่มีเน็ต'] },
  { e: '🔗', t: 'เชื่อมกับ Google Sheet', d: 'ข้อมูลจะสำรองไว้ในชีตของคุณ และเปิดใช้ฟีเจอร์ AI', connect: true },
  { e: '📲', t: 'ติดตั้งลงหน้าจอ', d: '', install: true }
];

export function render({ query }) {
  step = Math.min(Number(query.s) || 0, STEPS.length - 1);
  const s = STEPS[step];
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const last = step === STEPS.length - 1;

  let body = '';
  if (s.pts) body = `<div class="welcome-pts">${s.pts.map(x => `<div>${x}</div>`).join('')}</div>`;
  if (s.connect) body = isConfigured()
    ? `<div class="card center"><div style="font-size:2rem">✅</div><b>เชื่อมแล้ว</b><div class="sub">ข้อมูลจะซิงค์อัตโนมัติ</div></div>`
    : `<div class="card">
        <b>วิธีที่ง่ายที่สุด: วางลิงก์เชื่อมต่อ</b>
        <div class="sub">ใน Apps Script ให้รันฟังก์ชัน <code>setupToken</code> แล้วคัดลอก "ลิงก์เชื่อมต่อ" จาก log มาวางที่นี่ (หรือส่งลิงก์เข้าไลน์ตัวเอง แล้วกดเปิดบนมือถือได้เลย)</div>
        <textarea class="inp mt" id="cLink" rows="3" placeholder="https://kikmakawan.github.io/perfume-vault/#/connect?u=...&t=..."></textarea>
        <button class="btn btn-main btn-block mt" id="cBtn">🔌 เชื่อมต่อ</button>
        <div class="hint center">ยังไม่พร้อม? ข้ามไปก่อนได้ แอปใช้แบบเก็บในเครื่องได้เต็มที่</div>
      </div>`;
  if (s.install) body = standalone
    ? `<div class="card center"><div style="font-size:2rem">🎉</div><b>ติดตั้งเรียบร้อยแล้ว</b></div>`
    : `<div class="card"><div class="welcome-pts">${ios
      ? '<div>1️⃣ เปิดลิงก์นี้ใน <b>Safari</b></div><div>2️⃣ กดปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรขึ้น)</div><div>3️⃣ เลือก <b>เพิ่มไปยังหน้าจอโฮม</b></div>'
      : '<div>1️⃣ กดเมนู <b>⋮</b> มุมขวาบนของ Chrome</div><div>2️⃣ เลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มลงในหน้าจอหลัก</b></div>'}</div>
      <div class="hint">ติดตั้งแล้วจะเปิดได้แม้ไม่มีเน็ต เหมือนแอปทั่วไป</div></div>`;

  const html = `<div class="welcome">
    <div class="dots-step">${STEPS.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="welcome-e">${s.e}</div>
    <div class="page-title center" style="margin:8px 0 6px">${esc(s.t)}</div>
    ${s.d ? `<div class="sub center mb">${esc(s.d)}</div>` : ''}
    ${body}
    <div class="row mt">
      ${last ? '' : '<button class="btn btn-soft" data-act="wSkip">ข้าม</button>'}
      <button class="btn btn-main" data-act="${last ? 'wDone' : 'wNextStep'}">${last ? 'เริ่มใช้งาน 🎉' : 'ต่อไป →'}</button>
    </div>
  </div>`;

  return {
    html, title: 'Perfume Vault', tab: 'none', live: false,
    mount: (root) => {
      const b = root.querySelector('#cBtn');
      if (b) b.addEventListener('click', async () => {
        const cfg = parseConnectLink(root.querySelector('#cLink').value);
        if (!cfg) return toast('ลิงก์ไม่ถูกต้อง ลองคัดลอกใหม่จาก log ของ setupToken');
        b.disabled = true; b.textContent = 'กำลังเชื่อมต่อ...';
        if (await connectWith(cfg)) { step++; go('welcome?s=' + step); }
        else { b.disabled = false; b.textContent = '🔌 เชื่อมต่อ'; }
      });
    }
  };
}
