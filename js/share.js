// สร้างรูปการ์ดสวยๆ ไว้แชร์ IG Story / ส่งเพื่อน
import { toast, money, num, stars, thMonth, occLabel } from './util.js';
import { AXES } from './analytics.js';

const FONT_H = 'Mali, Prompt, sans-serif', FONT_B = 'Prompt, sans-serif';

async function ensureFonts() {
  try { await Promise.all(['700 60px Mali', '500 40px Prompt', '400 30px Prompt'].map(f => document.fonts.load(f))); } catch (e) {}
}

function canvas(w, h, grad = ['#FFA9CB', '#C4AEFF']) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, grad[0]); g.addColorStop(1, grad[1]);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // ฟองสบู่ตกแต่ง
  x.fillStyle = 'rgba(255,255,255,.14)';
  [[.12, .08, .16], [.92, .2, .1], [.85, .9, .2], [.05, .75, .08]].forEach(([a, b, r]) => { x.beginPath(); x.arc(w * a, h * b, w * r, 0, Math.PI * 2); x.fill(); });
  return { c, x };
}
function sparkle(x, cx, cy, r) {
  x.beginPath();
  x.moveTo(cx, cy - r); x.quadraticCurveTo(cx, cy, cx + r, cy); x.quadraticCurveTo(cx, cy, cx, cy + r);
  x.quadraticCurveTo(cx, cy, cx - r, cy); x.quadraticCurveTo(cx, cy, cx, cy - r); x.fill();
}
function wrapText(x, text, maxW) {
  const words = String(text || '').split(/(\s+|,\s*)/); const lines = []; let line = '';
  words.forEach(w => {
    const t = line + w;
    if (x.measureText(t).width > maxW && line) { lines.push(line.trim()); line = w.trimStart(); } else line = t;
  });
  if (line.trim()) lines.push(line.trim());
  // ภาษาไทยไม่มีช่องว่าง: ตัดตามตัวอักษรถ้ายาวเกิน
  return lines.flatMap(l => {
    if (x.measureText(l).width <= maxW) return [l];
    const out = []; let cur = '';
    [...l].forEach(ch => { if (x.measureText(cur + ch).width > maxW) { out.push(cur); cur = ch; } else cur += ch; });
    if (cur) out.push(cur); return out;
  });
}
function card(x, X, Y, W, H, r = 40, fill = 'rgba(255,255,255,.92)') {
  x.fillStyle = fill; x.beginPath(); x.roundRect(X, Y, W, H, r); x.fill();
}
function text(x, t, X, Y, { size = 40, weight = 400, color = '#4A3F5C', font = FONT_B, align = 'left', maxW } = {}) {
  x.font = `${weight} ${size}px ${font}`; x.fillStyle = color; x.textAlign = align; x.textBaseline = 'alphabetic';
  if (maxW) { const lines = wrapText(x, t, maxW); lines.forEach((l, i) => x.fillText(l, X, Y + i * size * 1.3)); return lines.length * size * 1.3; }
  x.fillText(t, X, Y); return size * 1.3;
}
function footer(x, w, h) {
  text(x, '🫧 Perfume Vault', w / 2, h - 60, { size: 30, weight: 500, color: 'rgba(255,255,255,.95)', align: 'center' });
}

export async function shareCanvas(c, filename, title = 'Perfume Vault') {
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], filename, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('บันทึกรูปแล้ว 📸');
}

