import { useEffect, useRef, useState } from 'react';

import { ErrorBoundary } from '@components/ErrorBoundary';
import { PLAYER, usePlayer } from '@lib/store';
import { PauseIcon } from '@components/PauseIcon';
import { PlayIcon } from '@components/PlayIcon';
import { RepeatIcon } from '@components/RepeatIcon';
import { categoryLabel, formatDuration } from '@lib/utils';

const BARS_AREA_HEIGHT = 84;
const DURATION_HASH_FACTOR = 17;
const ENV2_FREQ_BASE = 0.009;
const ENV2_FREQ_RANGE = 0.012;
const ENV_FREQ_BASE = 0.035;
const ENV_FREQ_RANGE = 0.04;
const ENV_MIX = 0.65;
const ENV_PRIMARY_WEIGHT = 0.55;
const ENV_SECONDARY_WEIGHT = 0.45;
const FADE_BARS = 6;
const FADER_HEIGHT = 64;
const FADER_TICKS = [0.25, 0.5, 0.75];
const HASH_PRIME = 31;
const JITTER_AMPLITUDE = 0.12;
const JITTER_FREQ = 0.6;
const JITTER_MIX = 0.4;
const LCG_INCREMENT = 1013904223;
const LCG_MULTIPLIER = 1664525;
const NOISE_MIX = 0.25;
const PEAK_MIN = 0.08;
const PULSE_RANGE = 0.08;
const PULSE_STRENGTH = 0.18;
const REEL_SIZE = 56;
const REEL_SPOKE_DEGREES = [0, 60, 120, 180, 240, 300];
const SEEK_STEP = 5;
const SEEK_STEP_SHIFT = 10;
const TICK_AREA_HEIGHT = 20;
const TICK_LONG_STEP = 30;
const TICK_LONG_THRESHOLD = 180;
const TICK_MEDIUM_STEP = 20;
const TICK_MEDIUM_THRESHOLD = 60;
const TICK_SHORT_STEP = 10;
const VU_ANIM_INTERVAL = 100;
const VU_DECAY_INTERVAL = 80;
const VU_DECAY_RATE = 0.85;
const VU_FLOOR = 0.04;
const VU_INITIAL = 0.1;
const VU_LEFT_BASE = 0.55;
const VU_LEFT_FREQ = 1.7;
const VU_LEFT_SWING = 0.18;
const VU_PHASE_STEP = 0.06;
const VU_RIGHT_BASE = 0.5;
const VU_RIGHT_FREQ = 2.1;
const VU_RIGHT_PHASE_OFFSET = 0.7;
const VU_RIGHT_SWING = 0.22;
const VU_SEGS = 16;
const WAVEFORM_AMPLITUDE = 88;
const WAVEFORM_BARS = 180;
const WAVEFORM_HEIGHT = BARS_AREA_HEIGHT + TICK_AREA_HEIGHT;

let trackList: Track[] = [];
const WAVEFORM_CACHE: Record<string, number[]> = {};

