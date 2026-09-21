/* Sample data for previewing the Status page (/status?demo=1).
   It is only loaded on demand and is always labelled "Sample data" in the UI.
   The numbers mirror the design brief: 12,548 requests, 127 failed, 182 ms. */

const HOUR = 60 * 60 * 1000;

function rng(seed) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}

/** Splits `total` into integers that follow `weights` and add up exactly. */
function distribute(total, weights) {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / weightSum) * total);
  const floors = raw.map(Math.floor);
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((value, index) => [value - floors[index], index]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k++, rest--) floors[order[k % order.length][1]]++;
  return floors;
}

function makeWindow(rand, startT, hours, { total, failed, serverErrors, avgMs }) {
  const times = Array.from({ length: hours }, (_, i) => startT + i * HOUR);
  const weights = times.map((t) => {
    const hour = new Date(t).getHours();
    const daily = 0.8 + 0.2 * Math.sin(((hour - 9) / 24) * Math.PI * 2);
    return Math.max(0.08, daily * (0.85 + rand() * 0.3));
  });
  const totals = distribute(total, weights);
  const failures = distribute(failed, weights.map((w) => w * (0.3 + rand() * 1.4)));
  const server = new Array(hours).fill(0);
  let placed = 0;
  for (let i = 0; placed < serverErrors && i < 5000; i++) {
    const at = Math.floor(rand() * hours);
    if (failures[at] > server[at]) {
      server[at]++;
      placed++;
    }
  }
  const avgs = times.map(() => Math.round(avgMs + (rand() - 0.5) * 46));
  // Nudge the busiest hour so the weighted average lands on `avgMs`.
  const busiest = totals.indexOf(Math.max(...totals));
  const need = avgMs * total;
  const have = avgs.reduce((n, a, i) => n + a * totals[i], 0);
  avgs[busiest] = Math.max(40, Math.round(avgs[busiest] + (need - have) / totals[busiest]));

  return times.map((t, i) => ({
    t,
    total: totals[i],
    success: totals[i] - failures[i],
    failed: failures[i],
    serverErrors: server[i],
    avgMs: avgs[i],
  }));
}

export function sampleStatus() {
  const now = Math.floor(Date.now() / HOUR) * HOUR;
  const rand = rng(2026);
  const previous = makeWindow(rand, now - 335 * HOUR, 168, { total: 11144, failed: 132, serverErrors: 13, avgMs: 187 });
  const current = makeWindow(rand, now - 167 * HOUR, 168, { total: 12548, failed: 127, serverErrors: 12, avgMs: 182 });

  const service = (id, name, desc, icon, uptime) => ({ id, name, desc, icon, state: 'operational', uptime });

  return {
    status: true,
    generatedAt: Date.now(),
    startedAt: Date.now() - 41 * 24 * 3600 * 1000,
    uptimeSeconds: 41 * 24 * 3600,
    persistence: 'sample',
    totals: {
      requests: 5203418,
      success: 5150092,
      failed: 53326,
      clientErrors: 50100,
      serverErrors: 3226,
      avgResponseMs: 182,
      errorRate: 1.02,
      availability: 99.94,
    },
    hourly: [...previous, ...current],
    routes: [],
    services: [
      service('gateway', 'API Gateway', 'Routing and request handling', 'server', 99.99),
      service('database', 'Database', 'Primary data store', 'database', 99.98),
      service('cdn', 'CDN', 'Static assets and caching', 'globe', 99.97),
      service('worker', 'Worker', 'Background jobs', 'layers', 99.96),
      service('websocket', 'WebSocket', 'Realtime connections', 'radio', 99.95),
    ],
  };
}
