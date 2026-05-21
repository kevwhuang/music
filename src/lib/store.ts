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
    let analyserL: AnalyserNode | null = null;
    let analyserR: AnalyserNode | null = null;
    let audio: HTMLAudioElement | null = null;
    let audioCtx: AudioContext | null = null;
    let gainNode: GainNode | null = null;
    let hpFilter: BiquadFilterNode | null = null;
    let lpFilter: BiquadFilterNode | null = null;
    let raf: number | null = null;
    let timeBufL: Float32Array<ArrayBuffer> | null = null;
    let timeBufR: Float32Array<ArrayBuffer> | null = null;

    const FILTER_Q = 0.707;
    const FILTER_SMOOTH = 0.015;
    const HP_MAX = 5000;
    const HP_MIN = 20;
    const LP_MAX = 20000;
    const LP_MIN = 200;
    const VU_SCALE = 2.5;

    function mapLowpass(v: number): number {
        return LP_MIN * Math.pow(LP_MAX / LP_MIN, v);
    }

    function mapHighpass(v: number): number {
        return HP_MIN * Math.pow(HP_MAX / HP_MIN, v);
    }

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
                audio.crossOrigin = 'anonymous';
                const element = audio;

                audioCtx = new AudioContext();
                const source = audioCtx.createMediaElementSource(element);

                lpFilter = audioCtx.createBiquadFilter();
                lpFilter.type = 'lowpass';
                lpFilter.Q.value = FILTER_Q;
                lpFilter.frequency.value = mapLowpass(store.state.lowpass);
                hpFilter = audioCtx.createBiquadFilter();
                hpFilter.type = 'highpass';
                hpFilter.Q.value = FILTER_Q;
                hpFilter.frequency.value = mapHighpass(store.state.highpass);
                gainNode = audioCtx.createGain();
                gainNode.gain.value = store.state.volume;
                const limiter = audioCtx.createDynamicsCompressor();
                limiter.threshold.value = 0;
                limiter.knee.value = 0;
                limiter.ratio.value = 20;
                limiter.attack.value = 0.001;
                limiter.release.value = 0.01;
                const splitter = audioCtx.createChannelSplitter(2);
                analyserL = audioCtx.createAnalyser();
                analyserR = audioCtx.createAnalyser();
                analyserL.fftSize = 1024;
                analyserR.fftSize = 1024;
                timeBufL = new Float32Array(analyserL.fftSize);
                timeBufR = new Float32Array(analyserR.fftSize);

                source.connect(lpFilter);
                lpFilter.connect(hpFilter);
                hpFilter.connect(gainNode);
                gainNode.connect(limiter);
                limiter.connect(audioCtx.destination);
                limiter.connect(splitter);
                splitter.connect(analyserL, 0);
                splitter.connect(analyserR, 1);

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
                    if (audioCtx?.state === 'suspended') audioCtx.resume();
                    store.state = { ...store.state, playing: true };
                    store.emit();

                    if (!raf) {
                        raf = requestAnimationFrame(tick);
                    }
                });
            }

            return audio;
        },

        getLevels(): [number, number] {
            if (!analyserL || !analyserR || !timeBufL || !timeBufR) return [0, 0];
            analyserL.getFloatTimeDomainData(timeBufL);
            analyserR.getFloatTimeDomainData(timeBufR);
            let sumL = 0;
            let sumR = 0;

            for (let i = 0; i < timeBufL.length; i++) {
                sumL += timeBufL[i] * timeBufL[i];
                sumR += timeBufR[i] * timeBufR[i];
            }

            const rmsL = Math.sqrt(sumL / timeBufL.length);
            const rmsR = Math.sqrt(sumR / timeBufR.length);
            return [Math.min(1, rmsL * VU_SCALE), Math.min(1, rmsR * VU_SCALE)];
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

            if (patch.lowpass !== undefined && lpFilter && audioCtx) {
                lpFilter.frequency.setTargetAtTime(mapLowpass(patch.lowpass), audioCtx.currentTime, FILTER_SMOOTH);
            }

            if (patch.highpass !== undefined && hpFilter && audioCtx) {
                hpFilter.frequency.setTargetAtTime(mapHighpass(patch.highpass), audioCtx.currentTime, FILTER_SMOOTH);
            }

            store.save();
            store.emit();
        },

        setRepeat(repeat: boolean) {
            store.set({ repeat });
        },

        setVolume(volume: number) {
            if (gainNode && audioCtx) {
                gainNode.gain.setTargetAtTime(volume, audioCtx.currentTime, FILTER_SMOOTH);
            }

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
