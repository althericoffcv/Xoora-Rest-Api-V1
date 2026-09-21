/* Loads src/settings.json (the same file the backend and the original UI use)
   and normalizes it. Every page reads from this one object. */

import { slug } from './format.js';
import { categoryIcon } from './icons.js';

export const DEFAULT_TAGLINE = 'Simple, reliable and high-performance REST APIs for your next application.';

export const DEFAULT_ASSETS = {
  logo: 'https://files.catbox.moe/n4dwml.png',
  favicon: 'https://files.catbox.moe/kijnl7.jpg',
  hero: 'https://files.catbox.moe/xwhhwj.png',
  docsRobot: 'https://files.catbox.moe/gfd4bv.png',
  statusHealthy: 'https://files.catbox.moe/9a74v6.png',
};

/** "AI (人工知能)" -> { label: "AI", native: "人工知能" } */
function splitName(name = '', separator = 'paren') {
  const text = String(name).trim();
  if (separator === 'pipe') {
    const [label, ...rest] = text.split('|');
    return { label: label.trim(), native: rest.join('|').trim() };
  }
  const match = text.match(/^(.*?)\s*\((.+)\)\s*$/);
  return match ? { label: match[1].trim(), native: match[2].trim() } : { label: text, native: '' };
}

function normalizeItem(raw, category, usedIds) {
  const [endpoint, query = ''] = String(raw.path || '/').split('?');
  const params = [...new URLSearchParams(query).keys()].map((name) => {
    const meta = (raw.params && raw.params[name]) || {};
    return {
      name,
      type: meta.type || 'string',
      required: meta.required !== false,
      description: meta.description || '',
      example: meta.example ?? '',
    };
  });

  let id = slug(raw.name);
  if (usedIds.has(id)) id = `${id}-${usedIds.size}`;
  usedIds.add(id);

  return {
    id,
    name: raw.name,
    desc: raw.desc || '',
    innerDesc: raw.innerDesc || '',
    method: String(raw.method || 'GET').toUpperCase(),
    path: raw.path || endpoint,
    endpoint,
    params,
    response: raw.response === 'image' ? 'image' : 'json',
    icon: raw.icon || category.icon,
    sample: raw.sample || null,
    category: { id: category.id, label: category.label },
  };
}

function normalizeIncident(raw, index) {
  return {
    id: raw.id || `incident-${index}`,
    title: raw.title || 'Incident',
    impact: ['minor', 'major', 'critical'].includes(raw.impact) ? raw.impact : 'minor',
    status: raw.status || (raw.resolvedAt ? 'resolved' : 'investigating'),
    startedAt: Date.parse(raw.startedAt) || Date.now(),
    resolvedAt: raw.resolvedAt ? Date.parse(raw.resolvedAt) : null,
    updates: (raw.updates || []).map((u) => ({ at: Date.parse(u.at) || null, message: u.message || '' })),
  };
}

function normalize(raw) {
  const site = raw.site || {};
  const usedIds = new Set();

  const categories = (raw.categories || []).map((rawCategory) => {
    const { label, native } = splitName(rawCategory.name);
    const category = { id: slug(label), label, native, icon: rawCategory.icon || categoryIcon(label) };
    const items = (rawCategory.items || [])
      .map((item) => normalizeItem(item, category, usedIds))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { ...category, items };
  });

  const auth = raw.auth || {};
  const name = raw.name || 'XOORA';

  return {
    name,
    version: raw.version || '',
    description: raw.description || DEFAULT_TAGLINE,
    title: site.title || `${name} — REST API Platform`,
    creator: (raw.apiSettings && raw.apiSettings.creator) || '',
    links: (raw.links || []).map((link) => ({ ...splitName(link.name, 'pipe'), url: link.url })),
    origin: String(site.baseUrl || location.origin).replace(/\/+$/, ''),
    assets: { ...DEFAULT_ASSETS, ...(site.assets || {}) },
    auth: {
      required: Boolean(auth.required),
      header: auth.header || 'Authorization',
      scheme: auth.scheme ?? 'Bearer',
      keysUrl: auth.keysUrl || '',
      signupUrl: auth.signupUrl || '',
    },
    categories,
    endpoints: categories.flatMap((category) => category.items),
    incidents: ((raw.status && raw.status.incidents) || []).map(normalizeIncident),
  };
}

let pending;

export function loadConfig() {
  pending ??= fetch('/src/settings.json')
    .then((response) => {
      if (!response.ok) throw new Error(`settings.json returned HTTP ${response.status}`);
      return response.json();
    })
    .then(normalize)
    .catch((error) => {
      pending = null;
      throw error;
    });
  return pending;
}

/** The friendliest endpoint to demo: JSON, every parameter has an example, fewest parameters. */
export function showcaseEndpoint(config) {
  const json = config.endpoints.filter((item) => item.response === 'json');
  const ready = json.filter((item) => item.params.every((param) => param.example));
  const pool = ready.length ? ready : json.length ? json : config.endpoints;
  return [...pool].sort((a, b) => a.params.length - b.params.length)[0];
}
