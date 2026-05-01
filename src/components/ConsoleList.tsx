import { useEffect, useRef, useState } from 'react';

import { ALL_KEYS, TRACKS, YEARS } from '@lib/tracks';
import { BPM_MAX, BPM_MIN, buildSlug, categoryLabel, fmtDuration, nextSort } from '@lib/utils';
import { PLAYER, usePlayer } from '@lib/store';
import { usePinModal } from './PinModal';
import { useTrackList } from '@lib/hooks';

import type { TrackListState } from '@lib/hooks';

const COL_TEMPLATE = '36px 70px minmax(0, 1fr) 70px 80px 220px';

export default function ConsoleList() {
    const list = useTrackList(TRACKS);
    const pin = usePinModal();
    const player = usePlayer();

    return (
        <section style={{ padding: '72px 32px 96px', maxWidth: 1480, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 32, gap: 24, flexWrap: 'wrap' }}>
                <h2 style={{ fontFamily: 'var(--cn-sans)', fontSize: 40, fontWeight: 500, margin: 0, letterSpacing: '-0.025em' }}>
                    Catalog
                    <span style={{ color: 'var(--cn-dim)', fontSize: 20, marginLeft: 18, fontFamily: 'var(--cn-font)', letterSpacing: '0.02em' }}>
                        {list.total}
                        {' '}
                        of
                        {TRACKS.length}
                    </span>
                </h2>
            </div>
            <Filters list={list} />
            <div style={{
                display: 'grid', gridTemplateColumns: COL_TEMPLATE,
                gap: 14, padding: '14px 20px',
                background: 'var(--cn-bg2)', border: '1px solid var(--cn-line)',
                fontSize: 11, letterSpacing: '0.22em', color: 'var(--cn-dim)', marginTop: 24,
                alignItems: 'center',
            }}
            >
                <span></span>
                <SortHeader list={list} field="id" label="ID" />
                <SortHeader list={list} field="title" label="TITLE · BPM · KEY" />
                <SortHeader list={list} field="year" label="YEAR" />
                <SortHeader list={list} field="duration" label="LENGTH" />
                <span style={{ textAlign: 'left' }}>DOWNLOAD</span>
            </div>
            <div style={{ border: '1px solid var(--cn-line)', borderTop: 'none' }}>
                {list.visible.length === 0
                    ? (
                            <div style={{ padding: 80, textAlign: 'center', color: 'var(--cn-dim)', fontSize: 14 }}>
                                No signals match the current filter chain.
                            </div>
                        )
                    : list.visible.map((t, i) => (
                            <Row key={t.id} t={t} isPlaying={player.trackId === t.id} pin={pin} idx={i} />
                        ))}
            </div>
            <Pagination list={list} />
        </section>
    );
}

