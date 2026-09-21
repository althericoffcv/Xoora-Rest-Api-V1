import { h, uid } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { Popover, openDialog, closeDialog, setupDialog, getTheme, toggleTheme, onImageError } from '../core/ui.js';
import { fmtDateTime } from '../core/format.js';
import { StatusDot } from './cards.js';

const NAV = [
  { id: 'home', label: 'Home', href: '/', icon: 'home' },
  { id: 'docs', label: 'Docs', href: '/docs', icon: 'book-open' },
  { id: 'status', label: 'Status', href: '/status', icon: 'activity' },
];

const WEEK = 7 * 24 * 60 * 60 * 1000;

/* ---------- brand ---------- */

export function Brand(config) {
  const fallback = h('span', { class: 'brand__fallback' }, icon('spark', { size: 18, fill: true }), config.name);
  const logo = h('img', { class: 'brand__logo', src: config.assets.logo, alt: config.name, width: 120, height: 34, decoding: 'async' });
  onImageError(logo, fallback);
  return h('a', { class: 'brand', href: '/' }, logo);
}

/* ---------- header controls ---------- */

function ThemeToggle() {
  const button = h(
    'button',
    { type: 'button', class: 'icon-btn theme-toggle', onclick: toggleTheme },
    h('span', { class: 'theme-toggle__sun' }, icon('sun')),
    h('span', { class: 'theme-toggle__moon' }, icon('moon'))
  );
  const sync = () => button.setAttribute('aria-label', getTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  document.addEventListener('xoora:theme', sync);
  sync();
  return button;
}

function Notifications(config) {
  const id = uid('notifications');
  const recent = config.incidents
    .filter((incident) => !incident.resolvedAt || incident.startedAt > Date.now() - WEEK)
    .sort((a, b) => b.startedAt - a.startedAt);
  const active = recent.some((incident) => !incident.resolvedAt && incident.status !== 'resolved');

  const trigger = h(
    'button',
    { type: 'button', class: 'icon-btn', 'aria-label': active ? 'Notifications, 1 or more active incidents' : 'Notifications', 'aria-expanded': 'false', 'aria-controls': id },
    icon('bell'),
    active ? h('span', { class: 'icon-btn__badge', 'aria-hidden': 'true' }) : null
  );

  const body = recent.length
    ? h(
        'ul',
        { class: 'popover__list' },
        recent.slice(0, 4).map((incident) =>
          h(
            'li',
            {},
            h(
              'a',
              { class: 'popover__link popover__link--stack', href: '/status#incidents' },
              h('span', { class: 'popover__link-title' }, incident.title),
              h('span', { class: 'popover__link-sub' }, `${incident.resolvedAt ? 'Resolved' : incident.status} · ${fmtDateTime(incident.startedAt)}`)
            )
          )
        )
      )
    : h(
        'div',
        { class: 'popover__empty' },
        icon('circle-check', { size: 22 }),
        h('p', { class: 'popover__title' }, 'You’re all caught up'),
        h('p', { class: 'popover__sub' }, 'No incidents or announcements right now.')
      );

  const panel = h(
    'div',
    { class: 'popover', id, hidden: true, role: 'region', 'aria-label': 'Notifications' },
    h('p', { class: 'popover__heading' }, 'Notifications'),
    body,
    h('a', { class: 'popover__footer', href: '/status' }, 'View system status', icon('arrow-right', { size: 14 }))
  );
  Popover({ trigger, panel });
  return h('div', { class: 'popover-host' }, trigger, panel);
}

function CreatorMenu(config) {
  if (!config.creator && !config.links.length) return null;
  const id = uid('creator');
  const name = config.creator || config.name;
  const initial = name.trim().charAt(0).toUpperCase();
  const trigger = h('button', { type: 'button', class: 'avatar-btn', 'aria-label': 'Creator links', 'aria-expanded': 'false', 'aria-controls': id }, initial);
  const panel = h(
    'div',
    { class: 'popover popover--menu', id, hidden: true, role: 'region', 'aria-label': 'Creator' },
    h('div', { class: 'popover__profile' }, h('span', { class: 'avatar' }, initial), h('div', {}, h('p', { class: 'popover__title' }, name), h('p', { class: 'popover__sub' }, 'Creator'))),
    config.links.length
      ? h(
          'ul',
          { class: 'popover__list' },
          config.links.map((link) =>
            h('li', {}, h('a', { class: 'popover__link', href: link.url, target: '_blank', rel: 'noopener noreferrer' }, link.label, icon('arrow-up-right', { size: 14 })))
          )
        )
      : null
  );
  Popover({ trigger, panel });
  return h('div', { class: 'popover-host popover-host--desktop' }, trigger, panel);
}

export function Navbar({ config, active, onMenu }) {
  const links = NAV.map((link) =>
    h('a', { class: 'nav__link', href: link.href, 'aria-current': link.id === active ? 'page' : null }, link.label)
  );
  return h(
    'header',
    { class: 'site-header', id: 'site-header' },
    h(
      'div',
      { class: 'site-header__bar container' },
      Brand(config),
      h('nav', { class: 'nav', 'aria-label': 'Primary' }, links),
      h(
        'div',
        { class: 'site-header__actions' },
        h('div', { class: 'desktop-only' }, ThemeToggle()),
        Notifications(config),
        CreatorMenu(config),
        h('a', { class: 'btn btn--primary btn--sm site-header__cta', href: '/docs#quick-start' }, 'Get Started', icon('arrow-right', { size: 16 })),
        h('button', { type: 'button', class: 'icon-btn menu-btn', 'aria-label': 'Open menu', 'aria-haspopup': 'dialog', onclick: onMenu }, icon('menu'))
      )
    )
  );
}

/* ---------- mobile menu (right-hand drawer) ---------- */

export function MobileMenu({ config, active }) {
  const dialog = setupDialog(h('dialog', { class: 'drawer drawer--right', 'aria-label': 'Menu' }));
  const close = () => closeDialog(dialog);

  const themeSwitch = h(
    'button',
    { type: 'button', class: 'switch-row', role: 'switch', onclick: toggleTheme },
    h('span', { class: 'switch-row__label' }, icon('moon', { size: 20 }), 'Dark theme'),
    h('span', { class: 'switch', 'aria-hidden': 'true' }, h('span', { class: 'switch__thumb' }))
  );
  const syncTheme = () => themeSwitch.setAttribute('aria-checked', String(getTheme() === 'dark'));
  document.addEventListener('xoora:theme', syncTheme);
  syncTheme();

  dialog.append(
    h(
      'div',
      { class: 'drawer__inner' },
      h('div', { class: 'drawer__head' }, Brand(config), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close menu', onclick: close }, icon('x'))),
      h(
        'nav',
        { class: 'drawer__nav', 'aria-label': 'Primary' },
        NAV.map((link) =>
          h(
            'a',
            { class: 'drawer__link', href: link.href, 'aria-current': link.id === active ? 'page' : null, onclick: close },
            icon(link.icon, { size: 20 }),
            link.label,
            icon('chevron-right', { size: 18, className: 'drawer__chevron' })
          )
        )
      ),
      themeSwitch,
      config.links.length
        ? h(
            'div',
            { class: 'drawer__section' },
            h('p', { class: 'drawer__title' }, config.creator || 'Links'),
            config.links.map((link) =>
              h('a', { class: 'drawer__link drawer__link--small', href: link.url, target: '_blank', rel: 'noopener noreferrer' }, link.label, icon('arrow-up-right', { size: 15, className: 'drawer__chevron' }))
            )
          )
        : null,
      h(
        'div',
        { class: 'drawer__foot' },
        h('a', { class: 'btn btn--primary', href: '/docs#quick-start', onclick: close }, 'Get Started', icon('arrow-right', { size: 18 })),
        config.version ? h('p', { class: 'drawer__version' }, `${config.name} v${config.version}`) : null
      )
    )
  );
  return { el: dialog, open: () => openDialog(dialog) };
}

/* ---------- bottom tab bar (phones) ---------- */

function TabBar(active) {
  return h(
    'nav',
    { class: 'tabbar', 'aria-label': 'Primary' },
    NAV.map((link) =>
      h(
        'a',
        { class: 'tabbar__link', href: link.href, 'aria-current': link.id === active ? 'page' : null },
        h('span', { class: 'tabbar__icon' }, icon(link.icon, { size: 22 })),
        h('span', { class: 'tabbar__label' }, link.label)
      )
    )
  );
}

/* ---------- footer ---------- */

const SHORT_STATE = {
  healthy: 'All systems operational',
  degraded: 'Degraded performance',
  outage: 'Service disruption',
  unknown: 'System status',
};

function Footer(config) {
  const statusText = h('span', {}, SHORT_STATE.unknown);
  const statusDot = h('span', { class: 'footer-status__dot' }, StatusDot('unknown'));
  const status = h('a', { class: 'footer-status', href: '/status' }, statusDot, statusText);

  const el = h(
    'footer',
    { class: 'site-footer' },
    h(
      'div',
      { class: 'container site-footer__grid' },
      h('div', { class: 'site-footer__brand' }, Brand(config), h('p', {}, config.description)),
      h(
        'nav',
        { 'aria-label': 'Platform' },
        h('h2', { class: 'site-footer__title' }, 'Platform'),
        h('ul', {}, NAV.map((link) => h('li', {}, h('a', { href: link.href }, link.label))), h('li', {}, h('a', { href: '/docs#quick-start' }, 'Quick start')))
      ),
      config.links.length
        ? h(
            'nav',
            { 'aria-label': 'Creator' },
            h('h2', { class: 'site-footer__title' }, config.creator || 'Links'),
            h('ul', {}, config.links.map((link) => h('li', {}, h('a', { href: link.url, target: '_blank', rel: 'noopener noreferrer' }, link.label))))
          )
        : null
    ),
    h(
      'div',
      { class: 'container site-footer__bottom' },
      h('span', {}, `© ${new Date().getFullYear()} ${config.name}`, config.version ? ` · v${config.version}` : ''),
      status
    )
  );

  return {
    el,
    setState(overall) {
      const state = overall.state === 'healthy' ? 'operational' : overall.state;
      statusDot.replaceChildren(StatusDot(state));
      statusText.textContent = SHORT_STATE[overall.state] || SHORT_STATE.unknown;
    },
  };
}

/* ---------- shell ---------- */

export function mountShell({ config, active }) {
  const app = document.getElementById('app');
  const menu = MobileMenu({ config, active });
  const header = Navbar({ config, active, onMenu: menu.open });
  const main = h('main', { id: 'main', class: 'page', tabindex: '-1' });
  const footer = Footer(config);

  app.replaceChildren(h('a', { class: 'skip-link', href: '#main' }, 'Skip to content'), header, main, footer.el, TabBar(active), menu.el);

  // Ctrl/⌘ + K opens the search palette on every page. It is loaded on first use.
  document.addEventListener('keydown', async (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      (await import('./search.js')).openSearch(config);
    }
  });

  return { main, header, setSystem: (overall) => footer.setState(overall) };
}

export function showFatalError(error) {
  const app = document.getElementById('app');
  app.replaceChildren(
    h(
      'main',
      { class: 'fatal', id: 'main' },
      h(
        'div',
        { class: 'fatal__card' },
        icon('triangle-alert', { size: 28 }),
        h('h1', {}, 'We couldn’t load this page'),
        h('p', {}, 'The site configuration (src/settings.json) could not be read.'),
        h('p', { class: 'fatal__detail' }, String((error && error.message) || error)),
        h('button', { type: 'button', class: 'btn btn--primary', onclick: () => location.reload() }, 'Try again')
      )
    )
  );
}
