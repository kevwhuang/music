/// <reference types="astro/client" />

declare module 'eslint-plugin-jsx-a11y';

interface Track {
    audioUrl: string;
    bpm: string[];
    category: 'music' | 'productions' | 'sessions';
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
