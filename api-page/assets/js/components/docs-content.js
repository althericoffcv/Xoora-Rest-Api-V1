import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { showcaseEndpoint } from '../core/config.js';
import { buildSnippets, errorSample, sampleResponse } from '../core/snippets.js';
import { CodeBlock, CodeTabs, CopyButton } from './code.js';
import { Callout, StatusPill } from './cards.js';
import { EndpointCard, Section, SubHeading } from './docs.js';

const quote = (value) => JSON.stringify(String(value));
const cjk = /[\u3040-\u30ff\u4e00-\u9fff]/;

const exampleValues = (item) => Object.fromEntries(item.params.map((param) => [param.name, param.example]));

function authHeaderText(config) {
  const scheme = config.auth.scheme ? `${config.auth.scheme} ` : '';
  return `${config.auth.header}: ${scheme}YOUR_API_KEY`;
}

/* ---------- Overview ---------- */

export function OverviewSection(config) {
  const imageEndpoints = config.endpoints.some((item) => item.response === 'image');
  const envelope = JSON.stringify({ status: true, creator: config.creator || undefined, result: '...' }, null, 2);

  const fact = (label, value) => h('div', { class: 'facts__item' }, h('dt', {}, label), h('dd', {}, value));
  const fields = [
    ['status', 'boolean', 'true when the request succeeded, false when it failed.'],
    ...(config.creator ? [['creator', 'string', 'The owner of the API.']] : []),
    ['result', 'any', 'The payload. Its shape depends on the endpoint.'],
    ['error', 'string', 'Explains what went wrong. Present instead of result when status is false.'],
  ];

  return Section(
    { id: 'overview', title: 'Overview', lead: `${config.name} is a collection of simple REST endpoints. Send an HTTP GET request and get JSON back, with no SDK or setup required.` },
    h(
      'dl',
      { class: 'facts' },
      fact('Format', 'JSON (UTF-8)'),
      fact('Method', 'GET'),
      fact('Authentication', config.auth.required ? 'API key' : 'None'),
      fact('Endpoints', String(config.endpoints.length))
    ),
    SubHeading({ id: 'base-url' }, 'Base URL'),
    h(
      'div',
      { class: 'urlbar' },
      h('span', { class: 'urlbar__icon' }, icon('globe', { size: 16 })),
      h('code', { class: 'urlbar__url' }, config.origin),
      CopyButton({ getText: () => config.origin, ariaLabel: 'Copy base URL' })
    ),
    SubHeading({ id: 'response-format' }, 'Response format'),
    h('p', { class: 'doc-p' }, 'Every JSON response uses the same envelope, so success and failure are easy to tell apart:'),
    CodeBlock({ code: envelope, lang: 'json', copy: true, label: 'Response envelope' }),
    h(
      'ul',
      { class: 'params' },
      fields.map(([name, type, text]) =>
        h('li', { class: 'params__row' }, h('div', { class: 'params__top' }, h('code', { class: 'params__name' }, name), h('span', { class: 'params__type' }, type)), h('p', { class: 'params__desc' }, text))
      )
    ),
    imageEndpoints ? h('p', { class: 'doc-p doc-p--muted' }, 'Image endpoints return the image itself instead of JSON.') : null
  );
}

/* ---------- Quick Start ---------- */

