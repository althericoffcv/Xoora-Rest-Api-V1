import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { Tabs, onImageError } from '../core/ui.js';
import { fmtDateTime, fmtDay, fmtDelta, fmtDuration, fmtInt, fmtMs, fmtPercent, fmtTime, fmtTimeSec, fmtUptime } from '../core/format.js';
import { chartPoints, rangeStats } from '../core/status-data.js';
import { LineChart } from './chart.js';
import { Callout, EmptyState, IncidentCard, ServiceStatusCard, StatCard } from './cards.js';

const DAY = 24 * 60 * 60 * 1000;

/* ---------- header ---------- */

export function StatusHeader({ config, onRefresh }) {
  const dot = h('span', { class: 'status-hero__dot', 'aria-hidden': 'true' });
  const title = h('span', {});
  const description = h('p', { class: 'status-hero__desc' });
  const updated = h('span', { class: 'status-hero__updated' });
  const refreshLabel = h('span', {}, 'Refresh');
  const refresh = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => onRefresh() }, icon('refresh-cw', { size: 15 }), refreshLabel);
  const art = h('figure', { class: 'status-hero__art' });
  const notice = h('div', { class: 'status-notice' });

  const el = h(
    'section',
    { class: 'status-hero hud', 'aria-labelledby': 'status-title' },
    h(
      'div',
      { class: 'status-hero__copy' },
      h('span', { class: 'chip chip--brand' }, icon('activity', { size: 14 }), 'API status'),
      h('h1', { class: 'status-hero__title', id: 'status-title' }, dot, title),
      description,
      h('p', { class: 'status-hero__meta' }, updated, refresh)
    ),
    art
  );

  function renderArt(state) {
    if (state === 'healthy') {
      const img = h('img', { class: 'status-hero__img', src: config.assets.statusHealthy, alt: 'Anime mascot giving an all good sign', width: 320, height: 240, fetchpriority: 'high', decoding: 'async' });
      onImageError(img);
      art.replaceChildren(img);
    } else {
      const glyph = state === 'outage' ? 'circle-x' : state === 'degraded' ? 'triangle-alert' : 'info';
      art.replaceChildren(h('span', { class: ['status-hero__glyph', `status-hero__glyph--${state}`], 'aria-hidden': 'true' }, icon(glyph, { size: 44 })));
    }
  }

  return {
    el,
    notice,
    setRefreshing(busy) {
      refresh.disabled = busy;
      refresh.classList.toggle('is-busy', busy);
      refreshLabel.textContent = busy ? 'Refreshing…' : 'Refresh';
    },
    update(model, { demo, onRetry }) {
      const overall = model.overall;
      const tone = overall.state === 'healthy' ? 'operational' : overall.state;
      dot.className = `status-hero__dot dot dot--${tone}`;
      title.textContent = overall.title;
      description.textContent = overall.description;
      updated.textContent = model.mode === 'sample' ? 'Sample data' : model.mode === 'live' ? `Updated ${fmtTimeSec(model.generatedAt)}` : '';
      renderArt(overall.state);

      if (model.mode === 'sample') {
        notice.replaceChildren(
          Callout(
            { tone: 'info', title: 'You’re viewing sample data' },
            h('p', {}, 'These numbers are generated for previewing the design. '),
            h('a', { class: 'callout__action', href: '/status' }, 'Switch to live data')
          )
        );
      } else if (model.mode === 'unavailable') {
        notice.replaceChildren(
          Callout(
            { tone: 'warn', title: 'Live status is unavailable' },
            h('p', {}, 'The status endpoint (GET /system/status) did not respond. Your API may still be working.'),
            h('button', { type: 'button', class: 'callout__action', onclick: onRetry }, 'Try again')
          )
        );
      } else {
        notice.replaceChildren();
      }
    },
  };
}

/* ---------- three headline metrics ---------- */

export function MetricRow() {
  const uptime = StatCard({ icon: 'shield-check', tone: 'ok', label: 'Uptime', hint: 'Share of requests answered without a server error' });
  const average = StatCard({ icon: 'zap', tone: 'cyan', label: 'Avg. Response', hint: 'Average time to answer a request' });
  const errors = StatCard({ icon: 'circle-check', tone: 'ok', label: 'Error Rate', hint: 'Share of requests answered with HTTP 400 or higher' });
  return {
    el: h('div', { class: 'metrics' }, uptime.el, average.el, errors.el),
    update(stats) {
      const has = stats && stats.total > 0;
      uptime.set(has ? fmtUptime(stats.uptime) : '—');
      average.set(has ? fmtMs(stats.avgMs) : '—');
      errors.set(has ? fmtPercent(stats.errorRate, stats.errorRate < 10 ? 1 : 0) : '—');
    },
  };
}

/* ---------- service list ---------- */

export function ServicePanel() {
  const count = h('span', { class: 'panel__count' });
  const body = h('div', { class: 'panel__body' });
  return {
    el: h('section', { class: 'panel', 'aria-labelledby': 'services-title', id: 'services' }, h('div', { class: 'panel__head' }, h('h2', { class: 'panel__heading', id: 'services-title' }, 'Service Status'), count), body),
    update(model) {
      if (!model.services.length) {
        count.textContent = '';
        body.replaceChildren(EmptyState({ icon: 'info', tone: 'muted', title: 'No service data', text: 'Status will appear here once the status endpoint responds.' }));
        return;
      }
      const ok = model.services.filter((service) => service.state === 'operational').length;
      count.textContent = `${ok} of ${model.services.length} operational`;
      body.replaceChildren(h('ul', { class: 'services' }, model.services.map((service) => ServiceStatusCard({ service }))));
    },
  };
}

