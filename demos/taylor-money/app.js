/* ==========================================================================
   Taylor Money — client
   No framework, no build step. Plain modules, DOM built with a small `h()`
   helper (which sets textContent rather than innerHTML, so a merchant name
   out of a CSV can never inject markup).
   ========================================================================== */

/* ------------------------------------------------------------------ */
/* DOM helpers                                                         */
/* ------------------------------------------------------------------ */

const SVG_NS = 'http://www.w3.org/2000/svg';

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  append(el, children);
  return el;
}

function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.setAttribute('class', v);
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function applyProps(el, props) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
}

function append(el, children) {
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

const $ = (sel, root = document) => root.querySelector(sel);
const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const money = (n, opts = {}) =>
  (n < 0 && !opts.signed ? '-' : n > 0 && opts.signed ? '+' : '') +
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.cents === false ? 0 : 2,
    maximumFractionDigits: opts.cents === false ? 0 : 2,
  }).format(Math.abs(n || 0));

const money0 = (n, opts) => money(n, { ...opts, cents: false });

function compact(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

const parseISO = (d) => new Date(`${d}T00:00:00`);

const fmtDate = (d, opts = {}) =>
  parseISO(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(opts.year ? { year: 'numeric' } : {}) });

function fmtRelative(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days < 7) return `in ${days} days`;
  if (days < 14) return 'next week';
  return `in ${Math.round(days / 7)} weeks`;
}

const pct = (n) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const ICONS = {
  utensils: ['M18 8h1a4 4 0 0 1 0 8h-1', 'M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z', 'M6 1v3', 'M10 1v3', 'M14 1v3'],
  car: ['M5 13l1.6-4.4A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.6L19 13v5h-2v-2H7v2H5z', 'M7.5 16v0', 'M16.5 16v0'],
  bag: ['M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
  zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
  play: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M10 8l6 4-6 4V8z'],
  plane: ['M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13 8.5 4.8 6.7c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'],
  heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.7-7.7 1.1-1.1a5.5 5.5 0 0 0 0-7.8z'],
  wrench: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z'],
  sparkle: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M18 15l.7 1.8L20.5 18l-1.8.7L18 21l-.7-2.3L15.5 18l1.8-1.2z'],
  home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  landmark: ['M3 22h18', 'M6 18v-7', 'M10 18v-7', 'M14 18v-7', 'M18 18v-7', 'M4 11h16', 'M12 2l9 5H3z'],
  alert: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 7v5', 'M12 16h.01'],
  card: ['M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M2 10h20', 'M6 15h4'],
  repeat: ['M17 1l4 4-4 4', 'M3 11V9a4 4 0 0 1 4-4h14', 'M7 23l-4-4 4-4', 'M21 13v2a4 4 0 0 1-4 4H3'],
  wallet: ['M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5', 'M17.5 13h.01'],
  dots: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  trendUp: ['M22 7l-8.5 8.5-4-4L2 19', 'M16 7h6v6'],
  trendDown: ['M22 17l-8.5-8.5-4 4L2 5', 'M16 17h6v-6'],
  piggy: ['M4 12a7 7 0 0 1 7-7h3a7 7 0 0 1 6.7 5H22v4h-1.5a7 7 0 0 1-2.5 3.3V20h-3v-1.3a7.4 7.4 0 0 1-3 0V20H9v-1.7A7 7 0 0 1 6 15H4z', 'M15 10h.01'],
  calendar: ['M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  bank: ['M3 21h18', 'M5 21V10', 'M19 21V10', 'M9 21v-6h6v6', 'M12 3l8 5H4z'],
  grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  pie: ['M21.2 15.9A10 10 0 1 1 8.1 2.8', 'M22 12A10 10 0 0 0 12 2v10z'],
  target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v13'],
  settings: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  check: ['M20 6L9 17l-5-5'],
  plus: ['M12 5v14', 'M5 12h14'],
  refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.5 9a9 9 0 0 1 14.9-3.4L23 10', 'M1 14l4.6 4.4A9 9 0 0 0 20.5 15'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  trash: ['M3 6h18', 'M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2', 'M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  mark: ['M12 3l6 7h-3.5v9h-5v-9H6z'],
  link: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'],
};

function icon(name, size = 18, extra = {}) {
  const paths = ICONS[name] || ICONS.dots;
  return s(
    'svg',
    {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', 'stroke-width': extra.weight || 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'aria-hidden': 'true', ...extra,
    },
    paths.map((d) => s('path', { d })),
  );
}

function catIcon(name, chip, small = false) {
  return h('div', {
    class: `cat-icon${small ? ' cat-icon-sm' : ''}`,
    style: { background: hexAlpha(chip, 0.16), color: chip },
  }, icon(name, small ? 15 : 18));
}

function hexAlpha(hex, alpha) {
  const m = String(hex || '#6B7480').replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ------------------------------------------------------------------ */
/* Toast & tooltip                                                     */
/* ------------------------------------------------------------------ */

function toast(message, kind = '') {
  const host = $('#toasts');
  const el = h('div', { class: `toast ${kind ? `toast-${kind}` : ''}` }, message);
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 200ms';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 220);
  }, kind === 'error' ? 5200 : 2800);
}

const tipEl = () => $('#tooltip');

function showTip(event, build) {
  const el = tipEl();
  clear(el);
  append(el, [build()]);
  el.classList.add('show');
  moveTip(event);
}

function moveTip(event) {
  const el = tipEl();
  const rect = el.getBoundingClientRect();
  let x = event.clientX + 14;
  let y = event.clientY + 14;
  if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - 14;
  if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - 14;
  el.style.left = `${Math.max(8, x)}px`;
  el.style.top = `${Math.max(8, y)}px`;
}

function hideTip() {
  tipEl().classList.remove('show');
}

function tipContent(title, rows) {
  return h('div', {},
    h('div', { class: 'tooltip-title' }, title),
    rows.map(([label, value, color]) =>
      h('div', { class: 'tooltip-row' },
        color ? h('span', { class: 'legend-swatch', style: { background: color } }) : null,
        label,
        h('b', {}, value),
      )),
  );
}

/* ==========================================================================
   Charts
   ========================================================================== */

/* ---- Donut ------------------------------------------------------- */

function polar(cx, cy, r, angle) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx, cy, rOuter, rInner, start, end) {
  const large = end - start > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, rOuter, start);
  const [x2, y2] = polar(cx, cy, rOuter, end);
  const [x3, y3] = polar(cx, cy, rInner, end);
  const [x4, y4] = polar(cx, cy, rInner, start);
  return `M${x1} ${y1}A${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2}L${x3} ${y3}A${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4}Z`;
}

function donutChart(slices, { size = 210, total = null, centerLabel = 'Total' } = {}) {
  const sum = total ?? slices.reduce((a, x) => a + x.amount, 0);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = rOuter - 27;
  const mid = (rOuter + rInner) / 2;
  // A 2px gap on the surface between adjacent fills, expressed as an angle.
  const gapDeg = sum > 0 ? Math.min(3, (2 / (2 * Math.PI * mid)) * 360) : 0;

  const wrap = h('div', { class: 'donut-wrap' });
  const paths = [];
  let angle = 0;

  const svgEl = s('svg', { class: 'chart', width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: 'img' });

  if (sum <= 0) {
    svgEl.appendChild(s('circle', { cx, cy, r: mid, fill: 'none', stroke: 'var(--surface-2)', 'stroke-width': rOuter - rInner }));
  }

  slices.forEach((slice, i) => {
    const extent = sum > 0 ? (slice.amount / sum) * 360 : 0;
    if (extent <= 0) return;
    const useGap = slices.length > 1 && extent > gapDeg * 2;
    const start = angle + (useGap ? gapDeg / 2 : 0);
    const end = angle + extent - (useGap ? gapDeg / 2 : 0);
    const path = s('path', {
      class: 'donut-slice',
      d: arcPath(cx, cy, rOuter, rInner, start, end),
      fill: slice.color,
      tabindex: '0',
      role: 'listitem',
      'aria-label': `${slice.label}: ${money(slice.amount)}, ${slice.share}%`,
    });
    const enter = (ev) => {
      wrap.classList.add('hovering');
      paths.forEach((p) => p.classList.remove('active'));
      path.classList.add('active');
      showTip(ev, () => tipContent(slice.label, [
        ['Amount', money(slice.amount), slice.color],
        ['Share', `${slice.share}%`],
        ...(slice.folded ? [['Includes', slice.folded.slice(0, 4).join(', ')]] : []),
      ]));
    };
    path.addEventListener('mouseenter', enter);
    path.addEventListener('focus', (ev) => enter({ ...ev, clientX: window.innerWidth / 2, clientY: 120 }));
    path.addEventListener('mousemove', moveTip);
    path.addEventListener('mouseleave', () => { wrap.classList.remove('hovering'); hideTip(); });
    path.addEventListener('blur', () => { wrap.classList.remove('hovering'); hideTip(); });
    paths.push(path);
    svgEl.appendChild(path);
    angle += extent;
  });

  wrap.appendChild(svgEl);
  wrap.appendChild(h('div', { class: 'donut-center' },
    h('div', { class: 'stat-label' }, centerLabel),
    h('div', { class: 'stat-value num' }, money0(sum)),
  ));
  return wrap;
}

/* ---- Line / area ------------------------------------------------- */

