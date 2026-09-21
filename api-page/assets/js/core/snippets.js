/* Builds copy-paste request snippets for an endpoint, in four languages,
   from the same config the playground and docs use. */

export const LANGS = [
  { id: 'curl', label: 'cURL', hl: 'bash' },
  { id: 'javascript', label: 'JavaScript', hl: 'js' },
  { id: 'python', label: 'Python', hl: 'python' },
  { id: 'node', label: 'Node.js', hl: 'js' },
];

export const langMeta = (id) => LANGS.find((lang) => lang.id === id) || LANGS[0];

const quote = (value) => JSON.stringify(String(value)); // valid string literal in JS, Python and shell

// encodeURIComponent leaves ! ' ( ) * alone; encoding them keeps the URL safe inside shell quotes.
const encode = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

export const placeholderFor = (name) => `YOUR_${name.toUpperCase().replace(/\W+/g, '_')}`;

/** Resolves current values into [name, value] pairs, using placeholders for empty ones. */
export function resolveParams(item, values = {}) {
  return item.params.map((param) => {
    const raw = String(values[param.name] ?? '').trim();
    return [param.name, raw || placeholderFor(param.name)];
  });
}

export function requestHeaders(config, item) {
  const headers = [];
  if (config.auth.required) {
    const scheme = config.auth.scheme ? `${config.auth.scheme} ` : '';
    headers.push([config.auth.header, `${scheme}YOUR_API_KEY`]);
  }
  headers.push(['Accept', item.response === 'image' ? 'image/*' : 'application/json']);
  return headers;
}

export function buildUrl(config, item, values = {}) {
  const pairs = resolveParams(item, values);
  const query = pairs.length ? `?${pairs.map(([key, value]) => `${key}=${encode(value)}`).join('&')}` : '';
  return `${config.origin}${item.endpoint}${query}`;
}

export function buildSnippets(config, item, values = {}) {
  const pairs = resolveParams(item, values);
  const headers = requestHeaders(config, item);
  const url = buildUrl(config, item, values);
  const base = `${config.origin}${item.endpoint}`;
  const isImage = item.response === 'image';
  const file = `${item.id}.png`;

  const jsKey = (key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : quote(key));
  const jsHeaders = `{ ${headers.map(([key, value]) => `${jsKey(key)}: ${quote(value)}`).join(', ')} }`;
  const jsParams = `{ ${pairs.map(([key, value]) => `${jsKey(key)}: ${quote(value)}`).join(', ')} }`;
  const pyDict = (entries) => `{${entries.map(([key, value]) => `${quote(key)}: ${quote(value)}`).join(', ')}}`;

  const curl = [
    `curl -X ${item.method} ${quote(url)}`,
    ...headers.map(([key, value]) => `  -H ${quote(`${key}: ${value}`)}`),
    ...(isImage ? [`  --output ${file}`] : []),
  ].join(' \\\n');

  const javascript = [
    `const response = await fetch(${quote(url)}, {`,
    `  headers: ${jsHeaders},`,
    `});`,
    ...(isImage
      ? ['const blob = await response.blob();', 'document.querySelector("img").src = URL.createObjectURL(blob);']
      : ['const data = await response.json();', 'console.log(data);']),
  ].join('\n');

  const python = [
    'import requests',
    '',
    'response = requests.get(',
    `    ${quote(base)},`,
    ...(pairs.length ? [`    params=${pyDict(pairs)},`] : []),
    `    headers=${pyDict(headers)},`,
    ')',
    ...(isImage
      ? [`with open(${quote(file)}, "wb") as file:`, '    file.write(response.content)']
      : ['print(response.json())']),
  ].join('\n');

  const node = [
    'import axios from "axios";',
    ...(isImage ? ['import { writeFileSync } from "node:fs";'] : []),
    '',
    `const { data } = await axios.get(${quote(base)}, {`,
    ...(pairs.length ? [`  params: ${jsParams},`] : []),
    `  headers: ${jsHeaders},`,
    ...(isImage ? ['  responseType: "arraybuffer",'] : []),
    '});',
    ...(isImage ? [`writeFileSync(${quote(file)}, data);`] : ['console.log(data);']),
  ].join('\n');

  return { curl, javascript, python, node };
}

/** Pretty JSON for the "Response example" panels. Image endpoints have none. */
export function sampleResponse(config, item) {
  if (item.response === 'image') return null;
  const body = { status: true };
  if (config.creator) body.creator = config.creator;
  Object.assign(body, item.sample || { result: '...' });
  return JSON.stringify(body, null, 2);
}

/** The 400 body the backend returns when a required parameter is missing. */
export function errorSample(config, item) {
  const first = item && item.params[0] ? item.params[0].name : 'text';
  const label = first.charAt(0).toUpperCase() + first.slice(1);
  const body = { status: false };
  if (config.creator) body.creator = config.creator;
  body.error = `${label} is required`;
  return JSON.stringify(body, null, 2);
}
