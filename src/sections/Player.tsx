import { useEffect, useRef, useState } from 'react';

import { PLAYER, useCurrentTrack, usePlayer } from '@lib/store';
import { TRACKS } from '@lib/tracks';
import { categoryLabel, fmtCounter, fmtDuration, fmtKey } from '@lib/utils';
import { useVU } from '@lib/hooks';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { PauseIcon } from '@components/PauseIcon';
import { PlayIcon } from '@components/PlayIcon';
import { RepeatIcon } from '@components/RepeatIcon';

const FADER_HEIGHT = 64;
const TICK_H = 20;
const VU_SEGS = 16;
const WAVE_H = 84;
const WAVEFORM_BARS = 180;
const WAVEFORM_HEIGHT = WAVE_H + TICK_H;

const WAVEFORM_CACHE: Record<string, number[]> = {};

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
        move(e as unknown as MouseEvent);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    return (
        <div className={`flex flex-col items-center gap-1.5 ${className || ''}`}>
            <span className="font-semibold text-[0.5625rem] tracking-[0.18em] text-[var(--color-cream-40)]">{label}</span>
            <div
                className="player__fader-track relative w-4 rounded-sm"
                ref={trackRef}
                aria-label={label === 'VOL' ? 'Volume' : `${label} filter`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(value * 100)}
                role="slider"
                style={{ height: FADER_HEIGHT }}
                tabIndex={0}
                onDoubleClick={() => {
                    if (resetValue !== undefined) onChange(resetValue);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') onChange(Math.min(1, value + 0.05));
                    else if (e.key === 'ArrowDown') onChange(Math.max(0, value - 0.05));
                }}
                onMouseDown={onDown}
            >
                {[0.25, 0.5, 0.75].map(p => (
                    <div
                        key={p}
                        className="absolute left-0.5 right-0.5 h-px pointer-events-none"
                        style={{ background: 'var(--color-cream-20)', top: `${(1 - p) * 100}%` }}
                    />
                ))}
                <div className="player__fader-fill absolute left-0 right-0 bottom-0" style={{ height: `${value * 100}%` }} />
                <div className="player__fader-thumb absolute -left-[5px] -right-[5px] h-2.5 rounded-sm" style={{ top: `${(1 - value) * 100}%`, transform: 'translateY(-50%)' }}>
                    <div className="player__fader-line absolute left-0 right-0 top-1/2 h-px -translate-y-1/2" />
                </div>
            </div>
            <span className="min-w-[1.625rem] text-[0.5625rem] tabular-nums text-center text-[var(--color-cream-60)]">{Math.round(value * 100)}</span>
        </div>
    );
}

function ProgressBar() {
    const s = usePlayer();
    const t = useCurrentTrack();
    const ref = useRef<HTMLDivElement>(null);
    const dur = s.duration || t?.duration || 0;
    const frac = dur ? s.position / dur : 0;

    return (
        <div
            className="player__progress relative"
            ref={ref}
            aria-label="Track progress"
            aria-valuemax={dur || 0}
            aria-valuemin={0}
            aria-valuenow={Math.floor(s.position)}
            role="slider"
            tabIndex={0}
            onClick={(e) => {
                if (!t || !ref.current) return;
                const rect = ref.current.getBoundingClientRect();
                PLAYER.seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * dur);
            }}
            onKeyDown={(e) => {
                if (!t) return;
                if (e.key === 'ArrowLeft') PLAYER.seek(Math.max(0, s.position - 5));
                else if (e.key === 'ArrowRight') PLAYER.seek(Math.min(dur, s.position + 5));
            }}
        >
            <div className="player__progress-fill" style={{ width: `${frac * 100}%` }} />
        </div>
    );
}

function TapeReel({ spinning }: { spinning: boolean }) {
    const size = 56;

    return (
        <div className="player__reel relative flex items-center justify-center rounded-full" style={{ height: size, width: size }}>
            <div
                className={`player__reel-inner relative rounded-full ${spinning ? '' : 'player__reel-inner--paused'}`}
                style={{ height: '72%', width: '72%' }}
            >
                <div className="absolute inset-[38%] rounded-full bg-[var(--color-orange-80)]" />
                {[0, 60, 120, 180, 240, 300].map(deg => (
                    <div
                        key={deg}
                        className="absolute top-1/2 left-1/2 w-px bg-[var(--color-cream-40)]"
                        style={{ height: '40%', transform: `translate(-50%, 0) rotate(${deg}deg)`, transformOrigin: 'top center' }}
                    />
                ))}
            </div>
        </div>
    );
}