function lineChart(points, {
  height = 190, color = 'var(--accent)', valueKey = 'value', labelKey = 'label',
  formatValue = money0, area = true, zeroBaseline = false, id = 'line',
} = {}) {
  const width = 720;
  const padL = 52;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const values = points.map((p) => p[valueKey]);
  let min = Math.min(...values);
  let max = Math.max(...values);
  // Pull zero into view only when the series actually gets near it. Forcing a
  // zero floor on a balance that never drops below $23k flattens the line into
  // a meaningless straight edge; the point of this chart is the shape.
  if (zeroBaseline && (min < 0 || min < max * 0.25)) min = Math.min(0, min);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.08;
  max += span * 0.12;

  const x = (i) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => padT + plotH - ((v - min) / (max - min)) * plotH;

  const svgEl = s('svg', {
    class: 'chart', viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none', role: 'img', style: `height:${height}px`,
  });

  // Recessive gridlines + y labels
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = min + ((max - min) * i) / ticks;
    const yy = y(v);
    svgEl.appendChild(s('line', { class: 'grid-line', x1: padL, x2: width - padR, y1: yy, y2: yy }));
    svgEl.appendChild(s('text', { class: 'axis-label', x: padL - 8, y: yy + 3.5, 'text-anchor': 'end' }, compact(v)));
  }
  if (min < 0 && max > 0) {
    svgEl.appendChild(s('line', { class: 'baseline', x1: padL, x2: width - padR, y1: y(0), y2: y(0) }));
  }

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p[valueKey])}`).join('');

  if (area) {
    const gradId = `grad-${id}`;
    svgEl.appendChild(s('defs', {},
      s('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' },
        s('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': '0.28' }),
        s('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': '0' }),
      )));
    svgEl.appendChild(s('path', {
      d: `${line}L${x(points.length - 1)} ${padT + plotH}L${x(0)} ${padT + plotH}Z`,
      fill: `url(#${gradId})`,
    }));
  }

  svgEl.appendChild(s('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

  // x labels — thinned so they never collide
  const step = Math.max(1, Math.ceil(points.length / 7));
  points.forEach((p, i) => {
    if (i % step !== 0 && i !== points.length - 1) return;
    svgEl.appendChild(s('text', {
      class: 'axis-label', x: x(i), y: height - 8,
      'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle',
    }, p[labelKey]));
  });

  // Crosshair layer
  const crossLine = s('line', { class: 'baseline', y1: padT, y2: padT + plotH, opacity: '0', 'stroke-dasharray': '3 3' });
  const dotRing = s('circle', { r: 6, fill: 'var(--surface)', stroke: color, 'stroke-width': 2, opacity: '0' });
  svgEl.appendChild(crossLine);
  svgEl.appendChild(dotRing);

  const overlay = s('rect', { x: padL, y: padT, width: plotW, height: plotH, fill: 'transparent', style: 'cursor:crosshair' });
  overlay.addEventListener('mousemove', (ev) => {
    const box = svgEl.getBoundingClientRect();
    const rel = ((ev.clientX - box.left) / box.width) * width;
    const i = Math.max(0, Math.min(points.length - 1, Math.round(((rel - padL) / plotW) * (points.length - 1))));
    const p = points[i];
    crossLine.setAttribute('x1', x(i));
    crossLine.setAttribute('x2', x(i));
    crossLine.setAttribute('opacity', '1');
    dotRing.setAttribute('cx', x(i));
    dotRing.setAttribute('cy', y(p[valueKey]));
    dotRing.setAttribute('opacity', '1');
    showTip(ev, () => tipContent(p.tipTitle || p[labelKey], [[p.tipLabel || 'Value', formatValue(p[valueKey]), color]]));
  });
  overlay.addEventListener('mouseleave', () => {
    crossLine.setAttribute('opacity', '0');
    dotRing.setAttribute('opacity', '0');
    hideTip();
  });
  svgEl.appendChild(overlay);

  return svgEl;
}

/* ---- Grouped bars ------------------------------------------------ */

function groupedBars(rows, series, { height = 200 } = {}) {
  const width = 720;
  const padL = 52;
  const padR = 10;
  const padT = 12;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const max = Math.max(1, ...rows.flatMap((r) => series.map((sr) => r[sr.key] || 0)));
  const groupW = plotW / rows.length;
  const gap = 2; // 2px surface gap between adjacent fills
  const barW = Math.max(3, (groupW * 0.62 - gap * (series.length - 1)) / series.length);
  const y = (v) => padT + plotH - (v / max) * plotH;

  const svgEl = s('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none', role: 'img', style: `height:${height}px` });

  for (let i = 0; i <= 3; i++) {
    const v = (max * i) / 3;
    svgEl.appendChild(s('line', { class: 'grid-line', x1: padL, x2: width - padR, y1: y(v), y2: y(v) }));
    svgEl.appendChild(s('text', { class: 'axis-label', x: padL - 8, y: y(v) + 3.5, 'text-anchor': 'end' }, compact(v)));
  }

  rows.forEach((row, ri) => {
    const groupX = padL + ri * groupW + (groupW - (barW * series.length + gap * (series.length - 1))) / 2;
    series.forEach((sr, si) => {
      const v = row[sr.key] || 0;
      const bx = groupX + si * (barW + gap);
      const bh = Math.max(v > 0 ? 2 : 0, (v / max) * plotH);
      const rect = s('rect', {
        x: bx, y: padT + plotH - bh, width: barW, height: bh,
        rx: Math.min(4, barW / 2), fill: sr.color,
        tabindex: '0',
        'aria-label': `${row.label} ${sr.label}: ${money(v)}`,
      });
      const enter = (ev) => showTip(ev, () => tipContent(row.tipTitle || row.label,
        series.map((x2) => [x2.label, money(row[x2.key] || 0), x2.color])
          .concat(row.net !== undefined ? [['Net', money(row.net, { signed: true })]] : [])));
      rect.addEventListener('mouseenter', enter);
      rect.addEventListener('mousemove', moveTip);
      rect.addEventListener('mouseleave', hideTip);
      svgEl.appendChild(rect);
    });

    const showLabel = rows.length <= 8 || ri % Math.ceil(rows.length / 7) === 0 || ri === rows.length - 1;
    if (showLabel) {
      svgEl.appendChild(s('text', { class: 'axis-label', x: groupX + (barW * series.length + gap) / 2, y: height - 8, 'text-anchor': 'middle' }, row.label));
    }
  });

  svgEl.appendChild(s('line', { class: 'baseline', x1: padL, x2: width - padR, y1: padT + plotH, y2: padT + plotH }));
  return svgEl;
}

function legend(series) {
  return h('div', { class: 'legend' },
    series.map((sr) => h('div', { class: 'legend-item' },
      h('span', { class: 'legend-swatch', style: { background: sr.color } }),
      sr.label,
    )));
}

/* ---- Sparkline --------------------------------------------------- */

function sparkline(values, { width = 76, height = 26, color = 'var(--text-3)' } = {}) {
  if (!values || values.length < 2) return h('span');
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (width - 3) + 1.5,
    height - 2 - ((v - min) / span) * (height - 4),
  ]);
  return s('svg', { class: 'spark', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' },
    s('path', {
      d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(''),
      fill: 'none', stroke: color, 'stroke-width': 1.75, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    }),
    s('circle', { cx: pts[pts.length - 1][0].toFixed(1), cy: pts[pts.length - 1][1].toFixed(1), r: 2.4, fill: color }),
  );
}

/* ---- Ranked bars (the donut's table view) ------------------------ */

function rankedBars(rows, { max = null, colorKey = null, limit = 99 } = {}) {
  const top = rows.slice(0, limit);
  const peak = max ?? Math.max(1, ...top.map((r) => r.amount));
  return h('div', {},
    top.map((row) => h('div', { class: 'bar-row' },
      h('div', { class: 'bar-row-top' },
        row.chip ? catIcon(row.icon, row.chip, true) : null,
        h('span', {}, row.label),
        row.share !== undefined ? h('span', { class: 'muted', style: { fontSize: '12px' } }, `${row.share}%`) : null,
      ),
      h('div', { class: 'bar-row-amount num' }, money0(row.amount)),
      h('div', { class: 'bar-track' },
        h('div', {
          class: 'bar-fill',
          style: { width: `${Math.max(1.5, (row.amount / peak) * 100)}%`, background: colorKey ? row[colorKey] : 'var(--accent)' },
        }),
      ),
    )),
  );
}

/* ==========================================================================
   State
   ========================================================================== */

const state = {
  route: 'dashboard',
  month: null,
  data: null,
  meta: null,
  txns: { rows: [], total: 0, offset: 0, q: '', category: '', account: '', direction: '' },
  recurring: null,
  importDraft: null,
};

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'spending', label: 'Spending', icon: 'pie' },
  { id: 'recurring', label: 'Recurring', icon: 'repeat' },
  { id: 'transactions', label: 'Transactions', icon: 'list' },
  { id: 'networth', label: 'Net Worth', icon: 'trendUp' },
  { id: 'budgets', label: 'Budgets', icon: 'target' },
  { id: 'bills', label: 'Bills & Goals', icon: 'calendar' },
  { id: 'import', label: 'Add Data', icon: 'upload' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

/* ==========================================================================
   Views
   ========================================================================== */

function sectionCard(title, note, ...body) {
  return h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', {}, title),
      note ? h('span', { class: 'card-note' }, note) : null,
    ),
    ...body,
  );
}

function statTile(label, value, delta) {
  return h('div', { class: 'tile' },
    h('div', { class: 'stat' },
      h('div', { class: 'stat-label' }, label),
      h('div', { class: 'stat-value num' }, value),
      delta || null,
    ));
}

function deltaChip(value, { invert = false, suffix = '' } = {}) {
  if (value === null || value === undefined) return null;
  const good = invert ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.05;
  return h('div', { class: `stat-delta ${flat ? 'muted' : good ? 'pos' : 'neg'}` },
    flat ? null : icon(value > 0 ? 'trendUp' : 'trendDown', 13, { weight: 2.4 }),
    `${pct(value)}${suffix}`,
  );
}

function alertRow(alert) {
  const iconName = alert.severity === 'good' ? 'check' : alert.type === 'price-increase' ? 'trendUp' : 'alert';
  return h('div', { class: `alert alert-${alert.severity || 'warning'}` },
    h('div', { class: 'alert-icon' }, icon(iconName, 17)),
    h('div', {},
      h('div', { class: 'alert-title' }, alert.title),
      alert.detail ? h('div', { class: 'alert-detail' }, alert.detail) : null,
    ));
}

/* ---- Dashboard --------------------------------------------------- */

