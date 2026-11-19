// ➕ เพิ่ม / แก้ไขขวด + AI อ่านรูป / หาข้อมูล / ถอด batch code
import * as store from '../store.js';
import { go } from '../nav.js';
import { ai, isConfigured, isOnline } from '../api.js';
import { esc, imgUrl, FALLBACK_IMG, toast, compressImage, pickImage, STATUS, FORMATS, GROUPS, PRESET_TAGS, todayStr, confirmDialog, isBlank, num } from '../util.js';

let picB64 = null;
let aiMeta = null;

const FIELDS = ['name', 'brand', 'brandGroup', 'format', 'category', 'volume', 'topNotes', 'midNotes', 'baseNotes', 'batchCode', 'pao',
  'status', 'mfgDate', 'expDate', 'purchaseDate', 'openedDate', 'location', 'price', 'rating', 'notes', 'fillLevel'];

function val(root, k) { const el = root.querySelector(`[name="${k}"]`); return el ? el.value.trim() : ''; }
function setVal(root, k, v) { const el = root.querySelector(`[name="${k}"]`); if (el && v !== undefined && v !== null) el.value = v; }

function needAi() {
  if (!isConfigured()) { toast('ต้องเชื่อม Google Sheet ก่อน (ตั้งค่า) ถึงจะใช้ AI ได้'); return false; }
  if (!isOnline()) { toast('AI ต้องใช้อินเทอร์เน็ตนะ'); return false; }
  return true;
}

async function applyAi(root, res, keys) {
  const groupOk = GROUPS.includes(res.brandGroup);
  const fmtOk = FORMATS.includes(res.format);
  const incoming = keys.map(k => [k, k === 'brandGroup' && !groupOk ? '' : k === 'format' && !fmtOk ? '' : res[k]])
    .filter(([, v]) => !isBlank(v));
  const conflicts = incoming.filter(([k, v]) => !isBlank(val(root, k)) && val(root, k) !== String(v) && k !== 'format');
  let overwrite = false;
  if (conflicts.length) {
    overwrite = await confirmDialog({ emoji: '🤖', title: 'AI เจอข้อมูลที่ต่างจากที่กรอกไว้', text: `${conflicts.length} ช่อง (${conflicts.map(c => c[0]).join(', ')})`, ok: 'แทนที่ทั้งหมด', cancel: 'เติมเฉพาะช่องว่าง' });
  }
  let n = 0;
  incoming.forEach(([k, v]) => { if (isBlank(val(root, k)) || overwrite || k === 'format') { setVal(root, k, v); n++; } });
  aiMeta = res._meta;
  const box = root.querySelector('#aiBox');
  box.hidden = false;
  box.innerHTML = `<b>🤖 ${esc(res._meta?.model || 'AI')}</b>${res.confidence ? ` · ความมั่นใจ: ${esc(res.confidence)}` : ''}${res.seen ? `<div>👀 ${esc(res.seen)}</div>` : ''}
    ${(res._meta?.sources || []).map(s => `<a href="${esc(s.uri)}" target="_blank" rel="noopener">🔗 ${esc(s.title)}</a>`).join('')}
    <a href="https://www.google.com/search?q=${encodeURIComponent('fragrantica ' + val(root, 'brand') + ' ' + val(root, 'name'))}" target="_blank" rel="noopener">🔍 เช็คใน Fragrantica</a>`;
  toast(res.confidence === 'low' ? `เติม ${n} ช่อง (AI ไม่ค่อยมั่นใจ ลองเช็คอีกที)` : `✨ เติมข้อมูลแล้ว ${n} ช่อง`, 2600);
}

