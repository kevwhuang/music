import { Fragment, createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import gsap from 'gsap';

import { CatalogRow } from '@components/CatalogRow';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { IconChevron } from '@components/IconChevron';
import { IconHeart } from '@components/IconHeart';
import { IconSearch } from '@components/IconSearch';
import { IconStar } from '@components/IconStar';
import { buildSlug, categoryLabel } from '@lib/utils';
import { usePlayer } from '@lib/store';

type TrackListState = ReturnType<typeof useTrackList>;

interface CategoryFilters {
    music: boolean;
    productions: boolean;
    sessions: boolean;
}

interface FavoriteFilters {
    heart: boolean;
    star: boolean;
}

interface PinModalTarget {
    kind: 'master' | 'mixdown';
    track: Track;
}

interface SortConfig {
    dir: 'asc' | 'desc';
    field: 'bpm' | 'duration' | 'id' | 'key' | 'title' | 'year';
}

const BPM_MAX = 180;
const BPM_MIN = 50;
const ENTRANCE_DURATION = 0.5;
const ENTRANCE_Y = 30;
const FOCUS_DELAY = 50;
const PAGE_ADJACENT = 2;
const PAGE_SIZE = 50;
const PIN_SUCCESS_DELAY = 3_000;
const SORT_FALLBACK = 9_999;

const PinModalContext = createContext<PinModalActions | null>(null);

gsap.registerPlugin(ScrollTrigger);

function allKeys(tracks: Track[]): string[] {
    const keys = new Set<string>();

    for (const track of tracks) {
        for (const key of track.data.keys) {
            keys.add(key);
        }
    }

    return [...keys].sort();
}

function allYears(tracks: Track[]): number[] {
    const years = new Set<number>();

    for (const track of tracks) {
        years.add(track.data.year);
    }

    return [...years].sort((a, b) => a - b);
}

function downloadTrack(target: PinModalTarget) {
    const slug = buildSlug(target.track.id, target.track.data.title);
    const file = target.kind === 'master' ? `${slug}.wav` : `${slug}_mixdown.wav`;
    const link = document.createElement('a');

    link.href = `/audio/${file}`;
    link.download = file;
    link.click();
}

function usePinModal() {
    return useContext(PinModalContext)!;
}

function useTrackList(tracks: Track[]) {
    const [bpmRange, setBpmRange] = useState<[number, number]>([BPM_MIN, BPM_MAX]);
    const [categories, setCategories] = useState<CategoryFilters>({ music: true, productions: true, sessions: true });
    const [favorites, setFavorites] = useState<FavoriteFilters>({ heart: false, star: false });
    const [keys, setKeys] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<SortConfig>({ dir: 'asc', field: 'id' });
    const [years, setYears] = useState<number[]>([]);

    const filtered = useMemo(() => {
        let results = tracks.filter(track => categories[track.category]);

        if (query.trim()) {
            const needle = query.trim().toLowerCase();
            results = results.filter(track =>
                (track.data.title || '').toLowerCase().includes(needle)
                || track.id.toLowerCase().includes(needle),
            );
        }

        if (years.length) {
            results = results.filter(track => years.includes(track.data.year));
        }

        if (keys.length) {
            results = results.filter(track => track.data.keys.some(k => keys.includes(k)));
        }

        if (favorites.star && favorites.heart) {
            results = results.filter(track => track.flags.star || track.flags.heart);
        } else if (favorites.star) {
            results = results.filter(track => track.flags.star);
        } else if (favorites.heart) {
            results = results.filter(track => track.flags.heart);
        }

        results = results.filter((track) => {
            if (track.data.bpm === 0) {
                return bpmRange[0] === BPM_MIN && bpmRange[1] === BPM_MAX;
            }

            return track.data.bpm >= bpmRange[0] && track.data.bpm <= bpmRange[1];
        });

        const direction = sort.dir === 'asc' ? 1 : -1;

        results = [...results].sort((a, b) => {
            let valA: string | number;
            let valB: string | number;

            if (sort.field === 'title') {
                valA = (a.data.title || '~~~').toLowerCase();
                valB = (b.data.title || '~~~').toLowerCase();
            } else if (sort.field === 'year') {
                valA = a.data.year;
                valB = b.data.year;
            } else if (sort.field === 'duration') {
                valA = a.data.duration;
                valB = b.data.duration;
            } else if (sort.field === 'bpm') {
                valA = a.data.bpm || SORT_FALLBACK;
                valB = b.data.bpm || SORT_FALLBACK;
            } else if (sort.field === 'key') {
                valA = (a.data.keys[0]) || '~~~';
                valB = (b.data.keys[0]) || '~~~';
            } else {
                valA = a.id;
                valB = b.id;
            }

            if (valA < valB) return -direction;
            if (valA > valB) return direction;
            return 0;
        });

        return results;
    }, [bpmRange, categories, favorites, keys, query, sort, tracks, years]);

    useEffect(() => setPage(0), [bpmRange, categories, favorites, keys, query, sort, years]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return {
        PAGE_SIZE,
        bpmRange,
        categories,
        favorites,
        keys,
        page,
        pageCount,
        query,
        setBpmRange,
        setCategories,
        setFavorites,
        setKeys,
        setPage,
        setQuery,
        setSort,
        setYears,
        sort,
        total: filtered.length,
        visible,
        years,
    };
}

function BPMSlider({ value, onChange }: { value: [number, number]; onChange: (v: [number, number]) => void }) {
    const [low, high] = value;
    const trackRef = useRef<HTMLDivElement>(null);
    const handleDrag = (which: 'lo' | 'hi') => (e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent) => {
            if (!trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            const ratio = (ev.clientX - rect.left) / rect.width;
            const bpm = Math.round(BPM_MIN + Math.max(0, Math.min(1, ratio)) * (BPM_MAX - BPM_MIN));
            if (which === 'lo') onChange([Math.min(bpm, high - 1), high]);
            else onChange([low, Math.max(bpm, low + 1)]);
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };
    const percentLow = ((low - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100;
    const percentHigh = ((high - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100;
    const isDefault = low === BPM_MIN && high === BPM_MAX;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs tracking-[0.2em] text-zinc-400">
                <span>BPM</span>
                <span className="tabular-nums tracking-[0.04em]" style={{ color: isDefault ? 'var(--color-white-60)' : 'var(--color-orange-80)' }}>
                    {low}
                    –
                    {high}
                </span>
            </div>
            <div className="flex items-center relative h-12">
                <div className="relative h-1.5 w-full rounded-sm bg-zinc-900 select-none" ref={trackRef}>
                    <div className="absolute bottom-0 top-0 rounded-sm bg-orange-80" style={{ left: `${percentLow}%`, right: `${100 - percentHigh}%` }} />
                    {([['lo', percentLow], ['hi', percentHigh]] as const).map(([k, p]) => (
                        <div
                            className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 h-4 w-4 border-2 border-orange-80 rounded-full bg-white cursor-ew-resize touch-none"
                            aria-label={`BPM ${k === 'lo' ? 'minimum' : 'maximum'}`}
                            aria-valuemax={BPM_MAX}
                            aria-valuemin={BPM_MIN}
                            aria-valuenow={k === 'lo' ? low : high}
                            key={k}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                                    if (k === 'lo') onChange([Math.max(BPM_MIN, low - 1), high]);
                                    else onChange([low, Math.max(low + 1, high - 1)]);
                                } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                                    if (k === 'lo') onChange([Math.min(high - 1, low + 1), high]);
                                    else onChange([low, Math.min(BPM_MAX, high + 1)]);
                                }
                            }}
                            onPointerDown={handleDrag(k)}
                            role="slider"
                            style={{ boxShadow: '0 2px 4px var(--color-black-40)', left: `${p}%` }}
                            tabIndex={0}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function CatalogInner({ tracks }: { tracks: Track[] }) {
    const trackList = useTrackList(tracks);
    const pinModal = usePinModal();
    const player = usePlayer();
    const headingRef = useRef<HTMLDivElement>(null);
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!sectionRef.current) return;

        gsap.from(sectionRef.current, {
            duration: ENTRANCE_DURATION,
            ease: 'power3.out',
            opacity: 0,
            scrollTrigger: { start: 'top 60%', trigger: sectionRef.current },
            y: ENTRANCE_Y,
        });
    }, []);

    function handlePageChange(p: number) {
        if (p === trackList.page) return;
        trackList.setPage(p);
        if (headingRef.current) {
            const playerHeight = document.querySelector<HTMLElement>('[aria-label="Audio player"]')?.offsetHeight ?? 0;
            const top = headingRef.current.getBoundingClientRect().top + window.scrollY - playerHeight;
            window.scrollTo({ behavior: 'smooth', top });
        }
    }

    return (
        <section className="py-24 font-mono text-base" aria-label="Catalog" ref={sectionRef}>
            <div className="max-w-7xl mx-auto">
                <div className="flex items-baseline justify-between gap-6 mb-6 px-5" ref={headingRef}>
                    <h2 className="catalog__heading m-0 font-inter font-medium text-4xl tracking-[-0.025em]">
                        Catalog
                    </h2>
                    <span className="text-xl tracking-[0.02em] text-zinc-400" aria-live="polite">
                        {trackList.total}
                        {' of '}
                        {tracks.length}
                    </span>
                </div>
                <Filters list={trackList} tracks={tracks} />
                <div className="catalog__grid grid mb-6" aria-label="Track catalog" role="list">
                    <div className="catalog__row grid items-center gap-6 px-5 py-3 border border-zinc-800 text-xs tracking-[0.2em] bg-zinc-900 text-zinc-400">
                        <span aria-hidden="true" />
                        <SortHeader field="id" label="ID" list={trackList} />
                        <SortHeader field="title" label="TITLE" list={trackList} />
                        <SortHeader align="right" field="duration" label="LENGTH" list={trackList} />
                        <span className="pl-4 text-left">DOWNLOAD</span>
                    </div>
                    <div className="catalog__body col-span-full grid grid-cols-subgrid border border-t-0 border-zinc-800">
                        {trackList.visible.length === 0 && (
                            <div className="col-span-full p-16 text-base text-center text-zinc-400" aria-live="polite" role="status">
                                No tracks match the current filters.
                            </div>
                        )}
                        {trackList.visible.length > 0 && trackList.visible.map((track, i) => (
                            <CatalogRow index={i} isActive={player.trackId === track.id} isPlaying={player.trackId === track.id && player.playing} key={track.id} pinModal={pinModal} track={track} />
                        ))}
                    </div>
                </div>
                <Pagination list={trackList} setPage={handlePageChange} />
            </div>
        </section>
    );
}

function DownloadChip({ children, kind }: {
    children: React.ReactNode; kind: 'master' | 'mixdown';
}) {
    return (
        <div className="text-xs">
            <div className="mb-2 tracking-[0.2em] text-zinc-400">
                {kind === 'master' ? 'MASTER' : 'MIXDOWN'}
            </div>
            <div className="px-4 py-2.5 border border-zinc-700 break-all leading-tight text-zinc-100">
                {children}
            </div>
        </div>
    );
}

function FavoriteChip({ active, color, icon, label, onClick }: {
    active: boolean; color: string; icon: React.ReactNode; label: string; onClick: () => void;
}) {
    return (
        <button
            className={`catalog__favorite flex items-center justify-center h-9 w-9 border rounded-sm duration-150 transition-[background,border-color,color] cursor-pointer ${active ? '' : 'border-white-20'}`}
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
            style={{
                background: active ? color : 'var(--color-transparent)',
                borderColor: active ? color : undefined,
                color: active ? 'var(--color-black)' : color,
            }}
        >
            {icon}
        </button>
    );
}

function Filters({ list, tracks }: { list: TrackListState; tracks: Track[] }) {
    return (
        <div className="flex flex-col gap-4 mb-6 p-6 border border-zinc-800 rounded-sm bg-zinc-800">
            <div className="flex items-center gap-4">
                <div className="focus-within:border-orange-80 hover:border-orange-80 flex flex-1 items-center gap-3 px-4 py-2.5 border border-transparent rounded-sm bg-zinc-900 duration-150 transition-[border-color]">
                    <IconSearch />
                    <input
                        className="catalog__search flex-1 border-none text-base bg-transparent text-zinc-100 outline-none"
                        aria-label="Search by title or ID"
                        maxLength={100}
                        onChange={e => list.setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                e.stopPropagation();
                                list.setQuery('');
                            }
                        }}
                        placeholder="Search by ID or title"
                        type="text"
                        value={list.query}
                    />
                    {list.query && (
                        <button
                            className="active:opacity-70 hover:opacity-80 border-none text-sm bg-transparent text-zinc-400 cursor-pointer"
                            aria-label="Clear search"
                            onClick={() => list.setQuery('')}
                        >
                            ✕
                        </button>
                    )}
                </div>
                <div className="flex rounded-sm bg-zinc-900">
                    {(['music', 'sessions', 'productions'] as const).map((c, i) => (
                        <Fragment key={c}>
                            {i > 0 && <div className="w-px my-2 bg-zinc-700" aria-hidden="true" />}
                            <button
                                className={`catalog__category ${list.categories[c] ? 'catalog__category--active' : 'text-zinc-400'} px-4 py-2.5 border-0 text-sm tracking-[0.2em] duration-150 transition-[background,color,opacity] cursor-pointer`}
                                aria-pressed={list.categories[c]}
                                onClick={() => list.setCategories({ ...list.categories, [c]: !list.categories[c] })}
                            >
                                {categoryLabel(c).toUpperCase()}
                            </button>
                        </Fragment>
                    ))}
                </div>
                <div className="flex gap-2">
                    <FavoriteChip active={list.favorites.star} color="var(--color-gold)" icon={<IconStar />} label="Starred only" onClick={() => list.setFavorites({ ...list.favorites, star: !list.favorites.star })} />
                    <FavoriteChip active={list.favorites.heart} color="var(--color-rose)" icon={<IconHeart />} label="Hearted only" onClick={() => list.setFavorites({ ...list.favorites, heart: !list.favorites.heart })} />
                </div>
            </div>
            <div className="grid grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_240px] items-end gap-4">
                <MultiSelect label="YEAR" onChange={list.setYears} options={allYears(tracks).map(y => [y, String(y)] as [number, string])} placeholder="All" selected={list.years} />
                <MultiSelect label="KEY" onChange={list.setKeys} options={allKeys(tracks).map(k => [k, k] as [string, string])} placeholder="All" selected={list.keys} />
                <BPMSlider onChange={list.setBpmRange} value={list.bpmRange} />
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
            if (e.key === 'Escape') {
                setOpen(false);
                (document.activeElement as HTMLElement)?.blur();
            }
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);

        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    let summary: string;

    if (selected.length === 0) summary = placeholder;
    else if (selected.length <= 5) summary = options.filter(([k]) => selected.includes(k)).map(([, l]) => l).join(', ');
    else summary = `${selected.length} selected`;

    return (
        <div className="flex flex-col relative gap-2" ref={ref}>
            <span className="text-xs tracking-[0.2em] text-zinc-400">{label}</span>
            <button
                className={`active:opacity-70 focus-visible:outline-none flex items-center justify-between px-4 py-2.5 border rounded-sm text-base text-left bg-zinc-900 duration-150 transition-[border-color] cursor-pointer select-none ${open ? 'border-orange-80' : 'border-transparent hover:border-orange-80'}`}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label={`${label} filter`}
                onClick={() => setOpen(!open)}
                style={{ color: selected.length ? 'var(--color-white)' : 'var(--color-white-60)' }}
            >
                <span className="truncate">{summary}</span>
                <IconChevron open={open} />
            </button>
            {open && <MultiSelectPopover onChange={onChange} options={options} selected={selected} />}
        </div>
    );
}

function MultiSelectPopover<T extends string | number>({ options, selected, onChange }: {
    onChange: (v: T[]) => void; options: [T, string][]; selected: T[];
}) {
    const [search, setSearch] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    const filtered = options.filter(([, l]) => !search || l.toLowerCase().includes(search.toLowerCase()));
    function toggleSelection(v: T) {
        if (selected.includes(v)) onChange(selected.filter(val => val !== v));
        else onChange([...selected, v]);
    }

    return (
        <div className="catalog__dropdown absolute flex flex-col left-0 right-0 top-[calc(100%+4px)] z-20 border border-zinc-700 rounded-sm bg-zinc-800">
            <div className="flex items-center gap-2 px-3 py-2.5">
                <span className="flex-1 text-xs tracking-[0.2em] text-zinc-400">
                    {selected.length}
                    {' '}
                    selected
                </span>
                <button
                    className="active:opacity-70 hover:opacity-80 border-none text-xs tracking-[0.2em] bg-transparent cursor-pointer"
                    disabled={!selected.length}
                    onClick={() => onChange([])}
                    style={{ color: selected.length ? 'var(--color-orange-80)' : 'var(--color-white-40)' }}
                >
                    CLEAR
                </button>
            </div>
            <input
                className="catalog__dropdown-input focus-visible:outline-none focus:border-orange-80 hover:border-orange-80 px-4 py-2.5 border border-zinc-700 outline-none rounded-sm text-sm bg-zinc-900 text-zinc-100 duration-150 transition-[border-color]"
                aria-label="Filter options"
                maxLength={20}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter"
                ref={searchRef}
                type="text"
                value={search}
            />
            <ul className="overflow-y-auto max-h-[400px] m-0 p-1.5 list-none" role="listbox">
                {filtered.length === 0 && (
                    <li className="p-4 text-center text-sm text-zinc-400">No matches.</li>
                )}
                {filtered.length > 0 && filtered.map(([v, l]) => {
                    const isSelected = selected.includes(v);

                    return (
                        <li
                            aria-selected={isSelected}
                            key={String(v)}
                            role="option"
                        >
                            <label
                                className="flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm cursor-pointer"
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--color-white-20)'; }}
                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--color-transparent)'; }}
                                style={{ background: isSelected ? 'var(--color-orange-20)' : 'var(--color-transparent)' }}
                            >
                                <span
                                    className="flex items-center justify-center h-3.5 w-3.5 rounded-sm text-xs text-white"
                                    style={{
                                        background: isSelected ? 'var(--color-orange-80)' : 'var(--color-transparent)',
                                        border: `1px solid ${isSelected ? 'var(--color-orange-80)' : 'var(--color-zinc-500)'}`,
                                    }}
                                >
                                    {isSelected ? '✓' : ''}
                                </span>
                                <input
                                    className="hidden"
                                    checked={isSelected}
                                    onChange={() => toggleSelection(v)}
                                    type="checkbox"
                                />
                                <span>{l}</span>
                            </label>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function PageButton({ children, active, disabled, label, onClick }: {
    active?: boolean; children: React.ReactNode; disabled?: boolean; label: string; onClick: () => void;
}) {
    return (
        <button
            className={`catalog__page ${active ? 'catalog__page--active cursor-default' : ''} min-w-9 px-3 py-2 border border-zinc-700 rounded-sm font-medium text-sm bg-transparent ${!active && !disabled ? 'text-zinc-400' : ''} ${disabled ? 'text-zinc-500' : ''} duration-150 transition-[background,border-color,color,opacity] select-none ${!active && !disabled ? 'cursor-pointer' : ''}`}
            aria-label={label}
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
        if (i === 0 || i === total - 1 || Math.abs(i - list.page) <= PAGE_ADJACENT) showPages.push(i);
        else if (showPages[showPages.length - 1] !== '…') showPages.push('…');
    }

    return (
        <div className="flex items-center justify-between px-5 text-sm tracking-[0.2em]">
            <span className="text-zinc-400">
                {list.total === 0 ? '0' : `${list.page * list.PAGE_SIZE + 1}–${Math.min((list.page + 1) * list.PAGE_SIZE, list.total)}`}
                {' OF '}
                {list.total}
            </span>
            <div className="flex gap-1">
                <PageButton disabled={list.page === 0} label="Previous page" onClick={() => setPage(Math.max(0, list.page - 1))}><span className="leading-none text-base">‹</span></PageButton>
                {showPages.map((p, i) => {
                    if (p === '…') return <span className="px-3 py-2 text-zinc-500" key={`e${i}`}>…</span>;
                    return <PageButton active={p === list.page} key={p} label={`Page ${p + 1}`} onClick={() => setPage(p)}>{p + 1}</PageButton>;
                })}
                <PageButton disabled={list.page === list.pageCount - 1} label="Next page" onClick={() => setPage(Math.min(list.pageCount - 1, list.page + 1))}><span className="leading-none text-base">›</span></PageButton>
            </div>
        </div>
    );
}

function PinModalDialog({ close, inputRef, pin, setPin, state, submit, target }: {
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
    const titleId = useId();
    const slug = buildSlug(target.track.id, target.track.data.title);

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
            className="modal__overlay fixed flex inset-0 items-center justify-center z-40 backdrop-blur"
            aria-labelledby={titleId}
            aria-modal="true"
            role="dialog"
        >
            <button
                className="absolute inset-0 cursor-default"
                aria-label="Close dialog"
                onClick={state === 'success' ? undefined : close}
                tabIndex={-1}
                type="button"
            />
            <form
                className={`modal ${state === 'error' ? 'modal--shake' : ''} relative max-w-[90vw] w-[460px] p-8 text-zinc-100`}
                onSubmit={submit}
                ref={formRef}
            >
                <h2 id={titleId} className="mb-1 font-medium text-2xl tracking-[-0.01em]">
                    {target.track.data.title || '(untitled)'}
                </h2>
                <div className="mb-6 text-xs tracking-[0.2em] text-zinc-400">
                    {`${categoryLabel(target.track.category).toUpperCase()} · ${target.track.id} · ${target.track.data.year}${target.track.data.bpm > 0 ? ` · BPM ${target.track.data.bpm}${target.track.data.tempo ? ` ${target.track.data.tempo}` : ''}` : ''} · ${target.track.data.keys.map(k => k.toUpperCase().replace(/([A-G])B/g, '$1b')).join(', ')}`}
                </div>
                <div className="mb-6">
                    <DownloadChip kind={target.kind}>
                        {target.kind === 'master' ? `${slug}.wav` : `${slug}_mixdown.wav`}
                    </DownloadChip>
                </div>
                <label
                    className="block mb-2 text-xs tracking-[0.2em] text-zinc-400 cursor-pointer"
                    htmlFor={pinInputId}
                >
                    PIN
                </label>
                <input
                    id={pinInputId}
                    className={`modal__input ${state === 'error' ? 'modal__input--error' : ''} w-full mb-2 px-4 py-4 rounded-none text-2xl tracking-[0.5em] duration-150 transition-[border-color,box-shadow]`}
                    autoComplete="off"
                    maxLength={6}
                    onChange={e => setPin(e.target.value)}
                    placeholder=""
                    ref={inputRef}
                    type="password"
                    value={pin}
                />
                <div className="min-h-5 mb-6 text-xs" aria-live="polite" role="status" style={{ color: state === 'error' ? 'var(--color-red)' : state === 'success' ? 'var(--color-sage)' : 'var(--color-white-60)' }}>
                    {state === 'error' && 'Invalid pin.'}
                    {state === 'success' && 'Downloading…'}
                    {state === 'idle' && ' '}
                    {state === 'checking' && 'Verifying…'}
                </div>
                <div className="flex gap-2">
                    <button
                        className={`enabled:active:opacity-70 enabled:hover:opacity-90 flex-[2] px-4 py-2.5 border-none font-medium text-sm tracking-[0.2em] text-white duration-150 transition-[background,opacity] ${state === 'checking' || state === 'success' ? 'opacity-60' : ''}`}
                        disabled={state === 'checking' || state === 'success'}
                        style={{
                            background: 'var(--color-orange-80)',
                            cursor: state === 'checking' || state === 'success' ? 'not-allowed' : 'pointer',
                        }}
                        type="submit"
                    >
                        {state === 'checking' ? 'VERIFYING…' : 'DOWNLOAD'}
                    </button>
                    <button
                        className={`enabled:active:opacity-70 enabled:hover:bg-white-20 enabled:hover:border-orange-80 enabled:hover:text-orange-80 flex-1 px-4 py-2.5 border border-zinc-700 text-sm tracking-[0.2em] bg-transparent text-zinc-400 duration-150 transition-[background,border-color,color,opacity] ${state === 'success' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        disabled={state === 'success'}
                        onClick={close}
                        type="button"
                    >
                        CANCEL
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

    function close() {
        setTarget(null);
        setPin('');
        setState('idle');
        triggerRef.current?.focus();
        triggerRef.current = null;
    }

    function open(track: Track, kind: 'master' | 'mixdown') {
        triggerRef.current = document.activeElement as HTMLElement;
        setTarget({ kind, track });
        setPin('');
        setState('idle');
    }

    async function handleSubmit(e?: React.FormEvent<HTMLFormElement>) {
        e?.preventDefault();
        if (!target || state === 'checking') return;

        setState('checking');

        try {
            const res = await fetch('/api/verify-pin', {
                body: JSON.stringify({ pin }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            });
            const { ok } = await res.json();

            if (!ok) {
                setState('error');
                return;
            }

            setState('success');
            downloadTrack(target);
            setTimeout(close, PIN_SUCCESS_DELAY);
        } catch {
            setState('error');
        }
    }

    useEffect(() => {
        if (target) setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY);
    }, [target]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && target && state !== 'success') close();
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [target, close]);

    return (
        <PinModalContext.Provider value={{ close, open }}>
            {children}
            {target && (
                <PinModalDialog
                    close={close}
                    inputRef={inputRef}
                    pin={pin}
                    setPin={setPin}
                    state={state}
                    submit={handleSubmit}
                    target={target}
                />
            )}
        </PinModalContext.Provider>
    );
}

function SortHeader({ align, field, label, list }: { align?: 'right'; field: SortConfig['field']; label: string; list: TrackListState }) {
    const active = list.sort.field === field;

    return (
        <span className={align === 'right' ? 'text-right' : ''}>
            <button
                className={`catalog__sort ${active ? 'catalog__sort--active' : ''} inline-flex items-center gap-1 border-none bg-transparent duration-150 transition-[color] cursor-pointer ${active ? '' : 'text-zinc-400'}`}
                aria-label={active ? `Sort by ${label.toLowerCase()}, ${list.sort.dir === 'asc' ? 'ascending' : 'descending'}` : `Sort by ${label.toLowerCase()}`}
                onClick={() => {
                    if (list.sort.field !== field) list.setSort({ dir: 'asc', field });
                    else if (list.sort.dir === 'asc') list.setSort({ dir: 'desc', field });
                    else list.setSort({ dir: 'asc', field: 'id' });
                }}
            >
                {label}
                {active && (
                    <span className="leading-none text-xs">{list.sort.dir === 'asc' ? '▲' : '▼'}</span>
                )}
            </button>
        </span>
    );
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