function viewDashboard() {
  const d = state.data;
  if (!d) return h('div');
  if (!d.stats.transactionCount) return emptyState();

  const nw = d.netWorth;
  const spendSeries = [
    { key: 'income', label: 'Income', color: '#199e70' },
    { key: 'spending', label: 'Spending', color: '#3987e5' },
  ];

  return h('div', {},
    h('div', { class: 'tiles', style: { marginBottom: '16px' } },
      statTile('Net worth', money0(nw.current), deltaChip(nw.series.length > 1 && nw.series[0].netWorth ? ((nw.current - nw.series[0].netWorth) / Math.abs(nw.series[0].netWorth)) * 100 : null, { suffix: ' this year' })),
      statTile(`Spent in ${d.monthLabel.split(' ')[0]}`, money0(d.headline.spending), deltaChip(d.headline.spendingChange, { invert: true, suffix: ` vs ${d.headline.previousLabel}` })),
      statTile('Recurring / mo', money0(d.recurring.summary.monthlyTotal),
        h('div', { class: 'stat-delta muted' }, `${d.recurring.summary.count} active`)),
      statTile('Left to spend', money0(d.budgets.totals.remaining),
        h('div', { class: `stat-delta ${d.budgets.totals.remaining < 0 ? 'neg' : 'muted'}` }, `${d.budgets.daysLeft} days left`)),
    ),

    d.insights.length ? h('div', { class: 'card', style: { marginBottom: '16px' } },
      h('div', { class: 'card-head' }, h('h2', {}, 'Worth a look')),
      d.insights.slice(0, 4).map(alertRow),
    ) : null,

    h('div', { class: 'grid grid-hero' },
      sectionCard('Where the money went', d.monthLabel,
        h('div', { style: { display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: '24px', alignItems: 'center' } },
          donutChart(d.donut, { total: d.categoryTotal, centerLabel: 'Spent' }),
          h('div', {}, rankedBars(d.categories, { colorKey: 'chip', limit: 7 })),
        ),
        legend(d.donut.map((x) => ({ label: x.label, color: x.color }))),
      ),
      sectionCard('Net worth', 'last 12 months',
        h('div', { class: 'stat', style: { marginBottom: '10px' } },
          h('div', { class: 'stat-hero num' }, money0(nw.current)),
          h('div', { class: 'stat-delta' },
            h('span', { class: nw.change >= 0 ? 'pos' : 'neg' }, `${nw.change >= 0 ? '+' : ''}${money0(nw.change)}`),
            h('span', { class: 'muted' }, 'over the period'),
          )),
        lineChart(nw.series.map((p) => ({ ...p, tipLabel: 'Net worth' })), { valueKey: 'netWorth', height: 150, id: 'nw' }),
      ),
    ),

    h('div', { class: 'grid grid-split', style: { marginTop: '16px' } },
      sectionCard('Income vs spending', 'last 12 months',
        groupedBars(d.trend.map((t) => ({ ...t, tipTitle: t.label })), spendSeries),
        legend(spendSeries),
      ),
      sectionCard('Coming up', `next 30 days · ${money0(d.cashFlow.billsTotal)} in bills`,
        d.cashFlow.bills.length
          ? h('div', { class: 'row-list' },
            d.cashFlow.bills.slice(0, 7).map((b) => {
              const cat = catMeta(b.category);
              return h('div', { class: 'row' },
                catIcon(cat.icon, cat.chip, true),
                h('div', { class: 'row-main' },
                  h('div', { class: 'row-title' }, b.name),
                  h('div', { class: 'row-sub' }, metaParts(
                    fmtDate(b.date), '·', fmtRelative(b.daysAway),
                    b.estimated ? h('span', { class: 'chip' }, 'estimate') : null,
                  )),
                ),
                h('div', { class: 'row-amount num' }, money(b.amount)),
              );
            }))
          : h('p', { class: 'hint' }, 'Nothing scheduled in the next 30 days.'),
      ),
    ),

    h('div', { class: 'grid grid-split', style: { marginTop: '16px' } },
      sectionCard('Budgets', d.budgets.monthLabel,
        d.budgets.rows.length
          ? d.budgets.rows.slice(0, 5).map(budgetRow)
          : h('p', { class: 'hint' }, 'No budgets yet. Set them up on the Budgets tab.'),
      ),
      sectionCard('Top merchants', d.monthLabel,
        rankedBars(d.topMerchants.map((m) => ({ label: m.merchant, amount: m.amount, icon: m.icon, chip: m.chip })), { limit: 7 }),
      ),
    ),
  );
}

function emptyState() {
  return h('div', { class: 'card' },
    h('div', { class: 'empty' },
      icon('upload', 42),
      h('h3', {}, 'Nothing here yet'),
      h('p', {}, 'Import a CSV from your bank, connect an account with Plaid, or load the demo data to look around first.'),
      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '18px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-primary', onclick: () => navigate('import') }, icon('upload', 16), 'Import a CSV'),
        h('button', { class: 'btn', onclick: () => navigate('settings') }, icon('settings', 16), 'Set up Plaid'),
      ),
    ));
}

function budgetRow(row) {
  const color = row.state === 'critical' ? 'var(--critical)'
    : row.state === 'serious' ? 'var(--serious)'
      : row.state === 'warning' ? 'var(--warning)' : 'var(--accent)';
  return h('div', { class: 'budget-row' },
    h('div', { class: 'budget-head' },
      catIcon(row.icon, row.chip, true),
      h('div', {},
        h('div', { style: { fontWeight: '560', fontSize: '14px' } }, row.label),
        h('div', { class: 'hint' },
          row.remaining >= 0 ? `${money0(row.remaining)} left` : `${money0(Math.abs(row.remaining))} over`,
          row.projected ? ` · on pace for ${money0(row.projected)}` : '',
        ),
      ),
      h('div', { class: 'budget-nums' },
        h('div', { class: 'num', style: { fontWeight: '620' } }, money0(row.spent)),
        h('div', { class: 'hint num' }, `of ${money0(row.limit)}`),
      ),
    ),
    h('div', { class: 'budget-track' },
      h('div', { class: 'budget-fill', style: { width: `${Math.min(100, row.pct)}%`, background: color } }),
      state.data?.budgets?.isCurrentMonth
        ? h('div', { class: 'budget-pace', style: { left: `${Math.min(99, state.data.budgets.monthProgress)}%` }, title: 'Where you should be today' })
        : null,
    ),
  );
}

/* ---- Spending ---------------------------------------------------- */

function viewSpending() {
  const d = state.data;
  if (!d || !d.stats.transactionCount) return emptyState();

  const prev = new Map(d.previousCategories.map((r) => [r.category, r.amount]));
  const compare = d.categories.map((r) => ({ ...r, prevAmount: prev.get(r.category) || 0, delta: r.amount - (prev.get(r.category) || 0) }));

  return h('div', {},
    h('div', { class: 'grid grid-hero' },
      sectionCard('Spending by category', d.monthLabel,
        h('div', { style: { display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: '26px', alignItems: 'center' } },
          donutChart(d.donut, { total: d.categoryTotal, size: 230, centerLabel: 'Spent' }),
          h('div', {}, rankedBars(d.categories, { colorKey: 'chip' })),
        ),
        legend(d.donut.map((x) => ({ label: x.label, color: x.color }))),
      ),
      h('div', {},
        sectionCard('This month vs last',
          `${d.headline.previousLabel}: ${money0(d.headline.previousSpending)}`,
          h('div', { class: 'row-list' },
            compare.filter((c) => Math.abs(c.delta) >= 1).slice(0, 9).map((c) =>
              h('div', { class: 'row' },
                catIcon(c.icon, c.chip, true),
                h('div', { class: 'row-main' },
                  h('div', { class: 'row-title' }, c.label),
                  h('div', { class: 'row-sub' }, `was ${money0(c.prevAmount)}`),
                ),
                h('div', { class: `row-amount num ${c.delta > 0 ? 'neg' : 'pos'}` }, `${c.delta > 0 ? '+' : '−'}${money0(Math.abs(c.delta))}`),
              )),
          )),
      ),
    ),
    sectionCard('Monthly trend', 'income vs spending, last 12 months',
      groupedBars(d.trend, [
        { key: 'income', label: 'Income', color: '#199e70' },
        { key: 'spending', label: 'Spending', color: '#3987e5' },
      ], { height: 230 }),
      legend([{ label: 'Income', color: '#199e70' }, { label: 'Spending', color: '#3987e5' }]),
    ),
    sectionCard('Top merchants', d.monthLabel,
      h('div', { class: 'row-list' },
        d.topMerchants.map((m) => h('div', { class: 'row', onclick: () => { state.txns.q = m.merchant; navigate('transactions'); } },
          catIcon(m.icon, m.chip, true),
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title' }, m.merchant),
            h('div', { class: 'row-sub' }, `${m.count} ${m.count === 1 ? 'transaction' : 'transactions'}`),
          ),
          h('div', { class: 'row-amount num' }, money(m.amount)),
        )),
      )),
  );
}

/* ---- Recurring --------------------------------------------------- */

function viewRecurring() {
  const r = state.recurring;
  if (!r) return loadingCard();
  if (!state.data?.stats.transactionCount) return emptyState();

  const active = r.streams.filter((x) => !x.cancelled && x.status !== 'inactive');
  const dormant = r.streams.filter((x) => x.status === 'inactive' && !x.cancelled);
  const cancelled = r.streams.filter((x) => x.cancelled);

  return h('div', {},
    h('div', { class: 'tiles', style: { marginBottom: '16px' } },
      statTile('Per month', money0(r.summary.monthlyTotal), h('div', { class: 'stat-delta muted' }, `${r.summary.count} charges`)),
      statTile('Per year', money0(r.summary.annualTotal)),
      statTile('Recurring income', money0(r.summary.monthlyIncome), h('div', { class: 'stat-delta muted' }, 'per month')),
      statTile('Gone quiet', String(r.summary.inactiveCount), h('div', { class: 'stat-delta muted' }, 'no recent charge')),
    ),

    r.alerts.length ? h('div', { class: 'card', style: { marginBottom: '16px' } },
      h('div', { class: 'card-head' }, h('h2', {}, 'Needs attention'), h('span', { class: 'card-note' }, `${r.alerts.length} found`)),
      r.alerts.map(alertRow),
    ) : null,

    sectionCard('Active', `${active.length} charges · ${money0(r.summary.monthlyTotal)}/mo`,
      active.length ? h('div', { class: 'stream-list' }, active.map(streamRow))
        : h('p', { class: 'hint' }, 'No recurring charges found yet. Detection needs at least two or three occurrences of the same merchant.')),

    dormant.length ? sectionCard('Stopped charging', 'these may already be cancelled',
      h('div', { class: 'stream-list' }, dormant.map(streamRow))) : null,

    cancelled.length ? sectionCard('Marked cancelled', null,
      h('div', { class: 'stream-list' }, cancelled.map(streamRow))) : null,

    r.income.length ? sectionCard('Recurring income', null,
      h('div', { class: 'stream-list' }, r.income.map(streamRow))) : null,
  );
}

