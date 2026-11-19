// ➕ เพิ่ม / แก้ไขขวด — ถ่ายรูปหรือพิมพ์ชื่อก็พอ ที่เหลือ AI เติมให้ (เบื้องหลัง)
import * as store from '../store.js';
import { ai, isConfigured, isOnline } from '../api.js';
import { esc, imgUrl, toast, compressImage, pickImage, STATUS, FORMATS, GROUPS, PRESET_TAGS, todayStr, confirmDialog, isBlank, num } from '../util.js';
import { queueEnrich } from '../enrich.js';
import { celebrate } from '../fx.js';

let picB64 = null;
let formState = { root: null, snap: '', submitted: false, tags: null };
const serialize = () => {
  const f = formState.root && formState.root.querySelector('#pForm'); if (!f) return '';
  return JSON.stringify([...new FormData(f).entries()]) + '|' + [...(formState.tags || [])].join(',') + '|' + (picB64 ? 1 : 0);
};

const FIELDS = ['name', 'brand', 'brandGroup', 'format', 'category', 'volume', 'topNotes', 'midNotes', 'baseNotes', 'batchCode', 'pao',
  'status', 'mfgDate', 'expDate', 'purchaseDate', 'openedDate', 'location', 'price', 'rating', 'notes', 'fillLevel'];

const val = (root, k) => { const el = root.querySelector(`[name="${k}"]`); return el ? el.value.trim() : ''; };
const setVal = (root, k, v) => { const el = root.querySelector(`[name="${k}"]`); if (el && v !== undefined && v !== null) { el.value = v; el.dispatchEvent(new Event('change')); } };
const aiReady = () => isConfigured() && isOnline();

function aiError(err) {
  confirmDialog({ emoji: '😵', title: 'AI ยังตอบไม่ได้ตอนนี้', text: `ไม่เป็นไร กดบันทึกไปก่อนได้เลย แล้ว AI จะเติมโน้ตให้ทีหลังเอง<div class="hint" style="text-align:left;word-break:break-word;margin-top:8px">${esc(err.message)}</div>`, ok: 'โอเค', cancel: 'ปิด' });
}

function applyAi(root, res, keys) {
  let n = 0;
  keys.forEach(k => {
    let v = res[k];
    if (k === 'brandGroup' && !GROUPS.includes(v)) v = '';
    if (k === 'format' && !FORMATS.includes(v)) v = '';
    if (isBlank(v)) return;
    if (isBlank(val(root, k)) || k === 'format') { setVal(root, k, v); n++; }
  });
  const box = root.querySelector('#aiBox');
  box.hidden = false;
  box.innerHTML = `<b>🤖 ${esc(res._meta?.model || 'AI')}</b>${res.confidence ? ` · ความมั่นใจ: ${esc(res.confidence)}` : ''}${res.seen ? `<div>👀 ${esc(res.seen)}</div>` : ''}
    <a href="https://www.google.com/search?q=${encodeURIComponent('fragrantica ' + val(root, 'brand') + ' ' + val(root, 'name'))}" target="_blank" rel="noopener">🔍 เช็คใน Fragrantica</a>`;
  if (keys.some(k => ['topNotes', 'midNotes', 'baseNotes'].includes(k) && !isBlank(res[k]))) root.querySelector('#secNotes').open = true;
  toast(res.confidence === 'low' ? `เติม ${n} ช่อง (AI ไม่ค่อยมั่นใจ ลองเช็คอีกที)` : `✨ AI เติมให้แล้ว ${n} ช่อง`, 2600);
}

