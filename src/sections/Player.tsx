import { useEffect, useRef, useState } from 'react';

import { ErrorBoundary } from '@components/ErrorBoundary';
import { IconPause } from '@components/IconPause';
import { IconPlay } from '@components/IconPlay';
import { IconRepeat } from '@components/IconRepeat';
import { formatDetails, formatDuration } from '@lib/utils';
import { playerStore, usePlayer } from '@lib/store';

const BARS_AREA_HEIGHT = 84;
const FADER_HEIGHT = 64;
const FADER_STEP = 0.05;
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
const VU_ORANGE_THRESHOLD = 7;
const VU_RED_THRESHOLD = 4;
const VU_SEGMENTS = 16;
const WAVEFORM_AMPLITUDE = 88;
const WAVEFORM_BAR_OFFSET = 0.5;
const WAVEFORM_BAR_PITCH = 2;
const WAVEFORM_BAR_RADIUS = 0.4;
const WAVEFORM_BAR_WIDTH = 1;
const WAVEFORM_VIEWBOX_HEIGHT = 100;

const WAVEFORM_HEIGHT = BARS_AREA_HEIGHT + TICK_AREA_HEIGHT;

let allTracks: Track[] = [];

function formatCounter(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);

    return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function renderTicks(duration: number) {
    if (duration <= 0) return null;

    const ticks: React.ReactNode[] = [];

    let step = TICK_SHORT_STEP;

    if (duration > TICK_LONG_THRESHOLD) step = TICK_LONG_STEP;
    else if (duration > TICK_MEDIUM_THRESHOLD) step = TICK_MEDIUM_STEP;

    for (let i = step; i < duration; i += step) {
        const percent = (i / duration) * 100;

        ticks.push(
            <div key={i}>
                <div className="player__tick absolute top-0 h-1 w-px pointer-events-none" style={{ left: `${percent}%` }} />
                <div
                    className="player__tick-label absolute top-1 tabular-nums text-xs -translate-x-1/2 pointer-events-none"
                    style={{ left: `${percent}%` }}
                >
                    {formatDuration(i)}
                </div>
            </div>,
        );
    }

    return ticks;
}

function useCurrentTrack(): Track | null {
    const player = usePlayer();

    if (!player.trackId) return null;
    return allTracks.find(track => track.id === player.trackId) ?? null;
}

function useVULevels() {
    const [levels, setLevels] = useState([0, 0]);
    const requestRef = useRef(0);
    const smoothRef = useRef([0, 0]);
    const wasZeroRef = useRef(true);

    function tick() {
        const [rawLeft, rawRight] = playerStore.getLevels();
        const previous = smoothRef.current;

        const left = Math.max(rawLeft, previous[0] * VU_DECAY);
        const right = Math.max(rawRight, previous[1] * VU_DECAY);

        smoothRef.current = [left, right];

        const outputLeft = left < VU_FLOOR ? 0 : left;
        const outputRight = right < VU_FLOOR ? 0 : right;

        const isZero = outputLeft === 0 && outputRight === 0;

        if (!isZero || !wasZeroRef.current) setLevels([outputLeft, outputRight]);

        wasZeroRef.current = isZero;
        requestRef.current = requestAnimationFrame(tick);
    }

    useEffect(() => {
        requestRef.current = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(requestRef.current);
    }, []);

    return levels;
}

function Fader({ label, onChange, resetValue, value }: {
    label: string; onChange: (value: number) => void; resetValue?: number; value: number;
}) {
    const trackRef = useRef<HTMLDivElement>(null);

    function handleDoubleClick() {
        if (resetValue !== undefined) onChange(resetValue);
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'ArrowUp') onChange(Math.min(1, value + FADER_STEP));
        else if (e.key === 'ArrowDown') onChange(Math.max(0, value - FADER_STEP));
    }

    function handlePointerDown(e: React.PointerEvent) {
        function move(e: PointerEvent) {
            if (!trackRef.current) return;

            const rect = trackRef.current.getBoundingClientRect();

            onChange(Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height)));
        }

        function up() {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        }

        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        move(e.nativeEvent);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    }

    return (
        <div className="flex flex-col items-center gap-1.5">
            <span className="min-w-7 tabular-nums text-center text-xs text-cream-60">{Math.round(value * 100)}</span>
            <div
                className="player__fader-track relative w-4 rounded-sm select-none touch-none"
                aria-label={label === 'HP' ? 'Highpass filter' : label === 'LP' ? 'Lowpass filter' : 'Volume'}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(value * 100)}
                onDoubleClick={handleDoubleClick}
                onKeyDown={handleKeyDown}
                onPointerDown={handlePointerDown}
                ref={trackRef}
                role="slider"
                style={{ height: FADER_HEIGHT }}
                tabIndex={0}
            >
                <div className="player__fader-fill absolute bottom-0 left-0 right-0 opacity-35 pointer-events-none" style={{ height: `${value * 100}%` }} />
                <div
                    className="player__fader-thumb -left-1.5 -right-1.5 absolute h-2.5 rounded-sm -translate-y-1/2 pointer-events-none"
                    style={{ top: `${(1 - value) * 100}%` }}
                >
                    <div className="player__fader-line absolute left-0 right-0 top-1/2 h-px -translate-y-1/2" />
                </div>
                {FADER_TICKS.map(position => (
                    <div
                        className="absolute left-0.5 right-0.5 h-px bg-cream-20 pointer-events-none"
                        key={position}
                        style={{ top: `${(1 - position) * 100}%` }}
                    />
                ))}
            </div>
            <span className="font-semibold text-xs tracking-[0.2em] text-cream-60">{label}</span>
        </div>
    );
}

