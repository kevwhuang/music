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
    volume: 1,
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
        emit() {
            for (const fn of store.listeners) {
                fn(store.state);
            }
        },

        get() {
            return store.state;
        },

        getAudio(): HTMLAudioElement {
            if (!audio) {
                audio = new Audio();
                audio.volume = store.state.volume;
                const element = audio;

                const tick = () => {
                    store.state = { ...store.state, position: element.currentTime };
                    store.emit();
                    raf = requestAnimationFrame(tick);
                };

                element.addEventListener('loadedmetadata', () => {
                    store.state = { ...store.state, duration: element.duration };
                    store.emit();
                });

                element.addEventListener('ended', () => {
                    if (store.state.repeat) {
                        element.currentTime = 0;
                        element.play().catch(() => {});
                    } else {
                        store.set({ playing: false, position: element.duration || store.state.duration });
                    }
                });

                element.addEventListener('pause', () => {
                    if (raf) {
                        cancelAnimationFrame(raf);
                        raf = null;
                    }

                    if (element.ended && store.state.repeat) return;

                    store.state = { ...store.state, playing: false };
                    store.emit();
                });

                element.addEventListener('play', () => {
                    store.state = { ...store.state, playing: true };
                    store.emit();

                    if (!raf) {
                        raf = requestAnimationFrame(tick);
                    }
                });
            }

            return audio;
        },

        listeners: new Set<(state: PlayerState) => void>(),

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

        seek(position: number) {
            const el = store.getAudio();
            const clamped = Math.max(0, Math.min(position, el.duration || store.state.duration));
            el.currentTime = clamped;
            store.set({ position: clamped });
        },

        set(patch: Partial<PlayerState>) {
            store.state = { ...store.state, ...patch };
            store.save();
            store.emit();
        },

        setRepeat(repeat: boolean) {
            store.set({ repeat });
        },

        setVolume(volume: number) {
            const el = store.getAudio();
            el.volume = volume;
            store.set({ volume });
        },

        state: restore(),

        subscribe(fn: (state: PlayerState) => void) {
            store.listeners.add(fn);

            return () => {
                store.listeners.delete(fn);
            };
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