function streamRow(stream) {
  const cat = catMeta(stream.category);
  const cls = `stream${stream.cancelled ? ' cancelled' : stream.status === 'inactive' ? ' inactive' : ''}`;
  const isIncome = stream.direction === 'in';

  return h('div', { class: cls },
    catIcon(cat.icon, cat.chip),
    h('div', { class: 'stream-main' },
      h('div', { class: 'stream-name' },
        stream.name,
        stream.priceChange && stream.priceChange.direction === 'up'
          ? h('span', { class: 'chip chip-serious' }, icon('trendUp', 12, { weight: 2.5 }), `+${stream.priceChange.pct}%`) : null,
        stream.priceChange && stream.priceChange.direction === 'down'
          ? h('span', { class: 'chip chip-good' }, icon('trendDown', 12, { weight: 2.5 }), `${stream.priceChange.pct}%`) : null,
        stream.status === 'late' ? h('span', { class: 'chip chip-warning' }, 'late') : null,
        stream.status === 'inactive' ? h('span', { class: 'chip' }, 'no recent charge') : null,
        stream.trialConverted ? h('span', { class: 'chip chip-warning' }, 'trial ended') : null,
      ),
      h('div', { class: 'stream-meta' },
        metaParts(
          stream.cadenceLabel,
          '·',
          stream.cancelled ? 'cancelled'
            : stream.status === 'inactive' ? `last seen ${fmtDate(stream.lastDate)}`
              : `next ${fmtDate(stream.nextDate)} · ${fmtRelative(stream.daysUntilNext)}`,
          stream.amountVaries ? h('span', { class: 'chip' }, `${money0(stream.minAmount)}–${money0(stream.maxAmount)}`) : null,
          h('span', { class: 'muted' }, `${stream.occurrences}×`),
        )),
    ),
    h('div', { class: 'stream-right' },
      sparkline(stream.history.map((x) => x.amount), { color: stream.priceChange?.direction === 'up' ? 'var(--serious)' : 'var(--text-3)' }),
      h('div', {},
        h('div', { class: `stream-amount num ${isIncome ? 'pos' : ''}` }, money0(stream.amount, { cents: stream.amount < 100 })),
        h('div', { class: 'hint num' }, `${money0(stream.monthlyAmount)}/mo`),
      ),
      h('div', { class: 'stream-actions' },
        !stream.cancelled
          ? h('button', {
            class: 'btn btn-sm', title: 'Mark as cancelled',
            onclick: () => overrideStream(stream.key, { status: 'cancelled' }, `${stream.name} marked cancelled`),
          }, icon('check', 14))
          : h('button', {
            class: 'btn btn-sm', title: 'Undo',
            onclick: () => overrideStream(stream.key, { status: null }, 'Restored'),
          }, icon('refresh', 14)),
        h('button', {
          class: 'btn btn-sm btn-danger', title: 'Not a recurring charge',
          onclick: () => overrideStream(stream.key, { status: 'ignored' }, 'Hidden from recurring'),
        }, icon('x', 14)),
      ),
    ),
  );
}

async function overrideStream(key, patch, message) {
  try {
    await api('/recurring/override', { method: 'POST', body: { key, ...patch } });
    await loadRecurring();
    render();
    toast(message);
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ---- Transactions ------------------------------------------------ */

function viewTransactions() {
  const meta = state.meta;
  const f = state.txns;

  const filters = h('div', { class: 'txn-filters' },
    h('input', {
      class: 'input search', type: 'search', placeholder: 'Search merchants, descriptions, notes…',
      value: f.q,
      oninput: debounce((e) => { f.q = e.target.value; f.offset = 0; loadTransactions().then(render); }, 260),
    }),
    h('select', {
      class: 'input', value: f.category,
      onchange: (e) => { f.category = e.target.value; f.offset = 0; loadTransactions().then(render); },
    },
    h('option', { value: '' }, 'All categories'),
    meta.categories.map((c) => h('option', { value: c.id, selected: f.category === c.id }, c.label)),
    ),
    h('select', {
      class: 'input', value: f.account,
      onchange: (e) => { f.account = e.target.value; f.offset = 0; loadTransactions().then(render); },
    },
    h('option', { value: '' }, 'All accounts'),
    (state.data?.accounts || []).map((a) => h('option', { value: a.id, selected: f.account === a.id }, a.name)),
    ),
    h('select', {
      class: 'input', value: f.direction,
      onchange: (e) => { f.direction = e.target.value; f.offset = 0; loadTransactions().then(render); },
    },
    h('option', { value: '' }, 'Money in & out'),
    h('option', { value: 'out', selected: f.direction === 'out' }, 'Money out'),
    h('option', { value: 'in', selected: f.direction === 'in' }, 'Money in'),
    ),
    h('a', { class: 'btn btn-sm', href: '/api/export/csv' }, icon('download', 14), 'Export'),
  );

  return h('div', {},
    h('div', { class: 'card' },
      filters,
      h('div', { class: 'hint', style: { marginBottom: '10px' } },
        `${f.total.toLocaleString()} ${f.total === 1 ? 'transaction' : 'transactions'}`,
        f.sum ? ` · ${money(f.sum)} out` : '',
      ),
      f.rows.length
        ? h('div', {}, f.rows.map(txnRow))
        : h('div', { class: 'empty' }, h('h3', {}, 'Nothing matches'), h('p', {}, 'Try a different search or clear the filters.')),
      f.rows.length < f.total
        ? h('div', { style: { textAlign: 'center', marginTop: '14px' } },
          h('button', {
            class: 'btn',
            onclick: async (e) => { e.target.disabled = true; f.offset = f.rows.length; await loadTransactions(true); render(); },
          }, `Load more (${(f.total - f.rows.length).toLocaleString()} left)`))
        : null,
    ));
}

function txnRow(t) {
  return h('div', { class: `txn${t.excluded ? ' excluded' : ''}` },
    catIcon(t.categoryIcon, t.categoryChip, true),
    h('div', { style: { minWidth: '0' } },
      h('div', { class: 'txn-name' }, t.merchant || t.rawName),
      h('div', { class: 'txn-sub' }, `${fmtDate(t.date)} · ${t.accountName}`, t.pending ? ' · pending' : '', t.notes ? ` · ${t.notes}` : ''),
    ),
    h('select', {
      class: 'txn-cat-select',
      onchange: (e) => updateTxn(t.id, { category: e.target.value, applyToAll: e.target.dataset.all === '1' }),
      oncontextmenu: (e) => e.preventDefault(),
      title: 'Change category',
    },
    state.meta.categories.map((c) => h('option', { value: c.id, selected: c.id === t.category }, c.label)),
    ),
    h('div', { class: `txn-amount ${t.amount < 0 ? 'pos' : ''}` }, t.amount < 0 ? money(-t.amount, { signed: true }) : money(t.amount)),
    h('button', {
      class: 'btn btn-sm btn-ghost txn-actions',
      title: t.excluded ? 'Include in totals' : 'Exclude from totals',
      onclick: () => updateTxn(t.id, { excluded: !t.excluded }),
    }, icon(t.excluded ? 'eye' : 'x', 14)),
  );
}

async function updateTxn(txnId, patch) {
  try {
    const res = await api(`/transactions/${txnId}`, { method: 'PATCH', body: patch });
    if (res.alsoUpdated) toast(`Updated, and ${res.alsoUpdated} similar ${res.alsoUpdated === 1 ? 'transaction' : 'transactions'}`);
    await Promise.all([loadDashboard(), loadTransactions(), loadRecurring()]);
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ---- Net worth --------------------------------------------------- */

function viewNetWorth() {
  const d = state.data;
  if (!d || !d.accounts.length) return emptyState();
  const assets = d.accounts.filter((a) => !a.isDebt);
  const debts = d.accounts.filter((a) => a.isDebt);

  return h('div', {},
    h('div', { class: 'card' },
      h('div', { class: 'stat', style: { marginBottom: '16px' } },
        h('div', { class: 'stat-label' }, 'Net worth'),
        h('div', { class: 'stat-hero num' }, money(d.netWorth.current)),
        h('div', { class: 'stat-delta' },
          h('span', { class: d.netWorth.change >= 0 ? 'pos' : 'neg' },
            `${d.netWorth.change >= 0 ? '+' : '−'}${money0(Math.abs(d.netWorth.change))}`),
          h('span', { class: 'muted' }, 'over the last 12 months'),
        )),
      lineChart(d.netWorth.series.map((p) => ({ ...p, tipLabel: 'Net worth' })), { valueKey: 'netWorth', height: 260, id: 'nw-big' }),
      h('div', { class: 'grid grid-2', style: { marginTop: '18px' } },
        h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Assets'), h('div', { class: 'stat-value num pos' }, money(d.netWorth.assets))),
        h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Debts'), h('div', { class: 'stat-value num neg' }, money(d.netWorth.debts))),
      ),
    ),

    sectionCard('Accounts', `${d.accounts.length} connected`,
      h('div', { style: { marginBottom: assets.length && debts.length ? '18px' : '0' } },
        assets.length ? h('div', { class: 'stat-label', style: { marginBottom: '9px' } }, 'Assets') : null,
        assets.map(accountRow),
      ),
      debts.length ? h('div', {},
        h('div', { class: 'stat-label', style: { marginBottom: '9px' } }, 'Debts'),
        debts.map(accountRow),
      ) : null,
      h('button', { class: 'btn', style: { marginTop: '14px' }, onclick: addAccountModal }, icon('plus', 15), 'Add an account manually'),
    ),
  );
}

function accountRow(a) {
  const initials = (a.institution || a.name || '?').replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
  return h('div', { class: 'account' },
    h('div', { class: 'account-logo' }, initials),
    h('div', { style: { minWidth: '0' } },
      h('div', { class: 'account-name' }, a.name),
      h('div', { class: 'account-sub' },
        [a.institution, a.mask ? `••${a.mask}` : null, a.subtype || a.type].filter(Boolean).join(' · '),
        a.limit ? ` · ${money0(a.limit)} limit` : '',
      ),
    ),
    h('div', { class: 'account-balance num' },
      h('span', { class: a.isDebt ? 'neg' : '' }, money(Math.abs(a.currentBalance))),
      h('div', { class: 'hint', style: { fontWeight: '400' } },
        h('button', {
          class: 'btn btn-sm btn-ghost',
          onclick: () => editBalanceModal(a),
        }, 'Update'),
      ),
    ),
  );
}

/* ---- Budgets ----------------------------------------------------- */

function viewBudgets() {
  const d = state.data;
  if (!d) return loadingCard();
  const b = d.budgets;

  return h('div', {},
    h('div', { class: 'tiles', style: { marginBottom: '16px' } },
      statTile('Budgeted', money0(b.totals.limit)),
      statTile('Spent', money0(b.totals.spent)),
      statTile('Remaining', money0(b.totals.remaining),
        h('div', { class: `stat-delta ${b.totals.remaining < 0 ? 'neg' : 'muted'}` }, `${b.daysLeft} days left`)),
      statTile('Unbudgeted spend', money0(b.totals.unbudgetedSpend)),
    ),

    h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h2', {}, 'Monthly budgets'),
        h('span', { class: 'card-note' }, b.monthLabel),
        h('div', { class: 'spacer' }),
        !b.rows.length ? h('button', { class: 'btn btn-sm btn-primary', onclick: suggestBudgets }, 'Suggest from my history') : null,
        h('button', { class: 'btn btn-sm', onclick: budgetModal }, icon('plus', 14), 'Add'),
      ),
      b.rows.length
        ? b.rows.map((row) => h('div', { style: { position: 'relative' } },
          budgetRow(row),
          h('button', {
            class: 'btn btn-sm btn-ghost',
            style: { position: 'absolute', top: '10px', right: '-4px' },
            title: 'Edit budget',
            onclick: () => budgetModal(row),
          }, icon('settings', 13)),
        ))
        : h('div', { class: 'empty' },
          icon('target', 36),
          h('h3', {}, 'No budgets set'),
          h('p', {}, 'Let the app propose budgets from what you actually spent over the last four months, then adjust.'),
          h('button', { class: 'btn btn-primary', style: { marginTop: '16px' }, onclick: suggestBudgets }, 'Suggest budgets'),
        ),
    ),

    b.unbudgeted.length ? sectionCard('Spending without a budget', b.monthLabel,
      h('div', { class: 'row-list' },
        b.unbudgeted.map((u) => h('div', { class: 'row' },
          catIcon(u.icon, u.chip, true),
          h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, u.label)),
          h('div', { class: 'row-amount num' }, money0(u.amount)),
          h('button', { class: 'btn btn-sm', onclick: () => budgetModal({ category: u.category, label: u.label, limit: Math.ceil(u.amount / 25) * 25 }) }, 'Budget it'),
        )),
      )) : null,
  );
}

