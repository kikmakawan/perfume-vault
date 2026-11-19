// ✨ ศูนย์รวม AI และเครื่องมืออื่นๆ
import * as store from '../store.js';
import { isConfigured } from '../api.js';

export function render() {
  const wish = store.state.wishlist.filter(w => w.status !== 'ซื้อแล้ว').length;
  const html = `
    <div class="section-label" style="margin-top:4px">🧠 ผู้ช่วย AI ${isConfigured() ? '' : '<span class="tag lemon">ต้องเชื่อม Sheet ก่อน</span>'}</div>
    <div class="hub">
      <a href="#/chat" class="wide t-lilac"><span class="e">💬</span><div><b>คุยกับตู้น้ำหอม</b><small>ถามได้ทุกเรื่อง เช่น "ไปงานแต่งเย็นนี้ ใส่ขวดไหนดี?"</small></div></a>
      <a href="#/purchase" class="t-pink"><span class="e">🛒</span><div><b>ช่วยคิดก่อนซื้อ</b><small>เข้ากับตู้ไหม ซ้ำไหม</small></div></a>
      <a href="#/layer" class="t-peach"><span class="e">🧪</span><div><b>Layering</b><small>จับคู่ฉีดซ้อน</small></div></a>
      <a href="#/dupe" class="t-sky"><span class="e">🔍</span><div><b>หา Dupe</b><small>ตัวแทนราคาประหยัด</small></div></a>
      <a href="#/wishlist" class="t-mint"><span class="e">💖</span><div><b>Wishlist</b><small>${wish} รายการ · ราคาเป้าหมาย</small></div></a>
    </div>

    <div class="section-label">📊 เกี่ยวกับตัวคุณ</div>
    <div class="hub">
      <a href="#/dna" class="t-lilac"><span class="e">🧬</span><div><b>DNA กลิ่น</b><small>เรดาร์สายกลิ่นที่ชอบ</small></div></a>
      <a href="#/stats" class="t-lemon"><span class="e">📈</span><div><b>สถิติ & งบ</b><small>ใช้เงินไปเท่าไหร่ ขวดไหนคุ้ม</small></div></a>
      <a href="#/wrapped" class="t-pink"><span class="e">🎁</span><div><b>Wrapped ${new Date().getFullYear()}</b><small>สรุปทั้งปีแบบสตอรี่</small></div></a>
      <a href="#/badges" class="t-peach"><span class="e">🏅</span><div><b>เหรียญรางวัล</b><small>ปลดล็อกความสำเร็จ</small></div></a>
    </div>

    <div class="section-label">⚙️ ระบบ</div>
    <div class="hub">
      <a href="#/settings" class="wide" style="background:var(--card)"><span class="e">⚙️</span><div><b>ตั้งค่า</b><small>เชื่อม Google Sheet · ธีม · งบ · สำรองข้อมูล</small></div></a>
    </div>`;
  return { html, title: 'AI & อื่นๆ', tab: 'more' };
}
