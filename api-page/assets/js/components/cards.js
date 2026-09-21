import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { fmtDateTime, fmtUptime } from '../core/format.js';

export const STATE_LABEL = {
  operational: 'Operational',
  degraded: 'Degraded',
  outage: 'Outage',
  unknown: 'Unknown',
};

export const StatusDot = (state) => h('span', { class: ['dot', `dot--${state}`], 'aria-hidden': 'true' });

export const StatusPill = ({ state, label }) =>
  h('span', { class: ['pill', `pill--${state}`] }, StatusDot(state), label || STATE_LABEL[state] || state);

export const MethodBadge = (method) => h('span', { class: ['method', `method--${method.toLowerCase()}`] }, method);

/** Small metric tile: icon, value, label. `set()` updates the value later. */
export function StatCard({ icon: iconName, value = '—', label, hint, tone }) {
  const valueEl = h('span', { class: 'stat__value' }, value);
  const el = h(
    'div',
    { class: ['stat', tone && `stat--${tone}`], title: hint },
    h('span', { class: 'stat__icon' }, icon(iconName, { size: 20 })),
    h('div', { class: 'stat__text' }, valueEl, h('span', { class: 'stat__label' }, label))
  );
  return {
    el,
    set(next) {
      valueEl.textContent = next;
    },
  };
}

/** Large tappable card that links somewhere. */
export function QuickAccessCard({ icon: iconName, title, description, href }) {
  return h(
    'a',
    { class: 'qa', href },
    h('span', { class: 'qa__icon' }, icon(iconName, { size: 22 })),
    h('span', { class: 'qa__title' }, title),
    h('span', { class: 'qa__desc' }, description),
    h('span', { class: 'qa__arrow', 'aria-hidden': 'true' }, icon('arrow-right', { size: 16 }))
  );
}

/** One API in the discovery grid. `setState()` shows live health when known. */
export function ApiCard({ item, onTry }) {
  const status = h('span', { class: 'api-card__status' });
  const query = item.params.length ? h('span', { class: 'api-card__query' }, `?${item.params.map((p) => p.name).join('&')}`) : null;
  const el = h(
    'article',
    { class: 'api-card', dataset: { id: item.id } },
    h(
      'header',
      { class: 'api-card__head' },
      h('span', { class: 'api-card__icon' }, icon(item.icon, { size: 20 })),
      h('div', { class: 'api-card__titles' }, h('h4', { class: 'api-card__name' }, item.name), h('p', { class: 'api-card__desc' }, item.desc)),
      status
    ),
    h('div', { class: 'api-card__endpoint' }, MethodBadge(item.method), h('code', { class: 'api-card__path' }, item.endpoint, query)),
    h(
      'footer',
      { class: 'api-card__foot' },
      h(
        'button',
        { type: 'button', class: 'btn btn--primary btn--sm', 'aria-label': `Try ${item.name} API`, onclick: () => onTry(item) },
        'Try API',
        icon('arrow-right', { size: 16 })
      ),
      h('a', { class: 'link-quiet', href: `/docs#endpoint-${item.id}`, 'aria-label': `${item.name} documentation` }, 'Docs')
    )
  );
  return {
    el,
    item,
    setState(state) {
      status.replaceChildren(state ? StatusPill({ state }) : '');
    },
  };
}

/** One row of the service list on the Status page. */
export function ServiceStatusCard({ service }) {
  const uptime =
    service.uptime == null
      ? h('span', { class: 'service__uptime service__uptime--idle' }, 'No traffic yet')
      : h('span', { class: 'service__uptime' }, fmtUptime(service.uptime));
  return h(
    'li',
    { class: ['service', `service--${service.state}`] },
    h('span', { class: 'service__icon' }, icon(service.icon || 'server', { size: 18 })),
    h('div', { class: 'service__text' }, h('span', { class: 'service__name' }, service.name), h('span', { class: 'service__desc' }, service.desc)),
    h('div', { class: 'service__meta' }, StatusPill({ state: service.state }), uptime)
  );
}

export function IncidentCard({ incident }) {
  const resolved = Boolean(incident.resolvedAt) || incident.status === 'resolved';
  const when = resolved && incident.resolvedAt ? `${fmtDateTime(incident.startedAt)} – ${fmtDateTime(incident.resolvedAt)}` : fmtDateTime(incident.startedAt);
  return h(
    'article',
    { class: ['incident', `incident--${incident.impact}`, resolved && 'is-resolved'] },
    h(
      'header',
      { class: 'incident__head' },
      h('h3', { class: 'incident__title' }, incident.title),
      h('span', { class: ['pill', resolved ? 'pill--operational' : `pill--${incident.impact === 'minor' ? 'degraded' : 'outage'}`] }, incident.status.replace(/^\w/, (c) => c.toUpperCase()))
    ),
    h('p', { class: 'incident__time' }, when),
    incident.updates.length
      ? h(
          'ol',
          { class: 'incident__updates' },
          incident.updates.map((update) => h('li', {}, update.at ? h('time', {}, fmtDateTime(update.at)) : null, update.message))
        )
      : null
  );
}

export function EmptyState({ icon: iconName = 'circle-check', title, text, tone = 'ok' }) {
  return h(
    'div',
    { class: ['empty', `empty--${tone}`] },
    h('span', { class: 'empty__icon' }, icon(iconName, { size: 22 })),
    h('div', {}, h('p', { class: 'empty__title' }, title), text ? h('p', { class: 'empty__text' }, text) : null)
  );
}

/** Highlighted note used in the docs. tone: info | ok | warn */
export function Callout({ tone = 'info', icon: iconName, title }, ...children) {
  const glyph = iconName || (tone === 'ok' ? 'circle-check' : tone === 'warn' ? 'triangle-alert' : 'info');
  return h(
    'aside',
    { class: ['callout', `callout--${tone}`] },
    h('span', { class: 'callout__icon' }, icon(glyph, { size: 20 })),
    h('div', { class: 'callout__body' }, title ? h('p', { class: 'callout__title' }, title) : null, ...children)
  );
}
