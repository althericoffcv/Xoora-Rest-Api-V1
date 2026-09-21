import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { highlightLines } from '../core/highlight.js';
import { copyText, announce, Tabs, getLang, setLang } from '../core/ui.js';
import { LANGS, langMeta } from '../core/snippets.js';

/** Button that copies text and confirms with a check mark. */
export function CopyButton({ getText, label = 'Copy', ariaLabel, className = '' }) {
  let timer;
  const text = h('span', { class: 'copy-btn__label' }, label);
  const button = h(
    'button',
    {
      type: 'button',
      class: ['copy-btn', className],
      'aria-label': ariaLabel || label,
      onclick: async () => {
        const ok = await copyText(getText());
        clearTimeout(timer);
        button.classList.toggle('is-copied', ok);
        text.textContent = ok ? 'Copied' : 'Copy failed';
        announce(ok ? 'Copied to clipboard' : 'Could not copy to clipboard');
        timer = setTimeout(() => {
          button.classList.remove('is-copied');
          text.textContent = label;
        }, 1800);
      },
    },
    h('span', { class: 'copy-btn__icons' }, icon('copy', { size: 15 }), icon('check', { size: 15 })),
    text
  );
  return button;
}

/** Syntax-highlighted, horizontally scrollable code with optional line numbers. */
export function CodeBlock({ code, lang = 'text', copy = false, numbered = true, label = 'Code' }) {
  const pre = h(
    'pre',
    { class: ['code', numbered && 'code--numbered'], tabindex: '0', role: 'region', 'aria-label': label },
    h('code', {}, highlightLines(code, lang))
  );
  if (!copy) return pre;
  return h('div', { class: 'code-wrap' }, pre, CopyButton({ getText: () => code, className: 'copy-btn--float', ariaLabel: `Copy ${label.toLowerCase()}` }));
}

/**
 * cURL / JavaScript / Python / Node.js tabs. The chosen language is shared by
 * every CodeTabs on the page (and remembered), like most API docs do.
 */
export function CodeTabs({ snippets, className = '' }) {
  let data = snippets;
  let current = LANGS.some((lang) => lang.id === getLang()) ? getLang() : LANGS[0].id;

  const body = h('div', { class: 'code-tabs__body' });
  const tabs = Tabs({
    items: LANGS,
    value: current,
    label: 'Code language',
    panel: body,
    className: 'tabs--code',
    onChange: (id) => setLang(id),
  });
  const copy = CopyButton({ getText: () => data[current], ariaLabel: 'Copy code' });

  function render() {
    const meta = langMeta(current);
    body.replaceChildren(CodeBlock({ code: data[current], lang: meta.hl, label: `${meta.label} example` }));
  }

  document.addEventListener('xoora:lang', (event) => {
    current = event.detail;
    tabs.set(current);
    render();
  });

  render();
  return {
    el: h('div', { class: ['code-tabs', className] }, h('div', { class: 'code-tabs__bar' }, tabs.el, copy), body),
    update(next) {
      data = next;
      render();
    },
  };
}
