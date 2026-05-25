import { useEffect, useRef, useState } from 'react';

import { ErrorBoundary } from '@components/ErrorBoundary';
import { IconPause } from '@components/IconPause';
import { IconPlay } from '@components/IconPlay';
import { IconRepeat } from '@components/IconRepeat';
import { playerStore, usePlayer } from '@lib/store';
import { formatDetails, formatDuration } from '@lib/utils';

const BARS_AREA_HEIGHT = 84;
const FADER_HEIGHT = 64;
const FADER_TICKS = [0.25, 0.5, 0.75];
const REEL_SPOKE_DEGREES = [0, 60, 120, 180, 240, 300];
const SEEK_STEP = 5;
const SEEK_STEP_SHIFT = 10;
const TICK_AREA_HEIGHT = 20;
const TICK_LONG_STEP = 30;
const TICK_LONG_THRESHOLD = 180;
const TICK_MEDIUM_STEP = 20;
const TICK_MEDIUM_THRESHOLD = 60;
const TICK_SHORT_STEP = 10;
const VU_DECAY = 0.88;
const VU_FLOOR = 0.04;
const VU_SEGS = 16;
const WAVEFORM_AMPLITUDE = 88;
const WAVEFORM_BAR_OFFSET = 0.5;
const WAVEFORM_BAR_PITCH = 2;
const WAVEFORM_BAR_RADIUS = 0.4;
const WAVEFORM_BAR_WIDTH = 1;
const WAVEFORM_HEIGHT = BARS_AREA_HEIGHT + TICK_AREA_HEIGHT;
const WAVEFORM_VIEWBOX_HEIGHT = 100;

let trackList: Track[] = [];

