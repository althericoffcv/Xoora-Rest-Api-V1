/* Tiny DOM helpers. h() builds HTML elements, s() builds SVG elements.
   Text children are always inserted as text nodes, so nothing here can inject markup. */

const SVG_NS = 'http://www.w3.org/2000/svg';

function setProps(el, props) {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === 'class') {
      const cls = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
      if (cls) el.setAttribute('class', cls);
    } else if (key === 'style' && typeof value === 'object') {
      for (const [prop, val] of Object.entries(value)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, val);
        else el.style[prop] = val;
      }
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key.startsWith('aria-') || key === 'role') {
      el.setAttribute(key, String(value));
    } else if (value === false) {
      continue;
    } else {
      el.setAttribute(key, value === true ? '' : value);
    }
  }
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false || child === true) continue;
    parent.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  setProps(el, props);
  return append(el, children);
}

export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  setProps(el, props);
  return append(el, children);
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

let counter = 0;
export const uid = (prefix = 'x') => `${prefix}-${++counter}`;

/** Turns plain text containing URLs into text + safe links. */
export function linkify(text) {
  const parts = String(text).split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) =>
    i % 2
      ? h('a', { href: part, target: '_blank', rel: 'noopener noreferrer' }, part.replace(/^https?:\/\//, ''))
      : part
  );
}
