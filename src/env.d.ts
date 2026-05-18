/// <reference types="astro/client" />

declare module 'eslint-plugin-jsx-a11y';

type Category = 'music' | 'productions' | 'sessions';

interface CategoryFilters {
    music: boolean;
    productions: boolean;
    sessions: boolean;
}

interface FavoriteFilters {
    heart: boolean;
    star: boolean;
}

interface PlayerState {
    collapsed: boolean;
    duration: number;
    highpass: number;
    lowpass: number;
    playing: boolean;
    position: number;
    repeat: boolean;
    trackId: string | null;
    volume: number;
}

interface SortConfig {
    dir: 'asc' | 'desc';
    field: string;
}

interface Track {
    audioUrl: string;
    bpm: string[];
    category: Category;
    duration: number;
    heart: boolean;
    id: string;
    key: string[];
    master: boolean;
    mixdown: boolean;
    slug: string;
    star: boolean;
    title: string;
    year: number;
}
