import fs from 'node:fs';
import path from 'node:path';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

import type { Loader } from 'astro/loaders';

type RawTrack = Pick<Track, 'data' | 'flags'>;

const CATEGORIES = ['music', 'productions', 'sessions'] as const;
const CONTENT_PATH = 'src/content';

function categoryFromId(id: string) {
    const prefix = id.charAt(0).toUpperCase();

    if (prefix === 'A') return 'music';
    if (prefix === 'B') return 'sessions';

    return 'productions';
}

function tracksLoader(): Loader {
    return {
        load: async ({ generateDigest, store, watcher }) => {
            const peaksPath = path.join(CONTENT_PATH, 'peaks.json');

            const allPeaks: Record<string, number[]> = fs.existsSync(peaksPath)
                ? JSON.parse(fs.readFileSync(peaksPath, 'utf-8'))
                : {};

            store.clear();

            for (const category of CATEGORIES) {
                const categoryDir = path.join(CONTENT_PATH, category);

                if (!fs.existsSync(categoryDir)) continue;

                for (const file of fs.readdirSync(categoryDir)) {
                    if (!file.endsWith('.json')) continue;

                    const filePath = path.join(categoryDir, file);
                    const id = file.replace('.json', '').toUpperCase();

                    const raw: RawTrack = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

                    store.set({
                        data: {
                            category: categoryFromId(id),
                            data: raw.data,
                            flags: raw.flags,
                            peaks: allPeaks[id] ?? [],
                        },

                        digest: generateDigest(JSON.stringify(raw)),
                        filePath,
                        id,
                    });
                }
            }

            watcher?.add(path.join(CONTENT_PATH, '{music,productions,sessions}/**/*.json'));
            watcher?.add(path.join(CONTENT_PATH, 'peaks.json'));
        },
        name: 'tracks-loader',
        schema: z.object({
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
        }),
    };
}

export const collections = { tracks: defineCollection({ loader: tracksLoader() }) };
