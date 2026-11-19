// 👤 ของฉัน — โปรไฟล์ + ทางลัดไปทุกอย่างที่เกี่ยวกับตัวเรา
import * as store from '../store.js';
import { isConfigured } from '../api.js';
import { esc, money, num, statusKey } from '../util.js';
import { dna, streak, badges, heatmap } from '../analytics.js';
import { heatmapHtml } from '../charts.js';

export function render() {
  const P = store.state.perfumes, W = store.state.wears;
  const d = dna();
  const B = badges(); const done = B.filter(b => b.done).length;
  const wish = store.state.wishlist.filter(w => w.status !== 'ซื้อแล้ว').length;
  const ym = new Date().toISOString().slice(0, 7);
  const row = (href, e, title, sub, cls = '') => `<a class="menu-row" href="${href}"><span class="menu-ic ${cls}">${e}</span><span class="grow"><b>${title}</b><small>${sub}</small></span><span class="chev">›</span></a>`;

  const html = `
    <div class="me-head">
      <div class="me-emoji">${d.title.e}</div>
      <div class="me-title">${esc(d.title.name)}</div>
      <div class="sub">${esc(d.title.sub)}</div>
      <div class="me-stats">
        <div><b>${P.length}</b><small>ขวด</small></div>
        <div><b>${W.length}</b><small>ครั้งที่ฉีด</small></div>
        <div><b>${streak()}🔥</b><small>วันติดกัน</small></div>
        <div><b>${done}/${B.length}</b><small>เหรียญ</small></div>
      </div>
    </div>

    <a class="card" href="#/diary" style="display:block;text-decoration:none;color:inherit">
      <div class="card-head">📔 สมุดบันทึกการฉีด <span class="sub">${W.filter(w => String(w.date).startsWith(ym)).length} ครั้งเดือนนี้ ›</span></div>
      ${heatmapHtml(heatmap(16))}
    </a>

    <div class="menu">
      ${row('#/wishlist', '💖', 'Wishlist', `${wish} รายการที่เล็งไว้ · ราคาเป้าหมาย`, 't-pink')}
      ${row('#/dna', '🧬', 'DNA กลิ่นของฉัน', 'เรดาร์สายกลิ่น + โน้ตที่หลงรัก', 't-lilac')}
      ${row('#/stats', '📈', 'สถิติ & งบ', 'ใช้เงินไปเท่าไหร่ ขวดไหนคุ้มสุด', 't-lemon')}
      ${row('#/wrapped', '🎁', `Wrapped ${new Date().getFullYear()}`, 'สรุปทั้งปีแบบสตอรี่ แชร์ลง IG ได้', 't-peach')}
      ${row('#/badges', '🏅', 'เหรียญรางวัล', `ปลดล็อกแล้ว ${done} จาก ${B.length}`, 't-mint')}
    </div>
    <div class="section-label">🧰 เครื่องมือ</div>
    <div class="menu">
      ${row('#/travel', '✈️', 'จัดกระเป๋าไปเที่ยว', 'ดูอากาศปลายทาง แล้วเลือกขวดให้', 't-sky')}
      ${row('#/season', '🍂', 'สลับขวดตามฤดู', 'ขวดไหนควรเอาออกมา ขวดไหนพักไว้', 't-peach')}
      ${row('#/dutyfree', '🛫', 'โหมดดิวตี้ฟรี', 'เช็คซ้ำ แปลงราคา เทียบราคาต่อ ml', 't-lemon')}
      ${row('#/map', '🗺️', 'แผนที่กลิ่น', 'ดูทั้งตู้บนแผนที่ สายไหนเยอะ สายไหนขาด', 't-lilac')}
      ${row('#/testers', '🧫', 'สมุดเทสเตอร์', `${store.state.testers.length} ขวดที่เคยลอง`, 't-mint')}
    </div>
    <div class="menu">
      ${row('#/settings', '⚙️', 'ตั้งค่า', isConfigured() ? 'เชื่อม Google Sheet แล้ว · ธีม · สำรองข้อมูล' : '⚠️ ยังไม่ได้เชื่อม Google Sheet', 't-sky')}
      ${row('#/welcome', '🌷', 'ดูวิธีใช้อีกครั้ง', 'ทัวร์แอปสั้นๆ 30 วินาที', '')}
    </div>`;
  return { html, title: 'ของฉัน', tab: 'me' };
}
