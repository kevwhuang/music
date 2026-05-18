import { useEffect, useState } from 'react';

import { TRACKS } from '@lib/tracks';

const INITIAL: PlayerState = {
    collapsed: false,
    duration: 0,
    highpass: 0,
    lowpass: 1,
    playing: false,
    position: 0,
    repeat: false,
    trackId: null,
    volume: 0.78,
};

const _global = typeof window !== 'undefined' ? window as Record<string, unknown> : {} as Record<string, unknown>;

function createPlayerStore() {
    let audio: HTMLAudioElement | null = (_global.__player_audio as HTMLAudioElement) || null;
    let raf: number | null = null;

    const restore = (): PlayerState => {
        try {
            const j = JSON.parse(localStorage.getItem('player') || 'null');
            if (j && typeof j === 'object') {
                return {
                    ...INITIAL,
                    collapsed: j.collapsed ?? false,
                    repeat: j.repeat ?? false,
                    volume: j.volume ?? INITIAL.volume,
                };
            }
        } catch {
            return { ...INITIAL };
        }
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
                    collapsed: store.state.collapsed,
                    repeat: store.state.repeat,
                    trackId: store.state.trackId,
                    volume: store.state.volume,
                }));
            } catch {
                return;
            }
        },

        set(patch: Partial<PlayerState>) {
            store.state = { ...store.state, ...patch };
            store._save();
            store._emit();
        },

        getAudio(): HTMLAudioElement {
            if (!audio) {
                audio = new Audio();
                _global.__player_audio = audio;
                audio.volume = store.state.volume;
                const tick = () => {
                    store.state = { ...store.state, position: audio!.currentTime };
                    store._emit();
                    raf = requestAnimationFrame(tick);
                };
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
                    if (raf) {
                        cancelAnimationFrame(raf);
                        raf = null;
                    }
                    store.state = { ...store.state, playing: false };
                    store._emit();
                });
                audio.addEventListener('play', () => {
                    store.state = { ...store.state, playing: true };
                    store._emit();
                    if (!raf) raf = requestAnimationFrame(tick);
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
            el.pause();
            store.set({ trackId: track.id, position: 0, duration: track.duration, playing: true });
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
