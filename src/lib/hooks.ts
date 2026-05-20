import { useEffect, useMemo, useState } from 'react';

import { BPM_MAX, BPM_MIN, bpmNum } from '@lib/utils';
import { usePlayer } from '@lib/store';

interface CategoryFilters {
    music: boolean;
    productions: boolean;
    sessions: boolean;
}

interface FavoriteFilters {
    heart: boolean;
    star: boolean;
}

interface SortConfig {
    dir: 'asc' | 'desc';
    field: string;
}

const PAGE_SIZE = 50;

export function useTrackList(tracks: Track[]) {
    const [bpmRange, setBpmRange] = useState<[number, number]>([BPM_MIN, BPM_MAX]);
    const [cats, setCats] = useState<CategoryFilters>({ music: true, productions: true, sessions: true });
    const [favs, setFavs] = useState<FavoriteFilters>({ heart: false, star: false });
    const [keys, setKeys] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const [q, setQ] = useState('');
    const [sort, setSort] = useState<SortConfig>({ dir: 'asc', field: 'id' });
    const [years, setYears] = useState<number[]>([]);

    const filtered = useMemo(() => {
        let r = tracks.filter(t => cats[t.category]);

        if (q.trim()) {
            const needle = q.trim().toLowerCase();
            r = r.filter(t =>
                (t.title || '').toLowerCase().includes(needle)
                || t.id.toLowerCase().includes(needle),
            );
        }

        if (years.length) {
            r = r.filter(t => years.includes(t.year));
        }

        if (keys.length) {
            r = r.filter(t => t.key.some(k => keys.includes(k)));
        }

        if (favs.star && favs.heart) {
            r = r.filter(t => t.star || t.heart);
        } else if (favs.star) {
            r = r.filter(t => t.star);
        } else if (favs.heart) {
            r = r.filter(t => t.heart);
        }

        r = r.filter((t) => {
            const n = bpmNum(t.bpm);

            if (n === null) {
                return bpmRange[0] === BPM_MIN && bpmRange[1] === BPM_MAX;
            }

            return n >= bpmRange[0] && n <= bpmRange[1];
        });

        const dir = sort.dir === 'asc' ? 1 : -1;

        r = [...r].sort((a, b) => {
            let av: string | number, bv: string | number;

            if (sort.field === 'title') {
                av = (a.title || '~~~').toLowerCase();
                bv = (b.title || '~~~').toLowerCase();
            } else if (sort.field === 'year') {
                av = a.year;
                bv = b.year;
            } else if (sort.field === 'duration') {
                av = a.duration;
                bv = b.duration;
            } else if (sort.field === 'bpm') {
                av = bpmNum(a.bpm) ?? 9999;
                bv = bpmNum(b.bpm) ?? 9999;
            } else if (sort.field === 'key') {
                av = (a.key[0]) || '~~~';
                bv = (b.key[0]) || '~~~';
            } else {
                av = a.id;
                bv = b.id;
            }

            return av < bv ? -dir : av > bv ? dir : 0;
        });

        return r;
    }, [bpmRange, cats, favs, keys, q, sort, tracks, years]);

    useEffect(() => setPage(0), [bpmRange, cats, favs, keys, q, sort, years]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return {
        PAGE_SIZE,
        bpmRange, setBpmRange,
        cats, setCats,
        favs, setFavs,
        filtered,
        keys, setKeys,
        page, setPage,
        pageCount,
        q, setQ,
        sort, setSort,
        total: filtered.length,
        visible,
        years, setYears,
    };
}

export type TrackListState = ReturnType<typeof useTrackList>;

export function useVU() {
    const s = usePlayer();
    const [levels, setLevels] = useState([0.1, 0.1]);

    useEffect(() => {
        if (!s.playing) {
            const t = setInterval(() => {
                setLevels(l => l.map(x => Math.max(0.04, x * 0.85)));
            }, 80);

            return () => clearInterval(t);
        }

        let phase = 0;

        const interval = setInterval(() => {
            phase += 0.06;
            const base = 0.55 + Math.sin(phase * 1.7) * 0.18;
            const baseR = 0.5 + Math.sin(phase * 2.1 + 0.7) * 0.22;
            setLevels([
                Math.max(0.05, Math.min(1, base + (Math.random() - 0.5) * 0.18)),
                Math.max(0.05, Math.min(1, baseR + (Math.random() - 0.5) * 0.22)),
            ]);
        }, 60);

        return () => clearInterval(interval);
    }, [s.playing]);

    return levels;
}