function TransportBtn({ children, active, disabled, onClick, title }: {
    children: React.ReactNode; active?: boolean; disabled?: boolean; onClick: () => void; title?: string;
}) {
    return (
        <button
            className={`player__transport-btn flex items-center justify-center w-10 h-10 rounded-sm transition-all duration-150 cursor-pointer ${active ? 'player__transport-btn--active' : ''}`}
            disabled={disabled}
            onClick={onClick}
            title={title}
        >
            {children}
        </button>
    );
}

function VUMeter({ label, level }: { label: string; level: number }) {
    const lit = Math.round(level * VU_SEGS);

    return (
        <div className="flex flex-col items-center gap-1.5">
            <span className="font-semibold text-[0.5625rem] tracking-[0.18em] text-[var(--color-cream-40)]">{label}</span>
            <div className="flex flex-col-reverse gap-px" style={{ height: FADER_HEIGHT }}>
                {Array.from({ length: VU_SEGS }).map((_, i) => {
                    const on = i < lit;
                    const color = i > VU_SEGS - 4
                        ? 'var(--color-red)'
                        : i > VU_SEGS - 7
                            ? 'var(--color-orange-80)'
                            : 'var(--color-sage)';
                    return (
                        <div
                            key={i}
                            className="w-[7px] flex-1 rounded-[0.5px]"
                            style={{ background: on ? color : 'var(--color-cream-20)', opacity: on ? 1 : 0.5 }}
                        />
                    );
                })}
            </div>
            <span className="min-w-[1.625rem] text-[0.5625rem] tabular-nums text-center text-[var(--color-cream-60)]">{Math.round(level * 100)}</span>
        </div>
    );
}

