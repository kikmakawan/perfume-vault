// กราฟแบบ SVG/HTML เบาๆ ไม่ต้องใช้ไลบรารี
import { esc, thMonth, money, todayStr } from './util.js';

export const PALETTE = ['#FF9EC4', '#B9A3F5', '#7FD6B6', '#8EC5F2', '#FFB98F', '#F5CF5B', '#E9A6F2', '#9ED8E8'];

export function hbars(entries, { colors = PALETTE, fmt = (n) => n } = {}) {
  if (!entries.length) return '<div class="hint">ยังไม่มีข้อมูล</div>';
  const max = Math.max(...entries.map(e => e[1]), 1);
  return entries.map(([label, n], i) => `
    <div class="bar-row">
      <div class="bar-label" title="${esc(label)}">${esc(label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(n / max * 100).toFixed(1)}%;background:${colors[i % colors.length]}"></div></div>
      <div class="bar-val">${fmt(n)}</div>
    </div>`).join('');
}

export function vbars(items, { budget = 0 } = {}) {
  const max = Math.max(...items.map(i => i.total), budget, 1);
  const line = budget ? `<div class="budget-line" style="bottom:${(budget / max * 100 * 0.82 + 12).toFixed(1)}%" title="งบ ${money(budget)}"></div>` : '';
  return `<div class="vbars">${line}${items.map(i => `
    <div class="vbar" title="${money(i.total)} ฿">
      <span style="font-size:.6rem;margin-bottom:2px">${i.total ? (i.total >= 1000 ? (i.total / 1000).toFixed(i.total >= 10000 ? 0 : 1) + 'k' : money(i.total)) : ''}</span>
      <i class="${budget && i.total > budget ? 'over' : ''}" style="height:${(i.total / max * 82).toFixed(1)}%"></i>
      <span>${thMonth(i.m)}</span>
    </div>`).join('')}</div>`;
}

export function radar(axes, size = 280) {
  const n = axes.length, cx = size / 2, cy = size / 2, R = size / 2 - 46;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  let grid = '';
  [0.25, 0.5, 0.75, 1].forEach(f => {
    grid += `<polygon points="${axes.map((_, i) => pt(i, R * f).join(',')).join(' ')}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
  });
  axes.forEach((_, i) => { const [x, y] = pt(i, R); grid += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/>`; });
  const poly = axes.map((a, i) => pt(i, R * Math.max(a.v, 4) / 100).join(',')).join(' ');
  const labels = axes.map((a, i) => {
    const [x, y] = pt(i, R + 26);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="var(--ink)">${a.e}</text>
            <text x="${x}" y="${y + 14}" text-anchor="middle" font-size="9" fill="var(--muted)">${esc(a.th.split('/')[0])}</text>`;
  }).join('');
  const dots = axes.map((a, i) => { const [x, y] = pt(i, R * Math.max(a.v, 4) / 100); return `<circle cx="${x}" cy="${y}" r="3.5" fill="#fff" stroke="#B9A3F5" stroke-width="2"/>`; }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size + 40}px">
    <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFA9CB" stop-opacity=".75"/><stop offset="1" stop-color="#C4AEFF" stop-opacity=".75"/></linearGradient></defs>
    ${grid}<polygon points="${poly}" fill="url(#rg)" stroke="#B9A3F5" stroke-width="2" stroke-linejoin="round"/>${dots}${labels}</svg>`;
}

export function heatmapHtml(cells) {
  const max = Math.max(...cells.map(c => c.n), 1);
  const today = todayStr();
  const lv = (n) => !n ? '' : n >= max && max > 1 ? 'l4' : n >= 3 ? 'l3' : n === 2 ? 'l2' : 'l1';
  return `<div class="heatmap">${cells.map(c => `<i class="${lv(c.n)} ${c.date === today ? 'today' : ''}" title="${c.date}: ${c.n}"></i>`).join('')}</div>
    <div class="hm-legend">น้อย <i style="background:var(--soft)"></i><i style="background:#FFD3E4"></i><i style="background:#FFA9CB"></i><i style="background:#D99BF0"></i><i style="background:#A88BF0"></i> มาก</div>`;
}

export function donut(entries, size = 120) {
  const total = entries.reduce((s, e) => s + e[1], 0) || 1;
  let acc = 0;
  const stops = entries.map(([, n], i) => { const a = acc / total * 360; acc += n; return `${PALETTE[i % PALETTE.length]} ${a}deg ${acc / total * 360}deg`; }).join(',');
  return `<div class="flex" style="gap:16px">
    <div style="width:${size}px;height:${size}px;border-radius:50%;background:conic-gradient(${stops || 'var(--soft) 0 360deg'});display:grid;place-items:center;flex-shrink:0">
      <div style="width:${size * .58}px;height:${size * .58}px;border-radius:50%;background:var(--card);display:grid;place-items:center;font-family:Mali;font-weight:700">${total === 1 && !entries.length ? 0 : total}</div></div>
    <div class="grow">${entries.map(([l, n], i) => `<div class="flex" style="font-size:.8rem;margin-bottom:4px"><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span><span class="grow trunc">${esc(l)}</span><b>${n}</b></div>`).join('')}</div>
  </div>`;
}
