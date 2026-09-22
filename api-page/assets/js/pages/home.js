import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { loadConfig, showcaseEndpoint } from '../core/config.js';
import { fetchSystemStatus, buildStatusModel } from '../core/status-data.js';
import { fmtCompact, fmtUptime } from '../core/format.js';
import { announce, scrollToHash } from '../core/ui.js';
import { mountShell, showFatalError } from '../components/layout.js';
import { Hero } from '../components/hero.js';
import { ApiCard, EmptyState, QuickAccessCard, StatCard } from '../components/cards.js';
import { ApiPlayground } from '../components/playground.js';

const cjk = /[\u3040-\u30ff\u4e00-\u9fff]/;

function SectionHeader({ id, title, action }) {
  return h('div', { class: 'section-head' }, h('h2', { class: 'section-head__title', id }, title), action || null);
}

/* ---------- popular APIs: auto-ranked based on hits ---------- */

function PopularApis({ config, onTry }) {
  const container = h('div', { class: 'api-grid' });
  const empty = h('div', { class: 'api-empty', hidden: true }, EmptyState({ icon: 'activity', tone: 'muted', title: 'No statistics available', text: 'Displaying default APIs.' }));
  
  // Default fallback: first 4 endpoints
  const fallbackItems = config.endpoints.slice(0, 4);
  let currentCards = [];
  
  const renderCards = (items, states = new Map()) => {
    container.innerHTML = '';
    currentCards = items.map(item => {
      const card = ApiCard({ item, onTry });
      if (states.has(item.id)) {
        card.setState(states.get(item.id));
      }
      return card;
    });
    currentCards.forEach(card => container.append(card.el));
  };

  renderCards(fallbackItems);

  const el = h('div', { class: 'directory' }, container, empty);

  return {
    el,
    setStates(model) {
      if (!model.ok || !model.services) {
         // Keep fallback but update states if any
         const states = new Map((model.services || []).map((s) => [s.id, s.state]));
         renderCards(fallbackItems, states);
         return;
      }
      
      const states = new Map(model.services.map((s) => [s.id, s.state]));
      const requestsMap = new Map(model.services.map((s) => [s.id, s.requests || 0]));
      
      // Filter only real endpoints (not the gateway)
      const endpoints = config.endpoints.filter(e => requestsMap.has(e.id));
      
      // Sort DESC by request count
      const sortedEndpoints = [...endpoints].sort((a, b) => {
        const reqA = requestsMap.get(a.id) || 0;
        const reqB = requestsMap.get(b.id) || 0;
        return reqB - reqA;
      });
      
      const POPULAR_API_LIMIT = 4;
      const topApis = sortedEndpoints.slice(0, POPULAR_API_LIMIT);
      renderCards(topApis, states);
    }
  };
}

/* ---------- page ---------- */

async function main() {
  let config;
  try {
    config = await loadConfig();
  } catch (error) {
    showFatalError(error);
    return;
  }

  const demo = new URLSearchParams(location.search).has('demo');
  const shell = mountShell({ config, active: 'home' });

  const hero = Hero({ config });

  const requests = StatCard({ icon: 'zap', label: 'API Requests', hint: 'Requests served since the server started' });
  const uptime = StatCard({ icon: 'shield-check', label: 'Uptime', hint: 'Share of requests answered without a server error' });
  const stats = h(
    'section',
    { class: 'container stats', 'aria-label': 'Platform statistics' },
    StatCard({ icon: 'layers', label: 'Endpoints', value: String(config.endpoints.length) }).el,
    StatCard({ icon: 'layout-grid', label: 'Categories', value: String(config.categories.length) }).el,
    requests.el,
    uptime.el
  );

  const keysHref = config.auth.keysUrl || '/docs#authentication';
  const quick = h(
    'section',
    { class: 'container section', 'aria-labelledby': 'quick-title' },
    SectionHeader({ id: 'quick-title', title: 'Quick Access', action: h('a', { class: 'link-more', href: '/docs' }, 'View all', icon('arrow-right', { size: 15 })) }),
    h(
      'div',
      { class: 'qa-grid' },
      QuickAccessCard({ icon: 'book-open', title: 'Documentation', description: 'Explore API docs and examples.', href: '/docs' }),
      QuickAccessCard({
        icon: 'key-round',
        title: 'API Keys',
        description: config.auth.keysUrl ? 'Manage your API keys and permissions.' : 'No key needed right now. See how authentication works.',
        href: keysHref,
      }),
      QuickAccessCard({ icon: 'activity', title: 'Live Status', description: 'Check API health and incidents.', href: '/status' }),
      QuickAccessCard({ icon: 'chart-column', title: 'Analytics', description: 'Monitor usage and performance.', href: '/status#statistics' })
    )
  );

  let playground;
  const popular = PopularApis({ config, onTry: (item) => playground.open(item.id) });
  const apis = h('section', { class: 'container section', id: 'apis', 'aria-labelledby': 'apis-title' }, SectionHeader({ id: 'apis-title', title: 'Popular APIs' }), popular.el);

  playground = ApiPlayground({ config, initialId: showcaseEndpoint(config).id });
  const playgroundSection = h(
    'section',
    { class: 'container section', id: 'playground', 'aria-labelledby': 'playground-title' },
    SectionHeader({ id: 'playground-title', title: 'API Playground' }),
    h('p', { class: 'section-lead' }, 'Send a real request, inspect the response, then copy the code.'),
    playground.el
  );

  const banner = h(
    'section',
    { class: 'container section section--last', 'aria-label': 'Get started' },
    h(
      'a',
      { class: 'banner', href: '/docs#quick-start' },
      h('span', { class: 'banner__icon' }, icon('rocket', { size: 24 })),
      h('span', { class: 'banner__text' }, h('strong', {}, `New to ${config.name}?`), h('span', {}, 'Read the quick start guide and make your first API call.')),
      h('span', { class: 'banner__cta' }, 'Get Started', icon('arrow-right', { size: 16 }))
    )
  );

  shell.main.append(hero.el, stats, quick, apis, playgroundSection, banner);
  scrollToHash();

  // Live numbers arrive after first paint.
  const result = await fetchSystemStatus({ demo });
  const model = buildStatusModel(result, config);
  hero.setStatus(model.overall);
  shell.setSystem(model.overall);
  popular.setStates(model);
  if (model.ok) {
    requests.set(fmtCompact(model.totals.requests));
    uptime.set(model.totals.requests > 0 ? fmtUptime(model.totals.availability) : '—');
  }
}

main();