export function QuickStartSection(config) {
  const first = showcaseEndpoint(config);
  const exampleQuery = first.params[0] ? `?${first.params[0].name}=${first.params[0].example || 'value'}` : '';
  const steps = config.auth.required
    ? [
        { title: 'Create an account', text: 'Sign up to get your API key.', link: config.auth.signupUrl && { href: config.auth.signupUrl, label: 'Sign up' } },
        { title: 'Get your API key', text: 'Find your API key in the dashboard.', link: config.auth.keysUrl && { href: config.auth.keysUrl, label: 'Open dashboard' } },
        { title: 'Make your first request', text: 'Use the example below to get started.' },
      ]
    : [
        { title: 'Pick an endpoint', text: 'Browse the endpoints below and choose the API you need.' },
        { title: 'Add your parameters', text: `Fill in the required query parameters, for example ${exampleQuery || 'none needed'}.` },
        { title: 'Make your first request', text: 'Send a GET request and read the response.' },
      ];

  const responseText = sampleResponse(config, first);

  return Section(
    { id: 'quick-start', title: 'Quick Start', lead: 'Three steps from zero to your first response.' },
    h(
      'ol',
      { class: 'steps' },
      steps.map((step, index) =>
        h(
          'li',
          { class: 'steps__item' },
          h('span', { class: 'steps__num', 'aria-hidden': 'true' }, String(index + 1).padStart(2, '0')),
          h(
            'div',
            {},
            h('p', { class: 'steps__title' }, step.title),
            h('p', { class: 'steps__text' }, step.text, step.link ? [' ', h('a', { href: step.link.href }, step.link.label)] : null)
          )
        )
      )
    ),
    SubHeading({ id: 'example-request' }, 'Example request'),
    CodeTabs({ snippets: buildSnippets(config, first, exampleValues(first)) }).el,
    responseText
      ? [
          SubHeading({ id: 'example-response' }, 'Example response'),
          h('div', { class: 'endpoint__label-row' }, h('span', { class: 'doc-p doc-p--muted' }, 'Status'), StatusPill({ state: 'operational', label: '200 OK' })),
          CodeBlock({ code: responseText, lang: 'json', copy: true, label: 'Example response' }),
        ]
      : null,
    h(
      'a',
      { class: 'note-link', href: '#endpoints' },
      h('span', { class: 'note-link__icon' }, icon('info', { size: 20 })),
      h('span', { class: 'note-link__text' }, h('strong', {}, 'Need more examples?'), h('span', {}, 'See the complete reference for all endpoints, parameters and response formats.')),
      icon('arrow-right', { size: 18 })
    )
  );
}

/* ---------- Authentication ---------- */

export function AuthSection(config) {
  if (!config.auth.required) {
    return Section(
      { id: 'authentication', title: 'Authentication', lead: `${config.name} is open, so requests don’t need an API key.` },
      Callout({ tone: 'ok', title: 'No API key required' }, h('p', {}, 'Every endpoint can be called anonymously. Send the request and read the response. There is nothing to configure.'))
    );
  }
  return Section(
    { id: 'authentication', title: 'Authentication', lead: 'Send your API key with every request.' },
    SubHeading({ id: 'auth-header' }, 'Authorization header'),
    h('p', { class: 'doc-p' }, 'Add your key to the request headers:'),
    CodeBlock({ code: authHeaderText(config), lang: 'text', numbered: false, copy: true, label: 'Authorization header' }),
    config.auth.keysUrl ? h('p', { class: 'doc-p' }, 'Manage your keys in the ', h('a', { href: config.auth.keysUrl }, 'dashboard'), '.') : null
  );
}

/* ---------- Endpoints ---------- */

export function EndpointsSection(config) {
  return Section(
    { id: 'endpoints', title: 'Endpoints', lead: 'All endpoints use GET and return JSON unless noted otherwise.' },
    config.categories
      .filter((category) => category.items.length)
      .map((category) =>
        h(
          'div',
          { class: 'doc-category' },
          SubHeading(
            { id: `category-${category.id}` },
            h('span', { class: 'doc-h__icon' }, icon(category.icon, { size: 18 })),
            category.label,
            category.native ? h('span', { class: 'doc-h__native', lang: cjk.test(category.native) ? 'ja' : null }, category.native) : null
          ),
          category.items.map((item) => EndpointCard({ config, item }))
        )
      )
  );
}

/* ---------- Rate limits ---------- */

const BACKOFF = `async function withRetry(makeRequest, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await makeRequest();
    } catch (error) {
      if (attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 500));
    }
  }
}`;

export function RateLimitsSection(config) {
  return Section(
    { id: 'rate-limits', title: 'Rate Limits', lead: 'Be kind to the API and it will be kind to you.' },
    Callout(
      { tone: 'info', title: 'No fixed rate limit' },
      h('p', {}, `${config.name} does not enforce a request quota today. Some endpoints call third-party services, such as AI providers or video search, and those can slow down or reject requests when they are busy.`)
    ),
    SubHeading({ id: 'fair-use' }, 'Fair use'),
    h('ul', { class: 'bullets' }, [
      h('li', {}, 'Cache results you already have instead of asking again.'),
      h('li', {}, 'Avoid bursts of parallel requests.'),
      h('li', {}, 'Retry failed requests with a short, growing delay.'),
    ]),
    SubHeading({ id: 'backoff' }, 'Retry with backoff'),
    CodeBlock({ code: BACKOFF, lang: 'js', copy: true, label: 'Retry helper' })
  );
}

/* ---------- SDKs ---------- */

