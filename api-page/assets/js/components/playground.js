import { h, uid, linkify } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { fmtBytes, fmtMs } from '../core/format.js';
import { runRequest } from '../core/runner.js';
import { buildSnippets, buildUrl, requestHeaders, sampleResponse } from '../core/snippets.js';
import { prefersReducedMotion } from '../core/ui.js';
import { CodeBlock, CodeTabs, CopyButton } from './code.js';
import { MethodBadge, StatusPill } from './cards.js';

const exampleValues = (item) => Object.fromEntries(item.params.map((param) => [param.name, param.example || '']));

/* ---------- parameter form ---------- */

export function ParamForm({ item, values = exampleValues(item), submitLabel = 'Send request', onInput, onSubmit }) {
  const prefix = uid('param');
  const inputs = new Map();
  const errors = new Map();

  const fields = item.params.map((param) => {
    const inputId = `${prefix}-${param.name}`;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const hint = param.description ? h('p', { class: 'field__hint', id: hintId }, linkify(param.description)) : null;
    const input = h('input', {
      class: 'input',
      id: inputId,
      name: param.name,
      type: 'text',
      value: values[param.name] || '',
      placeholder: param.example ? `e.g. ${param.example}` : `Enter ${param.name}`,
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-describedby': hint ? `${hintId} ${errorId}` : errorId,
      oninput: () => {
        input.removeAttribute('aria-invalid');
        errors.get(param.name).hidden = true;
        onInput?.(getValues());
      },
    });
    const error = h('p', { class: 'field__error', id: errorId, hidden: true }, `Enter a value for “${param.name}”.`);
    inputs.set(param.name, input);
    errors.set(param.name, error);
    return h(
      'div',
      { class: 'field' },
      h('label', { class: 'field__label', for: inputId }, param.name, param.required ? h('span', { class: 'field__req' }, 'required') : null),
      input,
      hint,
      error
    );
  });

  const submitText = h('span', {}, submitLabel);
  const submit = h('button', { type: 'submit', class: 'btn btn--primary pg__send' }, icon('send', { size: 17 }), submitText);
  const el = h(
    'form',
    {
      class: 'param-form',
      novalidate: true,
      onsubmit: (event) => {
        event.preventDefault();
        if (validate()) onSubmit?.(getValues());
      },
    },
    fields.length ? fields : h('p', { class: 'param-form__empty' }, 'This endpoint takes no parameters.'),
    submit
  );

  function getValues() {
    return Object.fromEntries([...inputs].map(([name, input]) => [name, input.value.trim()]));
  }

  function validate() {
    let first = null;
    for (const param of item.params) {
      const input = inputs.get(param.name);
      const missing = param.required && !input.value.trim();
      if (missing) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      errors.get(param.name).hidden = !missing;
      if (missing && !first) first = input;
    }
    first?.focus();
    return !first;
  }

  return {
    el,
    getValues,
    validate,
    focus: () => (inputs.size ? [...inputs.values()][0].focus() : submit.focus()),
    setBusy(busy) {
      submit.disabled = busy;
      submitText.textContent = busy ? 'Sending…' : submitLabel;
    },
  };
}

/* ---------- response viewer ---------- */

