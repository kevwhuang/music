import { useSyncExternalStore } from 'react';

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

const INITIAL: PlayerState = {
    collapsed: false,
    duration: 0,
    highpass: 0,
    lowpass: 1,
    playing: false,
    position: 0,
    repeat: true,
    trackId: null,
    volume: 0.78,
};

function createPlayerStore() {
    let audio: HTMLAudioElement | null = null;
    let raf: number | null = null;

    const restore = (): PlayerState => {
        try {
            const saved = JSON.parse(localStorage.getItem('player') || 'null');

            if (saved && typeof saved === 'object') {
                return {
                    ...INITIAL,
                    collapsed: saved.collapsed ?? INITIAL.collapsed,
                    highpass: saved.highpass ?? INITIAL.highpass,
                    lowpass: saved.lowpass ?? INITIAL.lowpass,
                    repeat: saved.repeat ?? INITIAL.repeat,
                    volume: saved.volume ?? INITIAL.volume,
                };
            }
        } catch {
            return { ...INITIAL };
        }

        return { ...INITIAL };
    };

    const store = {
        listeners: new Set<(state: PlayerState) => void>(),
        state: restore(),

        get() {
            return store.state;
        },

        subscribe(fn: (state: PlayerState) => void) {
            store.listeners.add(fn);

            return () => {
                store.listeners.delete(fn);
            };
        },

        emit() {
            for (const fn of store.listeners) {
                fn(store.state);
            }
        },

        save() {
            try {
                localStorage.setItem('player', JSON.stringify({
                    collapsed: store.state.collapsed,
                    highpass: store.state.highpass,
                    lowpass: store.state.lowpass,
                    repeat: store.state.repeat,
                    volume: store.state.volume,
                }));
            } catch {
                return;
            }
        },

        set(patch: Partial<PlayerState>) {
            store.state = { ...store.state, ...patch };
            store.save();
            store.emit();
        },

        getAudio(): HTMLAudioElement {
            if (!audio) {
                audio = new Audio();
                audio.volume = store.state.volume;

                const tick = () => {
                    store.state = { ...store.state, position: audio!.currentTime };
                    store.emit();
                    raf = requestAnimationFrame(tick);
                };

                audio.addEventListener('loadedmetadata', () => {
                    store.state = { ...store.state, duration: audio!.duration };
                    store.emit();
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
                    store.emit();
                });

                audio.addEventListener('play', () => {
                    store.state = { ...store.state, playing: true };
                    store.emit();

                    if (!raf) {
                        raf = requestAnimationFrame(tick);
                    }
                });
            }

            return audio;
        },

        load(track: Track) {
            const el = store.getAudio();
            const currentSrc = el.src ? new URL(el.src).pathname : '';

            if (currentSrc === track.audioUrl && store.state.trackId === track.id) {
                if (el.paused) {
                    el.play().catch(() => {});
                } else {
                    el.pause();
                }

                return;
            }

            el.pause();
            store.set({ duration: track.duration, playing: true, position: 0, trackId: track.id });
            el.src = track.audioUrl;

            const onReady = () => {
                el.removeEventListener('canplay', onReady);
                el.play().catch(() => {});
            };

            el.addEventListener('canplay', onReady);
            el.load();
        },

        seek(position: number) {
            const el = store.getAudio();
            const clamped = Math.max(0, Math.min(position, el.duration || store.state.duration));
            el.currentTime = clamped;
            store.set({ position: clamped });
        },

        setRepeat(repeat: boolean) {
            store.set({ repeat });
        },

        setVolume(volume: number) {
            const el = store.getAudio();
            el.volume = volume;
            store.set({ volume });
        },

        toggle() {
            if (!store.state.trackId) return;

            const el = store.getAudio();

            if (el.paused) {
                el.play().catch(() => {});
            } else {
                el.pause();
            }
        },
    };

    return store;
}

export const PLAYER = createPlayerStore();

export function usePlayer(): PlayerState {
    return useSyncExternalStore(PLAYER.subscribe, PLAYER.get);
}
