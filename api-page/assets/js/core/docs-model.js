/* Single source of truth for the documentation structure.
   The sidebar, the mobile drawer, the search palette and the page itself all read from here. */

export const DOC_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: 'layout-grid', keywords: 'introduction base url response format json envelope' },
  { id: 'quick-start', label: 'Quick Start', icon: 'rocket', keywords: 'getting started first request begin steps' },
  { id: 'authentication', label: 'Authentication', icon: 'key-round', keywords: 'api key token bearer header auth login' },
  { id: 'endpoints', label: 'Endpoints', icon: 'server', keywords: 'api reference routes parameters' },
  { id: 'rate-limits', label: 'Rate Limits', icon: 'gauge', keywords: 'throttle quota limit 429 retry backoff' },
  { id: 'sdks', label: 'SDKs', icon: 'package', keywords: 'client library helper axios requests fetch' },
  { id: 'examples', label: 'Examples', icon: 'terminal', keywords: 'recipe snippet tutorial code sample' },
  { id: 'errors', label: 'Errors', icon: 'triangle-alert', keywords: 'status codes 400 404 500 failure error' },
];

/** Everything the search palette can jump to. */
export function buildSearchIndex(config) {
  const sections = DOC_SECTIONS.map((section) => ({
    id: section.id,
    kind: 'Section',
    icon: section.icon,
    title: section.label,
    subtitle: 'Documentation',
    href: `/docs#${section.id}`,
    haystack: `${section.label} ${section.keywords}`.toLowerCase(),
  }));

  const endpoints = config.endpoints.map((item) => ({
    id: `endpoint-${item.id}`,
    kind: 'Endpoint',
    icon: item.icon,
    title: item.name,
    subtitle: `${item.method} ${item.endpoint}`,
    href: `/docs#endpoint-${item.id}`,
    haystack: `${item.name} ${item.desc} ${item.method} ${item.path} ${item.category.label} ${item.params.map((p) => p.name).join(' ')}`.toLowerCase(),
  }));

  return [...sections, ...endpoints];
}

/** Simple ranked substring search: every word must match; title matches rank first. */
export function searchIndex(index, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return index.slice(0, 8);
  return index
    .map((entry) => {
      if (!words.every((word) => entry.haystack.includes(word))) return null;
      const title = entry.title.toLowerCase();
      const score = words.reduce((n, word) => n + (title.startsWith(word) ? 3 : title.includes(word) ? 2 : 1), 0);
      return { entry, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((hit) => hit.entry)
    .slice(0, 8);
}
