import { getDeployStore } from '@netlify/blobs';

import type { Config, Context } from '@netlify/edge-functions';

const CONTENT_TYPE = { 'Content-Type': 'application/json' };
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60_000;

function json(data: Record<string, unknown>, status: number) {
    return new Response(JSON.stringify(data), { headers: CONTENT_TYPE, status });
}

export default async function (request: Request, context: Context) {
    if (request.method !== 'POST') return json({ ok: false }, 405);

    const ip = context.ip || 'unknown';
    const now = Date.now();
    const store = getDeployStore({ consistency: 'strong', name: 'pin-rate-limit' });
    const raw = await store.get(ip, { type: 'json' }) as number[] | null;
    const timestamps = (raw || []).filter(ts => now - ts < WINDOW_MS);

    if (timestamps.length >= MAX_ATTEMPTS) return json({ error: 'rate_limit', ok: false }, 429);

    const secret = Deno.env.get('DOWNLOAD_PIN') ?? '';

    if (!secret) return json({ error: 'not_configured', ok: false }, 503);

    const body = await request.json().catch(() => null);

    if (!body) return json({ ok: false }, 400);

    const pin = String(body.pin ?? '');
    let match = false;

    if (pin.length === secret.length) {
        let result = 0;

        for (let i = 0; i < pin.length; i++) {
            result |= pin.charCodeAt(i) ^ secret.charCodeAt(i);
        }

        match = result === 0;
    }

    timestamps.push(now);
    await store.setJSON(ip, timestamps);

    return json({ ok: match }, match ? 200 : 401);
}

export const config: Config = {
    path: '/api/verify-pin',
};
