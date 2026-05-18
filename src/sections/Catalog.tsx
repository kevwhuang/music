import { useEffect, useRef, useState } from 'react';

import { ALL_KEYS, TRACKS, YEARS } from '@lib/tracks';
import { BPM_MAX, BPM_MIN, buildSlug, categoryLabel, fmtDuration, nextSort } from '@lib/utils';
import { PLAYER, usePlayer } from '@lib/store';
import { PinModalProvider, usePinModal } from '@components/PinModal';
import { useTrackList } from '@lib/hooks';

import type { TrackListState } from '@lib/hooks';

const COL_TEMPLATE = '36px 70px minmax(0, 1fr) 70px 80px 220px';

export default function Catalog() {
    return (
        <PinModalProvider>
            <CatalogInner />
        </PinModalProvider>
    );
}

function CatalogInner() {
    const list = useTrackList(TRACKS);
    const pin = usePinModal();
    const player = usePlayer();

    return (
        <section className="px-[clamp(1rem,calc(0.5rem+2.5vw),2.5rem)] pt-[clamp(2.5rem,calc(1.83rem+3.33vw),4.5rem)] pb-[clamp(3rem,calc(2rem+5vw),6rem)] font-mono text-sm">
            <div className="max-w-[92.5rem] mx-auto">
                <div className="flex flex-wrap items-baseline justify-between gap-6 mb-8">
                    <h2 className="catalog__heading m-0 font-medium font-inter text-[clamp(1.5rem,calc(1.17rem+1.67vw),2.5rem)] tracking-[-0.025em]">
                        Catalog
                        <span className="ml-4 text-[clamp(0.75rem,calc(0.58rem+0.83vw),1.25rem)] tracking-[0.02em] [font-family:var(--font-mono)] text-zinc-400">
                            {list.total}
                            {' of '}
                            {TRACKS.length}
                        </span>
                    </h2>
                </div>
                <Filters list={list} />
                <div
                    className="grid items-center gap-3.5 px-5 py-3.5 mt-6 border border-zinc-800 text-[0.6875rem] tracking-[0.22em] bg-zinc-900 text-zinc-400"
                    style={{ gridTemplateColumns: COL_TEMPLATE }}
                >
                    <span />
                    <SortHeader field="id" label="ID" list={list} />
                    <SortHeader field="title" label="TITLE · BPM · KEY" list={list} />
                    <SortHeader field="year" label="YEAR" list={list} />
                    <SortHeader field="duration" label="LENGTH" list={list} />
                    <span className="text-left">DOWNLOAD</span>
                </div>
                <div className="border border-zinc-800 border-t-0">
                    {list.visible.length === 0
                        ? (
                                <div className="p-20 text-center text-sm text-zinc-400">
                                    No signals match the current filter chain.
                                </div>
                            )
                        : list.visible.map((t, i) => (
                                <Row key={t.id} idx={i} isPlaying={player.trackId === t.id} pin={pin} t={t} />
                            ))}
                </div>
                <Pagination list={list} />
            </div>
        </section>
    );
}

function SortHeader({ field, label, list }: { field: string; label: string; list: TrackListState }) {
    const active = list.sort.field === field;
    return (
        <button
            className={`catalog__sort-btn inline-flex items-center gap-[5px] border-none bg-transparent [font-family:inherit] transition-[color] duration-150 cursor-pointer select-none ${active ? 'text-[var(--color-orange-80)]' : 'text-zinc-400'}`}
            onClick={() => list.setSort(nextSort(list.sort, field))}
        >
            {label}
            {active && (
                <span className="text-[0.5rem] transition-transform duration-150" style={{ transform: list.sort.dir === 'desc' ? 'rotate(180deg)' : 'none' }}>▲</span>
            )}
        </button>
    );
}