function Waveform() {
    const s = usePlayer();
    const t = useCurrentTrack();
    const ref = useRef<HTMLDivElement>(null);
    const [hoverPos, setHoverPos] = useState<number | null>(null);
    const [hoverPx, setHoverPx] = useState<number | null>(null);
    const peaks = t ? waveformFor(t.id, t.duration) : null;
    const dur = s.duration || t?.duration || 0;
    const playedFrac = dur ? s.position / dur : 0;

    return (
        <div
            className={`player__waveform relative py-2 overflow-hidden ${t ? 'cursor-pointer' : ''}`}
            ref={ref}
            aria-label="Waveform scrubber"
            aria-valuemax={dur || 0}
            aria-valuemin={0}
            aria-valuenow={Math.floor(s.position)}
            role="slider"
            style={{ height: WAVEFORM_HEIGHT }}
            tabIndex={0}
            onKeyDown={(e) => {
                if (!t) return;
                if (e.key === 'ArrowLeft') PLAYER.seek(Math.max(0, s.position - 5));
                else if (e.key === 'ArrowRight') PLAYER.seek(Math.min(dur, s.position + 5));
            }}
            onMouseDown={(e) => {
                if (!t || !ref.current) return;
                e.preventDefault();
                const seek = (ev: MouseEvent) => {
                    if (!ref.current) return;
                    const rect = ref.current.getBoundingClientRect();
                    PLAYER.seek(Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)) * dur);
                };
                const up = () => {
                    window.removeEventListener('mousemove', seek);
                    window.removeEventListener('mouseup', up);
                };
                seek(e as unknown as MouseEvent);
                window.addEventListener('mousemove', seek);
                window.addEventListener('mouseup', up);
            }}
            onMouseLeave={() => {
                setHoverPos(null);
                setHoverPx(null);
            }}
            onMouseMove={(e) => {
                if (!t || !ref.current) return;
                const rect = ref.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                setHoverPx(x);
                setHoverPos((x / rect.width) * dur);
            }}
        >
            <div className="absolute left-0 right-0 top-0" style={{ height: WAVE_H }}>
                <div className={`player__waveform-center absolute left-0 right-0 top-1/2 h-px ${!t ? 'player__waveform-center--idle' : ''}`} />
                {peaks && (
                    <svg className="absolute inset-0" height="100%" preserveAspectRatio="none" viewBox={`0 0 ${peaks.length * 2} 100`} width="100%">
                        {peaks.map((p, i) => {
                            const x = i * 2 + 0.5;
                            const isPlayed = (i / peaks.length) <= playedFrac;
                            const distFromHead = Math.abs(i / peaks.length - playedFrac);
                            const pulse = s.playing && isPlayed && distFromHead < 0.08
                                ? 1 + (1 - distFromHead / 0.08) * 0.18
                                : 1;
                            const h = p * 88 * pulse;
                            const y = 50 - h / 2;
                            const inHover = hoverPx != null && (i / peaks.length) <= (hoverPx / (ref.current?.clientWidth || 1)) && !isPlayed;
                            let fill: string;
                            if (isPlayed) fill = 'var(--color-orange-80)';
                            else if (inHover) fill = 'var(--color-orange-60)';
                            else fill = 'var(--color-cream-40)';
                            return <rect key={i} fill={fill} height={h} rx="0.4" width={1} x={x} y={y} />;
                        })}
                    </svg>
                )}
            </div>
            <div className="absolute left-0 right-0 border-t border-[var(--color-cream-20)]" style={{ background: 'var(--color-zinc-950)', height: TICK_H, top: WAVE_H }}>
                {t && dur > 0 && (() => {
                    const ticks: React.ReactNode[] = [];
                    const step = dur > 240 ? 60 : dur > 60 ? 30 : 15;
                    for (let i = step; i < dur; i += step) {
                        const pct = (i / dur) * 100;
                        ticks.push(
                            <div key={`t${i}`}>
                                <div className="player__tick absolute top-0 w-px h-1" style={{ left: `${pct}%` }} />
                                <div className="player__tick-label absolute text-[0.625rem]" style={{ left: `${pct}%`, top: 5, transform: 'translateX(-50%)' }}>
                                    {fmtDuration(i)}
                                </div>
                            </div>,
                        );
                    }
                    return ticks;
                })()}
            </div>
            {t && (
                <div className="player__playhead absolute z-[2] w-0.5" style={{ height: WAVE_H + 4, left: `${playedFrac * 100}%`, top: -2, transform: 'translateX(-1px)' }}>
                    <div className="absolute top-[-3px] left-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-[var(--color-cream)] -translate-x-1/2" />
                    <div className="absolute bottom-[-3px] left-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[5px] border-b-[var(--color-cream)] -translate-x-1/2" />
                </div>
            )}
            {hoverPos !== null && t && (
                <div className="player__hover-time absolute px-[7px] py-0.5 text-[0.6875rem]" style={{ left: hoverPx!, top: 6, transform: 'translateX(-50%)' }}>
                    {fmtDuration(hoverPos)}
                </div>
            )}
        </div>
    );
}

function waveformFor(id: string, duration: number): number[] {
    const cacheKey = `${id}_${WAVEFORM_BARS}`;

    if (WAVEFORM_CACHE[cacheKey]) return WAVEFORM_CACHE[cacheKey];

    let seed = 0;

    for (let i = 0; i < id.length; i++) {
        seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
    }

    seed = (seed ^ Math.floor(duration * 17)) >>> 0;

    const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0xffffffff;
    };

    const peaks: number[] = [];
    const envFreq = 0.035 + rand() * 0.04;
    const envPhase = rand() * Math.PI * 2;
    const env2Freq = 0.009 + rand() * 0.012;
    const env2Phase = rand() * Math.PI * 2;

    for (let i = 0; i < WAVEFORM_BARS; i++) {
        const env = (Math.sin(i * envFreq + envPhase) * 0.5 + 0.5) * 0.55
            + (Math.sin(i * env2Freq + env2Phase) * 0.5 + 0.5) * 0.45;
        const noise = rand();
        const jitter = Math.sin(i * 0.6 + rand() * Math.PI) * 0.12;
        let v = env * 0.65 + noise * 0.25 + Math.abs(jitter) * 0.4;
        const fade = Math.min(1, Math.min(i, WAVEFORM_BARS - i - 1) / 6);
        v *= fade;
        peaks.push(Math.max(0.08, Math.min(1, v)));
    }

    WAVEFORM_CACHE[cacheKey] = peaks;
    return peaks;
}

