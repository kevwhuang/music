import type { Config, Context } from '@netlify/edge-functions';

const MAX_REQUESTS = 20;
const WINDOW_MS = 60000;

const hits = new Map<string, number[]>();

export default function (request: Request, context: Context) {
    const ip = context.ip || 'unknown';

    if (ip === '::1' || ip === '127.0.0.1') return context.next();

    const now = Date.now();
    const timestamps = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);

    if (timestamps.length >= MAX_REQUESTS) {
        return new Response('Rate limit exceeded', { status: 429 });
    }

    timestamps.push(now);
    hits.set(ip, timestamps);

    return context.next();
}

export const config: Config = {
    path: '/audio/*',
};