/* ---------- request statistics ---------- */

const SERIES = {
  total: { label: 'Requests', color: 'var(--blue)' },
  success: { label: 'Successful requests', color: 'var(--ok)' },
  failed: { label: 'Failed requests', color: 'var(--bad)' },
};

function Summary({ label }) {
  const value = h('span', { class: 'summary__value' }, '—');
  const delta = h('span', { class: 'summary__delta', hidden: true });
  return {
    el: h('div', { class: 'summary' }, value, h('span', { class: 'summary__label' }, label), delta),
    set(text, change, goodWhen) {
      value.textContent = text;
      if (change == null || Math.abs(change) < 0.05) {
        delta.hidden = true;
        return;
      }
      const up = change > 0;
      const good = goodWhen === 'up' ? up : !up;
      delta.hidden = false;
      delta.className = `summary__delta summary__delta--${good ? 'good' : 'bad'}`;
      delta.replaceChildren(icon(up ? 'arrow-up' : 'arrow-down', { size: 13 }), `${Math.abs(change).toFixed(1)}%`);
      delta.title = 'Compared with the previous period';
    },
  };
}

export function StatsPanel({ onRangeChange }) {
  let model = null;
  let range = '7d';
  let series = 'total';

  const chart = LineChart({ height: 230 });
  const chartHost = h('div', { class: 'stats__chart' }, chart.el);
  const note = h('p', { class: 'stats__note' });

  const rangeTabs = Tabs({
    items: [
      { id: '24h', label: '24 hours' },
      { id: '7d', label: '7 days' },
    ],
    value: range,
    label: 'Time range',
    className: 'tabs--segmented',
    onChange: (id) => {
      range = id;
      onRangeChange(id);
    },
  });
  const seriesTabs = Tabs({
    items: [
      { id: 'total', label: 'Total' },
      { id: 'success', label: 'Success' },
      { id: 'failed', label: 'Error' },
    ],
    value: series,
    label: 'Chart series',
    panel: chartHost,
    className: 'tabs--pills',
    onChange: (id) => {
      series = id;
      render();
    },
  });

  const total = Summary({ label: 'Total Requests' });
  const success = Summary({ label: 'Successful' });
  const failed = Summary({ label: 'Failed' });

  function render(animate = true) {
    if (!model || !model.ok) {
      chart.update([], { key: 'total', label: SERIES.total.label, emptyText: 'No data available.', animate });
      total.set('—');
      success.set('—');
      failed.set('—');
      note.textContent = '';
      return;
    }
    const points = chartPoints(model.hourly, range);
    const stats = rangeStats(model.hourly, range);
    const meta = SERIES[series];
    chart.update(points, {
      animate,
      key: series,
      color: meta.color,
      label: meta.label,
      formatX: (p) => (range === '24h' ? fmtTime(p.t) : fmtDay(p.t)),
      formatTip: (p) => (range === '24h' ? fmtDateTime(p.t) : `${fmtDateTime(p.t)} – ${fmtTime(p.end)}`),
      emptyText: model.mode === 'live' ? 'No requests recorded in this period yet. Send a request from the playground and check back.' : 'No data in this period.',
    });

    const { current, previous, hasPrevious } = stats;
    total.set(fmtInt(current.total), hasPrevious ? fmtDelta(current.total, previous.total) : null, 'up');
    success.set(fmtInt(current.success), hasPrevious ? fmtDelta(current.success, previous.success) : null, 'up');
    failed.set(fmtInt(current.failed), hasPrevious ? fmtDelta(current.failed, previous.failed) : null, 'down');

    if (model.mode === 'live') {
      note.textContent = `Live data from this server, collected since it started ${fmtDuration(model.uptimeSeconds)} ago. Counters reset when the server restarts.`;
    } else {
      note.textContent = 'Sample data for previewing the design.';
    }
  }

  const el = h(
    'section',
    { class: 'panel stats', id: 'statistics', 'aria-labelledby': 'stats-title' },
    h('div', { class: 'panel__head' }, h('h2', { class: 'panel__heading', id: 'stats-title' }, 'Request Statistics'), rangeTabs.el),
    h('div', { class: 'panel__body' }, seriesTabs.el, chartHost, h('div', { class: 'summaries' }, total.el, success.el, failed.el), note)
  );

  return {
    el,
    update(nextModel, nextRange, animate = true) {
      model = nextModel;
      if (nextRange && nextRange !== range) {
        range = nextRange;
        rangeTabs.set(range);
      }
      render(animate);
    },
    /** Stats for the current range, for the headline metrics. */
    statsFor(nextModel, nextRange) {
      return nextModel && nextModel.ok ? rangeStats(nextModel.hourly, nextRange).current : null;
    },
  };
}

/* ---------- incidents ---------- */

export function IncidentsPanel({ config }) {
  const recent = config.incidents
    .filter((incident) => !incident.resolvedAt || incident.startedAt >= Date.now() - 7 * DAY)
    .sort((a, b) => b.startedAt - a.startedAt);

  return h(
    'section',
    { class: 'panel', id: 'incidents', 'aria-labelledby': 'incidents-title' },
    h('div', { class: 'panel__head' }, h('h2', { class: 'panel__heading', id: 'incidents-title' }, 'Recent Incidents')),
    h(
      'div',
      { class: 'panel__body' },
      recent.length
        ? h('div', { class: 'incidents' }, recent.map((incident) => IncidentCard({ incident })))
        : EmptyState({ icon: 'circle-check', title: 'No incidents in the last 7 days.', text: 'Everything has been running smoothly.' })
    )
  );
}