function PlayerInner() {
    const s = usePlayer();
    const t = useCurrentTrack();
    const [vuL, vuR] = useVU();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement).isContentEditable) return;

            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                PLAYER.toggle();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const ps = PLAYER.get();
                const step = e.shiftKey ? 10 : 5;
                PLAYER.seek(Math.max(0, ps.position - step));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                const ps = PLAYER.get();
                const tr = TRACKS.find(x => x.id === ps.trackId);
                if (!tr) return;
                const step = e.shiftKey ? 10 : 5;
                PLAYER.seek(Math.min(tr.duration, ps.position + step));
            } else if (e.key === 'r' || e.key === 'R') {
                PLAYER.setRepeat(!PLAYER.get().repeat);
            }
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <div
            className={`player relative sticky top-0 z-[100] font-mono text-sm ${s.collapsed ? 'player--collapsed' : ''}`}
            aria-label="Audio player"
            role="region"
        >
            <div className="flex items-center gap-[clamp(0.75rem,calc(0.5rem+1.25vw),1.5rem)] px-[clamp(1rem,calc(0.5rem+2.5vw),2.5rem)] py-3.5">
                <button
                    className="player__collapse-btn hidden lg:flex items-center justify-center rounded-full cursor-pointer"
                    aria-expanded={!s.collapsed}
                    aria-label={s.collapsed ? 'Expand player' : 'Collapse player'}
                    onClick={() => PLAYER.set({ collapsed: !s.collapsed })}
                >
                    <TapeReel spinning={s.playing} />
                </button>
                <div className="flex gap-2.5">
                    <TransportBtn
                        active={s.playing}
                        disabled={!t}
                        onClick={() => PLAYER.toggle()}
                        title={s.playing ? 'Pause' : 'Play'}
                    >
                        {s.playing ? <PauseIcon /> : <PlayIcon />}
                    </TransportBtn>
                    <TransportBtn
                        active={s.repeat}
                        onClick={() => PLAYER.setRepeat(!s.repeat)}
                        title="Repeat"
                    >
                        <RepeatIcon />
                    </TransportBtn>
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`player__track-title font-medium text-[clamp(1rem,calc(0.83rem+0.83vw),1.5rem)] tracking-[-0.01em] truncate leading-[1.2] font-inter ${t ? 'text-[var(--color-cream)]' : 'text-[var(--color-cream-40)]'}`}>
                        {t ? (t.title || '(untitled session)') : 'Select a track'}
                    </div>
                    <div className="mt-0.5 text-[0.6875rem] tracking-[0.2em] text-[var(--color-cream-60)]">
                        {t ? `${categoryLabel(t.category).toUpperCase()} · ${t.id} · ${t.year} · ${t.bpm.join(' ')} BPM · ${t.key.map(fmtKey).join(', ')}` : 'NO TAPE LOADED'}
                    </div>
                </div>
                <div className="player__expandable hidden sm:block">
                    <div className="player__counter min-w-[clamp(7rem,calc(5.67rem+6.67vw),11rem)] px-4 py-2 text-[clamp(1rem,calc(0.83rem+0.83vw),1.5rem)] text-center text-[var(--color-orange-80)]">
                        {fmtCounter(s.position)}
                        {' '}
                        <span className="text-[var(--color-cream-40)]">/</span>
                        {' '}
                        <span className="text-[var(--color-cream-60)]">{fmtCounter(s.duration || t?.duration || 0)}</span>
                    </div>
                </div>
                <div className="player__expandable hidden items-center gap-3 lg:flex">
                    <div className="flex items-center gap-0.5">
                        <VUMeter label="L" level={s.playing ? vuL * s.volume : 0} />
                        <VUMeter label="R" level={s.playing ? vuR * s.volume : 0} />
                    </div>
                    <Fader label="VOL" value={s.volume} onChange={v => PLAYER.setVolume(v)} />
                    <Fader label="LO" resetValue={1} value={s.lowpass} onChange={v => PLAYER.set({ lowpass: v })} />
                    <Fader label="HI" resetValue={0} value={s.highpass} onChange={v => PLAYER.set({ highpass: v })} />
                </div>
                <div className="player__expandable flex lg:hidden">
                    <Fader label="VOL" value={s.volume} onChange={v => PLAYER.setVolume(v)} />
                </div>
            </div>
            <div className="player__expandable">
                <Waveform />
            </div>
            <ProgressBar />
        </div>
    );
}

export default function Player() {
    return (
        <ErrorBoundary>
            <PlayerInner />
        </ErrorBoundary>
    );
}