function formatCounter(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function useCurrentTrack(): Track | null {
    const player = usePlayer();

    if (!player.trackId) return null;

    return trackList.find(track => track.id === player.trackId) ?? null;
}

function useVULevels() {
    const [levels, setLevels] = useState([0, 0]);
    const smoothRef = useRef([0, 0]);

    useEffect(() => {
        let raf: number;
        let wasZero = true;

        const tick = () => {
            const [rawL, rawR] = playerStore.getLevels();
            const prev = smoothRef.current;
            const left = Math.max(rawL, prev[0] * VU_DECAY);
            const right = Math.max(rawR, prev[1] * VU_DECAY);
            smoothRef.current = [left, right];

            const outputLeft = left < VU_FLOOR ? 0 : left;
            const outputRight = right < VU_FLOOR ? 0 : right;
            const isZero = outputLeft === 0 && outputRight === 0;

            if (!isZero || !wasZero) setLevels([outputLeft, outputRight]);
            wasZero = isZero;
            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    return levels;
}

function Fader({ label, resetValue, value, onChange }: {
    label: string; resetValue?: number; value: number; onChange: (v: number) => void;
}) {
    const trackRef = useRef<HTMLDivElement>(null);
    function handlePointerDown(e: React.PointerEvent) {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent) => {
            if (!trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            onChange(Math.max(0, Math.min(1, 1 - (ev.clientY - rect.top) / rect.height)));
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        move(e.nativeEvent);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    }

    return (
        <div className="flex flex-col items-center gap-1.5">
            <span className="min-w-7 tabular-nums text-center text-xs text-cream-60">{Math.round(value * 100)}</span>
            <div
                className="player__fader-track relative w-4 rounded-sm select-none touch-none"
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
                onPointerDown={handlePointerDown}
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
                <div className="player__fader-fill absolute bottom-0 left-0 right-0 opacity-35 pointer-events-none" style={{ height: `${value * 100}%` }} />
                <div className="player__fader-thumb -left-1.5 -right-1.5 -translate-y-1/2 absolute h-2.5 rounded-sm pointer-events-none" style={{ top: `${(1 - value) * 100}%` }}>
                    <div className="player__fader-line -translate-y-1/2 absolute left-0 right-0 top-1/2 h-px" />
                </div>
            </div>
            <span className="font-semibold text-xs tracking-[0.2em] text-cream-60">{label}</span>
        </div>
    );
}

function ProgressBar() {
    const player = usePlayer();
    const track = useCurrentTrack();
    const ref = useRef<HTMLDivElement>(null);
    const duration = player.duration || track?.data.duration || 0;
    const fraction = duration ? player.position / duration : 0;

    return (
        <div
            className="player__progress relative h-1.5 cursor-pointer select-none"
            aria-label="Track progress"
            aria-valuemax={duration || 0}
            aria-valuemin={0}
            aria-valuenow={Math.floor(player.position)}
            onClick={(e) => {
                if (!track || !ref.current) return;
                const rect = ref.current.getBoundingClientRect();
                playerStore.seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration);
            }}
            onKeyDown={(e) => {
                if (!track) return;
                if (e.key === 'ArrowLeft') playerStore.seek(Math.max(0, player.position - SEEK_STEP));
                else if (e.key === 'ArrowRight') playerStore.seek(Math.min(duration, player.position + SEEK_STEP));
            }}
            ref={ref}
            role="slider"
            tabIndex={0}
        >
            <div className="player__progress-fill h-full pointer-events-none" style={{ width: `${fraction * 100}%` }} />
        </div>
    );
}

function TapeReel({ spinning }: { spinning: boolean }) {
    return (
        <div className="player__reel flex items-center justify-center relative h-14 w-14 rounded-full">
            <div className={`player__reel-inner ${spinning ? '' : 'player__reel-inner--paused'} relative h-[72%] w-[72%] rounded-full`}>
                <div className="absolute inset-[38%] rounded-full bg-orange-80" />
                {REEL_SPOKE_DEGREES.map(deg => (
                    <div
                        className="-translate-x-1/2 absolute left-1/2 origin-top top-1/2 h-[40%] w-px bg-cream-40"
                        key={deg}
                        style={{ transform: `rotate(${deg}deg)` }}
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
            className={`player__transport ${active ? 'player__transport--active' : ''} flex items-center justify-center h-9 w-9 rounded-sm duration-150 transition-[border-color,color,opacity] cursor-pointer`}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function VUMeter({ label, level }: { label: string; level: number }) {
    const litCount = Math.round(level * VU_SEGS);

    return (
        <div className="flex flex-col items-center gap-1.5">
            <span className="min-w-7 tabular-nums text-center text-xs text-cream-60">{Math.round(level * 100)}</span>
            <div
                className="flex flex-col-reverse gap-px"
                style={{ height: FADER_HEIGHT }}
            >
                {Array.from({ length: VU_SEGS }).map((_, i) => {
                    const on = i < litCount;

                    let color: string;

                    if (i > VU_SEGS - 4) color = 'var(--color-red)';
                    else if (i > VU_SEGS - 7) color = 'var(--color-orange-80)';
                    else color = 'var(--color-sage)';
                    return (
                        <div
                            className="flex-1 w-2 rounded-[0.5px]"
                            key={i}
                            style={{ background: on ? color : 'var(--color-cream-20)', opacity: on ? 1 : 0.5 }}
                        />
                    );
                })}
            </div>
            <span className="font-semibold text-xs tracking-[0.2em] text-cream-60">{label}</span>
        </div>
    );
}

function Waveform() {
    const player = usePlayer();
    const track = useCurrentTrack();
    const ref = useRef<HTMLDivElement>(null);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const [hoverPixel, setHoverPixel] = useState<number | null>(null);
    const peaks = track?.peaks.length ? track.peaks : null;
    const duration = player.duration || track?.data.duration || 0;
    const playedFraction = duration ? player.position / duration : 0;

    return (
        <div
            className={`player__waveform overflow-hidden relative py-2 select-none touch-none ${track ? 'cursor-pointer' : ''}`}
            aria-label="Waveform scrubber"
            aria-valuemax={duration || 0}
            aria-valuemin={0}
            aria-valuenow={Math.floor(player.position)}
            onKeyDown={(e) => {
                if (!track) return;
                if (e.key === 'ArrowLeft') playerStore.seek(Math.max(0, player.position - SEEK_STEP));
                else if (e.key === 'ArrowRight') playerStore.seek(Math.min(duration, player.position + SEEK_STEP));
            }}
            onMouseLeave={() => {
                setHoverTime(null);
                setHoverPixel(null);
            }}
            onMouseMove={(e) => {
                if (!track || !ref.current) return;
                const rect = ref.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                setHoverPixel(x);
                setHoverTime((x / rect.width) * duration);
            }}
            onPointerDown={(e) => {
                if (!track || !ref.current) return;
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                const seek = (ev: PointerEvent) => {
                    if (!ref.current) return;
                    const rect = ref.current.getBoundingClientRect();
                    playerStore.seek(Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)) * duration);
                };
                const up = () => {
                    window.removeEventListener('pointermove', seek);
                    window.removeEventListener('pointerup', up);
                };
                seek(e.nativeEvent);
                window.addEventListener('pointermove', seek);
                window.addEventListener('pointerup', up);
            }}
            ref={ref}
            role="slider"
            style={{ height: WAVEFORM_HEIGHT }}
            tabIndex={0}
        >
            <div
                className="absolute left-0 right-0 top-0"
                style={{ height: BARS_AREA_HEIGHT }}
            >
                <div className={`player__waveform-center ${!track ? 'player__waveform-center--idle' : ''} absolute left-0 right-0 top-1/2 h-px`} />
                {peaks && (
                    <svg
                        className="absolute inset-0"
                        height="100%"
                        preserveAspectRatio="none"
                        viewBox={`0 0 ${peaks.length * WAVEFORM_BAR_PITCH} ${WAVEFORM_VIEWBOX_HEIGHT}`}
                        width="100%"
                    >
                        {peaks.map((p, i) => {
                            const x = i * WAVEFORM_BAR_PITCH + WAVEFORM_BAR_OFFSET;
                            const isPlayed = (i / peaks.length) <= playedFraction;
                            const h = p * WAVEFORM_AMPLITUDE;
                            const y = WAVEFORM_VIEWBOX_HEIGHT / 2 - h / 2;
                            const isHovered = hoverPixel != null && (i / peaks.length) <= (hoverPixel / (ref.current?.clientWidth || 1)) && !isPlayed;

                            let fill: string;
                            if (isPlayed) fill = 'var(--color-orange-80)';
                            else if (isHovered) fill = 'var(--color-orange-60)';
                            else fill = 'var(--color-cream-40)';
                            return <rect fill={fill} height={h} key={i} rx={WAVEFORM_BAR_RADIUS} width={WAVEFORM_BAR_WIDTH} x={x} y={y} />;
                        })}
                    </svg>
                )}
            </div>
            <div
                className="absolute left-0 right-0 border-t border-zinc-800"
                style={{ background: 'var(--color-zinc-950)', height: TICK_AREA_HEIGHT, top: BARS_AREA_HEIGHT }}
            >
                {track && duration > 0 && (() => {
                    const ticks: React.ReactNode[] = [];

                    let step = TICK_SHORT_STEP;

                    if (duration > TICK_LONG_THRESHOLD) step = TICK_LONG_STEP;
                    else if (duration > TICK_MEDIUM_THRESHOLD) step = TICK_MEDIUM_STEP;
                    for (let i = step; i < duration; i += step) {
                        const percent = (i / duration) * 100;
                        ticks.push(
                            <div key={`t${i}`}>
                                <div className="player__tick absolute top-0 h-1 w-px pointer-events-none" style={{ left: `${percent}%` }} />
                                <div className="player__tick-label -translate-x-1/2 absolute top-1 tabular-nums text-xs pointer-events-none" style={{ left: `${percent}%` }}>
                                    {formatDuration(i)}
                                </div>
                            </div>,
                        );
                    }
                    return ticks;
                })()}
            </div>
            {track && (
                <div
                    className="player__playhead -top-0.5 -translate-x-px absolute z-10 w-0.5 pointer-events-none"
                    style={{ height: BARS_AREA_HEIGHT + 4, left: `${playedFraction * 100}%` }}
                >
                    <div className="-translate-x-1/2 absolute left-1/2 top-[-3px] h-0 w-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-cream" />
                    <div className="-translate-x-1/2 absolute bottom-[-3px] left-1/2 h-0 w-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[5px] border-b-cream" />
                </div>
            )}
            {hoverTime !== null && hoverPixel !== null && track && (
                <div
                    className="player__hover-time -translate-x-1/2 absolute top-1.5 px-2 py-0.5 tabular-nums text-xs whitespace-nowrap pointer-events-none"
                    style={{ left: hoverPixel }}
                >
                    {formatDuration(hoverTime)}
                </div>
            )}
        </div>
    );
}

function PlayerInner({ tracks }: { tracks: Track[] }) {
    useEffect(() => { trackList = tracks; }, [tracks]);
    const player = usePlayer();
    const track = useCurrentTrack();
    const [vuLeft, vuRight] = useVULevels();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement;
            const tag = el.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || el.isContentEditable) return;
            if (tag === 'button' || tag === 'a' || tag === 'select') return;
            const role = el.getAttribute('role');
            if (role === 'slider' || role === 'option' || role === 'listbox') return;

            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                playerStore.toggle();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();

                const state = playerStore.get();
                const step = e.shiftKey ? SEEK_STEP_SHIFT : SEEK_STEP;
                playerStore.seek(Math.max(0, state.position - step));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();

                const state = playerStore.get();
                const currentTrack = trackList.find(track => track.id === state.trackId);
                if (!currentTrack) return;
                const step = e.shiftKey ? SEEK_STEP_SHIFT : SEEK_STEP;
                playerStore.seek(Math.min(currentTrack.data.duration, state.position + step));
            } else if (e.key === 'r' || e.key === 'R') {
                playerStore.setRepeat(!playerStore.get().repeat);
            }
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <section
            className={`player ${player.collapsed ? 'player--collapsed' : ''} sticky top-0 z-30 font-mono text-base duration-150 transition-[box-shadow]`}
            aria-label="Audio player"
        >
            <div className="flex items-center gap-6 px-10 py-4">
                <button
                    className="player__collapse flex items-center justify-center rounded-full duration-150 transition-opacity cursor-pointer"
                    aria-expanded={!player.collapsed}
                    aria-label={player.collapsed ? 'Expand player' : 'Collapse player'}
                    onClick={() => playerStore.set({ collapsed: !player.collapsed })}
                >
                    <TapeReel spinning={player.playing} />
                </button>
                <div className="flex gap-2">
                    <TransportButton
                        active={player.playing}
                        disabled={!track}
                        label={player.playing ? 'Pause' : 'Play'}
                        onClick={() => playerStore.toggle()}
                    >
                        {player.playing ? <IconPause /> : <IconPlay />}
                    </TransportButton>
                    <TransportButton
                        active={player.repeat}
                        label="Repeat"
                        onClick={() => playerStore.setRepeat(!player.repeat)}
                    >
                        <IconRepeat />
                    </TransportButton>
                </div>
                <div
                    className="flex-1 min-w-0"
                    aria-live="polite"
                >
                    <div className={`player__track-title mb-0.5 font-inter font-medium leading-tight text-2xl tracking-[-0.01em] truncate ${track ? 'text-cream' : 'text-cream-40'}`}>
                        {track ? (track.data.title || '(untitled session)') : 'Select a track'}
                    </div>
                    <div className="text-xs tracking-[0.2em] text-cream-60">
                        {track ? formatDetails(track) : 'NO TAPE LOADED'}
                    </div>
                </div>
                <div
                    className="player__expandable"
                    inert={player.collapsed || undefined}
                >
                    <div className="player__counter min-w-44 px-4 py-2 tabular-nums text-2xl text-center text-orange-80">
                        {formatCounter(player.position)}
                        {' '}
                        <span className="text-cream-40">/</span>
                        {' '}
                        <span className="text-cream-60">{formatCounter(player.duration || track?.data.duration || 0)}</span>
                    </div>
                </div>
                <div
                    className="player__expandable flex items-center gap-4"
                    inert={player.collapsed || undefined}
                >
                    <div
                        className="flex items-center gap-1.5"
                        aria-hidden="true"
                    >
                        <VUMeter
                            label="L"
                            level={vuLeft}
                        />
                        <VUMeter
                            label="R"
                            level={vuRight}
                        />
                    </div>
                    <Fader
                        label="VOL"
                        onChange={volume => playerStore.setVolume(volume)}
                        value={player.volume}
                    />
                    <Fader
                        label="LP"
                        onChange={lowpass => playerStore.set({ lowpass })}
                        resetValue={1}
                        value={player.lowpass}
                    />
                    <Fader
                        label="HP"
                        onChange={highpass => playerStore.set({ highpass })}
                        resetValue={0}
                        value={player.highpass}
                    />
                </div>
            </div>
            <div
                className="player__expandable"
                inert={player.collapsed || undefined}
            >
                <div className="pb-4 bg-black">
                    <Waveform />
                </div>
            </div>
            {player.collapsed && <ProgressBar />}
        </section>
    );
}

export default function Player({ tracks }: { tracks: Track[] }) {
    return (
        <ErrorBoundary>
            <PlayerInner tracks={tracks} />
        </ErrorBoundary>
    );
}
