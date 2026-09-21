import { h, s, uid } from '../core/dom.js';
import { prefersReducedMotion, rafThrottle } from '../core/ui.js';
import { fmtInt, fmtCompact } from '../core/format.js';

const PAD = { top: 14, right: 14, bottom: 28, left: 46 };
const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return STEPS.find((step) => step >= n) * pow;
}

/**
 * Minimal line chart: gridlines, area fill, hover / arrow-key inspection.
 * update(points, { key, color, label, formatX, formatTip, emptyText })
 *   points: [{ t, ...values }]   key: which value to plot
 */
export function LineChart({ height = 220 } = {}) {
  const gradientId = uid('chart-fill');
  const svg = s('svg', { class: 'chart__svg', 'aria-hidden': 'true', focusable: 'false' });
  const tip = h('div', { class: 'chart__tip', hidden: true, 'aria-hidden': 'true' });
  const empty = h('p', { class: 'chart__empty', hidden: true });
  const table = h('table', { class: 'sr-only' });
  const el = h('div', { class: 'chart', tabindex: '0', role: 'group', style: { height: `${height}px` } }, svg, tip, empty, table);

  let state = { points: [], key: 'total', color: 'var(--blue)', label: 'Requests', formatX: (p) => String(p.t), formatTip: (p) => String(p.t), emptyText: 'No data yet.' };
  let width = 0;
  let active = -1;
  let geo = null;

  function draw(animate) {
    const { points, key, color, label } = state;
    const W = width || el.clientWidth || 320;
    const H = height;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.replaceChildren();

    const values = points.map((p) => p[key]);
    const peak = Math.max(0, ...values);
    const step = Math.max(1, niceStep(Math.max(peak, 1) / 4));
    const yMax = step * 4;
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (i) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * iw : iw / 2);
    const y = (v) => PAD.top + ih - (v / yMax) * ih;
    geo = { x, y, iw, W };

    for (let i = 0; i <= 4; i++) {
      const v = step * i;
      svg.append(
        s('line', { class: 'chart__grid', x1: PAD.left, x2: W - PAD.right, y1: y(v), y2: y(v) }),
        s('text', { class: 'chart__label', x: PAD.left - 8, y: y(v) + 4, 'text-anchor': 'end' }, fmtCompact(v))
      );
    }

    const ticks = Math.min(points.length, W < 440 ? 4 : 6);
    for (let k = 0; k < ticks && points.length > 1; k++) {
      const i = Math.round((k / (ticks - 1)) * (points.length - 1));
      svg.append(
        s('text', { class: 'chart__label', x: x(i), y: H - 8, 'text-anchor': k === 0 ? 'start' : k === ticks - 1 ? 'end' : 'middle' }, state.formatX(points[i]))
      );
    }

    const hasData = peak > 0;
    empty.hidden = hasData;
    empty.textContent = state.emptyText;
    el.setAttribute('aria-label', `${label} over time. Use the arrow keys to inspect values.`);

    if (hasData) {
      const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
      const area = `${line} L${x(points.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
      const linePath = s('path', { class: 'chart__line', d: line, style: { stroke: color } });
      const areaPath = s('path', { class: 'chart__area', d: area, fill: `url(#${gradientId})` });
      svg.append(
        s(
          'defs',
          {},
          s('linearGradient', { id: gradientId, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: '0%', style: { stopColor: color, stopOpacity: 0.26 } }), s('stop', { offset: '100%', style: { stopColor: color, stopOpacity: 0 } }))
        ),
        areaPath,
        linePath,
        s('line', { class: 'chart__cursor', y1: PAD.top, y2: PAD.top + ih, display: 'none' }),
        s('circle', { class: 'chart__dot', r: 4.5, style: { stroke: color }, display: 'none' })
      );
      if (animate && !prefersReducedMotion()) {
        const length = linePath.getTotalLength();
        linePath.animate([{ strokeDasharray: length, strokeDashoffset: length }, { strokeDasharray: length, strokeDashoffset: 0 }], { duration: 600, easing: 'cubic-bezier(.2,.7,.2,1)' });
        areaPath.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' });
      }
    }

    table.replaceChildren(
      h('caption', {}, `${label} over time`),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Time'), h('th', { scope: 'col' }, label))),
      h('tbody', {}, points.map((p) => h('tr', {}, h('td', {}, state.formatTip(p)), h('td', {}, fmtInt(p[key])))))
    );
    inspect(Math.min(active, points.length - 1));
  }

  function inspect(index) {
    active = index;
    const cursor = svg.querySelector('.chart__cursor');
    const dot = svg.querySelector('.chart__dot');
    if (!cursor || index < 0 || !state.points[index]) {
      tip.hidden = true;
      if (cursor) cursor.setAttribute('display', 'none');
      if (dot) dot.setAttribute('display', 'none');
      return;
    }
    const point = state.points[index];
    const px = geo.x(index);
    const py = geo.y(point[state.key]);
    cursor.setAttribute('x1', px);
    cursor.setAttribute('x2', px);
    cursor.removeAttribute('display');
    dot.setAttribute('cx', px);
    dot.setAttribute('cy', py);
    dot.removeAttribute('display');
    tip.replaceChildren(h('strong', {}, fmtInt(point[state.key])), h('span', {}, state.formatTip(point)));
    tip.hidden = false;
    const tipWidth = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(px - tipWidth / 2, 4), geo.W - tipWidth - 4)}px`;
    tip.style.top = `${Math.max(py - tip.offsetHeight - 12, 2)}px`;
  }

  el.addEventListener('pointermove', (event) => {
    if (!state.points.length || !geo) return;
    const rect = el.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - PAD.left) / geo.iw;
    inspect(Math.min(state.points.length - 1, Math.max(0, Math.round(ratio * (state.points.length - 1)))));
  });
  el.addEventListener('pointerleave', () => {
    if (document.activeElement !== el) inspect(-1);
  });
  el.addEventListener('blur', () => inspect(-1));
  el.addEventListener('keydown', (event) => {
    const last = state.points.length - 1;
    if (last < 0) return;
    let next = active;
    if (event.key === 'ArrowRight') next = active < 0 ? 0 : Math.min(last, active + 1);
    else if (event.key === 'ArrowLeft') next = active < 0 ? last : Math.max(0, active - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else if (event.key === 'Escape') next = -1;
    else return;
    event.preventDefault();
    inspect(next);
  });

  new ResizeObserver(
    rafThrottle(() => {
      const next = el.clientWidth;
      if (next && next !== width) {
        width = next;
        draw(false);
      }
    })
  ).observe(el);

  return {
    el,
    update(points, options = {}) {
      const { animate = true, ...rest } = options;
      state = { ...state, ...rest, points };
      active = -1;
      draw(animate);
    },
  };
}