// ---------- การ์ดขวดเดียว ----------
export async function perfumeCard(p, s) {
  await ensureFonts();
  const W = 1080, H = 1350; const { c, x } = canvas(W, H);
  x.fillStyle = '#fff'; sparkle(x, 930, 140, 50); sparkle(x, 150, 230, 26);
  text(x, 'ขวดโปรดของฉัน ✨', W / 2, 150, { size: 44, weight: 500, color: '#fff', align: 'center' });
  card(x, 80, 210, W - 160, 950);
  let y = 330;
  y += text(x, p.name, W / 2, y, { size: 76, weight: 700, font: FONT_H, align: 'center', maxW: W - 260 });
  text(x, `${p.brand || ''}${p.format ? ' · ' + p.format : ''}`, W / 2, y + 10, { size: 40, color: '#9A8FAE', align: 'center' }); y += 70;
  if (p.rating) { text(x, stars(p.rating), W / 2, y + 20, { size: 56, color: '#F5B83D', align: 'center' }); y += 80; }
  const rows = [['TOP', p.topNotes, '#E3F1FF'], ['HEART', p.midNotes, '#FFE6F0'], ['BASE', p.baseNotes, '#FFEDE2']].filter(r => r[1]);
  rows.forEach(([lab, val, bg]) => {
    x.font = `400 34px ${FONT_B}`; const lines = wrapText(x, val, W - 380).slice(0, 2);
    const hh = 60 + lines.length * 44;
    card(x, 140, y, W - 280, hh, 28, bg);
    text(x, lab, 180, y + 46, { size: 26, weight: 600, color: '#9A8FAE' });
    lines.forEach((l, i) => text(x, l, 180, y + 92 + i * 44, { size: 34 }));
    y += hh + 18;
  });
  if (s && s.wears) text(x, `ฉีดไปแล้ว ${s.wears} ครั้ง${s.compliments ? ` · ได้คำชม ${s.compliments} ครั้ง` : ''}`, W / 2, 1120, { size: 34, color: '#7A62D6', weight: 500, align: 'center' });
  footer(x, W, H);
  return shareCanvas(c, 'perfume.png', p.name);
}