function formatCounter(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function Fader({ className, label, resetValue, value, onChange }: {
    className?: string; label: string; resetValue?: number; value: number; onChange: (v: number) => void;
}) {
    const trackRef = useRef<HTMLDivElement>(null);
    const onDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const move = (ev: MouseEvent) => {
            if (!trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            onChange(Math.max(0, Math.min(1, 1 - (ev.clientY - rect.top) / rect.height)));
        };
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
        move(e.nativeEvent);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    return (
        <div className={`flex flex-col items-center gap-1.5 ${className || ''}`}>
            <span className="min-w-[1.625rem] text-[0.5625rem] tabular-nums text-center text-[var(--color-cream-60)]">{Math.round(value * 100)}</span>
            <div
                className="player__fader-track relative w-4 rounded-sm"
                aria-label={label === 'VOL' ? 'Volume' : `${label} filter`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(value * 100)}
                onDoubleClick={() => {
                    if (resetValue !== undefined) onChange(resetValue);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') onChange(Math.min(1, value + 0.05));
                    else if (e.key === 'ArrowDown') onChange(Math.max(0, value - 0.05));
                }}
                onMouseDown={onDown}
                ref={trackRef}
                role="slider"
                style={{ height: FADER_HEIGHT }}
                tabIndex={0}
            >
                {FADER_TICKS.map(p => (
                    <div
                        className="absolute left-0.5 right-0.5 h-px pointer-events-none"
                        key={p}
                        style={{ background: 'var(--color-cream-20)', top: `${(1 - p) * 100}%` }}
                    />
                ))}
                <div className="player__fader-fill absolute left-0 right-0 bottom-0" style={{ height: `${value * 100}%` }} />
                <div className="player__fader-thumb absolute -left-[5px] -right-[5px] h-2.5 rounded-sm" style={{ top: `${(1 - value) * 100}%`, transform: 'translateY(-50%)' }}>
                    <div className="player__fader-line absolute left-0 right-0 top-1/2 h-px -translate-y-1/2" />
                </div>
            </div>
            <span className="font-semibold text-[0.5625rem] tracking-[0.18em] text-[var(--color-cream-40)]">{label}</span>
        </div>
    );
}

function ProgressBar() {
    const player = usePlayer();
    const track = useCurrentTrack();
    const ref = useRef<HTMLDivElement>(null);
    const duration = player.duration || track?.duration || 0;
    const fraction = duration ? player.position / duration : 0;

    return (
        <div
            className="player__progress relative"
            aria-label="Track progress"
            aria-valuemax={duration || 0}
            aria-valuemin={0}
            aria-valuenow={Math.floor(player.position)}
            onClick={(e) => {
                if (!track || !ref.current) return;
                const rect = ref.current.getBoundingClientRect();
                PLAYER.seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration);
            }}
            onKeyDown={(e) => {
                if (!track) return;
                if (e.key === 'ArrowLeft') PLAYER.seek(Math.max(0, player.position - SEEK_STEP));
                else if (e.key === 'ArrowRight') PLAYER.seek(Math.min(duration, player.position + SEEK_STEP));
            }}
            ref={ref}
            role="slider"
            tabIndex={0}
        >
            <div className="player__progress-fill" style={{ width: `${fraction * 100}%` }} />
        </div>
    );
}

function TapeReel({ spinning }: { spinning: boolean }) {
    return (
        <div className="player__reel relative flex items-center justify-center rounded-full" style={{ height: REEL_SIZE, width: REEL_SIZE }}>
            <div
                className={`player__reel-inner ${spinning ? '' : 'player__reel-inner--paused'} relative rounded-full`}
                style={{ height: '72%', width: '72%' }}
            >
                <div className="absolute inset-[38%] rounded-full bg-[var(--color-orange-80)]" />
                {REEL_SPOKE_DEGREES.map(deg => (
                    <div
                        className="absolute top-1/2 left-1/2 w-px bg-[var(--color-cream-40)]"
                        key={deg}
                        style={{ height: '40%', transform: `translate(-50%, 0) rotate(${deg}deg)`, transformOrigin: 'top center' }}
                    />
                ))}
            </div>
        </div>
    );
}

function TransportButton({ children, active, disabled, label, onClick }: {
    children: React.ReactNode; active?: boolean; disabled?: boolean; label: string; onClick: () => void;
}) {
    return (
        <button
            className={`player__transport ${active ? 'player__transport--active' : ''} flex items-center justify-center w-10 h-10 rounded-sm transition-[border-color,color,opacity] duration-150 cursor-pointer`}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function VUMeter({ label, level }: { label: string; level: number }) {
    const lit = Math.round(level * VU_SEGS);

    return (
        <div className="flex flex-col items-center gap-1.5">
            <span className="min-w-[1.625rem] text-[0.5625rem] tabular-nums text-center text-[var(--color-cream-60)]">{Math.round(level * 100)}</span>
            <div className="flex flex-col-reverse gap-px" style={{ height: FADER_HEIGHT }}>
                {Array.from({ length: VU_SEGS }).map((_, i) => {
                    const on = i < lit;
                    let color: string;

                    if (i > VU_SEGS - 4) color = 'var(--color-red)';
                    else if (i > VU_SEGS - 7) color = 'var(--color-orange-80)';
                    else color = 'var(--color-sage)';
                    return (
                        <div
                            key={i}
                            className="w-[7px] flex-1 rounded-[0.5px]"
                            style={{ background: on ? color : 'var(--color-cream-20)', opacity: on ? 1 : 0.5 }}
                        />
                    );
                })}
            </div>
            <span className="font-semibold text-[0.5625rem] tracking-[0.18em] text-[var(--color-cream-40)]">{label}</span>
        </div>
    );
}

function Waveform() {
    const player = usePlayer();
    const track = useCurrentTrack();
    const ref = useRef<HTMLDivElement>(null);
    const [hoverPos, setHoverPos] = useState<number | null>(null);
    const [hoverPx, setHoverPx] = useState<number | null>(null);
    const peaks = track ? generateWaveform(track.id, track.duration) : null;
    const duration = player.duration || track?.duration || 0;
    const playedFrac = duration ? player.position / duration : 0;

    return (
        <div
            className={`player__waveform relative py-2 overflow-hidden ${track ? 'cursor-pointer' : ''}`}
            aria-label="Waveform scrubber"
            aria-valuemax={duration || 0}
            aria-valuemin={0}
            aria-valuenow={Math.floor(player.position)}
            onKeyDown={(e) => {
                if (!track) return;
                if (e.key === 'ArrowLeft') PLAYER.seek(Math.max(0, player.position - SEEK_STEP));
                else if (e.key === 'ArrowRight') PLAYER.seek(Math.min(duration, player.position + SEEK_STEP));
            }}
            onMouseDown={(e) => {
                if (!track || !ref.current) return;
                e.preventDefault();
                const seek = (ev: MouseEvent) => {
                    if (!ref.current) return;
                    const rect = ref.current.getBoundingClientRect();
                    PLAYER.seek(Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)) * duration);
                };
                const up = () => {
                    window.removeEventListener('mousemove', seek);
                    window.removeEventListener('mouseup', up);
                };
                seek(e.nativeEvent);
                window.addEventListener('mousemove', seek);
                window.addEventListener('mouseup', up);
            }}
            onMouseLeave={() => {
                setHoverPos(null);
                setHoverPx(null);
            }}
            onMouseMove={(e) => {
                if (!track || !ref.current) return;
                const rect = ref.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                setHoverPx(x);
                setHoverPos((x / rect.width) * duration);
            }}
            ref={ref}
            role="slider"
            style={{ height: WAVEFORM_HEIGHT }}
            tabIndex={0}
        >
            <div className="absolute left-0 right-0 top-0" style={{ height: BARS_AREA_HEIGHT }}>
                <div className={`player__waveform-center ${!track ? 'player__waveform-center--idle' : ''} absolute left-0 right-0 top-1/2 h-px`} />
                {peaks && (
                    <svg className="absolute inset-0" height="100%" preserveAspectRatio="none" viewBox={`0 0 ${peaks.length * 2} 100`} width="100%">
                        {peaks.map((p, i) => {
                            const x = i * 2 + 0.5;
                            const isPlayed = (i / peaks.length) <= playedFrac;
                            const distFromHead = Math.abs(i / peaks.length - playedFrac);
                            let pulse = 1;

                            if (player.playing && isPlayed && distFromHead < PULSE_RANGE) {
                                pulse = 1 + (1 - distFromHead / PULSE_RANGE) * PULSE_STRENGTH;
                            }
                            const h = p * WAVEFORM_AMPLITUDE * pulse;
                            const y = 50 - h / 2;
                            const inHover = hoverPx != null && (i / peaks.length) <= (hoverPx / (ref.current?.clientWidth || 1)) && !isPlayed;
                            let fill: string;
                            if (isPlayed) fill = 'var(--color-orange-80)';
                            else if (inHover) fill = 'var(--color-orange-60)';
                            else fill = 'var(--color-cream-40)';
                            return <rect fill={fill} height={h} key={i} rx="0.4" width={1} x={x} y={y} />;
                        })}
                    </svg>
                )}
            </div>
            <div className="absolute left-0 right-0 border-t border-[var(--color-cream-20)]" style={{ background: 'var(--color-zinc-950)', height: TICK_AREA_HEIGHT, top: BARS_AREA_HEIGHT }}>
                {track && duration > 0 && (() => {
                    const ticks: React.ReactNode[] = [];
                    let step = TICK_SHORT_STEP;
                    if (duration > TICK_LONG_THRESHOLD) step = TICK_LONG_STEP;
                    else if (duration > TICK_MEDIUM_THRESHOLD) step = TICK_MEDIUM_STEP;
                    for (let i = step; i < duration; i += step) {
                        const pct = (i / duration) * 100;
                        ticks.push(
                            <div key={`t${i}`}>
                                <div className="player__tick absolute top-0 w-px h-1" style={{ left: `${pct}%` }} />
                                <div className="player__tick-label absolute text-[0.625rem]" style={{ left: `${pct}%`, top: 5, transform: 'translateX(-50%)' }}>
                                    {formatDuration(i)}
                                </div>
                            </div>,
                        );
                    }
                    return ticks;
                })()}
            </div>
            {track && (
                <div className="player__playhead absolute z-[2] w-0.5" style={{ height: BARS_AREA_HEIGHT + 4, left: `${playedFrac * 100}%`, top: -2, transform: 'translateX(-1px)' }}>
                    <div className="absolute top-[-3px] left-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-[var(--color-cream)] -translate-x-1/2" />
                    <div className="absolute bottom-[-3px] left-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[5px] border-b-[var(--color-cream)] -translate-x-1/2" />
                </div>
            )}
            {hoverPos !== null && track && (
                <div className="player__hover-time absolute px-[7px] py-0.5 text-[0.6875rem]" style={{ left: hoverPx!, top: 6, transform: 'translateX(-50%)' }}>
                    {formatDuration(hoverPos)}
                </div>
            )}
        </div>
    );
}

function generateWaveform(id: string, duration: number): number[] {
    const cacheKey = `${id}_${WAVEFORM_BARS}`;

    if (WAVEFORM_CACHE[cacheKey]) return WAVEFORM_CACHE[cacheKey];

    let seed = 0;

    for (let i = 0; i < id.length; i++) {
        seed = (seed * HASH_PRIME + id.charCodeAt(i)) >>> 0;
    }

    seed = (seed ^ Math.floor(duration * DURATION_HASH_FACTOR)) >>> 0;

    const rand = () => {
        seed = (seed * LCG_MULTIPLIER + LCG_INCREMENT) >>> 0;
        return seed / 0xffffffff;
    };

    const peaks: number[] = [];
    const envFreq = ENV_FREQ_BASE + rand() * ENV_FREQ_RANGE;
    const envPhase = rand() * Math.PI * 2;
    const env2Freq = ENV2_FREQ_BASE + rand() * ENV2_FREQ_RANGE;
    const env2Phase = rand() * Math.PI * 2;

    for (let i = 0; i < WAVEFORM_BARS; i++) {
        const env = (Math.sin(i * envFreq + envPhase) * 0.5 + 0.5) * ENV_PRIMARY_WEIGHT
            + (Math.sin(i * env2Freq + env2Phase) * 0.5 + 0.5) * ENV_SECONDARY_WEIGHT;
        const noise = rand();
        const jitter = Math.sin(i * JITTER_FREQ + rand() * Math.PI) * JITTER_AMPLITUDE;
        let v = env * ENV_MIX + noise * NOISE_MIX + Math.abs(jitter) * JITTER_MIX;
        const fade = Math.min(1, Math.min(i, WAVEFORM_BARS - i - 1) / FADE_BARS);
        v *= fade;
        peaks.push(Math.max(PEAK_MIN, Math.min(1, v)));
    }

    WAVEFORM_CACHE[cacheKey] = peaks;
    return peaks;
}

function useCurrentTrack(): Track | null {
    const player = usePlayer();

    if (!player.trackId) return null;

    return trackList.find(t => t.id === player.trackId) ?? null;
}

function useVU() {
    const player = usePlayer();
    const [levels, setLevels] = useState([VU_INITIAL, VU_INITIAL]);

    useEffect(() => {
        if (!player.playing) {
            const decay = setInterval(() => {
                setLevels(levels => levels.map(level => Math.max(VU_FLOOR, level * VU_DECAY_RATE)));
            }, VU_DECAY_INTERVAL);

            return () => clearInterval(decay);
        }

        let phase = 0;

        const interval = setInterval(() => {
            phase += VU_PHASE_STEP;
            const base = VU_LEFT_BASE + Math.sin(phase * VU_LEFT_FREQ) * VU_LEFT_SWING;
            const baseR = VU_RIGHT_BASE + Math.sin(phase * VU_RIGHT_FREQ + VU_RIGHT_PHASE_OFFSET) * VU_RIGHT_SWING;
            setLevels([
                Math.max(VU_FLOOR, Math.min(1, base + (Math.random() - 0.5) * VU_LEFT_SWING)),
                Math.max(VU_FLOOR, Math.min(1, baseR + (Math.random() - 0.5) * VU_RIGHT_SWING)),
            ]);
        }, VU_ANIM_INTERVAL);

        return () => clearInterval(interval);
    }, [player.playing]);

    return levels;
}

function PlayerInner({ tracks }: { tracks: Track[] }) {
    trackList = tracks;
    const player = usePlayer();
    const track = useCurrentTrack();
    const [vuLeft, vuRight] = useVU();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement).isContentEditable) return;

            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                PLAYER.toggle();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const state = PLAYER.get();
                const step = e.shiftKey ? SEEK_STEP_SHIFT : SEEK_STEP;
                PLAYER.seek(Math.max(0, state.position - step));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                const state = PLAYER.get();
                const current = trackList.find(x => x.id === state.trackId);
                if (!current) return;
                const step = e.shiftKey ? SEEK_STEP_SHIFT : SEEK_STEP;
                PLAYER.seek(Math.min(current.duration, state.position + step));
            } else if (e.key === 'r' || e.key === 'R') {
                PLAYER.setRepeat(!PLAYER.get().repeat);
            }
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <div
            className={`player ${player.collapsed ? 'player--collapsed' : ''} sticky top-0 z-[100] font-mono text-sm transition-[box-shadow] duration-150`}
            aria-label="Audio player"
            role="region"
        >
            <div className="flex items-center gap-6 px-10 py-3.5">
                <button
                    className="player__collapse flex items-center justify-center rounded-full transition-opacity duration-150 cursor-pointer"
                    aria-expanded={!player.collapsed}
                    aria-label={player.collapsed ? 'Expand player' : 'Collapse player'}
                    onClick={() => PLAYER.set({ collapsed: !player.collapsed })}
                >
                    <TapeReel spinning={player.playing} />
                </button>
                <div className="flex gap-2.5">
                    <TransportButton
                        active={player.playing}
                        disabled={!track}
                        label={player.playing ? 'Pause' : 'Play'}
                        onClick={() => PLAYER.toggle()}
                    >
                        {player.playing ? <PauseIcon /> : <PlayIcon />}
                    </TransportButton>
                    <TransportButton
                        active={player.repeat}
                        label="Repeat"
                        onClick={() => PLAYER.setRepeat(!player.repeat)}
                    >
                        <RepeatIcon />
                    </TransportButton>
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`player__track-title font-medium text-2xl tracking-[-0.01em] truncate leading-[1.2] font-inter ${track ? 'text-[var(--color-cream)]' : 'text-[var(--color-cream-40)]'}`}>
                        {track ? (track.title || '(untitled session)') : 'Select a track'}
                    </div>
                    <div className="mt-0.5 text-[0.6875rem] tracking-[0.2em] text-[var(--color-cream-60)]">
                        {track ? `${categoryLabel(track.category).toUpperCase()} · ${track.id} · ${track.year} · BPM ${track.bpm.join(' ')} · ${track.key.map(k => k.toUpperCase().replace(/([A-G])B/g, '$1b')).join(', ')}` : 'NO TAPE LOADED'}
                    </div>
                </div>
                <div className="player__expandable">
                    <div className="player__counter min-w-44 px-4 py-2 text-2xl text-center text-[var(--color-orange-80)]">
                        {formatCounter(player.position)}
                        {' '}
                        <span className="text-[var(--color-cream-40)]">/</span>
                        {' '}
                        <span className="text-[var(--color-cream-60)]">{formatCounter(player.duration || track?.duration || 0)}</span>
                    </div>
                </div>
                <div className="player__expandable flex items-center gap-3">
                    <div className="flex items-center gap-0.5" aria-hidden="true">
                        <VUMeter label="L" level={player.playing ? vuLeft * player.volume : 0} />
                        <VUMeter label="R" level={player.playing ? vuRight * player.volume : 0} />
                    </div>
                    <Fader label="VOL" value={player.volume} onChange={volume => PLAYER.setVolume(volume)} />
                    <Fader label="LO" resetValue={1} value={player.lowpass} onChange={lowpass => PLAYER.set({ lowpass })} />
                    <Fader label="HI" resetValue={0} value={player.highpass} onChange={highpass => PLAYER.set({ highpass })} />
                </div>
            </div>
            <div className="player__expandable">
                <div className="pb-4 bg-black">
                    <Waveform />
                </div>
            </div>
            {player.collapsed && <ProgressBar />}
        </div>
    );
}

export default function Player({ tracks }: { tracks: Track[] }) {
    return (
        <ErrorBoundary>
            <PlayerInner tracks={tracks} />
        </ErrorBoundary>
    );
}
