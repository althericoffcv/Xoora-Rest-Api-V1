'use strict';

const { Redis } = require('@upstash/redis');

/**
 * XOORA telemetry
 * ---------------
 * A tiny, dependency-free request recorder that powers the /status page.
 * Supports Upstash Redis for durable storage in Serverless environments.
 */

const HOUR = 60 * 60 * 1000;
const RETENTION_HOURS = 24 * 14;      // keep two weeks of hourly buckets
const RECENT_WINDOW = 30 * 60 * 1000; // route health looks at the last 30 minutes...
const RECENT_MAX = 20;                // ...and at most 20 requests per route
const IGNORED_ROUTES = new Set(['/', '/docs', '/status']);

const percentUp = (bad, total) => (total ? +(100 - (bad / total) * 100).toFixed(2) : 100);

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(UPSTASH_URL && UPSTASH_TOKEN);
const redis = useRedis ? new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN }) : null;

module.exports = function telemetry(app) {
    const startedAt = Date.now();
    
    // Memory fallback state
    const totals = { total: 0, success: 0, clientErrors: 0, serverErrors: 0, ms: 0 };
    const buckets = new Map();
    const routes = new Map();

    if (useRedis) {
        redis.setnx('xoora:startedAt', startedAt).catch(() => {});
    }

    async function recordRedis(routePath, status, ms) {
        const now = Date.now();
        const isServerError = status >= 500;
        const isClientError = status >= 400 && status < 500;
        const failed = isServerError || isClientError;
        const hour = Math.floor(now / HOUR) * HOUR;
        
        try {
            const p = redis.pipeline();
            // Totals
            p.hincrby('xoora:totals', 'total', 1);
            p.hincrby('xoora:totals', 'ms', Math.round(ms));
            if (isServerError) p.hincrby('xoora:totals', 'serverErrors', 1);
            else if (isClientError) p.hincrby('xoora:totals', 'clientErrors', 1);
            else p.hincrby('xoora:totals', 'success', 1);

            // Hourly Bucket
            p.hincrby(`xoora:bucket:${hour}`, 'total', 1);
            p.hincrby(`xoora:bucket:${hour}`, 'ms', Math.round(ms));
            if (failed) p.hincrby(`xoora:bucket:${hour}`, 'failed', 1);
            else p.hincrby(`xoora:bucket:${hour}`, 'success', 1);
            if (isServerError) p.hincrby(`xoora:bucket:${hour}`, 'serverErrors', 1);
            p.sadd('xoora:buckets', hour);

            // Route
            p.hincrby(`xoora:route:${routePath}`, 'total', 1);
            p.hincrby(`xoora:route:${routePath}`, 'ms', Math.round(ms));
            if (failed) p.hincrby(`xoora:route:${routePath}`, 'failed', 1);
            if (isServerError) p.hincrby(`xoora:route:${routePath}`, 'serverErrors', 1);
            p.hset(`xoora:route:${routePath}`, { lastAt: now });
            p.sadd('xoora:routes', routePath);
            
            // Route recent sliding window
            p.lpush(`xoora:recent:${routePath}`, JSON.stringify([now, isServerError ? 1 : 0]));
            p.ltrim(`xoora:recent:${routePath}`, 0, RECENT_MAX - 1);

            await p.exec();
        } catch (error) {
            console.error('[Telemetry] Redis record error:', error);
        }
    }

    function recordMemory(routePath, status, ms) {
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

    function record(routePath, status, ms) {
        if (useRedis) {
            // Fire and forget (don't block the request)
            recordRedis(routePath, status, ms);
        } else {
            recordMemory(routePath, status, ms);
        }
    }

    function routeState(recent, now) {
        const recentWindow = recent.filter(([at]) => now - at <= RECENT_WINDOW);
        if (recentWindow.length < 3) return 'operational';
        const rate = recentWindow.reduce((sum, [, error]) => sum + error, 0) / recentWindow.length;
        if (rate >= 0.5) return 'outage';
        if (rate >= 0.2) return 'degraded';
        return 'operational';
    }

    async function snapshotRedis() {
        const now = Date.now();
        const p = redis.pipeline();
        p.hgetall('xoora:totals');
        p.smembers('xoora:buckets');
        p.smembers('xoora:routes');
        p.get('xoora:startedAt');
        const [rawTotals, bucketKeys, routeKeys, redisStartedAt] = await p.exec();

        const p2 = redis.pipeline();
        const validBuckets = (bucketKeys || []).filter(h => Number(h) >= now - (RETENTION_HOURS * HOUR));
        validBuckets.forEach(h => p2.hgetall(`xoora:bucket:${h}`));
        (routeKeys || []).forEach(r => {
            p2.hgetall(`xoora:route:${r}`);
            p2.lrange(`xoora:recent:${r}`, 0, RECENT_MAX - 1);
        });

        const results = await p2.exec();
        
        let idx = 0;
        const hourly = [];
        validBuckets.forEach(h => {
            const b = results[idx++] || {};
            const total = Number(b.total) || 0;
            hourly.push({
                t: Number(h),
                total,
                success: Number(b.success) || 0,
                failed: Number(b.failed) || 0,
                serverErrors: Number(b.serverErrors) || 0,
                avgMs: total ? Math.round(Number(b.ms || 0) / total) : 0
            });
        });
        hourly.sort((a, b) => a.t - b.t);

        const routesArr = [];
        (routeKeys || []).forEach(r => {
            const data = results[idx++] || {};
            const recentRaw = results[idx++] || [];
            const recent = recentRaw.map(s => {
                try { return JSON.parse(s); } catch(e) { return [0,0]; }
            });
            const total = Number(data.total) || 0;
            const serverErrors = Number(data.serverErrors) || 0;

            routesArr.push({
                path: r,
                total,
                failed: Number(data.failed) || 0,
                serverErrors,
                avgMs: total ? Math.round(Number(data.ms || 0) / total) : 0,
                availability: percentUp(serverErrors, total),
                state: routeState(recent, now),
                lastAt: Number(data.lastAt) || 0
            });
        });

        const totalReqs = Number(rawTotals?.total) || 0;
        const totalSE = Number(rawTotals?.serverErrors) || 0;
        const failed = (Number(rawTotals?.clientErrors) || 0) + totalSE;

        return {
            generatedAt: now,
            startedAt: Number(redisStartedAt) || startedAt,
            uptimeSeconds: Math.floor(process.uptime()),
            persistence: 'upstash-redis',
            totals: {
                requests: totalReqs,
                success: Number(rawTotals?.success) || 0,
                failed,
                clientErrors: Number(rawTotals?.clientErrors) || 0,
                serverErrors: totalSE,
                avgResponseMs: totalReqs ? Math.round(Number(rawTotals?.ms || 0) / totalReqs) : 0,
                errorRate: totalReqs ? +((failed / totalReqs) * 100).toFixed(2) : 0,
                availability: percentUp(totalSE, totalReqs)
            },
            hourly,
            routes: routesArr
        };
    }

    function snapshotMemory() {
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
            hourly: [...buckets.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([t, b]) => ({
                    t,
                    total: b.total,
                    success: b.success,
                    failed: b.failed,
                    serverErrors: b.serverErrors,
                    avgMs: b.total ? Math.round(b.ms / b.total) : 0
                })),
            routes: [...routes.entries()].map(([path, r]) => ({
                path,
                total: r.total,
                failed: r.failed,
                serverErrors: r.serverErrors,
                avgMs: r.total ? Math.round(r.ms / r.total) : 0,
                availability: percentUp(r.serverErrors, r.total),
                state: routeState(r.recent, now),
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

    app.get('/system/status', async (req, res) => {
        res.set('Cache-Control', 'no-store');
        try {
            const data = useRedis ? await snapshotRedis() : snapshotMemory();
            res.status(200).json({ status: true, ...data });
        } catch (error) {
            console.error('[Telemetry] Snapshot error:', error);
            res.status(500).json({ status: false, message: 'Failed to generate status snapshot' });
        }
    });
};