// ---------- DNA ----------
export async function dnaCard(d) {
  await ensureFonts();
  const W = 1080, H = 1920; const { c, x } = canvas(W, H, ['#FFB3D1', '#B9A3F5']);
  text(x, 'DNA กลิ่นของฉัน', W / 2, 220, { size: 64, weight: 700, font: FONT_H, color: '#fff', align: 'center' });
  card(x, 90, 300, W - 180, 1380);
  text(x, d.title.e, W / 2, 470, { size: 110, align: 'center' });
  text(x, d.title.name, W / 2, 590, { size: 62, weight: 700, font: FONT_H, align: 'center', maxW: W - 260 });
  text(x, d.title.sub, W / 2, 680, { size: 36, color: '#9A8FAE', align: 'center', maxW: W - 260 });
  // radar
  const cx = W / 2, cy = 1050, R = 280, n = d.axes.length;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  x.strokeStyle = '#EDE4FA'; x.lineWidth = 3;
  [0.33, 0.66, 1].forEach(f => { x.beginPath(); d.axes.forEach((_, i) => { const [a, b] = pt(i, R * f); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); x.stroke(); });
  const g = x.createLinearGradient(cx - R, cy - R, cx + R, cy + R); g.addColorStop(0, 'rgba(255,169,203,.8)'); g.addColorStop(1, 'rgba(196,174,255,.8)');
  x.fillStyle = g; x.beginPath(); d.axes.forEach((a, i) => { const [p, q] = pt(i, R * Math.max(a.v, 4) / 100); i ? x.lineTo(p, q) : x.moveTo(p, q); }); x.closePath(); x.fill();
  d.axes.forEach((a, i) => { const [p, q] = pt(i, R + 70); text(x, a.e, p, q, { size: 46, align: 'center' }); text(x, a.th.split('/')[0], p, q + 40, { size: 26, color: '#9A8FAE', align: 'center' }); });
  text(x, 'โน้ตที่หลงรัก: ' + d.notes.slice(0, 5).map(n => n.name).join(', '), W / 2, 1520, { size: 34, align: 'center', maxW: W - 280, color: '#7A62D6', weight: 500 });
  footer(x, W, H);
  return shareCanvas(c, 'scent-dna.png', 'DNA กลิ่นของฉัน');
}

// ---------- Wrapped ----------
export async function wrappedCard(r) {
  await ensureFonts();
  const W = 1080, H = 1920; const { c, x } = canvas(W, H, ['#FFA9CB', '#A9CFFF']);
  x.fillStyle = '#fff'; sparkle(x, 900, 160, 60); sparkle(x, 170, 300, 30);
  text(x, `Perfume Wrapped ${r.year}`, W / 2, 230, { size: 66, weight: 700, font: FONT_H, color: '#fff', align: 'center' });
  card(x, 80, 300, W - 160, 1440);
  text(x, String(r.wears), 260, 500, { size: 130, weight: 700, font: FONT_H, color: '#E0608F', align: 'center' });
  text(x, 'ครั้งที่ฉีด', 260, 560, { size: 34, color: '#9A8FAE', align: 'center' });
  text(x, String(r.days), 820, 500, { size: 130, weight: 700, font: FONT_H, color: '#7A62D6', align: 'center' });
  text(x, 'วันที่หอม', 820, 560, { size: 34, color: '#9A8FAE', align: 'center' });
  text(x, '🏆 Top 5 ประจำปี', 160, 700, { size: 44, weight: 700, font: FONT_H });
  r.top.slice(0, 5).forEach((t, i) => {
    const y = 790 + i * 92;
    card(x, 150, y - 58, W - 300, 78, 24, i === 0 ? '#FFE6F0' : '#F7F3FB');
    text(x, `${i + 1}. ${t.name}`, 185, y - 6, { size: 38, weight: i === 0 ? 600 : 400, maxW: 640 });
    text(x, `${t.n} ครั้ง`, W - 185, y - 6, { size: 34, color: '#9A8FAE', align: 'right' });
  });
  let y = 1310;
  const facts = [
    r.mostCompl ? `🥰 ขวดที่ได้คำชมเยอะสุด: ${r.mostCompl.name}` : null,
    r.favOcc ? `🎭 โอกาสที่ฉีดบ่อยสุด: ${occLabel(r.favOcc)}` : null,
    r.bought ? `🛍️ ขวดใหม่ปีนี้ ${r.bought} ขวด (${money(r.spend)} ฿)` : null,
    `🧬 สายกลิ่น: ${r.dna.title.name}`,
    r.streak ? `🔥 ฉีดติดกันนานสุด ${r.streak} วัน` : null
  ].filter(Boolean);
  facts.forEach(f => { y += text(x, f, 160, y, { size: 34, maxW: W - 320 }) + 6; });
  footer(x, W, H);
  return shareCanvas(c, `wrapped-${r.year}.png`, 'Perfume Wrapped');
}

// ---------- ตู้ของฉัน ----------
export async function vaultCard({ total, brands, value, top, persona }) {
  await ensureFonts();
  const W = 1080, H = 1920; const { c, x } = canvas(W, H, ['#C4AEFF', '#FFA9CB']);
  text(x, 'ตู้น้ำหอมของฉัน 🧴', W / 2, 230, { size: 64, weight: 700, font: FONT_H, color: '#fff', align: 'center' });
  card(x, 80, 300, W - 160, 1440);
  [[total, 'ขวด', 250, '#E0608F'], [brands, 'แบรนด์', 540, '#7A62D6'], [value >= 1000 ? Math.round(value / 1000) + 'k' : value, 'บาท', 830, '#2E9C77']].forEach(([v, l, X, col]) => {
    text(x, String(v), X, 500, { size: 100, weight: 700, font: FONT_H, color: col, align: 'center' });
    text(x, l, X, 560, { size: 34, color: '#9A8FAE', align: 'center' });
  });
  text(x, persona.e + ' ' + persona.name, W / 2, 700, { size: 48, weight: 700, font: FONT_H, align: 'center', maxW: W - 260 });
  text(x, '💖 ขวดเด่นในตู้', 160, 860, { size: 42, weight: 700, font: FONT_H });
  top.slice(0, 6).forEach((p, i) => {
    const y = 950 + i * 104;
    card(x, 150, y - 64, W - 300, 88, 26, ['#FFE6F0', '#EFE9FF', '#DDF7EE', '#E3F1FF', '#FFEDE2', '#FFF7D6'][i]);
    text(x, p.name, 185, y - 8, { size: 38, weight: 600, maxW: 560 });
    text(x, p.brand || '', W - 185, y - 8, { size: 30, color: '#9A8FAE', align: 'right' });
  });
  footer(x, W, H);
  return shareCanvas(c, 'my-vault.png', 'ตู้น้ำหอมของฉัน');
}