function SortHeader({ list, field, label }: { list: TrackListState; field: string; label: string }) {
    const active = list.sort.field === field;
    return (
        <span
            role="button"
            tabIndex={0}
            className="cn-tab"
            onClick={() => list.setSort(nextSort(list.sort, field))}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') list.setSort(nextSort(list.sort, field));
            }}
            style={{ color: active ? 'var(--cn-accent)' : 'var(--cn-dim)', display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
            {label}
            {active && (
                <span style={{ fontSize: 8, transform: list.sort.dir === 'desc' ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▲</span>
            )}
        </span>
    );
}

function Filters({ list }: { list: TrackListState }) {
    return (
        <div style={{
            background: 'var(--cn-panel)', border: '1px solid var(--cn-line)',
            padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 20,
            borderRadius: 2,
        }}
        >
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{
                    flex: '1 1 320px', minWidth: 260, display: 'flex', alignItems: 'center', gap: 12,
                    background: 'var(--cn-bg2)', border: '1px solid var(--cn-border2)', padding: '12px 16px',
                    borderRadius: 2,
                }}
                >
                    <svg width="14" height="14" viewBox="0 0 13 13" fill="none" stroke="var(--cn-dim)" strokeWidth="1.5">
                        <circle cx="5.5" cy="5.5" r="3.5" />
                        <path d="M9 9 L12 12" />
                    </svg>
                    <input
                        type="text"
                        value={list.q}
                        onChange={e => list.setQ(e.target.value)}
                        placeholder="search by title or id…"
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--cn-text)', font: 'inherit', fontSize: 14, flex: 1 }}
                    />
                    {list.q && (
                        <button onClick={() => list.setQ('')} style={{ background: 'none', border: 'none', color: 'var(--cn-dim)', font: 'inherit', cursor: 'pointer', fontSize: 13 }}>✕</button>
                    )}
                </div>
                <div style={{ display: 'flex', background: 'var(--cn-bg2)', border: '1px solid var(--cn-border2)', borderRadius: 2 }}>
                    {(['music', 'sessions', 'productions'] as const).map((c, i) => (
                        <button
                            key={c}
                            onClick={() => list.setCats({ ...list.cats, [c]: !list.cats[c] })}
                            style={{
                                background: list.cats[c] ? 'var(--cn-accent)' : 'transparent',
                                border: 'none', borderLeft: i ? '1px solid var(--cn-border2)' : 'none',
                                color: list.cats[c] ? '#fff' : 'var(--cn-dim)',
                                padding: '12px 18px', fontSize: 12, letterSpacing: '0.16em',
                                fontWeight: list.cats[c] ? 600 : 400, font: 'inherit', cursor: 'pointer',
                                transition: 'all .15s',
                            }}
                        >
                            {categoryLabel(c).toUpperCase()}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <FavChip active={list.favs.star} onClick={() => list.setFavs({ ...list.favs, star: !list.favs.star })} color="var(--cn-star)" label="★" title="Starred only" />
                    <FavChip active={list.favs.heart} onClick={() => list.setFavs({ ...list.favs, heart: !list.favs.heart })} color="var(--cn-heart)" label="♥" title="Hearted only" />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr) 240px', gap: 18, alignItems: 'end' }}>
                <MultiSelectField label="YEAR" selected={list.years} onChange={list.setYears} options={YEARS.map(y => [y, String(y)] as [number, string])} placeholder="All years" />
                <MultiSelectField label="KEY" selected={list.keys} onChange={list.setKeys} options={ALL_KEYS.map(k => [k, k] as [string, string])} placeholder="All keys" />
                <BPMSlider value={list.bpmRange} onChange={list.setBpmRange} />
            </div>
        </div>
    );
}

function FavChip({ active, onClick, color, label, title }: {
    active: boolean; onClick: () => void; color: string; label: string; title: string;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                background: active ? color : 'transparent',
                border: `1px solid ${active ? color : 'var(--cn-border2)'}`,
                color: active ? '#1a1611' : color,
                font: 'inherit', fontSize: 18, lineHeight: 1,
                width: 44, height: 44,
                cursor: 'pointer', transition: 'all .15s', borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            {label}
        </button>
    );
}

function MultiSelectField<T extends string | number>({ label, selected, onChange, options, placeholder }: {
    label: string;
    selected: T[];
    onChange: (v: T[]) => void;
    options: [T, string][];
    placeholder: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const summary = selected.length === 0
        ? placeholder
        : selected.length <= 2
            ? selected.map(v => options.find(([k]) => k === v)?.[1] || String(v)).join(', ')
            : `${selected.length} selected`;

    return (
        <div ref={ref} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--cn-dim)' }}>{label}</span>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    background: 'var(--cn-bg2)', border: `1px solid ${open ? 'var(--cn-accent)' : 'var(--cn-border2)'}`,
                    color: selected.length ? 'var(--cn-text)' : 'var(--cn-dim2)',
                    font: 'inherit', fontSize: 14, textAlign: 'left',
                    padding: '11px 14px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'border-color .15s', borderRadius: 2,
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selected.length > 0 && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange([]);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--cn-dim)', fontSize: 12, padding: '0 4px', cursor: 'pointer', font: 'inherit' }}
                            title="Clear"
                        >
                            ✕
                        </button>
                    )}
                    <svg width="10" height="6" viewBox="0 0 10 6" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                        <path d="M1 1 L5 5 L9 1" fill="none" stroke="var(--cn-dim)" strokeWidth="1.5" />
                    </svg>
                </span>
            </button>
            {open && <MultiSelectPopover label={label} selected={selected} onChange={onChange} options={options} />}
        </div>
    );
}