/* ---- Bills & goals ----------------------------------------------- */

function viewBills() {
  const d = state.data;
  if (!d) return loadingCard();
  const flow = d.cashFlow;
  const goals = d.goals;

  return h('div', {},
    h('div', { class: 'grid grid-hero' },
      sectionCard('Cash flow forecast', 'next 30 days',
        h('div', { class: 'grid grid-3', style: { marginBottom: '14px' } },
          h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Cash today'), h('div', { class: 'stat-value num' }, money0(flow.startingCash))),
          h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Bills due'), h('div', { class: 'stat-value num neg' }, money0(flow.billsTotal))),
          h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Projected'), h('div', { class: 'stat-value num' }, money0(flow.projectedEnd))),
        ),
        flow.negative
          ? alertRow({ severity: 'critical', title: `Projected to dip below zero on ${fmtDate(flow.lowPoint.date)}`, detail: `Low point is ${money(flow.lowPoint.balance)}.` })
          : null,
        lineChart(flow.points.map((p) => ({ ...p, label: fmtDate(p.date), tipLabel: 'Projected balance' })),
          { valueKey: 'balance', height: 170, zeroBaseline: true, id: 'flow', color: flow.negative ? 'var(--serious)' : 'var(--accent)' }),
      ),
      sectionCard('Bills calendar', 'next 30 days', billsCalendar(flow.bills)),
    ),

    h('div', { class: 'card', style: { marginTop: '16px' } },
      h('div', { class: 'card-head' },
        h('h2', {}, 'Savings goals'),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm', onclick: () => goalModal() }, icon('plus', 14), 'New goal'),
      ),
      goals.length
        ? h('div', { class: 'grid grid-3' }, goals.map(goalCard))
        : h('div', { class: 'empty' }, icon('piggy', 36), h('h3', {}, 'No goals yet'), h('p', {}, 'Set a target and track progress toward it.')),
    ),
  );
}

function billsCalendar(bills) {
  const today = parseISO(todayISO());
  const byDate = new Map();
  for (const b of bills) {
    if (!byDate.has(b.date)) byDate.set(b.date, []);
    byDate.get(b.date).push(b);
  }

  // A rolling five-week window from the start of this week, rather than the
  // calendar month — the card promises "next 30 days", and a month grid would
  // push early-next-month bills into greyed-out trailing cells.
  const cells = [];
  const cursor = new Date(today);
  cursor.setDate(cursor.getDate() - cursor.getDay());

  for (let i = 0; i < 35; i++) {
    const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    const dayBills = byDate.get(dateStr) || [];
    const totalOut = dayBills.reduce((a, b) => a + b.amount, 0);
    const isToday = dateStr === todayISO();
    const past = dateStr < todayISO();
    const firstOfMonth = cursor.getDate() === 1;

    const cell = h('div', {
      class: `cal-day${past ? ' other' : ''}${isToday ? ' today' : ''}${dayBills.length ? ' has-bill' : ''}`,
      tabindex: dayBills.length ? '0' : null,
    },
    h('div', { class: 'cal-daynum' },
      firstOfMonth ? cursor.toLocaleDateString('en-US', { month: 'short' }) + ' 1' : String(cursor.getDate())),
    dayBills.length ? h('div', { class: 'cal-dots' },
      dayBills.slice(0, 4).map((b) => h('span', { class: 'cal-dot', style: { background: catMeta(b.category).chip } }))) : null,
    dayBills.length ? h('div', { class: 'cal-amount' }, compact(totalOut)) : null,
    );

    if (dayBills.length) {
      const show = (ev) => showTip(ev, () => tipContent(fmtDate(dateStr, { year: true }),
        dayBills.map((b) => [b.name, money(b.amount), catMeta(b.category).chip])));
      cell.addEventListener('mouseenter', show);
      cell.addEventListener('mousemove', moveTip);
      cell.addEventListener('mouseleave', hideTip);
      cell.addEventListener('focus', (ev) => show({ ...ev, clientX: window.innerWidth / 2, clientY: 200 }));
      cell.addEventListener('blur', hideTip);
    }
    cells.push(cell);
    cursor.setDate(cursor.getDate() + 1);
  }

  return h('div', {},
    h('div', { class: 'cal' },
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => h('div', { class: 'cal-dow', key: i }, d)),
      cells,
    ));
}

function goalCard(g) {
  return h('div', { class: 'goal' },
    h('div', { class: 'goal-head' },
      h('div', { class: 'goal-name' }, g.name),
      g.complete ? h('span', { class: 'chip chip-good' }, icon('check', 12, { weight: 3 }), 'Done') : null,
      g.overdue ? h('span', { class: 'chip chip-warning' }, 'Past due') : null,
    ),
    h('div', { class: 'hint' },
      g.targetDate ? `Target ${fmtDate(g.targetDate, { year: true })}` : 'No deadline',
      g.requiredPerMonth && !g.complete ? ` · ${money0(g.requiredPerMonth)}/mo to get there` : '',
    ),
    h('div', { class: 'goal-track' }, h('div', { class: 'goal-fill', style: { width: `${g.pct}%` } })),
    h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '6px' } },
      h('span', { class: 'num', style: { fontWeight: '650', fontSize: '17px' } }, money0(g.currentAmount)),
      h('span', { class: 'hint num' }, `of ${money0(g.targetAmount)} · ${g.pct}%`),
    ),
    h('div', { style: { display: 'flex', gap: '6px', marginTop: '12px' } },
      h('button', { class: 'btn btn-sm', onclick: () => contributeModal(g) }, icon('plus', 13), 'Add'),
      h('button', { class: 'btn btn-sm btn-ghost', onclick: () => goalModal(g) }, 'Edit'),
      h('button', {
        class: 'btn btn-sm btn-ghost btn-danger',
        onclick: async () => {
          if (!confirm(`Delete the goal "${g.name}"?`)) return;
          await api(`/goals/${g.id}`, { method: 'DELETE' });
          await loadDashboard(); render(); toast('Goal deleted');
        },
      }, icon('trash', 13)),
    ),
  );
}

/* ---- Import ------------------------------------------------------ */

function viewImport() {
  const draft = state.importDraft;

  return h('div', {},
    h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Import a statement')),
      h('p', { class: 'hint', style: { marginTop: '-8px', marginBottom: '16px' } },
        'Export transactions as CSV from your bank\'s website, then drop the file here. Columns are detected automatically — Chase, Amex, Capital One, Wells Fargo, Citi, Discover and most others work as-is. Nothing is uploaded anywhere; the file is read by the app running on your own machine.'),
      dropzone(),
    ),
    draft ? importPreview(draft) : null,
    importHistory(),
    plaidCard(),
  );
}

