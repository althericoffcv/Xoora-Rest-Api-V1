/* Status data layer.
   The UI only ever talks to buildStatusModel(). To connect a different data
   source later (Firestore, a monitoring service, ...), return the same shape
   from fetchSystemStatus() and nothing else has to change.

   Raw payload (GET /system/status):
     { totals, hourly: [{ t, total, success, failed, serverErrors, avgMs }],
       routes: [{ path, total, failed, serverErrors, avgMs, availability, state }],
       services?: [...] }   <- optional; used by the sample data */

const HOUR = 60 * 60 * 1000;
const WINDOW_HOURS = 24 * 14;

export async function fetchSystemStatus({ demo = false } = {}) {
  if (demo) {
    const { sampleStatus } = await import('./demo.js');
    return { mode: 'sample', raw: sampleStatus() };
  }
  try {
    const response = await fetch('/system/status', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.json();
    if (!raw || raw.status !== true || !raw.totals) throw new Error('Unexpected response');
    return { mode: 'live', raw };
  } catch (error) {
    return { mode: 'unavailable', raw: null, error };
  }
}

function densify(sparse, now) {
  const end = Math.floor(now / HOUR) * HOUR;
  const byHour = new Map(sparse.map((bucket) => [bucket.t, bucket]));
  const dense = [];
  for (let i = WINDOW_HOURS - 1; i >= 0; i--) {
    const t = end - i * HOUR;
    dense.push(byHour.get(t) || { t, total: 0, success: 0, failed: 0, serverErrors: 0, avgMs: 0 });
  }
  return dense;
}

function liveServices(raw, config) {
  const byPath = new Map((raw.routes || []).map((route) => [route.path, route]));
  const gateway = {
    id: 'gateway',
    name: 'API Gateway',
    desc: 'Routing and request handling',
    icon: 'server',
    state: 'operational',
    uptime: raw.totals.availability,
    requests: raw.totals.requests,
  };
  const endpoints = config.endpoints.map((item) => {
    const route = byPath.get(item.endpoint);
    return {
      id: item.id,
      name: item.name,
      desc: `${item.method} ${item.endpoint}`,
      icon: item.icon,
      state: route ? route.state : 'operational',
      uptime: route ? route.availability : null,
      requests: route ? route.total : 0,
    };
  });
  return [gateway, ...endpoints];
}

const RECENT = 7 * 24 * HOUR;

function deriveOverall(services, incidents, now) {
  const active = incidents.filter((incident) => !incident.resolvedAt && incident.status !== 'resolved');
  const recent = incidents.filter((incident) => incident.startedAt >= now - RECENT);
  let level = 0;
  for (const service of services) level = Math.max(level, service.state === 'outage' ? 2 : service.state === 'degraded' ? 1 : 0);
  for (const incident of active) level = Math.max(level, incident.impact === 'minor' ? 1 : 2);

  if (level === 2) return { state: 'outage', title: 'Service Disruption', description: 'One or more services are currently unavailable.' };
  if (level === 1) return { state: 'degraded', title: 'Degraded Performance', description: 'Some services are slower or failing more often than usual.' };
  return {
    state: 'healthy',
    title: 'System Healthy',
    description: recent.length ? 'All systems operational.' : 'All systems operational. No incidents reported.',
  };
}

export function buildStatusModel(result, config) {
  if (result.mode === 'unavailable') {
    return {
      mode: 'unavailable',
      ok: false,
      services: [],
      hourly: [],
      overall: {
        state: 'unknown',
        title: 'Status unavailable',
        description: 'We couldn’t reach the status service. Try again in a moment.',
      },
    };
  }

  const raw = result.raw;
  const now = raw.generatedAt || Date.now();
  const services = raw.services || liveServices(raw, config);
  return {
    mode: result.mode,
    ok: true,
    generatedAt: now,
    startedAt: raw.startedAt,
    uptimeSeconds: raw.uptimeSeconds,
    persistence: raw.persistence,
    totals: raw.totals,
    hourly: densify(raw.hourly || [], now),
    services,
    overall: deriveOverall(services, config.incidents, now),
  };
}

/* ---------- derived numbers for the statistics panel ---------- */

function sum(buckets) {
  const total = buckets.reduce((n, b) => n + b.total, 0);
  const failed = buckets.reduce((n, b) => n + b.failed, 0);
  const serverErrors = buckets.reduce((n, b) => n + b.serverErrors, 0);
  const weightedMs = buckets.reduce((n, b) => n + b.avgMs * b.total, 0);
  return {
    total,
    success: total - failed,
    failed,
    avgMs: total ? weightedMs / total : 0,
    errorRate: total ? (failed / total) * 100 : 0,
    uptime: total ? 100 - (serverErrors / total) * 100 : 100,
  };
}

export function rangeHours(range) {
  return range === '24h' ? 24 : 168;
}

export function rangeStats(hourly, range) {
  const hours = rangeHours(range);
  const current = hourly.slice(-hours);
  const previous = hourly.slice(-hours * 2, -hours);
  return { current: sum(current), previous: sum(previous), hasPrevious: previous.some((bucket) => bucket.total > 0) };
}

/** 24h -> 24 hourly points, 7d -> 28 six-hour points. */
export function chartPoints(hourly, range) {
  const hours = rangeHours(range);
  const step = range === '24h' ? 1 : 6;
  const slice = hourly.slice(-hours);
  const points = [];
  for (let i = 0; i < slice.length; i += step) {
    const group = slice.slice(i, i + step);
    const total = group.reduce((n, b) => n + b.total, 0);
    const failed = group.reduce((n, b) => n + b.failed, 0);
    points.push({ t: group[0].t, end: group[group.length - 1].t + HOUR, total, success: total - failed, failed });
  }
  return points;
}
