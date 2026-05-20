/// <reference types="astro/client" />

declare module 'eslint-plugin-jsx-a11y';

type Category = 'music' | 'productions' | 'sessions';

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
