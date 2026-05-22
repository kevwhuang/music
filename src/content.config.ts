import { defineCollection } from 'astro:content';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'astro/zod';

import { buildSlug } from '@lib/utils';

import type { Loader } from 'astro/loaders';

interface RawTrack {
    data: {
        bpm: number;
        duration: number;
        keys: string[];
        tempo: string;
        title: string;
        year: number;
    };
    flags: {
        heart: boolean;
        master: boolean;
        mixdown: boolean;
        star: boolean;
    };
}

const CATEGORIES = ['music', 'productions', 'sessions'] as const;

function categoryFromId(id: string): typeof CATEGORIES[number] {
    const prefix = id.charAt(0).toUpperCase();

    if (prefix === 'A') return 'music';
    if (prefix === 'B') return 'sessions';

    return 'productions';
}

function tracksLoader(): Loader {
    return {
        load: async ({ generateDigest, store, watcher }) => {
            const contentDir = 'src/content';
            const peaksPath = path.join(contentDir, 'peaks.json');
            const allPeaks: Record<string, number[]> = fs.existsSync(peaksPath)
                ? JSON.parse(fs.readFileSync(peaksPath, 'utf-8'))
                : {};

            store.clear();

            for (const category of CATEGORIES) {
                const dir = path.join(contentDir, category);

                if (!fs.existsSync(dir)) continue;

                for (const file of fs.readdirSync(dir)) {
                    if (!file.endsWith('.json')) continue;

                    const filePath = path.join(dir, file);
                    const raw: RawTrack = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    const id = file.replace('.json', '').toUpperCase();
                    const slug = buildSlug(id, raw.data.title);

                    store.set({
                        data: {
                            audioUrl: `/audio/${slug}.mp3`,
                            category: categoryFromId(id),
                            data: raw.data,
                            flags: raw.flags,
                            peaks: allPeaks[id] ?? [],
                            slug,
                        },
                        digest: generateDigest(JSON.stringify(raw)),
                        filePath,
                        id,
                    });
                }
            }

            watcher?.add(path.join(contentDir, '{music,productions,sessions}/**/*.json'));
            watcher?.add(path.join(contentDir, 'peaks.json'));
        },
        name: 'tracks-loader',
        schema: z.object({
            audioUrl: z.string(),
            category: z.enum(CATEGORIES),
            data: z.object({
                bpm: z.number(),
                duration: z.number(),
                keys: z.array(z.string()),
                tempo: z.string(),
                title: z.string(),
                year: z.number(),
            }),
            flags: z.object({
                heart: z.boolean(),
                master: z.boolean(),
                mixdown: z.boolean(),
                star: z.boolean(),
            }),
            peaks: z.array(z.number()),
            slug: z.string(),
        }),
    };
}

const tracks = defineCollection({ loader: tracksLoader() });

export const collections = { tracks };
