import { useEffect, useState } from 'react';

import { TRACKS } from './tracks';

const INITIAL: PlayerState = {
    trackId: null,
    position: 0,
    duration: 0,
    playing: false,
    volume: 0.78,
    repeat: false,
    lowpass: 1,
    highpass: 0,
};

function createPlayerStore() {
    let audio: HTMLAudioElement | null = null;

    const restore = (): PlayerState => {
        try {
            const j = JSON.parse(localStorage.getItem('player') || 'null');
            if (j && typeof j === 'object') {
                return {
                    ...INITIAL,
                    volume: j.volume ?? INITIAL.volume,
                    repeat: j.repeat ?? false,
                };
            }
        } catch { /* ignore */ }
        return { ...INITIAL };
    };

    const store = {
        state: restore(),
        listeners: new Set<(s: PlayerState) => void>(),

        get() {
            return store.state;
        },

        subscribe(fn: (s: PlayerState) => void) {
            store.listeners.add(fn);
            return () => {
                store.listeners.delete(fn);
            };
        },

        _emit() {
            for (const fn of store.listeners) fn(store.state);
        },

        _save() {
            try {
                localStorage.setItem('player', JSON.stringify({
                    trackId: store.state.trackId,
                    volume: store.state.volume,
                    repeat: store.state.repeat,
                }));
            } catch { /* ignore */ }
        },

        set(patch: Partial<PlayerState>) {
            store.state = { ...store.state, ...patch };
            store._save();
            store._emit();
        },

        getAudio(): HTMLAudioElement {
            if (!audio) {
                audio = new Audio();
                audio.volume = store.state.volume;
                audio.addEventListener('timeupdate', () => {
                    store.state = { ...store.state, position: audio!.currentTime };
                    store._emit();
                });
                audio.addEventListener('loadedmetadata', () => {
                    store.state = { ...store.state, duration: audio!.duration };
                    store._emit();
                });
                audio.addEventListener('ended', () => {
                    if (store.state.repeat) {
                        audio!.currentTime = 0;
                        audio!.play().catch(() => {});
                    } else {
                        store.set({ playing: false, position: audio!.duration || store.state.duration });
                    }
                });
                audio.addEventListener('pause', () => {
                    store.state = { ...store.state, playing: false };
                    store._emit();
                });
                audio.addEventListener('play', () => {
                    store.state = { ...store.state, playing: true };
                    store._emit();
                });
            }
            return audio;
        },

        load(track: Track) {
            const el = store.getAudio();
            const currentSrc = el.src ? new URL(el.src).pathname : '';
            if (currentSrc === track.audioUrl && store.state.trackId === track.id) {
                if (el.paused) el.play().catch(() => {});
                else el.pause();
                return;
            }
            store.set({ trackId: track.id, position: 0, duration: track.duration, playing: false });
            el.src = track.audioUrl;
            const onReady = () => {
                el.removeEventListener('canplay', onReady);
                el.play().catch(() => {});
            };
            el.addEventListener('canplay', onReady);
            el.load();
        },

        toggle() {
            if (!store.state.trackId) return;
            const el = store.getAudio();
            if (el.paused) el.play().catch(() => {});
            else el.pause();
        },

        seek(pos: number) {
            const el = store.getAudio();
            const clamped = Math.max(0, Math.min(pos, el.duration || store.state.duration));
            el.currentTime = clamped;
            store.set({ position: clamped });
        },

        setVolume(v: number) {
            const el = store.getAudio();
            el.volume = v;
            store.set({ volume: v });
        },

        setRepeat(r: boolean) {
            store.set({ repeat: r });
        },
    };

    return store;
}

export const PLAYER = createPlayerStore();

export function usePlayer(): PlayerState {
    const [s, setS] = useState(PLAYER.get());
    useEffect(() => PLAYER.subscribe(setS), []);
    return s;
}

export function useCurrentTrack(): Track | null {
    const s = usePlayer();
    if (!s.trackId) return null;
    return TRACKS.find(t => t.id === s.trackId) ?? null;
}
