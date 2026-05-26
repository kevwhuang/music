import { getStore } from '@netlify/blobs';

import type { Config, Context } from '@netlify/edge-functions';

const MAX_REQUESTS = 100;
const WINDOW_MS = 60_000;

export default async function (_request: Request, context: Context) {
    const isDev = Netlify.env.get('NETLIFY_DEV') === 'true';

    if (isDev) return context.next();

    const ip = context.ip || 'unknown';
    const now = Date.now();
    const store = getStore({ consistency: 'strong', name: 'rate-limit' });

    const raw = await store.get(ip, { type: 'json' }) as number[] | null;

    const timestamps = (raw ?? []).filter(timestamp => now - timestamp < WINDOW_MS);

    if (timestamps.length >= MAX_REQUESTS) {
        const retryAfter = Math.ceil((timestamps[0] + WINDOW_MS - now) / 1_000);

        return new Response('Rate limit exceeded', {
            headers: { 'Retry-After': String(retryAfter) },
            status: 429,
        });
    }

    timestamps.push(now);
    await store.setJSON(ip, timestamps);

    return context.next();
}

export const config: Config = {
    path: '/audio/*',
};