function PlayerInner({ tracks }: { tracks: Track[] }) {
    const player = usePlayer();
    const track = useCurrentTrack();
    const [vuLeft, vuRight] = useVULevels();

    function handleKeyDown(e: KeyboardEvent) {
        const target = e.target as HTMLElement;

        const tagName = target.tagName.toLowerCase();

        if (target.isContentEditable || tagName === 'a' || tagName === 'button') return;
        if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') return;

        const role = target.getAttribute('role');

        if (role === 'listbox' || role === 'option' || role === 'slider') return;

        if (e.key === ' ') {
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

            const currentTrack = allTracks.find(track => track.id === state.trackId);

            if (!currentTrack) return;

            const step = e.shiftKey ? SEEK_STEP_SHIFT : SEEK_STEP;

            playerStore.seek(Math.min(currentTrack.data.duration, state.position + step));
        } else if (e.key.toLowerCase() === 'r') {
            playerStore.set({ repeat: !playerStore.get().repeat });
        }
    }

    useEffect(() => {
        allTracks = tracks;
    }, [tracks]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <section
            className={`player ${player.collapsed ? 'player--collapsed' : ''} sticky top-0 z-30 font-mono text-base duration-150 transition-[box-shadow]`}
            aria-label="Audio player"
        >
            <div className="flex items-center gap-6 px-10 py-4">
                <button
                    className="player__collapse flex items-center justify-center rounded-full cursor-pointer duration-150 transition-opacity"
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
                        onClick={() => playerStore.set({ repeat: !player.repeat })}
                    >
                        <IconRepeat />
                    </TransportButton>
                </div>
                <div
                    className="flex-1 min-w-0"
                    aria-live="polite"
                >
                    <div className={`mb-0.5 font-inter font-medium leading-tight text-2xl tracking-[-0.01em] truncate ${track ? 'text-cream' : 'text-cream-40'}`}>
                        {track ? track.data.title : 'Select a track'}
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
                        onChange={volume => playerStore.set({ volume })}
                        resetValue={1}
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

function ProgressBar() {
    const player = usePlayer();
    const progressRef = useRef<HTMLDivElement>(null);
    const track = useCurrentTrack();

    const duration = player.duration || track?.data.duration || 0;

    const fraction = duration ? player.position / duration : 0;

    function handleClick(e: React.MouseEvent) {
        if (!track || !progressRef.current) return;

        const rect = progressRef.current.getBoundingClientRect();

        playerStore.seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration);
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (!track) return;

        if (e.key === 'ArrowLeft') playerStore.seek(Math.max(0, player.position - SEEK_STEP));
        else if (e.key === 'ArrowRight') playerStore.seek(Math.min(duration, player.position + SEEK_STEP));
    }

    return (
        <div
            className="player__progress relative h-1.5 cursor-pointer select-none"
            aria-label="Track progress"
            aria-valuemax={duration || 0}
            aria-valuemin={0}
            aria-valuenow={Math.floor(player.position)}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            ref={progressRef}
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
                {REEL_SPOKE_DEGREES.map(degree => (
                    <div
                        className="absolute left-1/2 top-1/2 h-[40%] w-px bg-cream-40 -translate-x-1/2 origin-top"
                        key={degree}
                        style={{ transform: `rotate(${degree}deg)` }}
                    />
                ))}
            </div>
        </div>
    );
}

function TransportButton({ active, children, disabled, label, onClick }: {
    active?: boolean; children: React.ReactNode; disabled?: boolean; label: string; onClick: () => void;
}) {
    return (
        <button
            className={`player__transport ${active ? 'player__transport--active' : ''} flex items-center justify-center h-9 w-9 rounded-sm cursor-pointer duration-150 transition-[border-color,color,opacity]`}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function VUMeter({ label, level }: { label: string; level: number }) {
    const activeSegments = Math.round(level * VU_SEGMENTS);

    return (
        <div className="flex flex-col items-center gap-1.5">
            <span className="min-w-7 tabular-nums text-center text-xs text-cream-60">{Math.round(level * 100)}</span>
            <div
                className="flex flex-col-reverse gap-px"
                style={{ height: FADER_HEIGHT }}
            >
                {Array.from({ length: VU_SEGMENTS }).map((_, i) => {
                    const isActive = i < activeSegments;

                    let color: string;

                    if (i > VU_SEGMENTS - VU_RED_THRESHOLD) color = 'bg-red';
                    else if (i > VU_SEGMENTS - VU_ORANGE_THRESHOLD) color = 'bg-orange-80';
                    else color = 'bg-sage';

                    return (
                        <div
                            className={`flex-1 w-2 rounded-[0.5px] ${isActive ? color : 'bg-cream-20 opacity-50'}`}
                            key={i}
                        />
                    );
                })}
            </div>
            <span className="font-semibold text-xs tracking-[0.2em] text-cream-60">{label}</span>
        </div>
    );
}

function Waveform() {
    const [hoverPixel, setHoverPixel] = useState<number | null>(null);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const player = usePlayer();
    const track = useCurrentTrack();
    const waveformRef = useRef<HTMLDivElement>(null);

    const duration = player.duration || track?.data.duration || 0;
    const peaks = track?.peaks.length ? track.peaks : null;

    const playedFraction = duration ? player.position / duration : 0;

    function handleKeyDown(e: React.KeyboardEvent) {
        if (!track) return;

        if (e.key === 'ArrowLeft') playerStore.seek(Math.max(0, player.position - SEEK_STEP));
        else if (e.key === 'ArrowRight') playerStore.seek(Math.min(duration, player.position + SEEK_STEP));
    }

    function handleMouseLeave() {
        setHoverPixel(null);
        setHoverTime(null);
    }

    function handleMouseMove(e: React.MouseEvent) {
        if (!track || !waveformRef.current) return;

        const rect = waveformRef.current.getBoundingClientRect();

        const offset = e.clientX - rect.left;

        setHoverPixel(offset);
        setHoverTime((offset / rect.width) * duration);
    }

    function handlePointerDown(e: React.PointerEvent) {
        function seek(e: PointerEvent) {
            if (!waveformRef.current) return;

            const rect = waveformRef.current.getBoundingClientRect();

            playerStore.seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration);
        }

        function up() {
            window.removeEventListener('pointermove', seek);
            window.removeEventListener('pointerup', up);
        }

        if (!track || !waveformRef.current) return;

        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        seek(e.nativeEvent);
        window.addEventListener('pointermove', seek);
        window.addEventListener('pointerup', up);
    }

    return (
        <div
            className={`player__waveform overflow-hidden relative py-2 select-none touch-none ${track ? 'cursor-pointer' : ''}`}
            aria-label="Waveform scrubber"
            aria-valuemax={duration || 0}
            aria-valuemin={0}
            aria-valuenow={Math.floor(player.position)}
            onKeyDown={handleKeyDown}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            onPointerDown={handlePointerDown}
            ref={waveformRef}
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
                        {peaks.map((peak, i) => {
                            const barHeight = peak * WAVEFORM_AMPLITUDE;
                            const barX = i * WAVEFORM_BAR_PITCH + WAVEFORM_BAR_OFFSET;
                            const isPlayed = (i / peaks.length) <= playedFraction;

                            const barY = WAVEFORM_VIEWBOX_HEIGHT / 2 - barHeight / 2;
                            const isHovered = hoverPixel !== null && (i / peaks.length) <= (hoverPixel / (waveformRef.current?.clientWidth || 1)) && !isPlayed;

                            let fill: string;

                            if (isPlayed) fill = 'var(--color-orange-80)';
                            else if (isHovered) fill = 'var(--color-orange-60)';
                            else fill = 'var(--color-cream-40)';

                            return <rect fill={fill} height={barHeight} key={i} rx={WAVEFORM_BAR_RADIUS} width={WAVEFORM_BAR_WIDTH} x={barX} y={barY} />;
                        })}
                    </svg>
                )}
            </div>
            <div
                className="absolute left-0 right-0 border-t border-zinc-800 bg-zinc-950"
                style={{ height: TICK_AREA_HEIGHT, top: BARS_AREA_HEIGHT }}
            >
                {renderTicks(duration)}
            </div>
            {track && (
                <div
                    className="player__playhead -top-0.5 absolute z-10 w-0.5 -translate-x-px pointer-events-none"
                    style={{ height: BARS_AREA_HEIGHT + 4, left: `${playedFraction * 100}%` }}
                >
                    <div className="absolute left-1/2 top-[-3px] h-0 w-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-cream -translate-x-1/2" />
                    <div className="absolute bottom-[-3px] left-1/2 h-0 w-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[5px] border-b-cream -translate-x-1/2" />
                </div>
            )}
            {hoverTime !== null && hoverPixel !== null && track && (
                <div
                    className="player__hover-time absolute top-1.5 px-2 py-0.5 tabular-nums text-xs whitespace-nowrap -translate-x-1/2 pointer-events-none"
                    style={{ left: hoverPixel }}
                >
                    {formatDuration(hoverTime)}
                </div>
            )}
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
