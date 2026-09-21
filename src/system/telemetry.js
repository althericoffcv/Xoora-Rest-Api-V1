'use strict';

/**
 * XOORA telemetry
 * ---------------
 * A tiny, dependency-free request recorder that powers the /status page.
 *
 *  - Observes every request that matches a registered Express route
 *    (static files, unknown paths, the page routes and /system/* are ignored).
 *  - Keeps hourly buckets for 14 days plus per-route counters, in memory.
 *  - Exposes them as JSON at GET /system/status.
 *
 * The data lives in process memory, so it resets on restart (and, on serverless
 * hosts such as Vercel, is per-instance). To make it durable, swap the two
 * Maps below for a store such as Redis, Upstash or Firestore. The response
 * shape can stay the same, so the frontend does not need to change.
 */

const HOUR = 60 * 60 * 1000;
const RETENTION_HOURS = 24 * 14;      // keep two weeks of hourly buckets
const RECENT_WINDOW = 30 * 60 * 1000; // route health looks at the last 30 minutes...
const RECENT_MAX = 20;                // ...and at most 20 requests per route
const IGNORED_ROUTES = new Set(['/', '/docs', '/status']);

const percentUp = (bad, total) => (total ? +(100 - (bad / total) * 100).toFixed(2) : 100);

module.exports = function telemetry(app) {
    const startedAt = Date.now();
    const totals = { total: 0, success: 0, clientErrors: 0, serverErrors: 0, ms: 0 };
    const buckets = new Map(); // hour start (ms) -> counters
    const routes = new Map();  // route path -> counters + recent samples

    function record(routePath, status, ms) {
        const now = Date.now();
        const isServerError = status >= 500;
        const isClientError = status >= 400 && status < 500;
        const failed = isServerError || isClientError;

        totals.total++;
        totals.ms += ms;
        if (isServerError) totals.serverErrors++;
        else if (isClientError) totals.clientErrors++;
        else totals.success++;

        const hour = Math.floor(now / HOUR) * HOUR;
        let bucket = buckets.get(hour);
        if (!bucket) {
            bucket = { total: 0, success: 0, failed: 0, serverErrors: 0, ms: 0 };
            buckets.set(hour, bucket);
            for (const key of buckets.keys()) {
                if (key < hour - RETENTION_HOURS * HOUR) buckets.delete(key);
            }
        }
        bucket.total++;
        bucket.ms += ms;
        if (failed) bucket.failed++; else bucket.success++;
        if (isServerError) bucket.serverErrors++;

        let route = routes.get(routePath);
        if (!route) {
            route = { total: 0, failed: 0, serverErrors: 0, ms: 0, lastAt: 0, recent: [] };
            routes.set(routePath, route);
        }
        route.total++;
        route.ms += ms;
        route.lastAt = now;
        if (failed) route.failed++;
        if (isServerError) route.serverErrors++;
        route.recent.push([now, isServerError ? 1 : 0]);
        if (route.recent.length > RECENT_MAX) route.recent.shift();
    }

    function routeState(route, now) {
        const recent = route.recent.filter(([at]) => now - at <= RECENT_WINDOW);
        if (recent.length < 3) return 'operational';
        const rate = recent.reduce((sum, [, error]) => sum + error, 0) / recent.length;
        if (rate >= 0.5) return 'outage';
        if (rate >= 0.2) return 'degraded';
        return 'operational';
    }

    function snapshot() {
        const now = Date.now();
        const failed = totals.clientErrors + totals.serverErrors;
        return {
            generatedAt: now,
            startedAt,
            uptimeSeconds: Math.floor(process.uptime()),
            persistence: 'memory',
            totals: {
                requests: totals.total,
                success: totals.success,
                failed,
                clientErrors: totals.clientErrors,
                serverErrors: totals.serverErrors,
                avgResponseMs: totals.total ? Math.round(totals.ms / totals.total) : 0,
                errorRate: totals.total ? +((failed / totals.total) * 100).toFixed(2) : 0,
                availability: percentUp(totals.serverErrors, totals.total)
            },
            // Sparse: only hours that saw traffic. The frontend fills the gaps.
            hourly: [...buckets.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([t, b]) => ({
                    t,
                    total: b.total,
                    success: b.success,
                    failed: b.failed,
                    serverErrors: b.serverErrors,
                    avgMs: Math.round(b.ms / b.total)
                })),
            routes: [...routes.entries()].map(([path, r]) => ({
                path,
                total: r.total,
                failed: r.failed,
                serverErrors: r.serverErrors,
                avgMs: Math.round(r.ms / r.total),
                availability: percentUp(r.serverErrors, r.total),
                state: routeState(r, now),
                lastAt: r.lastAt
            }))
        };
    }

    // Recorder: registered before the API routes so it sees every request.
    app.use((req, res, next) => {
        const started = process.hrtime.bigint();
        res.on('finish', () => {
            const routePath = req.route && req.route.path;
            if (typeof routePath !== 'string') return;
            if (IGNORED_ROUTES.has(routePath) || routePath.startsWith('/system/')) return;
            record(routePath, res.statusCode, Number(process.hrtime.bigint() - started) / 1e6);
        });
        next();
    });

    app.get('/system/status', (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.status(200).json({ status: true, ...snapshot() });
    });
};