function Filters({ list }: { list: TrackListState }) {
    return (
        <div className="flex flex-col gap-5 p-[clamp(1rem,calc(0.75rem+1.25vw),1.75rem)] rounded-sm border border-zinc-800 bg-zinc-800">
            <div className="flex flex-wrap items-center gap-3.5">
                <div className="flex flex-[1_1_320px] items-center min-w-[260px] gap-3 px-4 py-3 rounded-sm border border-zinc-700 bg-zinc-900">
                    <svg className="text-white-40" aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 13 13" width="14">
                        <circle cx="5.5" cy="5.5" r="3.5" />
                        <path d="M9 9 L12 12" />
                    </svg>
                    <input
                        className="flex-1 border-none text-sm [font-family:inherit] bg-transparent text-zinc-100 outline-none"
                        placeholder="search by title or id"
                        type="text"
                        value={list.q}
                        onChange={e => list.setQ(e.target.value)}
                    />
                    {list.q && (
                        <button
                            className="border-none text-[0.8125rem] [font-family:inherit] bg-none text-zinc-400 cursor-pointer"
                            onClick={() => list.setQ('')}
                        >
                            ✕
                        </button>
                    )}
                </div>
                <div className="flex rounded-sm border border-zinc-700 bg-zinc-900">
                    {(['music', 'sessions', 'productions'] as const).map((c, i) => (
                        <button
                            key={c}
                            className={`catalog__category-btn px-[clamp(0.75rem,calc(0.63rem+0.62vw),1.125rem)] py-3 border-0 text-xs tracking-[0.16em] [font-family:inherit] transition-all duration-150 cursor-pointer ${list.cats[c] ? 'catalog__category-btn--active' : 'text-zinc-400'} ${i ? 'border-l border-l-zinc-700' : ''}`}
                            onClick={() => list.setCats({ ...list.cats, [c]: !list.cats[c] })}
                        >
                            {categoryLabel(c).toUpperCase()}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <FavChip active={list.favs.star} color="var(--color-gold)" label="★" size="text-2xl" title="Starred only" onClick={() => list.setFavs({ ...list.favs, star: !list.favs.star })} />
                    <FavChip active={list.favs.heart} color="var(--color-rose)" label="♥" size="text-xl" title="Hearted only" onClick={() => list.setFavs({ ...list.favs, heart: !list.favs.heart })} />
                </div>
            </div>
            <div className="grid grid-cols-1 items-end gap-[clamp(0.75rem,calc(0.63rem+0.62vw),1.125rem)] sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_240px]">
                <MultiSelect label="YEAR" options={YEARS.map(y => [y, String(y)] as [number, string])} placeholder="All" selected={list.years} onChange={list.setYears} />
                <MultiSelect label="KEY" options={ALL_KEYS.map(k => [k, k] as [string, string])} placeholder="All" selected={list.keys} onChange={list.setKeys} />
                <BPMSlider value={list.bpmRange} onChange={list.setBpmRange} />
            </div>
        </div>
    );
}

function FavChip({ active, color, label, size, title, onClick }: {
    active: boolean; color: string; label: string; onClick: () => void; size: string; title: string;
}) {
    return (
        <button
            className={`catalog__fav-btn flex items-center justify-center w-11 h-11 rounded-sm ${size} leading-none transition-all duration-150 cursor-pointer`}
            style={{
                background: active ? color : 'var(--color-transparent)',
                border: `1px solid ${active ? color : 'var(--color-white-20)'}`,
                color: active ? 'var(--color-black)' : color,
            }}
            title={title}
            onClick={onClick}
        >
            {label}
        </button>
    );
}

function MultiSelect<T extends string | number>({ label, options, placeholder, selected, onChange }: {
    label: string; onChange: (v: T[]) => void; options: [T, string][]; placeholder: string; selected: T[];
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
        <div className="relative flex flex-col gap-2" ref={ref}>
            <span className="text-[0.6875rem] tracking-[0.22em] text-zinc-400">{label}</span>
            <button
                className="flex items-center justify-between px-3.5 py-[11px] rounded-sm text-sm text-left [font-family:inherit] bg-zinc-900 transition-[border-color] duration-150 cursor-pointer"
                style={{ border: `1px solid ${open ? 'var(--color-orange-80)' : 'var(--color-white-20)'}`, color: selected.length ? 'var(--color-white)' : 'var(--color-white-40)' }}
                onClick={() => setOpen(!open)}
            >
                <span className="truncate">{summary}</span>
                <span className="flex items-center gap-2">
                    {selected.length > 0 && (
                        <button
                            className="border-none px-1 text-xs [font-family:inherit] bg-none text-zinc-400 cursor-pointer"
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange([]);
                            }}
                        >
                            ✕
                        </button>
                    )}
                    <svg className="text-white-40 transition-transform duration-150" height="6" style={{ transform: open ? 'rotate(180deg)' : 'none' }} viewBox="0 0 10 6" width="10">
                        <path d="M1 1 L5 5 L9 1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                </span>
            </button>
            {open && <MultiSelectPopover label={label} options={options} selected={selected} onChange={onChange} />}
        </div>
    );
}

function MultiSelectPopover<T extends string | number>({ label, options, selected, onChange }: {
    label: string; onChange: (v: T[]) => void; options: [T, string][]; selected: T[];
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
        <div className="catalog__dropdown absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex flex-col max-h-80 rounded-sm border border-[var(--color-orange-80)] bg-zinc-800">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-700">
                <span className="flex-1 text-[0.625rem] tracking-[0.22em] text-zinc-400">
                    {label}
                    {' '}
                    ·
                    {selected.length}
                    {' '}
                    selected
                </span>
                <button
                    className="border-none text-[0.6875rem] tracking-[0.16em] [font-family:inherit] bg-transparent cursor-pointer"
                    disabled={!selected.length}
                    style={{ color: selected.length ? 'var(--color-orange-80)' : 'var(--color-white-40)' }}
                    onClick={() => onChange([])}
                >
                    CLEAR
                </button>
            </div>
            <input
                className="px-3.5 py-2.5 border-none border-b border-b-zinc-700 text-[0.8125rem] [font-family:inherit] bg-zinc-900 text-zinc-100 outline-none"
                ref={searchRef}
                placeholder="filter…"
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
            <div className="max-h-[220px] p-1 overflow-y-auto">
                {filtered.length === 0
                    ? <div className="p-4 text-center text-zinc-400 text-xs">No matches</div>
                    : filtered.map(([v, l]) => {
                            const isSelected = selected.includes(v);
                            return (
                                <label
                                    key={String(v)}
                                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-[0.8125rem] cursor-pointer"
                                    style={{ background: isSelected ? 'var(--color-orange-20)' : 'var(--color-transparent)' }}
                                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--color-white-20)'; }}
                                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--color-transparent)'; }}
                                >
                                    <span
                                        className="flex items-center justify-center w-3.5 h-3.5 rounded-sm text-[0.625rem] text-white"
                                        style={{
                                            background: isSelected ? 'var(--color-orange-80)' : 'var(--color-transparent)',
                                            border: `1px solid ${isSelected ? 'var(--color-orange-80)' : 'var(--color-white-40)'}`,
                                        }}
                                    >
                                        {isSelected ? '✓' : ''}
                                    </span>
                                    <input
                                        checked={isSelected}
                                        className="hidden"
                                        type="checkbox"
                                        onChange={() => toggle(v)}
                                    />
                                    <span>{l}</span>
                                </label>
                            );
                        })}
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
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[0.6875rem] tracking-[0.22em] text-zinc-400">
                <span>BPM</span>
                <span className="tracking-[0.04em] tabular-nums" style={{ color: isDefault ? 'var(--color-white-60)' : 'var(--color-orange-80)' }}>
                    {lo}
                    –
                    {hi}
                </span>
            </div>
            <div className="relative flex items-center h-11">
                <div className="relative w-full h-1.5 rounded-sm bg-zinc-900" ref={trackRef}>
                    <div className="absolute top-0 bottom-0 rounded-sm bg-[var(--color-orange-80)]" style={{ left: `${pctL}%`, right: `${100 - pctH}%` }} />
                    {([['lo', pctL], ['hi', pctH]] as const).map(([k, p]) => (
                        <div
                            key={k}
                            className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-[var(--color-orange-80)] bg-white cursor-ew-resize"
                            aria-label={`BPM ${k === 'lo' ? 'minimum' : 'maximum'}`}
                            aria-valuemax={BPM_MAX}
                            aria-valuemin={BPM_MIN}
                            aria-valuenow={k === 'lo' ? lo : hi}
                            role="slider"
                            style={{ boxShadow: '0 2px 4px var(--color-black-40)', left: `${p}%`, transform: 'translate(-50%, -50%)' }}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                                    if (k === 'lo') onChange([Math.max(BPM_MIN, lo - 1), hi]);
                                    else onChange([lo, Math.max(lo + 1, hi - 1)]);
                                } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                                    if (k === 'lo') onChange([Math.min(hi - 1, lo + 1), hi]);
                                    else onChange([lo, Math.min(BPM_MAX, hi + 1)]);
                                }
                            }}
                            onMouseDown={onDrag(k)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function Row({ idx, isPlaying, pin, t }: { idx: number; isPlaying: boolean; pin: ReturnType<typeof usePinModal>; t: Track }) {
    const noMaster = !t.master;
    const onPlay = () => {
        if (!noMaster) PLAYER.load(t);
    };
    const slug = buildSlug(t.id, t.title);

    return (
        <div
            className={`catalog__row grid items-center gap-3.5 px-5 py-[clamp(0.875rem,calc(0.67rem+1.04vw),1.5rem)] text-sm transition-[background] duration-150 cursor-pointer ${isPlaying ? 'catalog__row--playing' : ''} ${noMaster ? 'catalog__row--disabled' : ''}`}
            role="button"
            style={{ borderTop: idx ? '1px solid var(--color-white-20)' : 'none', gridTemplateColumns: COL_TEMPLATE }}
            tabIndex={0}
            onClick={(e) => { onPlay(); (e.currentTarget as HTMLElement).blur(); }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onPlay();
                }
            }}
        >
            <div className="flex items-center justify-center">
                {isPlaying
                    ? <PlayingDots />
                    : t.star
                        ? <span className="text-[var(--color-gold)] text-[1.625rem] leading-none">★</span>
                        : t.heart
                            ? <span className="text-[var(--color-rose)] text-[1.5rem] leading-none">♥</span>
                            : null}
            </div>
            <span className="text-[0.8125rem] tracking-[0.04em] tabular-nums text-zinc-400">{t.id}</span>
            <div className="min-w-0 flex flex-col gap-[5px]">
                <div className={`catalog__track-title font-medium text-sm truncate tracking-[-0.005em] leading-[1.2] font-inter ${t.title ? 'text-zinc-100' : 'text-zinc-500 italic'}`}>
                    {t.title || ' '}
                </div>
                <div className="flex flex-wrap items-center gap-3.5 text-xs tracking-[0.02em] [font-family:var(--font-mono)] text-zinc-500">
                    {t.bpm.length > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                            <span className="text-[0.625rem] tracking-[0.18em] text-zinc-500">BPM</span>
                            <span className="tabular-nums">{t.bpm.join(' ')}</span>
                        </span>
                    )}
                    {t.key.length > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                            <span className="text-[0.625rem] tracking-[0.18em] text-zinc-500">KEY</span>
                            <span>{t.key.join(', ')}</span>
                        </span>
                    )}
                </div>
            </div>
            <span className="text-[0.8125rem] tabular-nums text-zinc-400">{t.title ? t.year : ''}</span>
            <span className="text-[0.8125rem] tabular-nums text-zinc-400">{t.title ? fmtDuration(t.duration) : ''}</span>
            <div className="flex gap-1.5 justify-start" aria-label="Download options" role="toolbar" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                <DLBtn disabled={!t.master} title={t.master ? 'Download WAV master' : 'No master available'} onClick={() => pin.open(t, 'master')}>WAV</DLBtn>
                <DLLink disabled={!t.master} href={`/audio/${slug}.mp3`} title="Download MP3">MP3</DLLink>
                <DLBtn disabled={!t.mixdown} title={t.mixdown ? 'Download mixdown' : 'No mixdown available'} onClick={() => { if (t.mixdown) pin.open(t, 'mixdown'); }}>MIX</DLBtn>
            </div>
        </div>
    );
}