function clientSnippets(config) {
  const first = showcaseEndpoint(config);
  const param = first.params[0];
  const call = { js: `await xoora(${quote(first.endpoint)}, { ${param ? `${param.name}: ${quote(param.example || 'value')}` : ''} })`, py: `xoora(${quote(first.endpoint)}${param ? `, ${param.name}=${quote(param.example || 'value')}` : ''})` };
  const authPair = config.auth.required ? [config.auth.header, `${config.auth.scheme ? `${config.auth.scheme} ` : ''}YOUR_API_KEY`] : null;
  const jsHeaders = `{ Accept: "application/json"${authPair ? `, ${authPair[0]}: ${quote(authPair[1])}` : ''} }`;
  const pyHeaders = `{"Accept": "application/json"${authPair ? `, ${quote(authPair[0])}: ${quote(authPair[1])}` : ''}}`;
  const base = config.origin;

  const curl = [
    `curl -s -G ${quote(base + first.endpoint)} \\`,
    ...(authPair ? [`  -H ${quote(`${authPair[0]}: ${authPair[1]}`)} \\`] : []),
    `  --data-urlencode ${quote(`${param ? param.name : 'key'}=${param ? param.example || 'value' : 'value'}`)}`,
  ].join('\n');

  const javascript = `const BASE_URL = ${quote(base)};

export async function xoora(path, params = {}) {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, { headers: ${jsHeaders} });
  const data = await response.json();
  if (!data.status) throw new Error(data.error);
  return data.result;
}

// const answer = ${call.js};`;

  const python = `import requests

BASE_URL = ${quote(base)}

def xoora(path, **params):
    response = requests.get(BASE_URL + path, params=params, headers=${pyHeaders}, timeout=60)
    data = response.json()
    if not data.get("status"):
        raise RuntimeError(data.get("error"))
    return data["result"]

# answer = ${call.py}`;

  const node = `import axios from "axios";

const client = axios.create({ baseURL: ${quote(base)}, headers: ${jsHeaders}, timeout: 60000 });

export async function xoora(path, params = {}) {
  const { data } = await client.get(path, { params, validateStatus: () => true });
  if (!data.status) throw new Error(data.error);
  return data.result;
}

// const answer = ${call.js};`;

  return { curl, javascript, python, node };
}

export function SdksSection(config) {
  return Section(
    { id: 'sdks', title: 'SDKs', lead: 'There are no official SDK packages yet. Every endpoint is a plain GET request, so any HTTP client works.' },
    SubHeading({ id: 'starter-clients' }, 'Starter clients'),
    h('p', { class: 'doc-p' }, 'Copy one of these small helpers. It builds the URL, sends the request and unwraps the response envelope for you.'),
    CodeTabs({ snippets: clientSnippets(config) }).el
  );
}

/* ---------- Examples ---------- */

function recipeSnippets(config, kind, item) {
  const url = config.origin + item.endpoint;
  const param = item.params[0];
  const value = param ? param.example || 'value' : '';

  if (kind === 'ai') {
    const prompt = 'Explain REST APIs in one sentence.';
    return {
      curl: `curl -s -G ${quote(url)} \\\n  --data-urlencode ${quote(`${param.name}=${prompt}`)} | jq -r '.result'`,
      javascript: `const url = new URL(${quote(url)});\nurl.searchParams.set(${quote(param.name)}, ${quote(prompt)});\n\nconst { status, result, error } = await (await fetch(url)).json();\nconsole.log(status ? result : \`Error: \${error}\`);`,
      python: `import requests\n\nres = requests.get(${quote(url)}, params={${quote(param.name)}: ${quote(prompt)}})\ndata = res.json()\nprint(data["result"] if data["status"] else f"Error: {data['error']}")`,
      node: `import axios from "axios";\n\nconst { data } = await axios.get(${quote(url)}, {\n  params: { ${param.name}: ${quote(prompt)} },\n  validateStatus: () => true,\n});\nconsole.log(data.status ? data.result : \`Error: \${data.error}\`);`,
    };
  }

  if (kind === 'search') {
    return {
      curl: `curl -s -G ${quote(url)} \\\n  --data-urlencode ${quote(`${param.name}=${value}`)} | jq -r '.result[:5][] | "\\(.title) - \\(.link)"'`,
      javascript: `const url = new URL(${quote(url)});\nurl.searchParams.set(${quote(param.name)}, ${quote(value)});\n\nconst { result } = await (await fetch(url)).json();\nfor (const video of result.slice(0, 5)) {\n  console.log(\`\${video.title} - \${video.link}\`);\n}`,
      python: `import requests\n\ndata = requests.get(${quote(url)}, params={${quote(param.name)}: ${quote(value)}}).json()\nfor video in data["result"][:5]:\n    print(f'{video["title"]} - {video["link"]}')`,
      node: `import axios from "axios";\n\nconst { data } = await axios.get(${quote(url)}, { params: { ${param.name}: ${quote(value)} } });\nfor (const video of data.result.slice(0, 5)) {\n  console.log(\`\${video.title} - \${video.link}\`);\n}`,
    };
  }

  const file = `${item.id}.png`;
  return {
    curl: `curl -s ${quote(url)} --output ${file}`,
    javascript: `const response = await fetch(${quote(url)});\nconst blob = await response.blob();\ndocument.querySelector("img").src = URL.createObjectURL(blob);`,
    python: `import requests\n\nresponse = requests.get(${quote(url)})\nwith open(${quote(file)}, "wb") as file:\n    file.write(response.content)`,
    node: `import { writeFileSync } from "node:fs";\n\nconst response = await fetch(${quote(url)});\nwriteFileSync(${quote(file)}, Buffer.from(await response.arrayBuffer()));`,
  };
}

