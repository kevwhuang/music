import { getStore } from '@netlify/blobs';

import type { Config, Context } from '@netlify/edge-functions';

const MAX_ATTEMPTS = 10;
const MAX_BODY_LENGTH = 64;
const WINDOW_MS = 60_000;

function json(data: Record<string, unknown>, headers: Record<string, string>, status: number) {
    return Response.json(data, { headers, status });
}

export default async function (request: Request, context: Context) {
    if (request.method !== 'POST') return json({ ok: false }, { Allow: 'POST' }, 405);

    const ip = context.ip || 'unknown';
    const isDev = Netlify.env.get('NETLIFY_DEV') === 'true';
    const now = Date.now();
    const store = getStore({ consistency: 'strong', name: 'pin-rate-limit' });

    let timestamps: number[] = [];

    if (!isDev) {
        const raw = await store.get(ip, { type: 'json' }) as number[] | null;

        timestamps = (raw ?? []).filter(timestamp => now - timestamp < WINDOW_MS);

        if (timestamps.length >= MAX_ATTEMPTS) {
            const retryAfter = Math.ceil((timestamps[0] + WINDOW_MS - now) / 1_000);

            return json({ error: 'rate_limit', ok: false }, { 'Retry-After': String(retryAfter) }, 429);
        }
    }

    const secret = Netlify.env.get('DOWNLOAD_PIN') ?? '';

    if (!secret) return json({ error: 'not_configured', ok: false }, {}, 503);

    const rawBody = await request.text().catch(() => '');

    if (rawBody.length > MAX_BODY_LENGTH) return json({ ok: false }, {}, 413);

    let body: Record<string, unknown>;

    try {
        body = JSON.parse(rawBody);
    } catch {
        return json({ ok: false }, {}, 400);
    }

    const pin = String(body.pin ?? '');

    let matched = false;

    if (pin.length === secret.length) {
        let result = 0;

        for (let i = 0; i < pin.length; i++) {
            result |= pin.charCodeAt(i) ^ secret.charCodeAt(i);
        }

        matched = result === 0;
    }

    if (!isDev) {
        timestamps.push(now);
        await store.setJSON(ip, timestamps);
    }

    return json({ ok: matched }, {}, matched ? 200 : 401);
}

export const config: Config = {
    path: '/api/verify-pin',
};
