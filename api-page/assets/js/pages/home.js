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

/* ---------- popular APIs: category chips, search and grouped cards ---------- */

function ApiDirectory({ config, onTry }) {
  const cards = config.endpoints.map((item) => ApiCard({ item, onTry }));
  const byId = new Map(cards.map((card) => [card.item.id, card]));
  let category = 'all';
  let query = '';

  const chips = [{ id: 'all', label: 'All' }, ...config.categories.filter((c) => c.items.length).map((c) => ({ id: c.id, label: c.label }))].map((chip) =>
    h(
      'button',
      {
        type: 'button',
        class: 'chip-btn',
        'aria-pressed': String(chip.id === category),
        onclick: () => {
          category = chip.id;
          chips.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.id === category)));
          apply();
        },
        dataset: { id: chip.id },
      },
      chip.label
    )
  );

  const searchId = 'api-search';
  const search = h('input', {
    class: 'input input--search',
    id: searchId,
    type: 'search',
    placeholder: 'Search APIs',
    autocomplete: 'off',
    spellcheck: 'false',
    oninput: () => {
      query = search.value.trim().toLowerCase();
      apply();
    },
  });

  const groups = config.categories
    .filter((c) => c.items.length)
    .map((c) => {
      const grid = h('div', { class: 'api-grid' }, c.items.map((item) => byId.get(item.id).el));
      const el = h(
        'section',
        { class: 'api-group', 'aria-labelledby': `group-${c.id}` },
        h(
          'h3',
          { class: 'api-group__title', id: `group-${c.id}` },
          h('span', { class: 'api-group__icon' }, icon(c.icon, { size: 18 })),
          c.label,
          c.native ? h('span', { class: 'api-group__native', lang: cjk.test(c.native) ? 'ja' : null }, c.native) : null,
          h('span', { class: 'api-group__count' }, String(c.items.length))
        ),
        grid
      );
      return { id: c.id, el, items: c.items };
    });

  const empty = h('div', { class: 'api-empty', hidden: true }, EmptyState({ icon: 'search', tone: 'muted', title: 'No APIs match your search', text: 'Try a different word or pick another category.' }));

  function apply() {
    let shown = 0;
    for (const group of groups) {
      let visibleInGroup = 0;
      for (const item of group.items) {
        const haystack = `${item.name} ${item.desc} ${item.path} ${group.id}`.toLowerCase();
        const match = (category === 'all' || category === group.id) && (!query || query.split(/\s+/).every((word) => haystack.includes(word)));
        byId.get(item.id).el.hidden = !match;
        if (match) visibleInGroup++;
      }
      group.el.hidden = visibleInGroup === 0;
      shown += visibleInGroup;
    }
    empty.hidden = shown > 0;
    announce(`${shown} ${shown === 1 ? 'API' : 'APIs'} shown`);
  }

  const el = h(
    'div',
    { class: 'directory' },
    h(
      'div',
      { class: 'directory__bar' },
      h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Filter by category' }, chips),
      h('div', { class: 'search-field' }, h('label', { class: 'sr-only', for: searchId }, 'Search APIs'), icon('search', { size: 18, className: 'search-field__icon' }), search)
    ),
    groups.map((group) => group.el),
    empty
  );

  return {
    el,
    setStates(model) {
      const states = new Map(model.services.map((service) => [service.id, service.state]));
      for (const card of cards) card.setState(model.ok ? states.get(card.item.id) || 'operational' : null);
    },
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
  const directory = ApiDirectory({ config, onTry: (item) => playground.open(item.id) });
  const apis = h('section', { class: 'container section', id: 'apis', 'aria-labelledby': 'apis-title' }, SectionHeader({ id: 'apis-title', title: 'Popular APIs' }), directory.el);

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
  directory.setStates(model);
  if (model.ok) {
    requests.set(fmtCompact(model.totals.requests));
    uptime.set(model.totals.requests > 0 ? fmtUptime(model.totals.availability) : '—');
  }
}

main();
