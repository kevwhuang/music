import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import fs from 'node:fs';
import path from 'node:path';

import { buildSlug } from '@lib/utils';

import type { Loader } from 'astro/loaders';

type RawTrack = Omit<Track, 'audioUrl' | 'category' | 'slug'>;

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

            store.clear();

            for (const category of CATEGORIES) {
                const dir = path.join(contentDir, category);

                if (!fs.existsSync(dir)) continue;

                for (const file of fs.readdirSync(dir)) {
                    if (!file.endsWith('.json')) continue;

                    const filePath = path.join(dir, file);
                    const raw: RawTrack = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    const slug = buildSlug(raw.id, raw.title);

                    store.set({
                        data: {
                            audioUrl: `/audio/${slug}.mp3`,
                            bpm: raw.bpm,
                            category: categoryFromId(raw.id),
                            duration: raw.duration,
                            heart: raw.heart,
                            key: raw.key,
                            master: raw.master,
                            mixdown: raw.mixdown,
                            slug,
                            star: raw.star,
                            title: raw.title,
                            year: raw.year,
                        },
                        digest: generateDigest(JSON.stringify(raw)),
                        filePath,
                        id: raw.id,
                    });
                }
            }

            watcher?.add(path.join(contentDir, '{music,productions,sessions}/**/*.json'));
        },
        name: 'tracks-loader',
        schema: z.object({
            audioUrl: z.string(),
            bpm: z.array(z.string()),
            category: z.enum(CATEGORIES),
            duration: z.number(),
            heart: z.boolean(),
            key: z.array(z.string()),
            master: z.boolean(),
            mixdown: z.boolean(),
            slug: z.string(),
            star: z.boolean(),
            title: z.string(),
            year: z.number(),
        }),
    };
}

const tracks = defineCollection({ loader: tracksLoader() });

export const collections = { tracks };
