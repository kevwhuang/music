import { useSyncExternalStore } from 'react';

import { buildSlug } from '@lib/utils';

type PersistedPlayer = Pick<PlayerState, 'collapsed' | 'highpass' | 'lowpass' | 'repeat' | 'volume'>;

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

const FFT_SIZE = 1_024;
const FILTER_Q = 0.707;
const FILTER_SMOOTH = 0.015;
const HP_MAX = 5_000;
const HP_MIN = 20;
const LP_MAX = 20_000;
const LP_MIN = 200;
const VU_SCALE = 2.5;

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

let analyserLeft: AnalyserNode | null = null;
let analyserRight: AnalyserNode | null = null;
let audio: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let gainNode: GainNode | null = null;
let hpFilter: BiquadFilterNode | null = null;
let lpFilter: BiquadFilterNode | null = null;
let requestId: number | null = null;
let timeBufferLeft: Float32Array<ArrayBuffer> | null = null;
let timeBufferRight: Float32Array<ArrayBuffer> | null = null;

function mapHighpass(value: number) {
    return HP_MIN * Math.pow(HP_MAX / HP_MIN, value);
}

function mapLowpass(value: number) {
    return LP_MIN * Math.pow(LP_MAX / LP_MIN, value);
}

function onCanPlay() {
    if (!audio) return;

    audio.removeEventListener('canplay', onCanPlay);
    audio.play().catch(() => { });
}

