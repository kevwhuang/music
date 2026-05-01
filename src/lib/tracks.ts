import { buildSlug, categoryFromId } from './utils';

interface RawTrack {
    id: string;
    title: string;
    duration: number;
    bpm: string[];
    key: string[];
    year: number;
    star: boolean;
    heart: boolean;
    master: boolean;
    mixdown: boolean;
}

const musicFiles = import.meta.glob<{ default: RawTrack }>('/src/content/music/*.json', { eager: true });
const sessionFiles = import.meta.glob<{ default: RawTrack }>('/src/content/sessions/*.json', { eager: true });
const productionFiles = import.meta.glob<{ default: RawTrack }>('/src/content/productions/*.json', { eager: true });

function loadAll(): Track[] {
    const raw: RawTrack[] = [];
    for (const mod of Object.values(musicFiles)) raw.push(mod.default);
    for (const mod of Object.values(sessionFiles)) raw.push(mod.default);
    for (const mod of Object.values(productionFiles)) raw.push(mod.default);

    return raw
        .map((t) => {
            const slug = buildSlug(t.id, t.title);
            return {
                ...t,
                category: categoryFromId(t.id),
                slug,
                audioUrl: `/audio/${slug}.mp3`,
            };
        })
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export const TRACKS: Track[] = loadAll();

export const ALL_KEYS: string[] = (() => {
    const s = new Set<string>();
    for (const t of TRACKS) for (const k of t.key) s.add(k);
    return [...s].sort();
})();

export const YEARS: number[] = (() => {
    const s = new Set<number>();
    for (const t of TRACKS) s.add(t.year);
    return [...s].sort((a, b) => a - b);
})();
