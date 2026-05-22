/// <reference types="astro/client" />

declare module 'eslint-plugin-jsx-a11y';

interface PinModalActions {
    close: () => void;
    open: (track: Track, kind: 'master' | 'mixdown') => void;
}

interface Track {
    audioUrl: string;
    category: 'music' | 'productions' | 'sessions';
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
    id: string;
    peaks: number[];
    slug: string;
}