function dropzone() {
  const input = h('input', {
    type: 'file', accept: '.csv,.txt,.tsv,text/csv', style: { display: 'none' },
    onchange: (e) => e.target.files[0] && readFile(e.target.files[0]),
  });

  const zone = h('div', {
    class: 'dropzone', tabindex: '0', role: 'button',
    onclick: () => input.click(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } },
    ondragover: (e) => { e.preventDefault(); zone.classList.add('over'); },
    ondragleave: () => zone.classList.remove('over'),
    ondrop: (e) => {
      e.preventDefault();
      zone.classList.remove('over');
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    },
  },
  icon('upload', 34),
  h('h3', {}, 'Drop a CSV here'),
  h('p', {}, 'or click to choose a file'),
  input,
  );
  return zone;
}

async function readFile(file) {
  try {
    const text = await file.text();
    toast('Reading file…');
    const result = await api('/import/analyze', { method: 'POST', body: { text } });
    state.importDraft = { ...result, text, filename: file.name };
    render();
    if (!result.ok) toast(result.error, 'error');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function importPreview(draft) {
  if (!draft.ok) {
    return h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Could not read that file')),
      h('p', { class: 'hint' }, draft.error),
      draft.rawSample ? h('table', { class: 'preview-table', style: { marginTop: '12px' } },
        h('tbody', {}, draft.rawSample.slice(0, 5).map((row) =>
          h('tr', {}, row.slice(0, 8).map((cell) => h('td', {}, cell || '—')))))) : null,
      h('button', { class: 'btn', style: { marginTop: '14px' }, onclick: () => { state.importDraft = null; render(); } }, 'Try another file'),
    );
  }

  const accounts = state.data?.accounts || [];
  let accountChoice = accounts[0]?.id || '__new__';
  let newName = draft.filename.replace(/\.[^.]+$/, '').slice(0, 40) || 'Imported Account';
  let newType = draft.totals.spending > draft.totals.income * 1.4 ? 'credit' : 'depository';

  const commit = async (btn) => {
    btn.disabled = true;
    try {
      const res = await api('/import/commit', {
        method: 'POST',
        body: {
          text: draft.text,
          filename: draft.filename,
          overrides: { signConvention: draft.signConvention, columns: draft.roles, dateOrder: draft.dateOrder },
          accountId: accountChoice === '__new__' ? null : accountChoice,
          newAccount: { name: newName, type: newType, institution: 'Imported' },
        },
      });
      state.importDraft = null;
      await refreshAll();
      navigate('dashboard');
      toast(`Imported ${res.imported} transactions${res.duplicates ? ` · skipped ${res.duplicates} already there` : ''}`);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  };

  const flipSign = async () => {
    const next = draft.signConvention === 'negative-is-spending' ? 'positive-is-spending' : 'negative-is-spending';
    const result = await api('/import/analyze', { method: 'POST', body: { text: draft.text, overrides: { signConvention: next, columns: draft.roles, dateOrder: draft.dateOrder } } });
    state.importDraft = { ...result, text: draft.text, filename: draft.filename };
    render();
  };

  return h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', {}, 'Check this looks right'),
      h('span', { class: 'card-note' }, draft.filename),
    ),

    h('div', { class: 'detect-grid' },
      h('div', { class: 'detect-item' }, h('div', { class: 'stat-label' }, 'Transactions'), h('div', { class: 'v num' }, draft.count.toLocaleString())),
      h('div', { class: 'detect-item' }, h('div', { class: 'stat-label' }, 'Date range'),
        h('div', { class: 'v' }, draft.dateRange.from ? `${fmtDate(draft.dateRange.from, { year: true })} → ${fmtDate(draft.dateRange.to, { year: true })}` : '—')),
      h('div', { class: 'detect-item' }, h('div', { class: 'stat-label' }, 'Money out'), h('div', { class: 'v num' }, money0(draft.totals.spending))),
      h('div', { class: 'detect-item' }, h('div', { class: 'stat-label' }, 'Money in'), h('div', { class: 'v num pos' }, money0(draft.totals.income))),
      draft.skipped ? h('div', { class: 'detect-item' }, h('div', { class: 'stat-label' }, 'Unreadable rows'), h('div', { class: 'v' }, String(draft.skipped))) : null,
    ),

    h('div', { class: 'alert alert-warning', style: { marginBottom: '16px' } },
      h('div', { class: 'alert-icon' }, icon('info', 17)),
      h('div', {},
        h('div', { class: 'alert-title' }, `Reading ${draft.signConvention === 'negative-is-spending' ? 'negative' : 'positive'} amounts as spending`),
        h('div', { class: 'alert-detail' },
          `Guessed from ${draft.signReason}. `,
          `That gives ${money0(draft.totals.spending)} spent and ${money0(draft.totals.income)} received across ${draft.count} rows. `,
          'If those look swapped, flip it.'),
        h('button', { class: 'btn btn-sm', style: { marginTop: '9px' }, onclick: flipSign }, icon('refresh', 13), 'Flip'),
      )),

    h('table', { class: 'preview-table' },
      h('thead', {}, h('tr', {},
        h('th', {}, 'Date'), h('th', {}, 'Merchant'), h('th', {}, 'Category'), h('th', { class: 'num' }, 'Amount'))),
      h('tbody', {}, draft.sample.map((t) => h('tr', {},
        h('td', { class: 'muted' }, fmtDate(t.date)),
        h('td', {}, h('div', { style: { fontWeight: '540' } }, t.merchant), h('div', { class: 'hint', style: { fontSize: '11.5px' } }, t.rawName.slice(0, 52))),
        h('td', {}, h('span', { class: 'chip' }, t.categoryLabel)),
        h('td', { class: `num ${t.amount < 0 ? 'pos' : ''}` }, money(t.amount)),
      ))),
    ),

    h('div', { class: 'divider' }),

    h('div', { class: 'grid grid-2' },
      h('label', { class: 'field' },
        h('span', {}, 'Add to which account?'),
        h('select', { class: 'input', onchange: (e) => { accountChoice = e.target.value; render(); } },
          accounts.map((a) => h('option', { value: a.id }, `${a.name}${a.mask ? ` ••${a.mask}` : ''}`)),
          h('option', { value: '__new__', selected: accountChoice === '__new__' }, '＋ Create a new account'),
        )),
      accountChoice === '__new__'
        ? h('div', {},
          h('label', { class: 'field' }, h('span', {}, 'Account name'),
            h('input', { class: 'input', value: newName, oninput: (e) => { newName = e.target.value; } })),
          h('label', { class: 'field' }, h('span', {}, 'Type'),
            h('select', { class: 'input', onchange: (e) => { newType = e.target.value; } },
              h('option', { value: 'depository', selected: newType === 'depository' }, 'Checking / Savings'),
              h('option', { value: 'credit', selected: newType === 'credit' }, 'Credit card'),
              h('option', { value: 'loan' }, 'Loan'),
              h('option', { value: 'investment' }, 'Investment'),
            )))
        : null,
    ),

    h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } },
      h('button', { class: 'btn btn-primary', onclick: (e) => commit(e.currentTarget) }, icon('check', 15), `Import ${draft.count.toLocaleString()} transactions`),
      h('button', { class: 'btn btn-ghost', onclick: () => { state.importDraft = null; render(); } }, 'Cancel'),
    ),
  );
}

function importHistory() {
  const batches = state.importBatches || [];
  if (!batches.length) return null;
  return sectionCard('Recent imports', null,
    h('div', { class: 'row-list' },
      batches.slice(0, 6).map((b) => h('div', { class: 'row' },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title' }, b.filename),
          h('div', { class: 'row-sub' },
            `${b.count} imported`,
            b.duplicates ? ` · ${b.duplicates} duplicates skipped` : '',
            ` · ${fmtDate(b.createdAt.slice(0, 10), { year: true })}`),
        ),
        h('button', {
          class: 'btn btn-sm btn-ghost btn-danger',
          onclick: async () => {
            if (!confirm(`Undo this import? ${b.count} transactions will be removed.`)) return;
            const res = await api(`/import/${b.id}`, { method: 'DELETE' });
            await refreshAll();
            toast(`Removed ${res.removed} transactions`);
          },
        }, 'Undo'),
      ))));
}

/* ---- Plaid ------------------------------------------------------- */

