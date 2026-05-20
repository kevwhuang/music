import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';

import { buildSlug, categoryLabel, fmtDuration } from '@lib/utils';
import { usePlayer } from '@lib/store';
import { CatalogRow } from '@components/CatalogRow';
import { ChevronIcon } from '@components/ChevronIcon';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { HeartIcon } from '@components/HeartIcon';
import { SearchIcon } from '@components/SearchIcon';
import { StarIcon } from '@components/StarIcon';

interface CategoryFilters {
    music: boolean;
    productions: boolean;
    sessions: boolean;
}

interface FavoriteFilters {
    heart: boolean;
    star: boolean;
}

interface PinModalActions {
    close: () => void;
    open: (track: Track, kind: 'master' | 'mixdown') => void;
}

interface PinModalTarget {
    kind: 'master' | 'mixdown';
    track: Track;
}

interface SortConfig {
    dir: 'asc' | 'desc';
    field: string;
}

type TrackListState = ReturnType<typeof useTrackList>;

const BPM_MAX = 180;
const BPM_MIN = 50;

const PAGE_SIZE = 50;
const PinModalContext = createContext<PinModalActions | null>(null);

function allKeys(tracks: Track[]): string[] {
    const keys = new Set<string>();

    for (const track of tracks) {
        for (const key of track.key) {
            keys.add(key);
        }
    }

    return [...keys].sort();
}

function allYears(tracks: Track[]): number[] {
    const years = new Set<number>();

    for (const track of tracks) {
        years.add(track.year);
    }

    return [...years].sort((a, b) => a - b);
}

function bpmNum(bpm: string[]): number | null {
    const value = parseInt(bpm[0], 10);
    return Number.isFinite(value) ? value : null;
}

