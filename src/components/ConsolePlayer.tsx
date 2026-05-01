import { useRef, useState } from 'react';

import { PLAYER, useCurrentTrack, usePlayer } from '@lib/store';
import { categoryLabel, fmtCounter, fmtDuration as fmtMS } from '@lib/utils';
import { useVU } from '@lib/hooks';

const _waveformCache: Record<string, number[]> = {};
function waveformFor(id: string, duration: number, bars = 180): number[] {
    const cacheKey = `${id}_${bars}`;
    if (_waveformCache[cacheKey]) return _waveformCache[cacheKey];
    let seed = 0;
    for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
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
    for (let i = 0; i < bars; i++) {
        const env = (Math.sin(i * envFreq + envPhase) * 0.5 + 0.5) * 0.55
            + (Math.sin(i * env2Freq + env2Phase) * 0.5 + 0.5) * 0.45;
        const noise = rand();
        const jitter = Math.sin(i * 0.6 + rand() * Math.PI) * 0.12;
        let v = env * 0.65 + noise * 0.25 + Math.abs(jitter) * 0.4;
        const fade = Math.min(1, Math.min(i, bars - i - 1) / 6);
        v *= fade;
        peaks.push(Math.max(0.08, Math.min(1, v)));
    }
    _waveformCache[cacheKey] = peaks;
    return peaks;
}