function MultiSelectPopover<T extends string | number>({ label, selected, onChange, options }: {
    label: string; selected: T[]; onChange: (v: T[]) => void; options: [T, string][];
}) {
    const [search, setSearch] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        searchRef.current?.focus();
    }, []);
    const filtered = options.filter(([, l]) => !search || l.toLowerCase().includes(search.toLowerCase()));
    const toggle = (v: T) => {
        if (selected.includes(v)) onChange(selected.filter(s => s !== v));
        else onChange([...selected, v]);
    };
    return (
        <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: 'var(--cn-panel)', border: '1px solid var(--cn-accent)',
            zIndex: 50, padding: 0, borderRadius: 2,
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            maxHeight: 320, display: 'flex', flexDirection: 'column',
        }}
        >
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--cn-border2)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--cn-dim)', flex: 1 }}>
                    {label}
                    {' '}
                    ·
                    {' '}
                    {selected.length}
                    {' '}
                    selected
                </span>
                <button
                    onClick={() => onChange([])}
                    disabled={!selected.length}
                    style={{
                        background: 'transparent', border: 'none',
                        color: selected.length ? 'var(--cn-accent)' : 'var(--cn-dim2)',
                        font: 'inherit', fontSize: 11, letterSpacing: '0.16em',
                        cursor: selected.length ? 'pointer' : 'default', padding: 0,
                    }}
                >
                    CLEAR
                </button>
            </div>
            <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="filter…"
                style={{
                    background: 'var(--cn-bg2)', border: 'none', borderBottom: '1px solid var(--cn-border2)',
                    color: 'var(--cn-text)', font: 'inherit', fontSize: 13,
                    padding: '10px 14px', outline: 'none',
                }}
            />
            <div style={{ overflowY: 'auto', maxHeight: 220, padding: 4 }}>
                {filtered.length === 0
                    ? (
                            <div style={{ padding: 16, color: 'var(--cn-dim)', fontSize: 12, textAlign: 'center' }}>No matches</div>
                        )
                    : filtered.map(([v, l]) => (

                            <label
                                key={String(v)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '8px 10px', cursor: 'pointer',
                                    background: selected.includes(v) ? 'rgba(201,122,74,0.10)' : 'transparent',
                                    fontSize: 13, borderRadius: 2,
                                }}
                                onMouseEnter={(e) => {
                                    if (!selected.includes(v)) e.currentTarget.style.background = 'var(--cn-panel2)';
                                }}
                                onMouseLeave={(e) => {
                                    if (!selected.includes(v)) e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <span style={{
                                    width: 14, height: 14, border: `1px solid ${selected.includes(v) ? 'var(--cn-accent)' : 'var(--cn-dim2)'}`,
                                    background: selected.includes(v) ? 'var(--cn-accent)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: 10, borderRadius: 2,
                                }}
                                >
                                    {selected.includes(v) ? '✓' : ''}
                                </span>
                                <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} style={{ display: 'none' }} />
                                <span>{l}</span>
                            </label>
                        ))}
            </div>
        </div>
    );
}