function BPMSlider({ value, onChange }: { value: [number, number]; onChange: (v: [number, number]) => void }) {
    const [lo, hi] = value;
    const trackRef = useRef<HTMLDivElement>(null);
    const onDrag = (which: 'lo' | 'hi') => (e: React.MouseEvent) => {
        e.preventDefault();
        const move = (ev: MouseEvent) => {
            if (!trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            const ratio = (ev.clientX - rect.left) / rect.width;
            const bpm = Math.round(BPM_MIN + Math.max(0, Math.min(1, ratio)) * (BPM_MAX - BPM_MIN));
            if (which === 'lo') onChange([Math.min(bpm, hi - 1), hi]);
            else onChange([lo, Math.max(bpm, lo + 1)]);
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

function CatalogInner({ tracks }: { tracks: Track[] }) {
    const list = useTrackList(tracks);
    const pin = usePinModal();
    const player = usePlayer();
    const sectionRef = useRef<HTMLElement>(null);

    const setPage = (p: number) => {
        list.setPage(p);
        sectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <section ref={sectionRef} className="px-10 py-48 font-mono text-sm">
            <div className="max-w-[92.5rem] mx-auto">
                <div className="flex items-baseline justify-between gap-6 mb-8">
                    <h2 className="catalog__heading m-0 font-medium font-inter text-4xl tracking-[-0.025em]">
                        Catalog
                    </h2>
                    <span className="text-xl tracking-[0.02em] [font-family:var(--font-mono)] text-zinc-400">
                        {list.total}
                        {' of '}
                        {tracks.length}
                    </span>
                </div>
                <Filters list={list} tracks={tracks} />
                <div className="catalog__row grid items-center gap-3.5 px-5 py-3.5 mt-6 border border-zinc-800 text-[0.6875rem] tracking-[0.22em] bg-zinc-900 text-zinc-400">
                    <span />
                    <SortHeader field="id" label="ID" list={list} />
                    <SortHeader field="title" label="TITLE" list={list} />
                    <SortHeader field="year" label="YEAR" list={list} />
                    <SortHeader field="duration" label="LENGTH" list={list} />
                    <span className="text-left">DOWNLOAD</span>
                </div>
                <div className="border border-zinc-800 border-t-0">
                    {list.visible.length === 0
                        ? (
                                <div className="p-20 text-center text-sm text-zinc-400">
                                    No tracks match the current filter chain.
                                </div>
                            )
                        : list.visible.map((t, i) => (
                                <CatalogRow key={t.id} idx={i} isPlaying={player.trackId === t.id} pin={pin} t={t} />
                            ))}
                </div>
                <Pagination list={list} setPage={setPage} />
            </div>
        </section>
    );
}

function DLChip({ active, children, disabled, kind }: {
    active: boolean; children: React.ReactNode; disabled?: boolean; kind: string;
}) {
    return (
        <div
            className="px-3 py-2.5 rounded-none text-[0.6875rem]"
            style={{
                background: active ? 'var(--color-white-20)' : 'var(--color-transparent)',
                border: `1px solid ${active ? 'var(--color-orange-80)' : 'var(--color-white-20)'}`,
                opacity: disabled ? 0.4 : 1,
            }}
        >
            <div className="mb-1 tracking-[0.18em] text-zinc-400">
                {kind === 'master' ? 'MASTER' : 'MIXDOWN'}
            </div>
            <div className="text-zinc-100 break-all leading-[1.3]">
                {children}
            </div>
        </div>
    );
}

function FavChip({ active, color, icon, title, onClick }: {
    active: boolean; color: string; icon: React.ReactNode; onClick: () => void; title: string;
}) {
    return (
        <button
            className="catalog__fav-btn flex items-center justify-center w-11 h-11 rounded-sm transition-all duration-150 cursor-pointer"
            style={{
                background: active ? color : 'var(--color-transparent)',
                border: `1px solid ${active ? color : 'var(--color-white-20)'}`,
                color: active ? 'var(--color-black)' : color,
            }}
            title={title}
            onClick={onClick}
        >
            {icon}
        </button>
    );
}

function Filters({ list, tracks }: { list: TrackListState; tracks: Track[] }) {
    return (
        <div className="flex flex-col gap-5 p-7 rounded-sm border border-zinc-800 bg-zinc-800">
            <div className="flex items-center gap-3.5">
                <div className="flex flex-1 items-center gap-3 px-4 py-3 rounded-sm bg-zinc-900">
                    <SearchIcon />
                    <input
                        className="flex-1 border-none text-sm [font-family:inherit] bg-transparent text-zinc-100 outline-none"
                        placeholder="search by title or id"
                        type="text"
                        value={list.query}
                        onChange={e => list.setQuery(e.target.value)}
                    />
                    {list.query && (
                        <button
                            aria-label="Clear search"
                            className="border-none text-[0.8125rem] [font-family:inherit] bg-none text-zinc-400 cursor-pointer"
                            onClick={() => list.setQuery('')}
                        >
                            ✕
                        </button>
                    )}
                </div>
                <div className="flex rounded-sm bg-zinc-900">
                    {(['music', 'sessions', 'productions'] as const).map(c => (
                        <button
                            key={c}
                            className={`catalog__category-btn px-[1.125rem] py-3 border-0 text-xs tracking-[0.16em] [font-family:inherit] transition-all duration-150 cursor-pointer ${list.cats[c] ? 'catalog__category-btn--active' : 'text-zinc-400'}`}
                            onClick={() => list.setCats({ ...list.cats, [c]: !list.cats[c] })}
                        >
                            {categoryLabel(c).toUpperCase()}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <FavChip active={list.favs.star} color="var(--color-gold)" icon={<StarIcon />} title="Starred only" onClick={() => list.setFavs({ ...list.favs, star: !list.favs.star })} />
                    <FavChip active={list.favs.heart} color="var(--color-rose)" icon={<HeartIcon />} title="Hearted only" onClick={() => list.setFavs({ ...list.favs, heart: !list.favs.heart })} />
                </div>
            </div>
            <div className="grid grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_240px] items-end gap-[1.125rem]">
                <MultiSelect label="YEAR" options={allYears(tracks).map(y => [y, String(y)] as [number, string])} placeholder="All" selected={list.years} onChange={list.setYears} />
                <MultiSelect label="KEY" options={allKeys(tracks).map(k => [k, k] as [string, string])} placeholder="All" selected={list.keys} onChange={list.setKeys} />
                <BPMSlider value={list.bpmRange} onChange={list.setBpmRange} />
            </div>
        </div>
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
                className={`flex items-center justify-between px-3.5 py-[11px] rounded-sm border text-sm text-left [font-family:inherit] bg-zinc-900 transition-[border-color] duration-150 cursor-pointer ${open ? 'border-zinc-500' : 'border-transparent'}`}
                style={{ color: selected.length ? 'var(--color-white)' : 'var(--color-white-40)' }}
                onClick={() => setOpen(!open)}
            >
                <span className="truncate">{summary}</span>
                <span className="flex items-center gap-2">
                    {selected.length > 0 && (
                        <button
                            aria-label="Clear selection"
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
                    <ChevronIcon open={open} />
                </span>
            </button>
            {open && <MultiSelectPopover options={options} selected={selected} onChange={onChange} />}
        </div>
    );
}

function MultiSelectPopover<T extends string | number>({ options, selected, onChange }: {
    onChange: (v: T[]) => void; options: [T, string][]; selected: T[];
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
        <div className="catalog__dropdown absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex flex-col max-h-80 rounded-sm border border-zinc-700 bg-zinc-800">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-700">
                <span className="flex-1 text-[0.625rem] tracking-[0.22em] text-zinc-400">
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
                placeholder="filter"
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
                                            border: `1px solid ${isSelected ? 'var(--color-orange-80)' : 'var(--color-zinc-500)'}`,
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

function Pagination({ list, setPage }: { list: TrackListState; setPage: (p: number) => void }) {
    const showPages: (number | '…')[] = [];
    const total = list.pageCount;
    for (let i = 0; i < total; i++) {
        if (i === 0 || i === total - 1 || Math.abs(i - list.page) <= 2) showPages.push(i);
        else if (showPages[showPages.length - 1] !== '…') showPages.push('…');
    }

    return (
        <div className="flex items-center justify-between mt-7 text-xs tracking-[0.16em]">
            <span className="text-zinc-400">
                {list.total === 0 ? '0' : `${list.page * list.PAGE_SIZE + 1}–${Math.min((list.page + 1) * list.PAGE_SIZE, list.total)}`}
                {' OF '}
                {list.total}
            </span>
            <div className="flex gap-1">
                <PageBtn disabled={list.page === 0} onClick={() => setPage(Math.max(0, list.page - 1))}>‹</PageBtn>
                {showPages.map((p, i) => (
                    p === '…'
                        ? <span key={`e${i}`} className="px-2.5 py-2 text-zinc-500">…</span>
                        : <PageBtn key={p} active={p === list.page} onClick={() => setPage(p)}>{p + 1}</PageBtn>
                ))}
                <PageBtn disabled={list.page === list.pageCount - 1} onClick={() => setPage(Math.min(list.pageCount - 1, list.page + 1))}>›</PageBtn>
            </div>
        </div>
    );
}

function PinModalChrome({ close, inputRef, pin, setPin, state, submit, target }: {
    close: () => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
    pin: string;
    setPin: (v: string) => void;
    state: 'checking' | 'error' | 'idle' | 'success';
    submit: (e?: React.FormEvent<HTMLFormElement>) => void;
    target: PinModalTarget;
}) {
    const formRef = useRef<HTMLFormElement>(null);
    const pinInputId = useId();
    const slug = buildSlug(target.track.id, target.track.title);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab' || !formRef.current) return;

            const focusable = formRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');

            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <div
            className="pin-modal__overlay fixed inset-0 z-[1000] flex items-center justify-center"
            aria-modal="true"
            role="dialog"
        >
            <button
                className="absolute inset-0 cursor-default"
                aria-label="Close dialog"
                tabIndex={-1}
                type="button"
                onClick={close}
            />
            <form
                className={`pin-modal relative w-[460px] max-w-[90vw] px-8 py-7 text-zinc-100 ${state === 'error' ? 'pin-modal--shake' : ''}`}
                ref={formRef}
                onSubmit={submit}
            >
                <div className="flex justify-between mb-5 text-[0.6875rem] tracking-[0.18em] text-zinc-400">
                    <span>AUTHORIZATION</span>
                    <button
                        className="border-none text-[0.6875rem] [font-family:inherit] bg-none text-zinc-400 cursor-pointer"
                        type="button"
                        onClick={close}
                    >
                        ESC
                    </button>
                </div>
                <div className="mb-1 font-medium text-[1.375rem] tracking-[-0.01em]">
                    {target.track.title || '(untitled)'}
                </div>
                <div className="mb-6 text-xs text-zinc-400">
                    {`${target.track.id} · ${fmtDuration(target.track.duration)} · ${target.track.bpm.join('/')} BPM · ${target.track.key.join(', ')}`}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-5">
                    <DLChip active={target.kind === 'master'} kind="master">
                        {slug}
                        .wav
                    </DLChip>
                    <DLChip active={target.kind === 'mixdown'} disabled={!target.track.mixdown} kind="mixdown">
                        {target.track.mixdown ? `${slug}_mixdown.wav` : 'no mixdown'}
                    </DLChip>
                </div>
                <label
                    className="block mb-2 text-[0.6875rem] tracking-[0.18em] text-zinc-400"
                    htmlFor={pinInputId}
                >
                    AUTHORIZATION
                </label>
                <input
                    className={`pin-modal__input w-full px-4 py-3.5 rounded-none font-mono text-[1.375rem] tracking-[0.5em] transition-[border-color,box-shadow] duration-150 ${state === 'error' ? 'pin-modal__input--error' : ''}`}
                    autoComplete="off"
                    id={pinInputId}
                    maxLength={6}
                    placeholder="• • • •"
                    ref={inputRef}
                    type="password"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                />
                <div className="min-h-[18px] mt-2 text-[0.6875rem]" style={{ color: state === 'error' ? 'var(--color-red)' : state === 'success' ? 'var(--color-sage)' : 'var(--color-white-60)' }}>
                    {state === 'error' && 'Invalid pin'}
                    {state === 'success' && '✓ Verified — generating signed url'}
                    {state === 'idle' && ' '}
                    {state === 'checking' && 'Verifying…'}
                </div>
                <div className="flex gap-2 mt-5">
                    <button
                        className="flex-1 px-4 py-3 border border-zinc-700 text-xs tracking-[0.18em] [font-family:inherit] bg-transparent text-zinc-400 cursor-pointer"
                        type="button"
                        onClick={close}
                    >
                        CANCEL
                    </button>
                    <button
                        className="flex-[2] px-4 py-3 border-none font-medium text-xs tracking-[0.18em] [font-family:inherit] text-white transition-[background,opacity] duration-150"
                        disabled={state === 'checking' || state === 'success'}
                        style={{
                            background: state === 'success' ? 'var(--color-sage-40)' : 'var(--color-orange-80)',
                            cursor: state === 'checking' ? 'wait' : 'pointer',
                            opacity: state === 'checking' ? 0.6 : 1,
                        }}
                        type="submit"
                    >
                        {state === 'success' ? '✓ DOWNLOAD READY' : state === 'checking' ? 'VERIFYING…' : 'DOWNLOAD'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function PinModalProvider({ children }: { children: React.ReactNode }) {
    const [target, setTarget] = useState<PinModalTarget | null>(null);
    const [pin, setPin] = useState('');
    const [state, setState] = useState<'checking' | 'error' | 'idle' | 'success'>('idle');
    const inputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLElement | null>(null);

    const close = () => {
        setTarget(null);
        setPin('');
        setState('idle');
        triggerRef.current?.focus();
        triggerRef.current = null;
    };

    const open = (track: Track, kind: 'master' | 'mixdown') => {
        triggerRef.current = document.activeElement as HTMLElement;
        setTarget({ kind, track });
        setPin('');
        setState('idle');
    };

    useEffect(() => {
        if (target) setTimeout(() => inputRef.current?.focus(), 50);
    }, [target]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && target) close();
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [target, close]);

    const submit = (e?: React.FormEvent<HTMLFormElement>) => {
        e?.preventDefault();
        setState('checking');
        setTimeout(() => {
            if (/^\d{4}$/.test(pin)) {
                setState('success');
                setTimeout(() => close(), 1400);
            } else {
                setState('error');
            }
        }, 600);
    };

    return (
        <PinModalContext.Provider value={{ close, open }}>
            {children}
            {target && (
                <PinModalChrome
                    close={close}
                    inputRef={inputRef}
                    pin={pin}
                    setPin={setPin}
                    state={state}
                    submit={submit}
                    target={target}
                />
            )}
        </PinModalContext.Provider>
    );
}

function SortHeader({ field, label, list }: { field: string; label: string; list: TrackListState }) {
    const active = list.sort.field === field;

    return (
        <button
            className={`catalog__sort-btn inline-flex items-center gap-[5px] border-none bg-transparent [font-family:inherit] transition-[color] duration-150 cursor-pointer select-none ${active ? 'text-[var(--color-orange-80)]' : 'text-zinc-400'}`}
            onClick={() => {
                if (list.sort.field !== field) list.setSort({ dir: 'asc', field });
                else if (list.sort.dir === 'asc') list.setSort({ dir: 'desc', field });
                else list.setSort({ dir: 'asc', field: 'id' });
            }}
        >
            {label}
            {active && (
                <span className="text-[0.5rem] transition-transform duration-150" style={{ transform: list.sort.dir === 'desc' ? 'rotate(180deg)' : 'none' }}>▲</span>
            )}
        </button>
    );
}

function usePinModal() {
    return useContext(PinModalContext)!;
}

function useTrackList(tracks: Track[]) {
    const [bpmRange, setBpmRange] = useState<[number, number]>([BPM_MIN, BPM_MAX]);
    const [cats, setCats] = useState<CategoryFilters>({ music: true, productions: true, sessions: true });
    const [favs, setFavs] = useState<FavoriteFilters>({ heart: false, star: false });
    const [keys, setKeys] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<SortConfig>({ dir: 'asc', field: 'id' });
    const [years, setYears] = useState<number[]>([]);

    const filtered = useMemo(() => {
        let results = tracks.filter(t => cats[t.category]);

        if (query.trim()) {
            const needle = query.trim().toLowerCase();
            results = results.filter(t =>
                (t.title || '').toLowerCase().includes(needle)
                || t.id.toLowerCase().includes(needle),
            );
        }

        if (years.length) {
            results = results.filter(t => years.includes(t.year));
        }

        if (keys.length) {
            results = results.filter(t => t.key.some(k => keys.includes(k)));
        }

        if (favs.star && favs.heart) {
            results = results.filter(t => t.star || t.heart);
        } else if (favs.star) {
            results = results.filter(t => t.star);
        } else if (favs.heart) {
            results = results.filter(t => t.heart);
        }

        results = results.filter((t) => {
            const value = bpmNum(t.bpm);

            if (value === null) {
                return bpmRange[0] === BPM_MIN && bpmRange[1] === BPM_MAX;
            }

            return value >= bpmRange[0] && value <= bpmRange[1];
        });

        const direction = sort.dir === 'asc' ? 1 : -1;

        results = [...results].sort((a, b) => {
            let valA: string | number, valB: string | number;

            if (sort.field === 'title') {
                valA = (a.title || '~~~').toLowerCase();
                valB = (b.title || '~~~').toLowerCase();
            } else if (sort.field === 'year') {
                valA = a.year;
                valB = b.year;
            } else if (sort.field === 'duration') {
                valA = a.duration;
                valB = b.duration;
            } else if (sort.field === 'bpm') {
                valA = bpmNum(a.bpm) ?? 9999;
                valB = bpmNum(b.bpm) ?? 9999;
            } else if (sort.field === 'key') {
                valA = (a.key[0]) || '~~~';
                valB = (b.key[0]) || '~~~';
            } else {
                valA = a.id;
                valB = b.id;
            }

            return valA < valB ? -direction : valA > valB ? direction : 0;
        });

        return results;
    }, [bpmRange, cats, favs, keys, query, sort, tracks, years]);

    useEffect(() => setPage(0), [bpmRange, cats, favs, keys, query, sort, years]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return {
        PAGE_SIZE,
        bpmRange, setBpmRange,
        cats, setCats,
        favs, setFavs,
        filtered,
        keys, setKeys,
        page, setPage,
        pageCount,
        query, setQuery,
        sort, setSort,
        total: filtered.length,
        visible,
        years, setYears,
    };
}

export default function Catalog({ tracks }: { tracks: Track[] }) {
    return (
        <ErrorBoundary>
            <PinModalProvider>
                <CatalogInner tracks={tracks} />
            </PinModalProvider>
        </ErrorBoundary>
    );
}
