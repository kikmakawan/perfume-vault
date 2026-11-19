// 🎉 ลูกเล่นเล็กๆ: สั่น, คอนเฟตตี, ปลดล็อกเหรียญ
import { badges } from './analytics.js';
import { esc, openSheet } from './util.js';

export function haptic(pattern = 12) { try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {} }

export function confetti({ count = 36, emojis = ['💖', '✨', '🫧', '🌸', '💜', '⭐'] } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.textContent = emojis[i % emojis.length];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.fontSize = (14 + Math.random() * 16) + 'px';
    s.style.animationDelay = (Math.random() * 0.35) + 's';
    s.style.animationDuration = (1.4 + Math.random() * 1.2) + 's';
    s.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
    s.style.setProperty('--rot', (Math.random() * 540 - 270) + 'deg');
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3200);
}

export const celebrate = () => { haptic([10, 40, 10]); confetti(); };

// ตรวจเหรียญใหม่ (ครั้งแรกแค่จำไว้ ไม่ฉลอง)
let ready = false;
export function checkBadges() {
  const done = badges().filter(b => b.done);
  let seen;
  try { seen = JSON.parse(localStorage.getItem('pv_badges_seen')); } catch (e) {}
  const ids = done.map(b => b.id);
  if (!seen) { localStorage.setItem('pv_badges_seen', JSON.stringify(ids)); ready = true; return; }
  const fresh = done.filter(b => !seen.includes(b.id));
  localStorage.setItem('pv_badges_seen', JSON.stringify(ids));
  if (!ready) { ready = true; if (!fresh.length) return; }
  if (!fresh.length) return;
  celebrate();
  const b = fresh[0];
  openSheet(`<div class="e" style="font-size:3.6rem">${b.e}</div><h3>ปลดล็อกเหรียญใหม่!</h3>
    <div style="font-family:Mali;font-size:1.2rem;margin:4px 0">${esc(b.title)}</div><div class="sub">${esc(b.desc)}</div>
    <div class="btns"><a class="btn btn-soft" href="#/badges" data-close>ดูทั้งหมด</a><button class="btn btn-main" data-close>เย้! 🎉</button></div>`, { dialog: true });
}