function BPMSlider({ value, onChange }: { value: [number, number]; onChange: (v: [number, number]) => void }) {
    const [lo, hi] = value;
    const trackRef = useRef<HTMLDivElement>(null);
    const onDrag = (which: 'lo' | 'hi') => (e: React.MouseEvent) => {
        e.preventDefault();
        const move = (ev: MouseEvent) => {
            if (!trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            const x = (ev.clientX - rect.left) / rect.width;
            const v = Math.round(BPM_MIN + Math.max(0, Math.min(1, x)) * (BPM_MAX - BPM_MIN));
            if (which === 'lo') onChange([Math.min(v, hi - 1), hi]);
            else onChange([lo, Math.max(v, lo + 1)]);
        };
        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };
    const pctL = ((lo - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100;
    const pctH = ((hi - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100;
    const isDefault = lo === BPM_MIN && hi === BPM_MAX;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, letterSpacing: '0.22em', color: 'var(--cn-dim)' }}>
                <span>BPM</span>
                <span style={{ color: isDefault ? 'var(--cn-dim)' : 'var(--cn-accent)', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
                    {lo}
                    –
                    {hi}
                </span>
            </div>
            <div style={{ position: 'relative', height: 44, display: 'flex', alignItems: 'center' }}>
                <div ref={trackRef} style={{ position: 'relative', height: 4, background: 'var(--cn-bg2)', width: '100%', borderRadius: 2 }}>
                    <div style={{
                        position: 'absolute', left: `${pctL}%`, right: `${100 - pctH}%`, top: 0, bottom: 0,
                        background: 'var(--cn-accent)', borderRadius: 2,
                    }}
                    />
                    {([['lo', pctL], ['hi', pctH]] as const).map(([k, p]) => (
                        <div
                            key={k}
                            role="slider"
                            tabIndex={0}
                            aria-label={`BPM ${k === 'lo' ? 'minimum' : 'maximum'}`}
                            aria-valuemin={BPM_MIN}
                            aria-valuemax={BPM_MAX}
                            aria-valuenow={k === 'lo' ? lo : hi}
                            onMouseDown={onDrag(k)}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                                    if (k === 'lo') onChange([Math.max(BPM_MIN, lo - 1), hi]);
                                    else onChange([lo, Math.max(lo + 1, hi - 1)]);
                                } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                                    if (k === 'lo') onChange([Math.min(hi - 1, lo + 1), hi]);
                                    else onChange([lo, Math.min(BPM_MAX, hi + 1)]);
                                }
                            }}
                            style={{
                                position: 'absolute', left: `${p}%`, top: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 16, height: 16, borderRadius: '50%',
                                background: 'var(--cn-text)', border: '2px solid var(--cn-accent)',
                                cursor: 'ew-resize', boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function Row({ t, isPlaying, pin, idx }: { t: Track; isPlaying: boolean; pin: ReturnType<typeof usePinModal>; idx: number }) {
    const noMaster = !t.master;
    const onPlay = () => {
        if (!noMaster) PLAYER.load(t);
    };
    const slug = buildSlug(t.id, t.title);
    return (
        <div
            role="button"
            tabIndex={0}
            className={`cn-row ${isPlaying ? 'is-playing' : ''}`}
            onClick={onPlay}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onPlay();
            }}
            style={{
                display: 'grid', gridTemplateColumns: COL_TEMPLATE,
                gap: 14, padding: '22px 20px',
                borderTop: idx ? '1px solid var(--cn-line)' : 'none',
                fontSize: 14, alignItems: 'center',
                opacity: noMaster ? 0.45 : 1,
                cursor: noMaster ? 'not-allowed' : 'pointer',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isPlaying
                    ? <PlayingDots />
                    : t.star
                        ? <span style={{ color: 'var(--cn-star)', fontSize: 26, lineHeight: 1 }}>★</span>
                        : t.heart
                            ? <span style={{ color: 'var(--cn-heart)', fontSize: 24, lineHeight: 1 }}>♥</span>
                            : null}
            </div>
            <span style={{ color: 'var(--cn-dim)', fontSize: 13, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>{t.id}</span>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{
                    fontFamily: 'var(--cn-sans)', fontSize: 17, fontWeight: 500,
                    color: t.title ? 'var(--cn-text)' : 'var(--cn-dim2)',
                    fontStyle: t.title ? 'normal' : 'italic',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    letterSpacing: '-0.005em', lineHeight: 1.2,
                }}
                >
                    {t.title || ' '}
                </div>
                <div style={{
                    display: 'flex', gap: 14, fontSize: 12, color: 'var(--cn-dim2)',
                    fontFamily: 'var(--cn-font)', letterSpacing: '0.02em',
                    flexWrap: 'wrap', alignItems: 'center',
                }}
                >
                    {t.bpm.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: 'var(--cn-dim2)', fontSize: 10, letterSpacing: '0.18em' }}>BPM</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{t.bpm.join(' ')}</span>
                        </span>
                    )}
                    {t.key.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: 'var(--cn-dim2)', fontSize: 10, letterSpacing: '0.18em' }}>KEY</span>
                            <span>{t.key.join(', ')}</span>
                        </span>
                    )}
                </div>
            </div>
            <span style={{ color: 'var(--cn-dim)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{t.title ? t.year : ''}</span>
            <span style={{ color: 'var(--cn-dim)', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{t.title ? fmtDuration(t.duration) : ''}</span>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div
                style={{ display: 'flex', gap: 6, justifyContent: 'flex-start' }}
                onClick={e => e.stopPropagation()}
            >
                <DLBtn onClick={() => pin.open(t, 'master')} disabled={!t.master} title={t.master ? 'Download WAV master' : 'No master available'}>WAV</DLBtn>
                <DLLink href={`/audio/${slug}.mp3`} disabled={!t.master} title="Download MP3">MP3</DLLink>
                <DLBtn
                    onClick={() => {
                        if (t.mixdown) pin.open(t, 'mixdown');
                    }}
                    disabled={!t.mixdown}
                    title={t.mixdown ? 'Download mixdown' : 'No mixdown available'}
                >
                    MIX
                </DLBtn>
            </div>
        </div>
    );
}

function PlayingDots() {
    return (
        <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 14 }}>
            {[0, 1, 2, 3].map(i => (
                <div
                    key={i}
                    style={{
                        width: 2, height: 14, background: 'var(--cn-accent)',
                        transformOrigin: 'center',
                        animation: `cnVU 0.7s ease-in-out ${i * 0.1}s infinite`,
                    }}
                />
            ))}
        </div>
    );
}

function DLBtn({ children, onClick, disabled, title }: {
    children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string;
}) {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                background: disabled ? 'transparent' : (hover ? 'var(--cn-panel2)' : 'transparent'),
                border: `1px solid ${disabled ? 'var(--cn-line)' : (hover ? 'var(--cn-accent)' : 'var(--cn-border2)')}`,
                color: disabled ? 'var(--cn-dim2)' : (hover ? 'var(--cn-accent)' : 'var(--cn-text2)'),
                font: 'inherit', fontSize: 11, letterSpacing: '0.18em', fontWeight: 500,
                padding: '8px 14px', cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all .12s', borderRadius: 2,
                opacity: disabled ? 0.4 : 1,
            }}
        >
            {children}
        </button>
    );
}