function plaidCard() {
  const p = state.meta?.plaid;
  if (!p) return null;

  if (!p.configured) {
    return h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Connect a bank directly'), h('span', { class: 'chip' }, 'not set up')),
      h('p', { class: 'hint' },
        'Live bank syncing runs through Plaid, the same aggregator Rocket Money and most budgeting apps use. It is already wired up here — it just needs your own free API keys, because those are tied to your account, not the app.'),
      h('ol', { class: 'hint', style: { paddingLeft: '18px', lineHeight: '1.9', marginTop: '10px' } },
        h('li', {}, 'Sign up at ', h('a', { href: 'https://dashboard.plaid.com/signup', target: '_blank', rel: 'noopener' }, 'dashboard.plaid.com'), ' — free, no card needed'),
        h('li', {}, 'Copy ', h('code', {}, 'client_id'), ' and the ', h('code', {}, 'sandbox'), ' secret from the Keys page'),
        h('li', {}, 'Put them in the ', h('code', {}, '.env'), ' file next to this app (see ', h('code', {}, '.env.example'), ')'),
        h('li', {}, 'Restart the app — a "Link a bank" button appears right here'),
      ),
      h('p', { class: 'hint', style: { marginTop: '10px' } },
        'Sandbox uses fake banks so you can test the whole flow safely (log in with ', h('code', {}, 'user_good'), ' / ', h('code', {}, 'pass_good'), '). Real bank access needs Production access from Plaid, which their free Trial plan covers for up to 10 linked banks.'),
    );
  }

  return h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', {}, 'Connected banks'),
      h('span', { class: `chip ${p.environment === 'production' ? 'chip-good' : ''}` }, p.environment),
      h('div', { class: 'spacer' }),
      p.items.length ? h('button', { class: 'btn btn-sm', onclick: syncPlaid }, icon('refresh', 14), 'Sync now') : null,
      h('button', { class: 'btn btn-sm btn-primary', onclick: startPlaidLink }, icon('link', 14), 'Link a bank'),
    ),
    p.items.length
      ? p.items.map((item) => h('div', { class: 'account' },
        h('div', { class: 'account-logo' }, icon('bank', 18)),
        h('div', { style: { minWidth: 0 } },
          h('div', { class: 'account-name' }, item.institutionName),
          h('div', { class: 'account-sub' },
            `${item.accountCount} ${item.accountCount === 1 ? 'account' : 'accounts'}`,
            item.lastSync ? ` · synced ${new Date(item.lastSync).toLocaleString()}` : ' · never synced'),
        ),
        h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' } },
          item.status === 'reauth' ? h('span', { class: 'chip chip-warning' }, 'needs sign-in') : null,
          item.status === 'error' ? h('span', { class: 'chip chip-critical', title: item.error || '' }, 'error') : null,
          h('button', {
            class: 'btn btn-sm btn-ghost btn-danger',
            onclick: async () => {
              if (!confirm(`Disconnect ${item.institutionName}? Transactions already imported will stay.`)) return;
              await api(`/plaid/items/${item.id}`, { method: 'DELETE' });
              await refreshAll();
              toast('Disconnected');
            },
          }, 'Disconnect'),
        ),
      ))
      : h('div', {},
        h('p', { class: 'hint' }, 'No banks linked yet. In sandbox, log in with username ', h('code', {}, 'user_good'), ' and password ', h('code', {}, 'pass_good'), '.'),
        p.environment === 'sandbox'
          ? h('button', {
            class: 'btn', style: { marginTop: '12px' },
            onclick: async (e) => {
              e.target.disabled = true;
              try { await api('/plaid/sandbox-link', { method: 'POST', body: {} }); await refreshAll(); toast('Sandbox bank linked'); }
              catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
            },
          }, 'Link a test bank without the popup')
          : null,
      ),
  );
}

let plaidScriptPromise = null;
function loadPlaidScript() {
  if (plaidScriptPromise) return plaidScriptPromise;
  plaidScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Plaid Link. Check your internet connection.'));
    document.head.appendChild(script);
  });
  return plaidScriptPromise;
}

async function startPlaidLink() {
  try {
    toast('Preparing Plaid…');
    const [{ linkToken }] = await Promise.all([api('/plaid/link-token', { method: 'POST', body: {} }), loadPlaidScript()]);
    const handler = window.Plaid.create({
      token: linkToken,
      onSuccess: async (publicToken, metadata) => {
        try {
          toast('Linking and pulling transactions…');
          const res = await api('/plaid/exchange', { method: 'POST', body: { publicToken, metadata } });
          await refreshAll();
          toast(`Linked. ${res.sync?.added ?? 0} transactions imported.`);
        } catch (err) {
          toast(err.message, 'error');
        }
      },
      onExit: (err) => { if (err) toast(err.display_message || err.error_message || 'Link cancelled', 'error'); },
    });
    handler.open();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function syncPlaid() {
  try {
    toast('Syncing…');
    const { results } = await api('/plaid/sync', { method: 'POST', body: {} });
    await refreshAll();
    const added = results.reduce((a, r) => a + (r.added || 0), 0);
    const errored = results.find((r) => r.error);
    if (errored) toast(errored.error, 'error');
    else toast(added ? `${added} new transactions` : 'Already up to date');
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ---- Settings ---------------------------------------------------- */

function viewSettings() {
  const meta = state.meta;
  return h('div', {},
    plaidCard(),

    sectionCard('Your data', 'everything lives in data/db.json on this machine',
      h('div', { class: 'grid grid-4', style: { marginBottom: '16px' } },
        h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Transactions'), h('div', { class: 'stat-value num' }, meta.counts.transactions.toLocaleString())),
        h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Accounts'), h('div', { class: 'stat-value num' }, String(meta.counts.accounts))),
        h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Budgets'), h('div', { class: 'stat-value num' }, String(meta.counts.budgets))),
        h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, 'Goals'), h('div', { class: 'stat-value num' }, String(meta.counts.goals))),
      ),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('a', { class: 'btn', href: '/api/export/csv' }, icon('download', 15), 'Export transactions (CSV)'),
        h('a', { class: 'btn', href: '/api/export/json' }, icon('download', 15), 'Back up everything (JSON)'),
        h('button', {
          class: 'btn',
          onclick: async () => {
            const res = await api('/recategorize', { method: 'POST', body: {} });
            await refreshAll();
            toast(`Re-checked categories · ${res.changed} changed`);
          },
        }, icon('refresh', 15), 'Re-run categorization'),
      ),
    ),

    state.rules?.length ? sectionCard('Your category rules', 'created when you choose "apply to all"',
      h('div', { class: 'row-list' },
        state.rules.map((r) => h('div', { class: 'row' },
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title' }, r.match),
            h('div', { class: 'row-sub' }, `→ ${catMeta(r.category).label}`),
          ),
          h('button', {
            class: 'btn btn-sm btn-ghost btn-danger',
            onclick: async () => { await api(`/rules/${r.id}`, { method: 'DELETE' }); await refreshAll(); toast('Rule removed'); },
          }, icon('trash', 14)),
        )))) : null,

    h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Danger zone')),
      h('p', { class: 'hint' }, 'Deletes every account and transaction stored locally. Budgets and goals are kept.'),
      h('button', {
        class: 'btn btn-danger', style: { marginTop: '12px' },
        onclick: async () => {
          if (!confirm('Delete all accounts and transactions? This cannot be undone.')) return;
          await api('/reset', { method: 'POST', body: { keepSetup: true } });
          await refreshAll();
          navigate('dashboard');
          toast('Cleared');
        },
      }, icon('trash', 15), 'Delete all transactions'),
    ),
  );
}

function loadingCard() {
  return h('div', { class: 'card' },
    h('div', { class: 'skeleton', style: { height: '20px', width: '180px', marginBottom: '16px' } }),
    h('div', { class: 'skeleton', style: { height: '160px' } }),
  );
}

/* ==========================================================================
   Modals
   ========================================================================== */

function modal(title, body, actions) {
  const backdrop = h('div', {
    class: 'modal-backdrop',
    onclick: (e) => { if (e.target === backdrop) close(); },
  });
  function close() { backdrop.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    h('h2', {}, title),
    body,
    h('div', { class: 'modal-actions' }, ...actions(close)),
  );
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);
  setTimeout(() => $('input, select, textarea', box)?.focus(), 30);
  return close;
}

