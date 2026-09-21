/* Formatting helpers shared by every page. */

const int = new Intl.NumberFormat('en-US');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const fmtInt = (n) => int.format(Math.round(n));
export const fmtCompact = (n) => (n < 10000 ? int.format(Math.round(n)) : compact.format(n));

export function fmtMs(ms) {
  if (!Number.isFinite(ms)) return '—';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

export function fmtBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function fmtPercent(value, digits = 1) {
  return Number.isFinite(value) ? `${value.toFixed(digits)}%` : '—';
}

/** 100 → "100%", 99.987 → "99.99%" (never rounds an outage up to 100). */
export function fmtUptime(value) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 100) return '100%';
  const floored = Math.floor(value * 100) / 100;
  return `${floored.toFixed(2)}%`;
}

export function fmtDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const d = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${hrs}h`;
  if (hrs) return `${hrs}h ${min}m`;
  if (min) return `${min}m`;
  return `${Math.floor(seconds)}s`;
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const timeSecFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const fmtTime = (t) => timeFmt.format(t);
export const fmtTimeSec = (t) => timeSecFmt.format(t);
export const fmtDay = (t) => dayFmt.format(t);
export const fmtDateTime = (t) => dateTimeFmt.format(t);

export function fmtDelta(current, previous) {
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  if (!Number.isFinite(pct)) return null;
  return pct;
}

export const slug = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-') || 'item';