export default function ConsolePlayer() {
    const s = usePlayer();
    const t = useCurrentTrack();
    const [vu_l, vu_r] = useVU();

    return (
        <div style={{
            position: 'sticky', top: 0, zIndex: 100,
            background: 'linear-gradient(180deg, var(--cn-pBg2) 0%, var(--cn-pBg) 100%)',
            borderBottom: '1px solid var(--cn-pBorder2)',
            padding: '16px 32px 14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <TapeReel spinning={s.playing} />
                    <TapeReel spinning={s.playing} small />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <TransportBtn onClick={() => PLAYER.toggle()} disabled={!t} active={s.playing} title={s.playing ? 'Pause' : 'Play'}>
                        {s.playing
                            ? (
                                    <svg width="14" height="14" viewBox="0 0 14 14">
                                        <rect x="2" y="2" width="3" height="10" fill="currentColor" />
                                        <rect x="9" y="2" width="3" height="10" fill="currentColor" />
                                    </svg>
                                )
                            : (
                                    <svg width="14" height="14" viewBox="0 0 14 14"><polygon points="3,2 12,7 3,12" fill="currentColor" /></svg>
                                )}
                    </TransportBtn>
                    <TransportBtn onClick={() => PLAYER.setRepeat(!s.repeat)} active={s.repeat} title="Repeat">
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6 a3 3 0 0 1 3 -3 h7 l-2 -2 m2 2 l-2 2" />
                            <path d="M13 10 a3 3 0 0 1 -3 3 h-7 l2 2 m-2 -2 l2 -2" />
                        </svg>
                    </TransportBtn>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--cn-pDim)', marginBottom: 3, textTransform: 'uppercase' }}>
                        {t ? `${t.id} · ${categoryLabel(t.category)} · ${t.year}  ·  ${t.bpm.join(' ')} bpm  ·  ${t.key.join(', ')}` : 'No tape loaded'}
                    </div>
                    <div style={{
                        fontFamily: 'var(--cn-sans)',
                        fontSize: 24, fontWeight: 500, letterSpacing: '-0.01em',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        color: t ? 'var(--cn-pText)' : 'var(--cn-pDim2)',
                        lineHeight: 1.2,
                    }}
                    >
                        {t ? (t.title || '(untitled session)') : 'Select a track to begin'}
                    </div>
                </div>
                <div style={{
                    fontFamily: 'var(--cn-font)', fontSize: 22, color: 'var(--cn-accent)',
                    background: '#000', padding: '8px 16px',
                    border: '1px solid var(--cn-accentDim)',
                    letterSpacing: '0.03em',
                    minWidth: 140, textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                }}
                >
                    {fmtCounter(s.position)}
                    {' '}
                    <span style={{ color: 'var(--cn-pDim2)' }}>/</span>
                    {' '}
                    <span style={{ color: 'var(--cn-pDim)' }}>{fmtCounter(s.duration || t?.duration || 0)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <VUStrip level={s.playing ? vu_l * s.volume : 0} label="L" />
                    <VUStrip level={s.playing ? vu_r * s.volume : 0} label="R" />
                </div>
                <FilterFader label="LO" value={s.lowpass} onChange={v => PLAYER.set({ lowpass: v })} />
                <FilterFader label="HI" value={s.highpass} onChange={v => PLAYER.set({ highpass: v })} />
                <VolumeFader value={s.volume} onChange={v => PLAYER.setVolume(v)} />
            </div>
            <Waveform />
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

    const onClick = (e: React.MouseEvent) => {
        if (!t || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        PLAYER.seek(Math.max(0, Math.min(1, x)) * dur);
    };

    const onMove = (e: React.MouseEvent) => {
        if (!t || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        setHoverPx(x);
        setHoverPos((x / rect.width) * dur);
    };

    const HEIGHT = 100;
    const WAVE_H = 72;
    const TICK_H = 20;

    return (
        <div
            ref={ref}
            role="slider"
            tabIndex={0}
            aria-label="Waveform scrubber"
            aria-valuemin={0}
            aria-valuemax={dur || 0}
            aria-valuenow={Math.floor(s.position)}
            onClick={onClick}
            onKeyDown={(e) => {
                if (!t) return;
                if (e.key === 'ArrowLeft') PLAYER.seek(Math.max(0, s.position - 5));
                else if (e.key === 'ArrowRight') PLAYER.seek(Math.min(dur, s.position + 5));
            }}
            onMouseMove={onMove}
            onMouseLeave={() => {
                setHoverPos(null);
                setHoverPx(null);
            }}
            style={{
                position: 'relative', height: HEIGHT,
                background: '#0a0907', borderRadius: 2,
                cursor: t ? 'pointer' : 'default',
                overflow: 'hidden', userSelect: 'none',
            }}
        >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: WAVE_H }}>
                <div style={{
                    position: 'absolute', left: 0, right: 0, top: '50%', height: 1,
                    background: 'rgba(232,217,176,0.08)',
                }}
                />
                {peaks && (
                    <svg width="100%" height="100%" preserveAspectRatio="none" viewBox={`0 0 ${peaks.length * 2} 100`} style={{ position: 'absolute', inset: 0 }}>
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
                            if (isPlayed) fill = 'var(--cn-accent)';
                            else if (inHover) fill = 'rgba(201,122,74,0.5)';
                            else fill = 'rgba(232,217,176,0.32)';
                            return <rect key={i} x={x} y={y} width={1} height={h} fill={fill} rx="0.4" />;
                        })}
                    </svg>
                )}
            </div>
            <div style={{
                position: 'absolute', left: 0, right: 0, top: WAVE_H, height: TICK_H,
                borderTop: '1px solid var(--cn-pBorder)',
                background: '#070605',
            }}
            >
                {t && dur > 0 && (() => {
                    const ticks: React.ReactNode[] = [];
                    const step = dur > 240 ? 60 : dur > 60 ? 30 : 15;
                    for (let i = step; i < dur; i += step) {
                        const tickPct = (i / dur) * 100;
                        ticks.push(
                            <div key={`t${i}`}>
                                <div style={{
                                    position: 'absolute', left: `${tickPct}%`, top: 0,
                                    width: 1, height: 4,
                                    background: 'rgba(232,217,176,0.32)',
                                    pointerEvents: 'none',
                                }}
                                />
                                <div style={{
                                    position: 'absolute', left: `${tickPct}%`, top: 5,
                                    fontSize: 10, color: 'rgba(232,217,176,0.55)',
                                    transform: 'translateX(-50%)',
                                    letterSpacing: '0.04em',
                                    pointerEvents: 'none',
                                    fontFamily: 'var(--cn-font)',
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                                >
                                    {fmtMS(i)}
                                </div>
                            </div>,
                        );
                    }
                    return ticks;
                })()}
            </div>
            {t && (
                <div style={{
                    position: 'absolute', top: -2, height: WAVE_H + 4,
                    left: `${playedFrac * 100}%`, width: 2,
                    background: 'var(--cn-pText)',
                    boxShadow: '0 0 6px rgba(236,223,196,0.6), 0 0 12px var(--cn-accent)',
                    transform: 'translateX(-1px)',
                    pointerEvents: 'none', zIndex: 2,
                }}
                >
                    <div style={{
                        position: 'absolute', top: -3, left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0, height: 0,
                        borderLeft: '4px solid transparent',
                        borderRight: '4px solid transparent',
                        borderTop: '5px solid var(--cn-pText)',
                    }}
                    />
                    <div style={{
                        position: 'absolute', bottom: -3, left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0, height: 0,
                        borderLeft: '4px solid transparent',
                        borderRight: '4px solid transparent',
                        borderBottom: '5px solid var(--cn-pText)',
                    }}
                    />
                </div>
            )}
            {hoverPos !== null && t && (
                <div style={{
                    position: 'absolute', top: 6, left: hoverPx!,
                    transform: 'translateX(-50%)',
                    background: 'var(--cn-pBg)', border: '1px solid var(--cn-accentDim)',
                    padding: '2px 7px', fontSize: 11, color: 'var(--cn-accent)',
                    pointerEvents: 'none', whiteSpace: 'nowrap',
                    fontFamily: 'var(--cn-font)', letterSpacing: '0.03em',
                    fontVariantNumeric: 'tabular-nums',
                }}
                >
                    {fmtMS(hoverPos)}
                </div>
            )}
            {!t && (
                <div
                    className="cn-blink"
                    style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--cn-pDim2)', fontSize: 11, letterSpacing: '0.28em',
                    }}
                >
                    AWAITING SIGNAL
                </div>
            )}
        </div>
    );
}

