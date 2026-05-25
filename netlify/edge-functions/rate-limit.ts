import { getDeployStore } from '@netlify/blobs';

import type { Config, Context } from '@netlify/edge-functions';

const MAX_REQUESTS = 30;
const WINDOW_MS = 60_000;

export default async function (_request: Request, context: Context) {
    const ip = context.ip || 'unknown';

    if (ip === '::1' || ip === '127.0.0.1') return context.next();

    const isDev = Deno.env.get('NETLIFY_DEV') === 'true';

    if (isDev) return context.next();

    const now = Date.now();
    const store = getDeployStore({ consistency: 'strong', name: 'rate-limit' });
    const raw = await store.get(ip, { type: 'json' }) as number[] | null;
    const timestamps = (raw || []).filter(timestamp => now - timestamp < WINDOW_MS);

    if (timestamps.length >= MAX_REQUESTS) return new Response('Rate limit exceeded', { status: 429 });

    timestamps.push(now);
    await store.setJSON(ip, timestamps);

    return context.next();
}

export const config: Config = {
    path: '/audio/*',
};