export function ResponseView({ title = 'Response', example = true } = {}) {
  let copyValue = '';
  let lastBlob = null;

  const tag = h('span', { class: 'response__tag' });
  const meta = h('div', { class: 'response__meta' });
  const body = h('div', { class: 'response__body', 'aria-live': 'polite' });
  const copy = CopyButton({ getText: () => copyValue, ariaLabel: 'Copy response' });
  copy.hidden = true;

  const el = h('section', { class: 'response', 'aria-label': title }, h('header', { class: 'response__head' }, h('h3', { class: 'response__title' }, title), tag, copy), meta, body);

  const chip = (glyph, text, label) => h('span', { class: 'meta-chip', title: label }, icon(glyph, { size: 14 }), h('span', {}, text));

  function reset() {
    meta.replaceChildren();
    if (lastBlob) URL.revokeObjectURL(lastBlob);
    lastBlob = null;
  }

  function setCopy(text, label) {
    copyValue = text;
    copy.hidden = !text;
    copy.setAttribute('aria-label', label);
  }

  function showIdle(message = 'Send a request to see the live response here.') {
    reset();
    tag.textContent = '';
    setCopy('', 'Copy response');
    body.setAttribute('aria-busy', 'false');
    body.replaceChildren(h('p', { class: 'response__placeholder' }, icon('terminal', { size: 18 }), message));
  }

  return {
    el,
    showIdle,
    /** Documented example, shown before anything has been sent. */
    showExample(config, item) {
      if (!example) return showIdle();
      reset();
      tag.textContent = 'Example';
      body.setAttribute('aria-busy', 'false');
      const text = sampleResponse(config, item);
      meta.replaceChildren(
        h('span', { class: 'pill pill--muted' }, '200 OK'),
        chip('file-text', item.response === 'image' ? 'PNG image' : 'JSON', 'Response format'),
        h('span', { class: 'meta-hint' }, 'Send a request to see live latency and size.')
      );
      if (text) {
        setCopy(text, 'Copy example response');
        body.replaceChildren(CodeBlock({ code: text, lang: 'json', label: 'Example response' }));
      } else {
        setCopy('', 'Copy response');
        body.replaceChildren(h('p', { class: 'response__placeholder' }, icon('image', { size: 18 }), 'Returns a PNG image. Send a request to preview it.'));
      }
    },
    showLoading() {
      reset();
      tag.textContent = 'Live';
      setCopy('', 'Copy response');
      body.setAttribute('aria-busy', 'true');
      body.replaceChildren(h('div', { class: 'response__loading' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Sending request…'));
    },
    showError(message) {
      reset();
      tag.textContent = 'Live';
      setCopy('', 'Copy response');
      body.setAttribute('aria-busy', 'false');
      body.replaceChildren(
        h('div', { class: 'empty empty--bad' }, h('span', { class: 'empty__icon' }, icon('circle-x', { size: 22 })), h('div', {}, h('p', { class: 'empty__title' }, 'Request failed'), h('p', { class: 'empty__text' }, message)))
      );
    },
    showResult(result, item) {
      reset();
      tag.textContent = 'Live';
      const tone = result.status >= 500 ? 'outage' : result.status >= 400 ? 'degraded' : 'operational';
      meta.replaceChildren(
        StatusPill({ state: tone, label: `${result.status} ${result.statusText}`.trim() }),
        chip('timer', fmtMs(result.ms), 'Latency'),
        chip('database', fmtBytes(result.size), 'Response size'),
        chip('file-text', result.kind === 'json' ? 'JSON' : result.kind === 'image' ? result.contentType.replace('image/', '').toUpperCase() : 'Text', 'Content type')
      );
      body.setAttribute('aria-busy', 'false');
      if (result.kind === 'image') {
        lastBlob = result.blobUrl;
        setCopy(result.url, 'Copy image URL');
        body.replaceChildren(h('img', { class: 'response__image', src: result.blobUrl, alt: `Image returned by ${item.name}` }));
      } else {
        setCopy(result.text, 'Copy response');
        body.replaceChildren(CodeBlock({ code: result.text, lang: result.kind === 'json' ? 'json' : 'text', label: 'Response body' }));
      }
    },
  };
}

/* ---------- API playground (Home) ---------- */

export function ApiPlayground({ config, initialId }) {
  let item = config.endpoints.find((endpoint) => endpoint.id === initialId) || config.endpoints[0];
  let values = exampleValues(item);
  let ticket = 0;

  const selectId = uid('pg-api');
  const select = h(
    'select',
    { class: 'select', id: selectId, onchange: () => choose(select.value) },
    config.categories
      .filter((category) => category.items.length)
      .map((category) => h('optgroup', { label: category.label }, category.items.map((endpoint) => h('option', { value: endpoint.id }, endpoint.name))))
  );
  select.value = item.id;

  const urlText = h('code', { class: 'urlbar__url' });
  let urlValue = '';
  const urlCopy = CopyButton({ getText: () => urlValue, ariaLabel: 'Copy request URL', label: 'Copy' });
  const methodHost = h('span', { class: 'urlbar__method' });
  const urlbar = h('div', { class: 'urlbar' }, methodHost, urlText, urlCopy);

  const paramsHost = h('div', { class: 'pg__params-host' });
  const headersHost = h('dl', { class: 'kv' });
  const response = ResponseView({ title: 'Response' });
  const tabs = CodeTabs({ snippets: buildSnippets(config, item, values) });

  let form;

  function refresh() {
    urlValue = buildUrl(config, item, values);
    urlText.textContent = urlValue;
    methodHost.replaceChildren(MethodBadge(item.method));
    headersHost.replaceChildren(...requestHeaders(config, item).flatMap(([name, value]) => [h('dt', {}, name), h('dd', {}, value)]));
    tabs.update(buildSnippets(config, item, values));
  }

  async function send(currentValues) {
    values = currentValues;
    refresh();
    const mine = ++ticket;
    form.setBusy(true);
    response.showLoading();
    const result = await runRequest(buildUrl(config, item, values), requestHeaders(config, item));
    if (mine !== ticket) return; // the person switched API while this was in flight
    form.setBusy(false);
    if (result.networkError) response.showError(result.message);
    else response.showResult(result, item);
  }

  function mountForm() {
    form = ParamForm({
      item,
      values,
      onInput: (next) => {
        values = next;
        refresh();
      },
      onSubmit: send,
    });
    paramsHost.replaceChildren(form.el);
  }

  function choose(id, { focus = false } = {}) {
    const next = config.endpoints.find((endpoint) => endpoint.id === id);
    if (!next) return;
    ticket++;
    item = next;
    values = exampleValues(item);
    select.value = item.id;
    mountForm();
    refresh();
    response.showExample(config, item);
    if (focus) form.focus();
  }

  mountForm();
  refresh();
  response.showExample(config, item);

  const panel = (className, ...children) => h('div', { class: ['panel', className] }, ...children);

  const el = h(
    'div',
    { class: 'pg' },
    panel(
      'pg__target',
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: selectId }, 'API'), h('div', { class: 'select-wrap' }, select, icon('chevron-down', { size: 18, className: 'select-wrap__icon' }))),
      urlbar
    ),
    panel('pg__params', h('h3', { class: 'panel__title' }, 'Parameters'), paramsHost),
    panel('pg__code', h('h3', { class: 'panel__title' }, 'Headers'), headersHost, h('h3', { class: 'panel__title panel__title--gap' }, 'Request'), tabs.el),
    panel('pg__response hud', response.el)
  );

  return {
    el,
    /** Called by "Try API" on a card: select it, bring the playground into view, focus the first field. */
    open(id) {
      choose(id);
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => form.focus(), prefersReducedMotion() ? 0 : 450);
    },
  };
}

/* ---------- "Try request" panel (Docs) ---------- */

export function TryPanel({ config, item }) {
  let values = exampleValues(item);
  const response = ResponseView({ title: 'Live response', example: false });
  response.showIdle();

  const form = ParamForm({
    item,
    values,
    submitLabel: 'Send request',
    onInput: (next) => {
      values = next;
    },
    onSubmit: async (current) => {
      values = current;
      form.setBusy(true);
      response.showLoading();
      const result = await runRequest(buildUrl(config, item, values), requestHeaders(config, item));
      form.setBusy(false);
      if (result.networkError) response.showError(result.message);
      else response.showResult(result, item);
    },
  });

  return { el: h('div', { class: 'try-panel' }, form.el, response.el), focus: form.focus };
}

