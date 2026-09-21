import { h, uid, linkify } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { DOC_SECTIONS } from '../core/docs-model.js';
import { onImageError } from '../core/ui.js';
import { buildSnippets, requestHeaders, sampleResponse } from '../core/snippets.js';
import { CodeBlock, CodeTabs, CopyButton } from './code.js';
import { MethodBadge, StatusPill } from './cards.js';
import { TryPanel } from './playground.js';

/* ---------- headings ---------- */

export function Section({ id, title, lead }, ...children) {
  return h(
    'section',
    { class: 'doc-section', id, 'aria-labelledby': `${id}-title` },
    h('h2', { class: 'doc-section__title', id: `${id}-title`, dataset: { toc: '2', section: id } }, title),
    lead ? h('p', { class: 'doc-section__lead' }, lead) : null,
    ...children
  );
}

export function SubHeading({ id, level = 3 }, ...children) {
  return h(`h${level}`, { class: ['doc-h', `doc-h--${level}`], id, dataset: { toc: String(level) } }, ...children);
}

/* ---------- header ---------- */

export function DocsHeader({ config }) {
  const robot = h('img', {
    class: 'docs-hero__robot',
    src: config.assets.docsRobot,
    alt: `${config.name} robot mascot`,
    width: 240,
    height: 240,
    fetchpriority: 'high',
    decoding: 'async',
  });
  onImageError(robot);

  const jumps = [
    ['overview', 'Overview'],
    ['authentication', 'Authentication'],
    ['endpoints', 'Endpoints'],
    ['sdks', 'SDKs'],
  ].map(([id, label]) => h('a', { class: 'jump', href: `#${id}`, dataset: { section: id } }, label));

  const el = h(
    'header',
    { class: 'docs-hero hud' },
    h(
      'div',
      { class: 'docs-hero__copy' },
      h('h1', { class: 'docs-hero__title' }, 'API Documentation'),
      h('p', { class: 'docs-hero__lead' }, `Everything you need to integrate ${config.name} into your application.`)
    ),
    robot,
    h('nav', { class: 'docs-hero__jump', 'aria-label': 'Jump to section' }, jumps)
  );

  return {
    el,
    setActive(sectionId) {
      for (const link of jumps) {
        if (link.dataset.section === sectionId) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    },
  };
}

/* ---------- sidebar navigation (used in the desktop aside and the mobile drawer) ---------- */

export function DocsNav({ config, onNavigate }) {
  const links = new Map();

  const link = (className, href, key, ...children) => {
    const a = h('a', { class: className, href, onclick: onNavigate }, ...children);
    links.set(key, a);
    return a;
  };

  const endpointList = h(
    'ul',
    { class: 'docs-nav__sub' },
    config.categories
      .filter((category) => category.items.length)
      .flatMap((category) => [
        h('li', { class: 'docs-nav__group' }, category.label),
        ...category.items.map((item) => h('li', {}, link('docs-nav__sublink', `#endpoint-${item.id}`, `endpoint-${item.id}`, item.name))),
      ])
  );

  const el = h(
    'nav',
    { class: 'docs-nav', 'aria-label': 'Documentation' },
    h(
      'ul',
      { class: 'docs-nav__list' },
      DOC_SECTIONS.map((section) =>
        h('li', {}, link('docs-nav__link', `#${section.id}`, section.id, icon(section.icon, { size: 18 }), section.label), section.id === 'endpoints' ? endpointList : null)
      )
    )
  );

  return {
    el,
    setActive(sectionId, subId) {
      for (const [key, anchor] of links) {
        const on = key === sectionId || key === subId;
        if (on) anchor.setAttribute('aria-current', 'location');
        else anchor.removeAttribute('aria-current');
      }
    },
  };
}

/* ---------- "On this page" rail ---------- */

export function TocRail() {
  const list = h('ul', { class: 'toc__list' });
  const el = h('nav', { class: 'toc', 'aria-label': 'On this page', hidden: true }, h('p', { class: 'toc__title' }, 'On this page'), list);
  return {
    el,
    setItems(items) {
      list.replaceChildren(
        ...items.map((item) => h('li', { class: `toc__item toc__item--${item.level}` }, h('a', { class: 'toc__link', href: `#${item.id}`, dataset: { id: item.id } }, item.text)))
      );
      el.hidden = items.length === 0;
    },
    setActive(id) {
      for (const anchor of list.querySelectorAll('a')) {
        if (anchor.dataset.id === id) anchor.setAttribute('aria-current', 'location');
        else anchor.removeAttribute('aria-current');
      }
    },
  };
}

/* ---------- endpoint reference ---------- */

const HEADER_HELP = {
  accept: 'The format you want back.',
  authorization: 'Your API key, sent as a Bearer token.',
};

function ParamList(item) {
  if (!item.params.length) return h('p', { class: 'endpoint__none' }, 'None');
  return h(
    'ul',
    { class: 'params' },
    item.params.map((param) =>
      h(
        'li',
        { class: 'params__row' },
        h(
          'div',
          { class: 'params__top' },
          h('code', { class: 'params__name' }, param.name),
          h('span', { class: 'params__type' }, param.type),
          h('span', { class: param.required ? 'params__req' : 'params__opt' }, param.required ? 'required' : 'optional')
        ),
        param.description ? h('p', { class: 'params__desc' }, linkify(param.description)) : null
      )
    )
  );
}

function HeaderList(config, item) {
  return h(
    'ul',
    { class: 'params' },
    requestHeaders(config, item).map(([name, value]) =>
      h(
        'li',
        { class: 'params__row' },
        h('div', { class: 'params__top' }, h('code', { class: 'params__name' }, name), h('code', { class: 'params__value' }, value)),
        HEADER_HELP[name.toLowerCase()] ? h('p', { class: 'params__desc' }, HEADER_HELP[name.toLowerCase()]) : null
      )
    )
  );
}

export function EndpointCard({ config, item }) {
  const tryId = uid('try');
  const responseText = sampleResponse(config, item);
  const label = h('span', {}, 'Try request');
  let panel;

  const tryHost = h('div', { class: 'endpoint__try', id: tryId, hidden: true });
  const toggle = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--sm',
      'aria-expanded': 'false',
      'aria-controls': tryId,
      onclick: () => {
        const open = tryHost.hidden;
        tryHost.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        label.textContent = open ? 'Hide request' : 'Try request';
        if (open) {
          if (!panel) {
            panel = TryPanel({ config, item });
            tryHost.append(panel.el);
          }
          panel.focus();
        }
      },
    },
    icon('play', { size: 15 }),
    label
  );

  return h(
    'article',
    { class: 'endpoint', id: `endpoint-${item.id}`, 'aria-labelledby': `endpoint-${item.id}-title` },
    h(
      'header',
      { class: 'endpoint__head' },
      h('span', { class: 'endpoint__icon' }, icon(item.icon, { size: 20 })),
      h(
        'div',
        { class: 'endpoint__titles' },
        h('h4', { class: 'endpoint__title', id: `endpoint-${item.id}-title`, dataset: { toc: '4' } }, item.name),
        h('p', { class: 'endpoint__desc' }, item.desc)
      )
    ),
    h(
      'div',
      { class: 'endpoint__route' },
      MethodBadge(item.method),
      h('code', { class: 'endpoint__path' }, item.endpoint),
      CopyButton({ getText: () => item.endpoint, ariaLabel: `Copy ${item.name} path`, className: 'copy-btn--quiet' })
    ),
    item.innerDesc ? h('p', { class: 'endpoint__note' }, icon('info', { size: 16 }), h('span', {}, linkify(item.innerDesc))) : null,
    h(
      'div',
      { class: 'endpoint__cols' },
      h('div', {}, h('h5', { class: 'endpoint__label' }, 'Parameters'), ParamList(item)),
      h('div', {}, h('h5', { class: 'endpoint__label' }, 'Headers'), HeaderList(config, item))
    ),
    h('div', { class: 'endpoint__block' }, h('h5', { class: 'endpoint__label' }, 'Request example'), CodeTabs({ snippets: buildSnippets(config, item, Object.fromEntries(item.params.map((p) => [p.name, p.example]))) }).el),
    h(
      'div',
      { class: 'endpoint__block' },
      h('div', { class: 'endpoint__label-row' }, h('h5', { class: 'endpoint__label' }, 'Response example'), StatusPill({ state: 'operational', label: '200 OK' })),
      responseText
        ? CodeBlock({ code: responseText, lang: 'json', copy: true, label: `${item.name} example response` })
        : h('p', { class: 'endpoint__none' }, 'Returns an image (PNG) instead of JSON.')
    ),
    h('footer', { class: 'endpoint__foot' }, toggle),
    tryHost
  );
}
