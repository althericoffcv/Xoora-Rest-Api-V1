import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { onImageError } from '../core/ui.js';
import { StatusDot } from './cards.js';

const CHIP_TEXT = {
  healthy: 'All systems operational',
  degraded: 'Degraded performance',
  outage: 'Service disruption',
};

export function Hero({ config }) {
  const statusHost = h('div', { class: 'hero__status' });

  const art = h('img', {
    class: 'hero__img',
    src: config.assets.hero,
    alt: `Anime developer character welcoming you to ${config.name}`,
    width: 720,
    height: 540,
    fetchpriority: 'high',
    decoding: 'async',
  });
  onImageError(art);

  const el = h(
    'section',
    { class: 'hero', 'aria-labelledby': 'hero-title' },
    h('div', { class: 'hero__bg', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'container hero__grid' },
      h(
        'div',
        { class: 'hero__copy' },
        statusHost,
        h('h1', { class: 'hero__title', id: 'hero-title' }, 'Build faster with ', h('span', { class: 'hero__name' }, config.name)),
        h('p', { class: 'hero__lead' }, config.description),
        h(
          'div',
          { class: 'hero__cta' },
          h('a', { class: 'btn btn--primary btn--lg', href: '/docs#quick-start' }, 'Get Started', icon('arrow-right', { size: 18 })),
          h('a', { class: 'btn btn--lg', href: '/docs' }, icon('book-open', { size: 18 }), 'Documentation')
        ),
        h('p', { class: 'hero__note' }, icon('circle-check', { size: 16 }), config.auth.required ? 'API key required' : 'No API key required')
      ),
      h(
        'figure',
        { class: 'hero__art hud' },
        h('span', { class: 'hero__slash hero__slash--lime', 'aria-hidden': 'true' }),
        h('span', { class: 'hero__slash hero__slash--blue', 'aria-hidden': 'true' }),
        h('div', { class: 'hero__frame' }, art),
        h('span', { class: 'hero__spark hero__spark--a', 'aria-hidden': 'true' }, icon('spark', { size: 34, fill: true, stroke: 1 })),
        h('span', { class: 'hero__spark hero__spark--b', 'aria-hidden': 'true' }, icon('spark', { size: 18, fill: true, stroke: 1 }))
      )
    )
  );

  return {
    el,
    /** Shows the live system state as a small chip above the title. */
    setStatus(overall) {
      const text = CHIP_TEXT[overall.state];
      if (!text) return statusHost.replaceChildren();
      const state = overall.state === 'healthy' ? 'operational' : overall.state;
      statusHost.replaceChildren(
        h('a', { class: ['chip', `chip--${state}`], href: '/status' }, StatusDot(state), text, icon('chevron-right', { size: 14 }))
      );
    },
  };
}
