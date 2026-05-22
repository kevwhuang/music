import { getDeployStore } from '@netlify/blobs';

import type { Config, Context } from '@netlify/edge-functions';

const MAX_REQUESTS = 20;
const WINDOW_MS = 60000;

export default async function (request: Request, context: Context) {
    const ip = context.ip || 'unknown';

    if (ip === '::1' || ip === '127.0.0.1') return context.next();

    const store = getDeployStore({ consistency: 'strong', name: 'rate-limit' });
    const now = Date.now();
    const raw = await store.get(ip, { type: 'json' }) as number[] | null;
    const timestamps = (raw || []).filter(t => now - t < WINDOW_MS);

    if (timestamps.length >= MAX_REQUESTS) {
        return new Response('Rate limit exceeded', { status: 429 });
    }

    timestamps.push(now);
    await store.setJSON(ip, timestamps);

    return context.next();
}

export const config: Config = {
    path: '/audio/*',
};