export function render({ params, query }) {
  const editing = params.id ? store.perfume(params.id) : null;
  if (params.id && !editing) return { html: '<div class="empty">ไม่พบขวดนี้</div>', back: true, title: 'แก้ไข' };
  picB64 = null; aiMeta = null;

  let p = editing ? { ...editing } : { status: STATUS.rotation, format: 'EDP', purchaseDate: todayStr() };
  if (!editing && query.from) {
    const w = store.find('wishlist', query.from);
    if (w) p = { ...p, name: w.name, brand: w.brand, brandGroup: w.brandGroup, format: w.format || 'EDP', category: w.category, topNotes: w.topNotes, midNotes: w.midNotes, baseNotes: w.baseNotes, status: STATUS.sealed, _fromWish: w.uid };
  }
  const tags = new Set(String(p.tags || '').split(',').map(t => t.trim()).filter(Boolean));
  const allTags = [...new Set([...PRESET_TAGS, ...store.state.perfumes.flatMap(x => String(x.tags || '').split(',').map(t => t.trim())).filter(Boolean)])];
  const uniq = (k) => [...new Set(store.state.perfumes.map(x => String(x[k] ?? '').trim()).filter(Boolean))];
  const opt = (arr, cur, blank) => (blank ? `<option value="">${blank}</option>` : '') + arr.map(v => { const [a, b] = Array.isArray(v) ? v : [v, v]; return `<option value="${esc(a)}" ${String(cur) === String(a) ? 'selected' : ''}>${esc(b)}</option>`; }).join('');
  const inp = (k, label, type = 'text', extra = '') => `<label class="lbl">${label}</label><input class="inp" name="${k}" type="${type}" value="${esc(p[k] ?? '')}" ${extra}>`;

  const html = `
    <form id="pForm" autocomplete="off">
      <label class="photo-drop" id="photoDrop">
        <img id="photoImg" src="${esc(imgUrl(p))}" ${p.pic || p.picLocal ? '' : 'hidden'}>
        <div class="photo-ph" ${p.pic || p.picLocal ? 'hidden' : ''}><div class="big">📷</div>แตะเพื่อถ่าย/เลือกรูป</div>
      </label>
      <div class="photo-actions">
        <button type="button" class="btn btn-lilac btn-sm" id="btnVision">✨ ให้ AI อ่านจากรูป</button>
        <button type="button" class="btn btn-soft btn-sm" id="btnPhoto">🖼️ เปลี่ยนรูป</button>
      </div>
      <div class="hint center">ถ่ายรูปขวดให้เห็นฉลาก AI จะกรอกชื่อ แบรนด์ และโน้ตให้เอง</div>

      <div class="card mt">
        <div class="card-head">🌷 ข้อมูลพื้นฐาน</div>
        <label class="lbl" style="margin-top:0">ชื่อน้ำหอม *</label>
        <div class="input-btn"><input class="inp" name="name" value="${esc(p.name || '')}" required placeholder="เช่น Khamrah">
          <button type="button" class="btn btn-lemon btn-sm" id="btnIdentify">✨ AI</button></div>
        <div class="hint">ใส่แบรนด์ด้วยจะได้ข้อมูลแม่นขึ้น</div>
        <div class="grid2">
          <div>${inp('brand', 'แบรนด์', 'text', 'list="dlBrand"')}<datalist id="dlBrand">${uniq('brand').map(b => `<option value="${esc(b)}">`).join('')}</datalist></div>
          <div><label class="lbl">กลุ่มแบรนด์</label><select class="sel" name="brandGroup">${opt(GROUPS, p.brandGroup, 'เลือก...')}</select></div>
          <div><label class="lbl">ความเข้มข้น</label><select class="sel" name="format">${opt(FORMATS, p.format)}</select></div>
          <div>${inp('volume', 'ปริมาณ (ml)', 'number', 'inputmode="decimal" min="0"')}</div>
        </div>
        ${inp('category', 'หมวดกลิ่น', 'text', 'list="dlCat" placeholder="เช่น Amber Spicy"')}<datalist id="dlCat">${uniq('category').map(b => `<option value="${esc(b)}">`).join('')}</datalist>
        <div id="aiBox" class="ai-info" hidden></div>
      </div>

      <div class="card">
        <div class="card-head">🫧 โครงสร้างกลิ่น</div>
        <label class="lbl" style="margin-top:0"><span class="dot d-top"></span>Top Notes</label><input class="inp" name="topNotes" value="${esc(p.topNotes || '')}">
        <label class="lbl"><span class="dot d-mid"></span>Middle Notes</label><input class="inp" name="midNotes" value="${esc(p.midNotes || '')}">
        <label class="lbl"><span class="dot d-base"></span>Base Notes</label><input class="inp" name="baseNotes" value="${esc(p.baseNotes || '')}">
        <label class="lbl">🏷️ แท็ก (ไว้ใช้สุ่มตามโอกาส)</label>
        <div class="chips wrap" id="tagChips">${allTags.map(t => `<button type="button" class="chip-btn ${tags.has(t) ? 'active' : ''}" data-t="${esc(t)}">#${esc(t)}</button>`).join('')}
          <button type="button" class="chip-btn" id="addTag">＋ แท็กใหม่</button></div>
      </div>

      <div class="card">
        <div class="card-head">💰 การซื้อ & ความชอบ</div>
        <label class="lbl" style="margin-top:0">สถานะ</label>
        <select class="sel" name="status">${opt([[STATUS.rotation, '✨ ใช้อยู่'], [STATUS.sealed, '📦 ยังไม่แกะ'], [STATUS.empty, '🫙 หมดแล้ว']], p.status)}</select>
        <div class="grid2">
          <div>${inp('price', 'ราคา (฿)', 'number', 'inputmode="decimal" min="0"')}</div>
          <div><label class="lbl">คะแนน</label><select class="sel" name="rating">${opt([['', '-'], ['5', '★★★★★'], ['4.5', '★★★★½'], ['4', '★★★★'], ['3.5', '★★★½'], ['3', '★★★'], ['2', '★★'], ['1', '★']], p.rating)}</select></div>
          <div>${inp('purchaseDate', 'วันที่ซื้อ', 'date')}</div>
          <div>${inp('location', 'ซื้อที่', 'text', 'list="dlLoc"')}<datalist id="dlLoc">${[...new Set(['King Power', 'Shopee', 'Lazada', 'Central', 'Duty Free', ...uniq('location')])].map(b => `<option value="${esc(b)}">`).join('')}</datalist></div>
        </div>
        <label class="lbl">เหลือในขวด: <b id="fillOut">${isBlank(p.fillLevel) ? 100 : num(p.fillLevel)}%</b></label>
        <input type="range" name="fillLevel" min="0" max="100" step="5" value="${isBlank(p.fillLevel) ? 100 : num(p.fillLevel)}">
        <label class="lbl">บันทึกเพิ่มเติม</label><textarea class="inp" name="notes" rows="3" placeholder="รีวิวสั้นๆ ความรู้สึก ฯลฯ">${esc(p.notes || '')}</textarea>
      </div>

      <div class="card">
        <div class="card-head">🗓️ อายุขวด</div>
        <label class="lbl" style="margin-top:0">Batch Code</label>
        <div class="input-btn"><input class="inp" name="batchCode" value="${esc(p.batchCode || '')}" placeholder="ดูที่ใต้ขวด/กล่อง">
          <button type="button" class="btn btn-lilac btn-sm" id="btnBatch">📸 ถอดรหัส</button></div>
        <div class="hint">AI ช่วยประเมินวันผลิตจาก batch code ได้บางแบรนด์</div>
        <div class="grid2">
          <div>${inp('mfgDate', 'ผลิต (MFG)', 'date')}</div>
          <div>${inp('expDate', 'หมดอายุ (EXP)', 'date')}</div>
          <div>${inp('openedDate', 'แกะใช้เมื่อ', 'date')}</div>
          <div>${inp('pao', 'PAO (เดือน)', 'number', 'inputmode="numeric" min="0" placeholder="เช่น 36"')}</div>
        </div>
      </div>

      <button type="submit" class="btn btn-main btn-block" id="saveBtn">💾 ${editing ? 'บันทึกการแก้ไข' : 'เพิ่มเข้าตู้'}</button>
    </form>`;

  return {
    html, title: editing ? 'แก้ไขขวด' : 'เพิ่มขวดใหม่', back: !!editing, parent: editing ? 'p/' + editing.uid : 'vault', tab: 'add', live: false,
    mount: (root) => {
      const f = root.querySelector('#pForm');
      const img = root.querySelector('#photoImg'), ph = root.querySelector('.photo-ph');

      const choosePhoto = async () => {
        const file = await pickImage();
        if (!file) return null;
        const r = await compressImage(file, 900, 0.78);
        picB64 = r.b64; img.src = r.dataUrl; img.hidden = false; ph.hidden = true;
        return r;
      };
      root.querySelector('#photoDrop').addEventListener('click', (e) => { e.preventDefault(); choosePhoto(); });
      root.querySelector('#btnPhoto').addEventListener('click', choosePhoto);

      root.querySelector('#btnVision').addEventListener('click', async (e) => {
        if (!needAi()) return;
        const btn = e.currentTarget;
        if (!picB64) { const r = await choosePhoto(); if (!r) return; }
        btn.disabled = true; btn.textContent = '👀 AI กำลังดูรูป...';
        try {
          const res = await ai('vision', { image: picB64, mime: 'image/jpeg', hint: [val(root, 'brand'), val(root, 'name')].filter(Boolean).join(' ') });
          await applyAi(root, res, ['name', 'brand', 'brandGroup', 'format', 'category', 'topNotes', 'midNotes', 'baseNotes', 'volume', 'batchCode']);
        } catch (err) { toast('AI อ่านรูปไม่สำเร็จ: ' + err.message, 3000); }
        finally { btn.disabled = false; btn.textContent = '✨ ให้ AI อ่านจากรูป'; }
      });

      root.querySelector('#btnIdentify').addEventListener('click', async (e) => {
        if (!val(root, 'name')) { toast('พิมพ์ชื่อน้ำหอมก่อนนะ'); return; }
        if (!needAi()) return;
        const btn = e.currentTarget; btn.disabled = true; btn.textContent = '⏳';
        try {
          const res = await ai('identify', { name: val(root, 'name'), brand: val(root, 'brand'), format: val(root, 'format') });
          await applyAi(root, res, ['brand', 'brandGroup', 'category', 'topNotes', 'midNotes', 'baseNotes']);
        } catch (err) { toast('AI ไม่ตอบ: ' + err.message, 3000); }
        finally { btn.disabled = false; btn.textContent = '✨ AI'; }
      });

      root.querySelector('#btnBatch').addEventListener('click', async (e) => {
        if (!needAi()) return;
        const btn = e.currentTarget;
        let image = null;
        if (!val(root, 'batchCode')) {
          const file = await pickImage(); if (!file) return;
          image = (await compressImage(file, 1100, 0.85)).b64;
        }
        btn.disabled = true; btn.textContent = '⏳';
        try {
          const r = await ai('batch', { code: val(root, 'batchCode'), brand: val(root, 'brand'), image, mime: 'image/jpeg' });
          if (r.batchCode && !val(root, 'batchCode')) setVal(root, 'batchCode', r.batchCode);
          if (r.mfgDate && /^\d{4}-\d{2}/.test(r.mfgDate)) {
            const ok = await confirmDialog({ emoji: '🗓️', title: `ผลิตประมาณ ${r.mfgDate.slice(0, 7)}`, text: `${esc(r.explain || '')}<br><small>ความมั่นใจ: ${esc(r.confidence || '-')}</small>`, ok: 'ใช้วันนี้', cancel: 'ไม่ใช้' });
            if (ok) setVal(root, 'mfgDate', r.mfgDate.length === 7 ? r.mfgDate + '-01' : r.mfgDate.slice(0, 10));
          } else {
            confirmDialog({ emoji: '🤷', title: 'ถอดรหัสไม่ได้', text: esc(r.explain || 'แบรนด์นี้ไม่มีรูปแบบรหัสที่รู้จัก'), ok: 'โอเค', cancel: 'ปิด' });
          }
        } catch (err) { toast('ถอดรหัสไม่สำเร็จ: ' + err.message, 3000); }
        finally { btn.disabled = false; btn.textContent = '📸 ถอดรหัส'; }
      });

      const chips = root.querySelector('#tagChips');
      chips.addEventListener('click', (e) => {
        const b = e.target.closest('.chip-btn'); if (!b) return;
        if (b.id === 'addTag') {
          const t = (prompt('ชื่อแท็กใหม่') || '').trim().replace(/[,#]/g, '');
          if (t && !tags.has(t)) {
            tags.add(t);
            const nb = document.createElement('button'); nb.type = 'button'; nb.className = 'chip-btn active'; nb.dataset.t = t; nb.textContent = '#' + t;
            chips.insertBefore(nb, b);
          }
          return;
        }
        const t = b.dataset.t; if (tags.has(t)) tags.delete(t); else tags.add(t);
        b.classList.toggle('active', tags.has(t));
      });

      const range = root.querySelector('[name=fillLevel]');
      range.addEventListener('input', () => root.querySelector('#fillOut').textContent = range.value + '%');

      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!val(root, 'name')) { toast('ใส่ชื่อน้ำหอมก่อนนะ'); return; }
        const rec = { ...(editing || {}) };
        FIELDS.forEach(k => { rec[k] = val(root, k); });
        rec.tags = [...tags].join(', ');
        if (rec.status === STATUS.rotation && !rec.openedDate && !editing) rec.openedDate = todayStr();
        if (!editing && rec.fillLevel === '100' && rec.status === STATUS.sealed) rec.fillLevel = '100';
        const btn = root.querySelector('#saveBtn'); btn.disabled = true;
        const saved = await store.save('perfumes', rec, { picB64 });
        if (p._fromWish) await store.patch('wishlist', p._fromWish, { status: 'ซื้อแล้ว' });
        toast(editing ? 'บันทึกแล้ว ✨' : `🎉 เพิ่ม ${saved.name} เข้าตู้แล้ว`);
        picB64 = null;
        location.replace('#/p/' + saved.uid);
      });
    }
  };
}
