import { h, uid } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { openDialog, closeDialog, setupDialog } from '../core/ui.js';
import { buildSearchIndex, searchIndex } from '../core/docs-model.js';

let palette;

function build(config) {
  const index = buildSearchIndex(config);
  const listId = uid('search-results');
  let results = [];
  let active = 0;

  const input = h('input', {
    class: 'palette__input',
    type: 'text',
    placeholder: 'Search for endpoints, examples…',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    role: 'combobox',
    'aria-label': 'Search documentation',
    'aria-expanded': 'true',
    'aria-controls': listId,
    'aria-autocomplete': 'list',
  });
  const list = h('ul', { class: 'palette__list', id: listId, role: 'listbox', 'aria-label': 'Results' });
  const empty = h('p', { class: 'palette__empty', hidden: true }, 'No matches. Try “auth”, “errors” or an endpoint name.');

  const close = () => closeDialog(dialog);
  const dialog = setupDialog(
    h(
      'dialog',
      { class: 'palette', 'aria-label': 'Search' },
      h(
        'div',
        { class: 'palette__inner' },
        h('div', { class: 'palette__bar' }, icon('search', { size: 20 }), input, h('button', { type: 'button', class: 'palette__esc', 'aria-label': 'Close search', onclick: close }, 'Esc')),
        list,
        empty,
        h('p', { class: 'palette__hint' }, '↑ ↓ to move · Enter to open')
      )
    )
  );

  function setActive(next) {
    active = next;
    [...list.children].forEach((item, i) => item.setAttribute('aria-selected', String(i === active)));
    const current = list.children[active];
    input.setAttribute('aria-activedescendant', current ? current.id : '');
    current?.scrollIntoView({ block: 'nearest' });
  }

  function go(entry) {
    close();
    const url = new URL(entry.href, location.origin);
    if (url.pathname === location.pathname) location.hash = url.hash;
    else location.href = entry.href;
  }

  function render() {
    results = searchIndex(index, input.value);
    list.replaceChildren(
      ...results.map((entry, i) =>
        h(
          'li',
          { role: 'option', id: `${listId}-${i}`, class: 'palette__item', 'aria-selected': 'false', onpointermove: () => active !== i && setActive(i), onclick: () => go(entry) },
          h('span', { class: 'palette__icon' }, icon(entry.icon, { size: 18 })),
          h('span', { class: 'palette__text' }, h('span', { class: 'palette__title' }, entry.title), h('span', { class: 'palette__sub' }, entry.subtitle)),
          h('span', { class: 'palette__kind' }, entry.kind)
        )
      )
    );
    empty.hidden = results.length > 0;
    setActive(0);
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      setActive((active + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      setActive((active - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault();
      go(results[active]);
    }
  });

  document.body.append(dialog);
  return {
    open() {
      input.value = '';
      render();
      openDialog(dialog);
      input.focus();
    },
  };
}

export function openSearch(config) {
  palette ??= build(config);
  palette.open();
}

/** A button that looks like a search field and opens the palette. */
export function SearchTrigger({ config, className = '' }) {
  const isApple = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  return h(
    'button',
    {
      type: 'button',
      class: ['search-trigger', className],
      'aria-label': 'Search documentation',
      'aria-keyshortcuts': 'Control+K Meta+K',
      onclick: () => openSearch(config),
    },
    icon('search', { size: 18 }),
    h('span', { class: 'search-trigger__text' }, 'Search for endpoints, examples…'),
    h('kbd', { class: 'kbd' }, isApple ? '⌘ K' : 'Ctrl K')
  );
}