function restoreState() {
    try {
        const saved: Partial<PersistedPlayer> = JSON.parse(localStorage.getItem('player') ?? 'null');

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
}

function tick() {
    if (!audio) return;

    playerStore.state = { ...playerStore.state, position: audio.currentTime };
    playerStore.emit();
    requestId = requestAnimationFrame(tick);
}

export const playerStore = {
    emit() {
        for (const listener of playerStore.listeners) {
            listener(playerStore.state);
        }
    },

    get() {
        return playerStore.state;
    },

    getAudio(): HTMLAudioElement {
        if (!audio) {
            audio = new Audio();
            audio.crossOrigin = 'anonymous';

            const element = audio;

            audioContext = new AudioContext();

            const source = audioContext.createMediaElementSource(element);

            gainNode = audioContext.createGain();
            gainNode.gain.value = playerStore.state.volume;
            hpFilter = audioContext.createBiquadFilter();
            hpFilter.Q.value = FILTER_Q;
            hpFilter.frequency.value = mapHighpass(playerStore.state.highpass);
            hpFilter.type = 'highpass';
            lpFilter = audioContext.createBiquadFilter();
            lpFilter.Q.value = FILTER_Q;
            lpFilter.frequency.value = mapLowpass(playerStore.state.lowpass);
            lpFilter.type = 'lowpass';

            const limiter = audioContext.createDynamicsCompressor();

            limiter.attack.value = 0.001;
            limiter.knee.value = 0;
            limiter.ratio.value = 20;
            limiter.release.value = 0.01;
            limiter.threshold.value = 0;

            const splitter = audioContext.createChannelSplitter(2);

            analyserLeft = audioContext.createAnalyser();
            analyserRight = audioContext.createAnalyser();
            analyserLeft.fftSize = FFT_SIZE;
            analyserRight.fftSize = FFT_SIZE;

            timeBufferLeft = new Float32Array(analyserLeft.fftSize);
            timeBufferRight = new Float32Array(analyserRight.fftSize);

            source.connect(lpFilter);
            lpFilter.connect(hpFilter);
            hpFilter.connect(gainNode);
            gainNode.connect(limiter);
            limiter.connect(audioContext.destination);
            limiter.connect(splitter);
            splitter.connect(analyserLeft, 0);
            splitter.connect(analyserRight, 1);

            element.addEventListener('ended', () => {
                if (playerStore.state.repeat) {
                    element.currentTime = 0;
                    element.play().catch(() => { });
                } else {
                    playerStore.set({ playing: false, position: element.duration || playerStore.state.duration });
                }
            });

            element.addEventListener('loadedmetadata', () => {
                playerStore.state = { ...playerStore.state, duration: element.duration };
                playerStore.emit();
            });

            element.addEventListener('pause', () => {
                if (requestId) {
                    cancelAnimationFrame(requestId);
                    requestId = null;
                }

                if (element.ended && playerStore.state.repeat) return;

                playerStore.state = { ...playerStore.state, playing: false };
                playerStore.emit();
            });

            element.addEventListener('play', () => {
                if (audioContext?.state === 'suspended') audioContext.resume();

                playerStore.state = { ...playerStore.state, playing: true };
                playerStore.emit();

                if (!requestId) requestId = requestAnimationFrame(tick);
            });
        }

        return audio;
    },

    getLevels(): [number, number] {
        if (!analyserLeft || !analyserRight || !timeBufferLeft || !timeBufferRight) return [0, 0];

        analyserLeft.getFloatTimeDomainData(timeBufferLeft);
        analyserRight.getFloatTimeDomainData(timeBufferRight);

        let sumLeft = 0;
        let sumRight = 0;

        for (let i = 0; i < timeBufferLeft.length; i++) {
            sumLeft += timeBufferLeft[i] * timeBufferLeft[i];
            sumRight += timeBufferRight[i] * timeBufferRight[i];
        }

        const rmsLeft = Math.sqrt(sumLeft / timeBufferLeft.length);
        const rmsRight = Math.sqrt(sumRight / timeBufferRight.length);

        return [Math.min(1, rmsLeft * VU_SCALE), Math.min(1, rmsRight * VU_SCALE)];
    },

    listeners: new Set<(state: PlayerState) => void>(),

    load(track: Track) {
        const audioUrl = `/audio/${buildSlug(track.id, track.data.title)}.mp3`;
        const element = playerStore.getAudio();

        const currentSrc = element.src ? new URL(element.src).pathname : '';

        if (currentSrc === audioUrl && playerStore.state.trackId === track.id) {
            if (element.paused) element.play().catch(() => { });
            else element.pause();

            return;
        }

        element.pause();
        playerStore.set({ duration: track.data.duration, playing: true, position: 0, trackId: track.id });
        element.src = audioUrl;

        element.addEventListener('canplay', onCanPlay);
        element.load();
    },

    save() {
        try {
            const persisted: PersistedPlayer = {
                collapsed: playerStore.state.collapsed,
                highpass: playerStore.state.highpass,
                lowpass: playerStore.state.lowpass,
                repeat: playerStore.state.repeat,
                volume: playerStore.state.volume,
            };

            localStorage.setItem('player', JSON.stringify(persisted));
        } catch {
            return;
        }
    },

    seek(position: number) {
        const element = playerStore.getAudio();

        const clamped = Math.max(0, Math.min(position, element.duration || playerStore.state.duration));

        element.currentTime = clamped;
        playerStore.set({ position: clamped });
    },

    set(patch: Partial<PlayerState>) {
        playerStore.state = { ...playerStore.state, ...patch };

        if (patch.highpass !== undefined && hpFilter && audioContext) {
            hpFilter.frequency.setTargetAtTime(mapHighpass(patch.highpass), audioContext.currentTime, FILTER_SMOOTH);
        }

        if (patch.lowpass !== undefined && lpFilter && audioContext) {
            lpFilter.frequency.setTargetAtTime(mapLowpass(patch.lowpass), audioContext.currentTime, FILTER_SMOOTH);
        }

        if (patch.volume !== undefined && gainNode && audioContext) {
            gainNode.gain.setTargetAtTime(patch.volume, audioContext.currentTime, FILTER_SMOOTH);
        }

        playerStore.save();
        playerStore.emit();
    },

    state: restoreState(),

    subscribe(listener: (state: PlayerState) => void) {
        playerStore.listeners.add(listener);

        return () => {
            playerStore.listeners.delete(listener);
        };
    },

    toggle() {
        if (!playerStore.state.trackId) return;

        const element = playerStore.getAudio();

        if (element.paused) element.play().catch(() => { });
        else element.pause();
    },
};

export function usePlayer(): PlayerState {
    return useSyncExternalStore(playerStore.subscribe, playerStore.get, () => INITIAL);
}
