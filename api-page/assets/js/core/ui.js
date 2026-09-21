/* Small, dependency-free UI behaviours: preferences, theme, clipboard,
   modal dialogs, popovers and accessible tabs. */

import { h, uid } from './dom.js';

/* ---------- preferences (localStorage, never throws) ---------- */

export function getPref(key, fallback) {
  try {
    return localStorage.getItem(`xoora.${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setPref(key, value) {
  try {
    localStorage.setItem(`xoora.${key}`, value);
  } catch {
    /* storage unavailable (private mode): the preference just won't persist */
  }
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function rafThrottle(fn) {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...args);
    });
  };
}

/* ---------- theme ---------- */

export const getTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  setPref('theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#070d22' : '#f3f7ff');
  document.dispatchEvent(new CustomEvent('xoora:theme', { detail: theme }));
}

export const toggleTheme = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark');

/* ---------- code language (shared by every code tab on a page) ---------- */

export const getLang = () => getPref('lang', 'curl');

export function setLang(id) {
  setPref('lang', id);
  document.dispatchEvent(new CustomEvent('xoora:lang', { detail: id }));
}

/* ---------- clipboard (with a fallback for non-HTTPS origins) ---------- */

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  const area = h('textarea', { readonly: true, 'aria-hidden': 'true', style: { position: 'fixed', top: '0', left: '0', opacity: '0' } });
  area.value = text;
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/* ---------- screen-reader announcements ---------- */

let liveRegion;
export function announce(message) {
  if (!liveRegion) {
    liveRegion = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    document.body.append(liveRegion);
  }
  liveRegion.textContent = '';
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 40);
}

/* ---------- modal dialogs (drawers, search palette) ---------- */

export function openDialog(dialog) {
  if (dialog.open) return;
  dialog.showModal();
  document.documentElement.classList.add('scroll-lock');
  requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-open')));
}

export function closeDialog(dialog) {
  if (!dialog.open) return;
  dialog.classList.remove('is-open');
  const finish = () => {
    if (dialog.open) dialog.close();
  };
  if (prefersReducedMotion()) finish();
  else setTimeout(finish, 240);
}

export function setupDialog(dialog) {
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog(dialog);
  });
  dialog.addEventListener('close', () => {
    dialog.classList.remove('is-open');
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('scroll-lock');
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog); // click on the backdrop
  });
  return dialog;
}

/* ---------- popovers (notifications, account menu) ---------- */

export function Popover({ trigger, panel }) {
  const onOutside = (event) => {
    if (!panel.contains(event.target) && !trigger.contains(event.target)) set(false);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      set(false);
      trigger.focus();
    }
  };
  function set(open) {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      document.dispatchEvent(new CustomEvent('xoora:popover', { detail: panel }));
      document.addEventListener('pointerdown', onOutside, true);
      document.addEventListener('keydown', onKey);
    } else {
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey);
    }
  }
  trigger.addEventListener('click', () => set(panel.hidden));
  panel.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (next && !panel.contains(next) && !trigger.contains(next)) set(false);
  });
  document.addEventListener('xoora:popover', (event) => {
    if (event.detail !== panel && !panel.hidden) set(false);
  });
  return { open: () => set(true), close: () => set(false) };
}

/* ---------- tabs (WAI-ARIA tabs pattern with roving tabindex) ---------- */

export function Tabs({ items, value, label, onChange, panel, className = '' }) {
  const id = uid('tabs');
  if (panel) {
    panel.setAttribute('role', 'tabpanel');
    if (!panel.id) panel.id = `${id}-panel`;
  }
  const list = h('div', { class: ['tabs', className], role: 'tablist', 'aria-label': label });
  const buttons = new Map();

  function select(next, { focus = false, silent = false } = {}) {
    value = next;
    for (const [tabId, button] of buttons) {
      const on = tabId === next;
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
      if (on && panel) panel.setAttribute('aria-labelledby', button.id);
      if (on && focus) button.focus();
    }
    if (!silent) onChange?.(next);
  }

  for (const item of items) {
    const button = h(
      'button',
      {
        type: 'button',
        role: 'tab',
        class: 'tab',
        id: `${id}-${item.id}`,
        'aria-controls': panel ? panel.id : null,
        onclick: () => select(item.id),
      },
      item.label
    );
    buttons.set(item.id, button);
    list.append(button);
  }

  list.addEventListener('keydown', (event) => {
    const ids = items.map((item) => item.id);
    let index = ids.indexOf(value);
    if (event.key === 'ArrowRight') index = (index + 1) % ids.length;
    else if (event.key === 'ArrowLeft') index = (index - 1 + ids.length) % ids.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = ids.length - 1;
    else return;
    event.preventDefault();
    select(ids[index], { focus: true });
  });

  select(value, { silent: true });
  return {
    el: list,
    set: (next, options) => select(next, { silent: true, ...options }),
    get value() {
      return value;
    },
  };
}

/* ---------- navigation helpers ---------- */

export function scrollToHash({ smooth = false } = {}) {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return false;
  const target = document.getElementById(id);
  if (!target) return false;
  target.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'instant', block: 'start' });
  return true;
}

/** Swaps a broken <img> for nothing (or a fallback node) without leaving a broken-image icon. */
export function onImageError(img, fallback) {
  img.addEventListener('error', () => {
    if (fallback) img.replaceWith(fallback);
    else img.hidden = true;
  }, { once: true });
  return img;
}