function TransportBtn({ children, onClick, disabled, active, title }: {
    children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean; title?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            style={{
                width: 40, height: 40,
                background: active ? 'var(--cn-accent2)' : '#0a0907',
                border: `1px solid ${active ? 'var(--cn-accent)' : 'var(--cn-pBorder2)'}`,
                color: active ? 'var(--cn-pText)' : (disabled ? 'var(--cn-pDim2)' : 'var(--cn-pDim)'),
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s', borderRadius: 2,
            }}
        >
            {children}
        </button>
    );
}

function TapeReel({ spinning, small }: { spinning: boolean; small?: boolean }) {
    const size = small ? 32 : 44;
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            border: '1px solid var(--cn-pBorder2)',
            background: 'radial-gradient(circle at 50% 50%, #211d17 0%, #0a0907 70%)',
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        >
            <div
                className={`cn-reel ${spinning ? '' : 'paused'}`}
                style={{
                    width: '72%', height: '72%', borderRadius: '50%',
                    border: '1px dashed var(--cn-pDim2)', position: 'relative',
                }}
            >
                <div style={{ position: 'absolute', inset: '38%', borderRadius: '50%', background: 'var(--cn-accent2)' }} />
                {[0, 60, 120, 180, 240, 300].map(deg => (
                    <div
                        key={deg}
                        style={{
                            position: 'absolute', top: '50%', left: '50%',
                            width: 1, height: '40%', background: 'var(--cn-pDim2)',
                            transformOrigin: 'top center',
                            transform: `translate(-50%, 0) rotate(${deg}deg)`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function VUStrip({ level, label }: { level: number; label: string }) {
    const segs = 18;
    const lit = Math.round(level * segs);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--cn-pDim2)', width: 8, fontWeight: 600 }}>{label}</span>
            <div style={{ display: 'flex', gap: 1 }}>
                {Array.from({ length: segs }).map((_, i) => {
                    const on = i < lit;
                    const color = i > segs - 4 ? 'var(--cn-danger)' : i > segs - 7 ? 'var(--cn-accent)' : 'var(--cn-sage)';
                    return (
                        <div
                            key={i}
                            style={{
                                width: 5, height: 9,
                                background: on ? color : '#1a1814',
                                opacity: on ? 1 : 0.7,
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function FilterFader({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    const trackRef = useRef<HTMLDivElement>(null);
    const HEIGHT = 64;
    const onDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const move = (ev: MouseEvent) => {
            if (!trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            const y = (ev.clientY - rect.top) / rect.height;
            onChange(Math.max(0, Math.min(1, 1 - y)));
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--cn-pDim2)', letterSpacing: '0.18em', fontWeight: 600 }}>{label}</span>
            <div
                ref={trackRef}
                role="slider"
                tabIndex={0}
                aria-label={label === 'LO' ? 'Low-pass filter' : 'High-pass filter'}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(value * 100)}
                onMouseDown={onDown}
                onDoubleClick={() => onChange(label === 'LO' ? 1 : 0)}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') onChange(Math.min(1, value + 0.05));
                    else if (e.key === 'ArrowDown') onChange(Math.max(0, value - 0.05));
                }}
                title={`${label === 'LO' ? 'Low-pass' : 'High-pass'} (drag to adjust, double-click to reset)`}
                style={{
                    width: 16, height: HEIGHT,
                    background: '#0a0907', border: '1px solid var(--cn-pBorder2)',
                    borderRadius: 2, position: 'relative', cursor: 'ns-resize',
                }}
            >
                {[0.25, 0.5, 0.75].map(p => (
                    <div
                        key={p}
                        style={{
                            position: 'absolute', left: 2, right: 2,
                            top: `${(1 - p) * 100}%`, height: 1,
                            background: 'rgba(232,217,176,0.10)', pointerEvents: 'none',
                        }}
                    />
                ))}
                <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    height: `${value * 100}%`,
                    background: 'linear-gradient(180deg, var(--cn-accent2) 0%, var(--cn-accentDim) 100%)',
                    opacity: 0.35, pointerEvents: 'none',
                }}
                />
                <div style={{
                    position: 'absolute', left: -5, right: -5,
                    top: `${(1 - value) * 100}%`,
                    transform: 'translateY(-50%)',
                    height: 10,
                    background: 'var(--cn-pText)', border: '1px solid var(--cn-accent)',
                    borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    pointerEvents: 'none',
                }}
                >
                    <div style={{
                        position: 'absolute', left: 0, right: 0, top: '50%',
                        height: 1, background: 'var(--cn-accent2)', transform: 'translateY(-50%)',
                    }}
                    />
                </div>
            </div>
            <span style={{ fontSize: 9, color: 'var(--cn-pDim)', fontVariantNumeric: 'tabular-nums', minWidth: 22, textAlign: 'center' }}>{Math.round(value * 100)}</span>
        </div>
    );
}

function VolumeFader({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const trackRef = useRef<HTMLDivElement>(null);
    const HEIGHT = 64;
    const onDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const move = (ev: MouseEvent) => {
            if (!trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            const y = (ev.clientY - rect.top) / rect.height;
            onChange(Math.max(0, Math.min(1, 1 - y)));
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--cn-pDim2)', letterSpacing: '0.18em', fontWeight: 600 }}>VOL</span>
            <div
                ref={trackRef}
                role="slider"
                tabIndex={0}
                aria-label="Volume"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(value * 100)}
                onMouseDown={onDown}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') onChange(Math.min(1, value + 0.05));
                    else if (e.key === 'ArrowDown') onChange(Math.max(0, value - 0.05));
                }}
                style={{
                    width: 16, height: HEIGHT,
                    background: '#0a0907', border: '1px solid var(--cn-pBorder2)',
                    borderRadius: 2, position: 'relative', cursor: 'ns-resize',
                }}
            >
                {[0.25, 0.5, 0.75].map(p => (
                    <div
                        key={p}
                        style={{
                            position: 'absolute', left: 2, right: 2,
                            top: `${(1 - p) * 100}%`, height: 1,
                            background: 'rgba(232,217,176,0.10)', pointerEvents: 'none',
                        }}
                    />
                ))}
                <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    height: `${value * 100}%`,
                    background: 'linear-gradient(180deg, var(--cn-accent2) 0%, var(--cn-accentDim) 100%)',
                    opacity: 0.35, pointerEvents: 'none',
                }}
                />
                <div style={{
                    position: 'absolute', left: -5, right: -5,
                    top: `${(1 - value) * 100}%`,
                    transform: 'translateY(-50%)',
                    height: 10,
                    background: 'var(--cn-pText)', border: '1px solid var(--cn-accent)',
                    borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    pointerEvents: 'none',
                }}
                >
                    <div style={{
                        position: 'absolute', left: 0, right: 0, top: '50%',
                        height: 1, background: 'var(--cn-accent2)', transform: 'translateY(-50%)',
                    }}
                    />
                </div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--cn-pDim)', letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums', minWidth: 26, textAlign: 'center' }}>{Math.round(value * 100)}</span>
        </div>
    );
}