function DLLink({ children, href, disabled, title }: {
    children: React.ReactNode; href: string; disabled?: boolean; title?: string;
}) {
    const [hover, setHover] = useState(false);
    if (disabled) {
        return (
            <span
                title={title}
                style={{
                    background: 'transparent',
                    border: '1px solid var(--cn-line)',
                    color: 'var(--cn-dim2)',
                    font: 'inherit', fontSize: 11, letterSpacing: '0.18em', fontWeight: 500,
                    padding: '8px 14px', cursor: 'not-allowed',
                    borderRadius: 2, opacity: 0.4,
                    display: 'inline-block', textDecoration: 'none',
                }}
            >
                {children}
            </span>
        );
    }
    return (
        <a
            href={href}
            download
            title={title}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                background: hover ? 'var(--cn-panel2)' : 'transparent',
                border: `1px solid ${hover ? 'var(--cn-accent)' : 'var(--cn-border2)'}`,
                color: hover ? 'var(--cn-accent)' : 'var(--cn-text2)',
                font: 'inherit', fontSize: 11, letterSpacing: '0.18em', fontWeight: 500,
                padding: '8px 14px', cursor: 'pointer',
                transition: 'all .12s', borderRadius: 2,
                display: 'inline-block', textDecoration: 'none',
            }}
        >
            {children}
        </a>
    );
}

function Pagination({ list }: { list: TrackListState }) {
    const showPages: (number | '…')[] = [];
    const total = list.pageCount;
    for (let i = 0; i < total; i++) {
        if (i === 0 || i === total - 1 || Math.abs(i - list.page) <= 2) showPages.push(i);
        else if (showPages[showPages.length - 1] !== '…') showPages.push('…');
    }
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, fontSize: 12, letterSpacing: '0.16em' }}>
            <span style={{ color: 'var(--cn-dim)' }}>
                {list.total === 0 ? '0' : `${list.page * list.PAGE_SIZE + 1}–${Math.min((list.page + 1) * list.PAGE_SIZE, list.total)}`}
                {' '}
                OF
                {list.total}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
                <PgBtn onClick={() => list.setPage(Math.max(0, list.page - 1))} disabled={list.page === 0}>‹</PgBtn>
                {showPages.map((p, i) => (
                    p === '…'
                        ? <span key={`e${i}`} style={{ padding: '8px 10px', color: 'var(--cn-dim2)' }}>…</span>
                        : <PgBtn key={p} onClick={() => list.setPage(p)} active={p === list.page}>{p + 1}</PgBtn>
                ))}
                <PgBtn onClick={() => list.setPage(Math.min(list.pageCount - 1, list.page + 1))} disabled={list.page === list.pageCount - 1}>›</PgBtn>
            </div>
        </div>
    );
}

function PgBtn({ children, onClick, disabled, active }: {
    children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                background: active ? 'var(--cn-accent)' : 'transparent',
                border: `1px solid ${active ? 'var(--cn-accent)' : 'var(--cn-border2)'}`,
                color: active ? '#fff' : disabled ? 'var(--cn-dim2)' : 'var(--cn-dim)',
                font: 'inherit', fontSize: 12, fontWeight: 500,
                padding: '8px 13px', minWidth: 36,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1, transition: 'all .12s',
                borderRadius: 2,
            }}
        >
            {children}
        </button>
    );
}