function PlayingDots() {
    return (
        <div className="flex items-center gap-0.5 h-3.5">
            {[0, 1, 2, 3].map(i => (
                <div
                    key={i}
                    className="w-0.5 h-3.5 bg-[var(--color-orange-80)]"
                    style={{ animation: `player__vu-bounce 0.7s ease-in-out ${i * 0.1}s infinite`, transformOrigin: 'center' }}
                />
            ))}
        </div>
    );
}

function DLBtn({ children, disabled, title, onClick }: {
    children: React.ReactNode; disabled?: boolean; onClick: () => void; title?: string;
}) {
    return (
        <button
            className="catalog__dl-btn px-3.5 py-2 rounded-sm border border-zinc-700 font-medium text-[0.6875rem] tracking-[0.18em] [font-family:inherit] bg-transparent text-zinc-300 transition-all duration-150 cursor-pointer"
            disabled={disabled}
            title={title}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function DLLink({ children, disabled, href, title }: {
    children: React.ReactNode; disabled?: boolean; href: string; title?: string;
}) {
    if (disabled) {
        return (
            <span
                className="inline-block px-3.5 py-2 rounded-sm border border-zinc-700 font-medium text-[0.6875rem] tracking-[0.18em] no-underline bg-transparent text-zinc-300 opacity-40 cursor-not-allowed"
                title={title}
            >
                {children}
            </span>
        );
    }
    return (
        <a
            className="catalog__dl-btn inline-block px-3.5 py-2 rounded-sm border border-zinc-700 font-medium text-[0.6875rem] tracking-[0.18em] no-underline [font-family:inherit] bg-transparent text-zinc-300 transition-all duration-150 cursor-pointer"
            download
            href={href}
            title={title}
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
        <div className="flex flex-wrap items-center justify-between mt-7 text-xs tracking-[0.16em]">
            <span className="text-zinc-400">
                {list.total === 0 ? '0' : `${list.page * list.PAGE_SIZE + 1}–${Math.min((list.page + 1) * list.PAGE_SIZE, list.total)}`}
                {' OF '}
                {list.total}
            </span>
            <div className="flex gap-1">
                <PageBtn disabled={list.page === 0} onClick={() => list.setPage(Math.max(0, list.page - 1))}>‹</PageBtn>
                {showPages.map((p, i) => (
                    p === '…'
                        ? <span key={`e${i}`} className="px-2.5 py-2 text-zinc-500">…</span>
                        : <PageBtn key={p} active={p === list.page} onClick={() => list.setPage(p)}>{p + 1}</PageBtn>
                ))}
                <PageBtn disabled={list.page === list.pageCount - 1} onClick={() => list.setPage(Math.min(list.pageCount - 1, list.page + 1))}>›</PageBtn>
            </div>
        </div>
    );
}

function PageBtn({ children, active, disabled, onClick }: {
    active?: boolean; children: React.ReactNode; disabled?: boolean; onClick: () => void;
}) {
    return (
        <button
            className={`catalog__page-btn min-w-9 px-[13px] py-2 rounded-sm border border-zinc-700 font-medium text-xs [font-family:inherit] bg-transparent transition-all duration-150 cursor-pointer ${active ? 'catalog__page-btn--active' : ''} ${!active && !disabled ? 'text-zinc-400' : ''} ${disabled ? 'text-zinc-500' : ''}`}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
}