export function render({ params, query }) {
  const editing = params.id ? store.perfume(params.id) : null;
  if (params.id && !editing) return { html: '<div class="empty">ไม่พบขวดนี้</div>', back: true, title: 'แก้ไข' };
  picB64 = null;

  let p = editing ? { ...editing } : { status: STATUS.rotation, format: 'EDP', purchaseDate: todayStr() };
  if (!editing && query.name) p = { ...p, name: query.name, brand: query.brand || '', price: query.price || '', volume: query.volume || '', status: STATUS.sealed };
  if (!editing && query.from) {
    const w = store.find('wishlist', query.from);
    if (w) p = { ...p, name: w.name, brand: w.brand, brandGroup: w.brandGroup, format: w.format || 'EDP', category: w.category, topNotes: w.topNotes, midNotes: w.midNotes, baseNotes: w.baseNotes, status: STATUS.sealed, _fromWish: w.uid };
  }
  const tags = new Set(String(p.tags || '').split(',').map(t => t.trim()).filter(Boolean));
  const allTags = [...new Set([...PRESET_TAGS, ...store.state.perfumes.flatMap(x => String(x.tags || '').split(',').map(t => t.trim())).filter(Boolean)])];
  const uniq = (k) => [...new Set(store.state.perfumes.map(x => String(x[k] ?? '').trim()).filter(Boolean))];
  const opt = (arr, cur, blank) => (blank ? `<option value="">${blank}</option>` : '') + arr.map(v => { const [a, b] = Array.isArray(v) ? v : [v, v]; return `<option value="${esc(a)}" ${String(cur) === String(a) ? 'selected' : ''}>${esc(b)}</option>`; }).join('');
  const inp = (k, label, type = 'text', extra = '') => `<label class="lbl">${label}</label><input class="inp" name="${k}" type="${type}" value="${esc(p[k] ?? '')}" ${extra}>`;
  const hasPic = !!(p.pic || p.picLocal);
  const hasNotes = !!(p.topNotes || p.midNotes || p.baseNotes);
  const statusKeyOf = (s) => s === STATUS.sealed ? 'sealed' : s === STATUS.empty ? 'empty' : 'rotation';

  const html = `
    <form id="pForm" autocomplete="off">
      <div class="add-hero">
        <label class="photo-drop" id="photoDrop">
          <img id="photoImg" src="${esc(imgUrl(p))}" ${hasPic ? '' : 'hidden'}>
          <div class="photo-ph" ${hasPic ? 'hidden' : ''}><div class="big">📷</div>แตะเพื่อใส่รูป</div>
        </label>
        ${!editing ? `<button type="button" class="btn btn-main btn-block mt" id="btnVision">📸 ถ่ายรูปขวด ให้ AI กรอกให้</button>
        <div class="hint center">หรือพิมพ์แค่ชื่อด้านล่างก็พอ ที่เหลือ AI จัดการให้ ✨</div>` : `<button type="button" class="btn btn-soft btn-sm mt" id="btnVision">✨ ให้ AI อ่านจากรูปอีกครั้ง</button>`}
      </div>

      <div class="card mt">
        <label class="lbl" style="margin-top:0">ชื่อน้ำหอม *</label>
        <div class="input-btn"><input class="inp" name="name" value="${esc(p.name || '')}" required placeholder="เช่น Khamrah" autocomplete="off">
          <button type="button" class="btn btn-lemon btn-sm" id="btnIdentify" title="ให้ AI หาข้อมูลตอนนี้">✨</button></div>
        ${inp('brand', 'แบรนด์', 'text', 'list="dlBrand" placeholder="เช่น Lattafa"')}<datalist id="dlBrand">${uniq('brand').map(b => `<option value="${esc(b)}">`).join('')}</datalist>

        <label class="lbl">สถานะ</label>
        <input type="hidden" name="status" value="${esc(p.status || STATUS.rotation)}">
        <div class="seg" id="segStatus">${[['rotation', '✨ ใช้อยู่'], ['sealed', '📦 ยังไม่แกะ'], ['empty', '🫙 หมดแล้ว']].map(([k, l]) => `<button type="button" data-v="${k}" class="${statusKeyOf(p.status) === k ? 'on' : ''}">${l}</button>`).join('')}</div>

        <div class="grid2">
          <div><label class="lbl">ชอบแค่ไหน</label><input type="hidden" name="rating" value="${esc(p.rating ?? '')}">
            <div class="star-pick" id="starPick">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-v="${i}" class="${num(p.rating) >= i ? 'on' : ''}">★</button>`).join('')}</div></div>
          <div>${inp('price', 'ราคา (฿)', 'number', 'inputmode="decimal" min="0" placeholder="ไม่ใส่ก็ได้"')}</div>
        </div>

        ${!editing && !hasNotes ? `<label class="toggle-row mt">
          <span><b>✨ ให้ AI เติมโน้ตกลิ่นให้อัตโนมัติ</b><br><small class="sub">บันทึกได้เลยไม่ต้องรอ AI ทำงานเบื้องหลัง${isConfigured() ? '' : ' (ต้องเชื่อม Sheet ก่อน)'}</small></span>
          <span class="switch"><input type="checkbox" id="autoAi" ${isConfigured() ? 'checked' : 'disabled'}><span></span></span></label>` : ''}
        <div id="aiBox" class="ai-info" hidden></div>
      </div>

      <details class="card fold" id="secNotes" ${editing && hasNotes ? 'open' : ''}>
        <summary>🫧 โน้ตกลิ่น & แท็ก <span class="sub">${hasNotes ? 'มีข้อมูลแล้ว' : 'AI เติมให้ได้'}</span></summary>
        <label class="lbl"><span class="dot d-top"></span>Top Notes</label><input class="inp" name="topNotes" value="${esc(p.topNotes || '')}">
        <label class="lbl"><span class="dot d-mid"></span>Middle Notes</label><input class="inp" name="midNotes" value="${esc(p.midNotes || '')}">
        <label class="lbl"><span class="dot d-base"></span>Base Notes</label><input class="inp" name="baseNotes" value="${esc(p.baseNotes || '')}">
        ${inp('category', 'หมวดกลิ่น', 'text', 'list="dlCat" placeholder="เช่น Amber Spicy"')}<datalist id="dlCat">${uniq('category').map(b => `<option value="${esc(b)}">`).join('')}</datalist>
        <label class="lbl">🏷️ แท็ก (ใช้ตอนสุ่มตามโอกาส)</label>
        <div class="chips wrap" id="tagChips">${allTags.map(t => `<button type="button" class="chip-btn ${tags.has(t) ? 'active' : ''}" data-t="${esc(t)}">#${esc(t)}</button>`).join('')}
          <button type="button" class="chip-btn" id="addTag">＋ แท็กใหม่</button></div>
      </details>

      <details class="card fold">
        <summary>📋 รายละเอียดขวด <span class="sub">ไม่บังคับ</span></summary>
        <div class="grid2">
          <div><label class="lbl">ความเข้มข้น</label><select class="sel" name="format">${opt(FORMATS, p.format)}</select></div>
          <div>${inp('volume', 'ปริมาณ (ml)', 'number', 'inputmode="decimal" min="0"')}</div>
          <div><label class="lbl">กลุ่มแบรนด์</label><select class="sel" name="brandGroup">${opt(GROUPS, p.brandGroup, 'เลือก...')}</select></div>
          <div>${inp('purchaseDate', 'วันที่ซื้อ', 'date')}</div>
        </div>
        ${inp('location', 'ซื้อที่', 'text', 'list="dlLoc"')}<datalist id="dlLoc">${[...new Set(['King Power', 'Shopee', 'Lazada', 'Central', 'Duty Free', ...uniq('location')])].map(b => `<option value="${esc(b)}">`).join('')}</datalist>
        <label class="lbl">เหลือในขวด: <b id="fillOut">${isBlank(p.fillLevel) ? 100 : num(p.fillLevel)}%</b></label>
        <input type="range" name="fillLevel" min="0" max="100" step="5" value="${isBlank(p.fillLevel) ? 100 : num(p.fillLevel)}">
        <label class="lbl">บันทึก / รีวิวสั้นๆ</label><textarea class="inp" name="notes" rows="3">${esc(p.notes || '')}</textarea>
      </details>

      <details class="card fold">
        <summary>🗓️ อายุขวด <span class="sub">Batch · MFG · EXP · PAO</span></summary>
        <label class="lbl">Batch Code</label>
        <div class="input-btn"><input class="inp" name="batchCode" value="${esc(p.batchCode || '')}" placeholder="ดูที่ใต้ขวด/กล่อง">
          <button type="button" class="btn btn-lilac btn-sm" id="btnBatch">📸 ถอดรหัส</button></div>
        <div class="grid2">
          <div>${inp('mfgDate', 'ผลิต (MFG)', 'date')}</div>
          <div>${inp('expDate', 'หมดอายุ (EXP)', 'date')}</div>
          <div>${inp('openedDate', 'แกะใช้เมื่อ', 'date')}</div>
          <div>${inp('pao', 'PAO (เดือน)', 'number', 'inputmode="numeric" min="0" placeholder="เช่น 36"')}</div>
        </div>
      </details>

      <div class="save-bar"><button type="submit" class="btn btn-main btn-block" id="saveBtn">💾 ${editing ? 'บันทึกการแก้ไข' : 'เพิ่มเข้าตู้'}</button></div>
    </form>`;

  return {
    html, title: editing ? 'แก้ไขขวด' : 'เพิ่มขวดใหม่', back: !!editing, parent: editing ? 'p/' + editing.uid : 'vault', tab: 'add', live: false,
    canLeave: async () => {
      if (formState.submitted || serialize() === formState.snap) return true;
      return confirmDialog({ emoji: '📝', title: 'ยังไม่ได้บันทึก', text: 'ออกจากหน้านี้แล้วสิ่งที่แก้ไว้จะหายไป', ok: 'ทิ้งการแก้ไข', cancel: 'อยู่ต่อ', danger: true });
    },
    mount: (root) => {
      formState = { root, snap: '', submitted: false, tags };
      setTimeout(() => { formState.snap = serialize(); }, 0);
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

      // สถานะ + ดาว
      root.querySelector('#segStatus').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        root.querySelectorAll('#segStatus button').forEach(x => x.classList.toggle('on', x === b));
        root.querySelector('[name=status]').value = STATUS[b.dataset.v];
      });
      root.querySelector('#starPick').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const cur = num(val(root, 'rating')); let v = Number(b.dataset.v);
        if (cur === v) v = 0; // แตะซ้ำ = ล้าง
        root.querySelector('[name=rating]').value = v || '';
        root.querySelectorAll('#starPick button').forEach(x => x.classList.toggle('on', Number(x.dataset.v) <= v));
      });

      root.querySelector('#btnVision').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        if (!picB64) { const r = await choosePhoto(); if (!r) return; }
        if (!aiReady()) { toast(isConfigured() ? 'ออฟไลน์อยู่ ใส่ชื่อแล้วบันทึกไปก่อน AI จะเติมให้ทีหลัง' : 'เชื่อม Sheet ก่อนถึงจะใช้ AI อ่านรูปได้'); return; }
        const label = btn.textContent; btn.disabled = true; btn.innerHTML = '<span class="typing"><i></i><i></i><i></i></span> AI กำลังดูรูป...';
        try {
          const res = await ai('vision', { image: picB64, mime: 'image/jpeg', hint: [val(root, 'brand'), val(root, 'name')].filter(Boolean).join(' ') });
          applyAi(root, res, ['name', 'brand', 'brandGroup', 'format', 'category', 'topNotes', 'midNotes', 'baseNotes', 'volume', 'batchCode']);
        } catch (err) { aiError(err); }
        finally { btn.disabled = false; btn.textContent = label; }
      });

      root.querySelector('#btnIdentify').addEventListener('click', async (e) => {
        if (!val(root, 'name')) { toast('พิมพ์ชื่อน้ำหอมก่อนนะ'); return; }
        if (!aiReady()) { toast('ตอนนี้ใช้ AI ไม่ได้ บันทึกไปก่อนได้เลย'); return; }
        const btn = e.currentTarget; btn.disabled = true; btn.textContent = '⏳';
        try {
          const res = await ai('identify', { name: val(root, 'name'), brand: val(root, 'brand'), format: val(root, 'format') });
          applyAi(root, res, ['brand', 'brandGroup', 'category', 'topNotes', 'midNotes', 'baseNotes']);
        } catch (err) { aiError(err); }
        finally { btn.disabled = false; btn.textContent = '✨'; }
      });

      root.querySelector('#btnBatch').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        let image = null;
        if (!val(root, 'batchCode')) { const file = await pickImage(); if (!file) return; image = (await compressImage(file, 1100, 0.85)).b64; }
        if (!aiReady()) { toast('ตอนนี้ใช้ AI ไม่ได้'); return; }
        btn.disabled = true; btn.textContent = '⏳';
        try {
          const r = await ai('batch', { code: val(root, 'batchCode'), brand: val(root, 'brand'), image, mime: 'image/jpeg' });
          if (r.batchCode && !val(root, 'batchCode')) setVal(root, 'batchCode', r.batchCode);
          if (r.mfgDate && /^\d{4}-\d{2}/.test(r.mfgDate)) {
            const ok = await confirmDialog({ emoji: '🗓️', title: `ผลิตประมาณ ${r.mfgDate.slice(0, 7)}`, text: `${esc(r.explain || '')}<br><small>ความมั่นใจ: ${esc(r.confidence || '-')}</small>`, ok: 'ใช้วันนี้', cancel: 'ไม่ใช้' });
            if (ok) setVal(root, 'mfgDate', r.mfgDate.length === 7 ? r.mfgDate + '-01' : r.mfgDate.slice(0, 10));
          } else confirmDialog({ emoji: '🤷', title: 'ถอดรหัสไม่ได้', text: esc(r.explain || 'แบรนด์นี้ไม่มีรูปแบบรหัสที่รู้จัก'), ok: 'โอเค', cancel: 'ปิด' });
        } catch (err) { aiError(err); }
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
      let fillTouched = false;
      range.addEventListener('input', () => { fillTouched = true; root.querySelector('#fillOut').textContent = range.value + '%'; });

      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!val(root, 'name')) { toast('ใส่ชื่อน้ำหอมก่อนนะ'); root.querySelector('[name=name]').focus(); return; }
        if (editing && !picB64 && serialize() === formState.snap) { formState.submitted = true; toast('ไม่มีอะไรเปลี่ยน'); location.replace('#/p/' + editing.uid); return; }
        const rec = { ...(editing || {}) };
        FIELDS.forEach(k => { rec[k] = val(root, k); });
        if (!fillTouched && isBlank(p.fillLevel)) rec.fillLevel = '';   // ไม่ได้แตะแถบ = ไม่ตั้งค่าให้เอง
        rec.tags = [...tags].join(', ');
        if (rec.status === STATUS.rotation && !rec.openedDate && !editing) rec.openedDate = todayStr();
        root.querySelector('#saveBtn').disabled = true;
        formState.submitted = true;
        const saved = await store.save('perfumes', rec, { picB64 });
        if (p._fromWish) await store.patch('wishlist', p._fromWish, { status: 'ซื้อแล้ว' });
        const auto = root.querySelector('#autoAi');
        const needNotes = !saved.topNotes && !saved.midNotes && !saved.baseNotes;
        if (auto && auto.checked && needNotes) queueEnrich(saved.uid);
        picB64 = null;
        if (!editing) celebrate();
        toast(editing ? 'บันทึกแล้ว ✨' : `🎉 เพิ่ม ${saved.name} เข้าตู้แล้ว${auto && auto.checked && needNotes ? ' · AI กำลังเติมโน้ตให้' : ''}`, 3000);
        location.replace('#/p/' + saved.uid);
      });
    }
  };
}
