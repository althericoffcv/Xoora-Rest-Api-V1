import { h } from '../core/dom.js';
import { loadConfig } from '../core/config.js';
import { fetchSystemStatus, buildStatusModel } from '../core/status-data.js';
import { scrollToHash } from '../core/ui.js';
import { mountShell, showFatalError } from '../components/layout.js';
import { IncidentsPanel, MetricRow, ServicePanel, StatsPanel, StatusHeader } from '../components/status.js';

const REFRESH_MS = 30000;

async function main() {
  let config;
  try {
    config = await loadConfig();
  } catch (error) {
    showFatalError(error);
    return;
  }

  const demo = new URLSearchParams(location.search).has('demo');
  const shell = mountShell({ config, active: 'status' });

  let range = '7d';
  let model = null;
  let loadedAt = 0;
  let loading = false;

  const header = StatusHeader({ config, onRefresh: () => load({ manual: true }) });
  const metrics = MetricRow();
  const services = ServicePanel();
  const stats = StatsPanel({
    onRangeChange: (next) => {
      range = next;
      render({ animate: true });
    },
  });
  const incidents = IncidentsPanel({ config });

  shell.main.append(
    h(
      'div',
      { class: 'container status' },
      header.el,
      header.notice,
      metrics.el,
      h('div', { class: 'status-grid' }, services.el, stats.el),
      incidents
    )
  );

  function render({ animate = true } = {}) {
    header.update(model, { demo, onRetry: () => load({ manual: true }) });
    metrics.update(stats.statsFor(model, range));
    services.update(model);
    stats.update(model, range, animate);
    shell.setSystem(model.overall);
  }

  async function load({ manual = false } = {}) {
    if (loading) return;
    loading = true;
    if (manual) header.setRefreshing(true);
    const started = performance.now();
    const result = await fetchSystemStatus({ demo });
    const first = model === null;
    model = buildStatusModel(result, config);
    loadedAt = Date.now();
    // Keep the "Refreshing…" state visible long enough to be noticed.
    const wait = manual ? Math.max(0, 500 - (performance.now() - started)) : 0;
    setTimeout(() => {
      render({ animate: first || manual });
      header.setRefreshing(false);
      loading = false;
    }, wait);
  }

  await load();
  scrollToHash();

  if (!demo) {
    setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - loadedAt > REFRESH_MS) load();
    });
  }
}

main();