function budgetModal(existing) {
  let category = existing?.category || state.meta.categories.find((c) => c.kind === 'expense').id;
  let amount = existing?.limit || '';

  const body = h('div', {},
    h('label', { class: 'field' }, h('span', {}, 'Category'),
      h('select', { class: 'input', disabled: Boolean(existing?.id), onchange: (e) => { category = e.target.value; } },
        state.meta.categories.filter((c) => c.kind === 'expense')
          .map((c) => h('option', { value: c.id, selected: c.id === category }, c.label)))),
    h('label', { class: 'field' }, h('span', {}, 'Monthly limit'),
      h('input', { class: 'input', type: 'number', min: '1', step: '5', value: amount, placeholder: '400', oninput: (e) => { amount = e.target.value; } })),
  );

  modal(existing?.id ? 'Edit budget' : 'New budget', body, (close) => [
    existing?.id ? h('button', {
      class: 'btn btn-danger',
      onclick: async () => { await api(`/budgets/${existing.id}`, { method: 'DELETE' }); close(); await loadDashboard(); render(); toast('Budget removed'); },
    }, 'Delete') : null,
    h('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
    h('button', {
      class: 'btn btn-primary',
      onclick: async () => {
        try {
          await api('/budgets', { method: 'POST', body: { category, amount: Number(amount) } });
          close(); await loadDashboard(); render(); toast('Budget saved');
        } catch (err) { toast(err.message, 'error'); }
      },
    }, 'Save'),
  ].filter(Boolean));
}

async function suggestBudgets() {
  try {
    const res = await api('/budgets/suggest', { method: 'POST', body: {} });
    await loadDashboard();
    render();
    toast(res.created ? `Created ${res.created} budgets from your history` : 'Budgets already cover your spending');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function goalModal(existing) {
  let name = existing?.name || '';
  let targetAmount = existing?.targetAmount || '';
  let currentAmount = existing?.currentAmount || 0;
  let targetDate = existing?.targetDate || '';

  const body = h('div', {},
    h('label', { class: 'field' }, h('span', {}, 'What are you saving for?'),
      h('input', { class: 'input', value: name, placeholder: 'Emergency fund', oninput: (e) => { name = e.target.value; } })),
    h('div', { class: 'grid grid-2' },
      h('label', { class: 'field' }, h('span', {}, 'Target amount'),
        h('input', { class: 'input', type: 'number', min: '1', value: targetAmount, placeholder: '5000', oninput: (e) => { targetAmount = e.target.value; } })),
      h('label', { class: 'field' }, h('span', {}, 'Saved so far'),
        h('input', { class: 'input', type: 'number', min: '0', value: currentAmount, oninput: (e) => { currentAmount = e.target.value; } })),
    ),
    h('label', { class: 'field' }, h('span', {}, 'Target date (optional)'),
      h('input', { class: 'input', type: 'date', value: targetDate, oninput: (e) => { targetDate = e.target.value; } })),
  );

  modal(existing ? 'Edit goal' : 'New goal', body, (close) => [
    h('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
    h('button', {
      class: 'btn btn-primary',
      onclick: async () => {
        try {
          const payload = { name, targetAmount: Number(targetAmount), currentAmount: Number(currentAmount), targetDate: targetDate || null };
          if (existing) await api(`/goals/${existing.id}`, { method: 'PATCH', body: payload });
          else await api('/goals', { method: 'POST', body: payload });
          close(); await loadDashboard(); render(); toast('Goal saved');
        } catch (err) { toast(err.message, 'error'); }
      },
    }, 'Save'),
  ]);
}

function contributeModal(goal) {
  let amount = '';
  const body = h('div', {},
    h('p', { class: 'hint', style: { marginBottom: '14px' } },
      `${money0(goal.currentAmount)} of ${money0(goal.targetAmount)} so far · ${money0(goal.remaining)} to go.`),
    h('label', { class: 'field' }, h('span', {}, 'Add how much?'),
      h('input', { class: 'input', type: 'number', step: '10', placeholder: '250', oninput: (e) => { amount = e.target.value; } })),
  );
  modal(`Add to ${goal.name}`, body, (close) => [
    h('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
    h('button', {
      class: 'btn btn-primary',
      onclick: async () => {
        await api(`/goals/${goal.id}`, { method: 'PATCH', body: { contribute: Number(amount) || 0 } });
        close(); await loadDashboard(); render(); toast('Added');
      },
    }, 'Add'),
  ]);
}

function addAccountModal() {
  let name = '';
  let type = 'depository';
  let currentBalance = '';
  let institution = '';

  const body = h('div', {},
    h('p', { class: 'hint', style: { marginBottom: '14px' } },
      'Useful for things the app cannot see — a brokerage, a car loan, or a mortgage — so net worth is complete.'),
    h('label', { class: 'field' }, h('span', {}, 'Account name'),
      h('input', { class: 'input', placeholder: '401(k)', oninput: (e) => { name = e.target.value; } })),
    h('div', { class: 'grid grid-2' },
      h('label', { class: 'field' }, h('span', {}, 'Institution'),
        h('input', { class: 'input', placeholder: 'Fidelity', oninput: (e) => { institution = e.target.value; } })),
      h('label', { class: 'field' }, h('span', {}, 'Type'),
        h('select', { class: 'input', onchange: (e) => { type = e.target.value; } },
          h('option', { value: 'depository' }, 'Checking / Savings'),
          h('option', { value: 'investment' }, 'Investment'),
          h('option', { value: 'credit' }, 'Credit card'),
          h('option', { value: 'loan' }, 'Loan / Mortgage'),
        )),
    ),
    h('label', { class: 'field' }, h('span', {}, 'Current balance'),
      h('input', { class: 'input', type: 'number', step: '0.01', placeholder: '0.00', oninput: (e) => { currentBalance = e.target.value; } }),
      h('div', { class: 'hint', style: { marginTop: '5px' } }, 'For a credit card or loan, enter what you owe as a positive number.')),
  );

  modal('Add an account', body, (close) => [
    h('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
    h('button', {
      class: 'btn btn-primary',
      onclick: async () => {
        try {
          await api('/accounts', { method: 'POST', body: { name, type, institution, currentBalance: Number(currentBalance) || 0 } });
          close(); await refreshAll(); toast('Account added');
        } catch (err) { toast(err.message, 'error'); }
      },
    }, 'Add'),
  ]);
}

function editBalanceModal(account) {
  let balance = Math.abs(account.currentBalance);
  const body = h('div', {},
    h('label', { class: 'field' }, h('span', {}, account.isDebt ? 'Amount owed' : 'Current balance'),
      h('input', { class: 'input', type: 'number', step: '0.01', value: balance, oninput: (e) => { balance = e.target.value; } })),
    h('p', { class: 'hint' }, 'Net worth history is rebuilt from this figure and your transactions, so keeping it current keeps the chart honest.'),
  );
  modal(account.name, body, (close) => [
    h('button', {
      class: 'btn btn-danger',
      onclick: async () => {
        if (!confirm(`Delete ${account.name} and all its transactions?`)) return;
        const res = await api(`/accounts/${account.id}`, { method: 'DELETE' });
        close(); await refreshAll(); toast(`Removed with ${res.removedTransactions} transactions`);
      },
    }, 'Delete'),
    h('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
    h('button', {
      class: 'btn btn-primary',
      onclick: async () => {
        await api(`/accounts/${account.id}`, { method: 'PATCH', body: { currentBalance: Number(balance) || 0 } });
        close(); await refreshAll(); toast('Balance updated');
      },
    }, 'Save'),
  ]);
}

/* ==========================================================================
   Shell & routing
   ========================================================================== */

function catMeta(id) {
  return state.meta?.categories.find((c) => c.id === id) || { label: 'Other', icon: 'dots', chip: '#6B7480' };
}

/**
 * Wrap each part in a span. Adjacent bare text nodes collapse into a single
 * anonymous flex item, so `gap` never separates them — elements do.
 */
function metaParts(...parts) {
  return parts.filter((p) => p !== null && p !== undefined && p !== false && p !== '')
    .map((p) => (p instanceof Node ? p : h('span', {}, p)));
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

const VIEWS = {
  dashboard: { render: viewDashboard, title: 'Dashboard' },
  spending: { render: viewSpending, title: 'Spending' },
  recurring: { render: viewRecurring, title: 'Recurring & Subscriptions' },
  transactions: { render: viewTransactions, title: 'Transactions' },
  networth: { render: viewNetWorth, title: 'Net Worth' },
  budgets: { render: viewBudgets, title: 'Budgets' },
  bills: { render: viewBills, title: 'Bills & Goals' },
  import: { render: viewImport, title: 'Add Data' },
  settings: { render: viewSettings, title: 'Settings' },
};

/** Data some routes need but the initial boot payload doesn't include. */
async function loadForRoute(route) {
  try {
    if (route === 'transactions' && !state.txns.loaded) { await loadTransactions(); state.txns.loaded = true; }
    else if (route === 'import') await loadImportHistory();
    else if (route === 'settings') { await loadRules(); await loadImportHistory(); }
    else return;
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function navigate(route) {
  state.route = route;
  location.hash = route;
  window.scrollTo({ top: 0 });
  render();
  loadForRoute(route);
}

function render() {
  const view = VIEWS[state.route] || VIEWS.dashboard;
  const d = state.data;

  const monthPicker = d?.availableMonths?.length > 1 && ['dashboard', 'spending', 'budgets'].includes(state.route)
    ? h('select', {
      class: 'input', style: { width: 'auto' },
      onchange: async (e) => { state.month = e.target.value; await loadDashboard(); render(); },
    }, d.availableMonths.map((m) => h('option', {
      value: m, selected: m === d.month,
    }, new Date(`${m}-02T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))))
    : null;

  const app = clear($('#app'));
  app.appendChild(h('div', { class: 'app' },
    h('nav', { class: 'sidebar', 'aria-label': 'Main' },
      h('div', { class: 'brand' },
        h('div', { class: 'brand-mark' }, icon('mark', 17, { weight: 0, fill: 'currentColor', stroke: 'none' })),
        'Taylor Money',
      ),
      NAV.map((item) => h('button', {
        class: `nav-item${state.route === item.id ? ' active' : ''}`,
        onclick: () => navigate(item.id),
        'aria-current': state.route === item.id ? 'page' : null,
      },
      icon(item.icon, 18),
      item.label,
      item.id === 'recurring' && state.recurring?.alerts.length
        ? h('span', { class: 'nav-badge' }, String(state.recurring.alerts.length)) : null,
      )),
      h('div', { class: 'nav-spacer' }),
    ),
    h('main', { class: 'main' },
      h('header', { class: 'topbar' },
        h('div', {},
          h('h1', {}, view.title),
          d?.stats?.newestDate ? h('div', { class: 'topbar-sub' }, `Through ${fmtDate(d.stats.newestDate, { year: true })}`) : null,
        ),
        h('div', { class: 'topbar-actions' },
          monthPicker,
          state.meta?.plaid?.configured && state.meta.plaid.items.length
            ? h('button', { class: 'btn btn-sm', onclick: syncPlaid }, icon('refresh', 14), 'Sync') : null,
          h('button', { class: 'btn btn-sm btn-primary', onclick: () => navigate('import') }, icon('plus', 14), 'Add data'),
        ),
      ),
      h('div', { class: 'content' }, view.render()),
    ),
  ));
}

/* ------------------------------------------------------------------ */
/* Data loading                                                        */
/* ------------------------------------------------------------------ */

async function loadMeta() { state.meta = await api('/meta'); }

async function loadDashboard() {
  state.data = await api(`/dashboard${state.month ? `?month=${state.month}` : ''}`);
}

async function loadRecurring() { state.recurring = await api('/recurring'); }

async function loadTransactions(appendMode = false) {
  const f = state.txns;
  const params = new URLSearchParams({ limit: '150', offset: String(appendMode ? f.offset : 0) });
  if (f.q) params.set('q', f.q);
  if (f.category) params.set('category', f.category);
  if (f.account) params.set('account', f.account);
  if (f.direction) params.set('direction', f.direction);
  const res = await api(`/transactions?${params}`);
  f.rows = appendMode ? [...f.rows, ...res.transactions] : res.transactions;
  f.total = res.total;
  f.sum = res.sum;
}

async function loadImportHistory() {
  try { state.importBatches = (await api('/imports')).batches; } catch { state.importBatches = []; }
}

async function loadRules() {
  try { state.rules = (await api('/rules')).rules; } catch { state.rules = []; }
}

async function refreshAll() {
  await Promise.all([loadMeta(), loadDashboard(), loadRecurring(), loadTransactions(), loadImportHistory(), loadRules()]);
  render();
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function init() {
  try {
    await Promise.all([loadMeta(), loadDashboard(), loadRecurring()]);
    const hash = location.hash.replace('#', '');
    if (VIEWS[hash]) state.route = hash;
    if (state.meta.empty) state.route = VIEWS[hash] ? hash : 'import';
    render();
    loadForRoute(state.route);
  } catch (err) {
    clear($('#app')).appendChild(
      h('div', { style: { padding: '48px', textAlign: 'center' } },
        h('h2', {}, 'Could not reach the server'),
        h('p', { class: 'hint' }, err.message),
        h('p', { class: 'hint' }, 'Is it still running? Start it with ', h('code', {}, 'npm start'), '.'),
      ));
  }
}

window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#', '');
  if (VIEWS[hash] && hash !== state.route) { state.route = hash; render(); loadForRoute(hash); }
});

init();