const RECIPES = [
  {
    id: 'example-ai',
    kind: 'ai',
    title: 'Ask an AI',
    text: 'Send a prompt and print the answer, or the error if something went wrong.',
    find: (config) => config.endpoints.find((item) => item.response === 'json' && item.params.length === 1 && item.params[0].name === 'text'),
  },
  {
    id: 'example-search',
    kind: 'search',
    title: 'Search and list results',
    text: 'Run a search and print the title and link of the first five results.',
    find: (config) =>
      config.endpoints.find((item) => {
        const first = Array.isArray(item.sample && item.sample.result) ? item.sample.result[0] : null;
        return item.params.length === 1 && first && first.title && first.link;
      }),
  },
  {
    id: 'example-image',
    kind: 'image',
    title: 'Save an image',
    text: 'Image endpoints return the file itself, so write the bytes to disk or show them in the page.',
    find: (config) => config.endpoints.find((item) => item.response === 'image'),
  },
];

export function ExamplesSection(config) {
  const recipes = RECIPES.map((recipe) => ({ recipe, item: recipe.find(config) })).filter((entry) => entry.item);
  return Section(
    { id: 'examples', title: 'Examples', lead: 'Small, complete snippets for common jobs.' },
    recipes.length
      ? recipes.map(({ recipe, item }) =>
          h(
            'div',
            { class: 'recipe' },
            SubHeading({ id: recipe.id }, recipe.title),
            h('p', { class: 'doc-p' }, recipe.text),
            CodeTabs({ snippets: recipeSnippets(config, recipe.kind, item) }).el
          )
        )
      : Callout({ tone: 'info', title: 'No examples yet' }, h('p', {}, 'Add endpoints to src/settings.json and matching examples will appear here.'))
  );
}

/* ---------- Errors ---------- */

export function ErrorsSection(config) {
  const first = showcaseEndpoint(config);
  const hasImages = config.endpoints.some((item) => item.response === 'image');
  const codes = [
    ['200', 'OK', 'operational', 'The request succeeded and status is true.'],
    ['400', 'Bad Request', 'degraded', 'A required parameter is missing. The error field says which one.'],
    ['404', 'Not Found', 'degraded', 'The route does not exist. This returns an HTML page, not JSON.'],
    ['500', 'Internal Server Error', 'outage', 'The request failed, often because an upstream service did. See the error field.'],
  ];

  return Section(
    { id: 'errors', title: 'Errors', lead: 'Failures use standard HTTP status codes, and JSON errors follow the same envelope as successes.' },
    SubHeading({ id: 'status-codes' }, 'Status codes'),
    h(
      'ul',
      { class: 'params' },
      codes.map(([code, name, tone, text]) =>
        h('li', { class: 'params__row' }, h('div', { class: 'params__top' }, StatusPill({ state: tone, label: `${code} ${name}` })), h('p', { class: 'params__desc' }, text))
      )
    ),
    SubHeading({ id: 'error-format' }, 'Error format'),
    h('p', { class: 'doc-p' }, 'When status is false, read the error field. The exact wording depends on the endpoint.'),
    CodeBlock({ code: errorSample(config, first), lang: 'json', copy: true, label: 'Error response' }),
    hasImages ? h('p', { class: 'doc-p doc-p--muted' }, 'Image endpoints report errors as plain text instead of JSON.') : null
  );
}

export function buildDocSections(config) {
  return [
    OverviewSection(config),
    QuickStartSection(config),
    AuthSection(config),
    EndpointsSection(config),
    RateLimitsSection(config),
    SdksSection(config),
    ExamplesSection(config),
    ErrorsSection(config),
  ];
}
