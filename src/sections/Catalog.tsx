import gsap from 'gsap';
import { Fragment, createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { CatalogRow } from '@components/CatalogRow';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { IconChevron } from '@components/IconChevron';
import { IconHeart } from '@components/IconHeart';
import { IconSearch } from '@components/IconSearch';
import { IconStar } from '@components/IconStar';
import { buildSlug, categoryLabel, formatDetails } from '@lib/utils';
import { usePlayer } from '@lib/store';

type CategoryFilter = Record<Track['category'], boolean>;

type FavoriteFilter = {
    heart: boolean;
    star: boolean;
};

type PinModalTarget = {
    kind: 'master' | 'mixdown';
    track: Track;
};

type SortConfig = {
    direction: 'asc' | 'desc';
    field: 'duration' | 'id' | 'title';
};

type TrackListState = ReturnType<typeof useTrackList>;

const BPM_MAX = 180;
const BPM_MIN = 50;
const ENTRANCE_DURATION = 0.5;
const ENTRANCE_Y = 30;
const FOCUS_DELAY = 50;
const MAX_INLINE_SELECTED = 5;
const PAGE_ADJACENT = 2;
const PAGE_SIZE = 50;
const PIN_MIN_DELAY = 500;
const PIN_SUCCESS_DELAY = 3_000;
const SORT_LAST = '\uffff';

const PinModalContext = createContext<PinModalActions | null>(null);

function allKeys(tracks: Track[]) {
    const keys = new Set<string>();

    for (const track of tracks) {
        for (const key of track.data.keys) {
            keys.add(key);
        }
    }

    return [...keys].sort();
}

function allYears(tracks: Track[]) {
    const years = new Set<number>();

    for (const track of tracks) {
        years.add(track.data.year);
    }

    return [...years].sort((a, b) => a - b);
}

function downloadTrack(target: PinModalTarget) {
    const link = document.createElement('a');
    const slug = buildSlug(target.track.id, target.track.data.title);

    const file = target.kind === 'master' ? `${slug}.wav` : `${slug}_mixdown.wav`;

    link.download = file;
    link.href = `/audio/${file}`;
    link.click();
}

function filterTracks(
    tracks: Track[],
    { bpmRange, categories, favorites, keys, query, sort, years }: {
        bpmRange: [number, number]; categories: CategoryFilter; favorites: FavoriteFilter;
        keys: string[]; query: string; sort: SortConfig; years: number[];
    },
) {
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
        results = results.filter(track => track.data.keys.some(key => keys.includes(key)));
    }

    if (favorites.heart) {
        results = results.filter(track => track.flags.heart);
    }

    if (favorites.star) {
        results = results.filter(track => track.flags.star);
    }

    results = results.filter((track) => {
        if (track.data.bpm === 0) {
            return bpmRange[0] === BPM_MIN && bpmRange[1] === BPM_MAX;
        }

        return track.data.bpm >= bpmRange[0] && track.data.bpm <= bpmRange[1];
    });

    const direction = sort.direction === 'asc' ? 1 : -1;

    results = [...results].sort((a, b) => {
        let valueA: number | string;
        let valueB: number | string;

        if (sort.field === 'duration') {
            valueA = a.data.duration;
            valueB = b.data.duration;
        } else if (sort.field === 'id') {
            valueA = a.id;
            valueB = b.id;
        } else {
            valueA = (a.data.title || SORT_LAST).toLowerCase();
            valueB = (b.data.title || SORT_LAST).toLowerCase();
        }

        if (valueA < valueB) return -direction;
        if (valueA > valueB) return direction;
        return 0;
    });

    return results;
}

function usePinModal() {
    return useContext(PinModalContext) as PinModalActions;
}

function useTrackList(tracks: Track[]) {
    const [bpmRange, setBpmRange] = useState<[number, number]>([BPM_MIN, BPM_MAX]);
    const [categories, setCategories] = useState<CategoryFilter>({ music: true, productions: true, sessions: true });
    const [favorites, setFavorites] = useState<FavoriteFilter>({ heart: false, star: false });
    const [keys, setKeys] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<SortConfig>({ direction: 'asc', field: 'id' });
    const [years, setYears] = useState<number[]>([]);

    const filtered = useMemo(
        () => filterTracks(tracks, { bpmRange, categories, favorites, keys, query, sort, years }),
        [bpmRange, categories, favorites, keys, query, sort, tracks, years],
    );

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    useEffect(() => setPage(0), [bpmRange, categories, favorites, keys, query, sort, years]);

    return {
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

function BPMSlider({ onChange, value }: {
    onChange: (value: [number, number]) => void; value: [number, number];
}) {
    const [low, high] = value;
    const trackRef = useRef<HTMLDivElement>(null);

    const isDefault = low === BPM_MIN && high === BPM_MAX;
    const percentHigh = ((high - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100;
    const percentLow = ((low - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100;

    function handleKeyDown(end: 'lo' | 'hi', e: React.KeyboardEvent) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            if (end === 'lo') onChange([Math.max(BPM_MIN, low - 1), high]);
            else onChange([low, Math.max(low + 1, high - 1)]);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            if (end === 'lo') onChange([Math.min(high - 1, low + 1), high]);
            else onChange([low, Math.min(BPM_MAX, high + 1)]);
        }
    }

    function handlePointerDown(end: 'lo' | 'hi', e: React.PointerEvent) {
        function move(e: PointerEvent) {
            if (!trackRef.current) return;

            const rect = trackRef.current.getBoundingClientRect();

            const ratio = (e.clientX - rect.left) / rect.width;

            const bpm = Math.round(BPM_MIN + Math.max(0, Math.min(1, ratio)) * (BPM_MAX - BPM_MIN));

            if (end === 'lo') onChange([Math.min(bpm, high - 1), high]);
            else onChange([low, Math.max(bpm, low + 1)]);
        }

        function up() {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        }

        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs tracking-[0.2em] text-zinc-400">
                <span>BPM</span>
                <span className={`tabular-nums tracking-[0.04em] ${isDefault ? 'text-white-60' : 'text-orange-80'}`}>
                    {low}
                    &ndash;
                    {high}
                </span>
            </div>
            <div className="flex items-center relative h-12">
                <div
                    className="relative h-1.5 w-full rounded-sm bg-zinc-900 select-none"
                    ref={trackRef}
                >
                    <div className="absolute bottom-0 top-0 rounded-sm bg-orange-80" style={{ left: `${percentLow}%`, right: `${100 - percentHigh}%` }} />
                    {(['lo', 'hi'] as const).map(end => (
                        <div
                            className="absolute top-1/2 h-4 w-4 border-2 border-orange-80 rounded-full bg-white -translate-x-1/2 -translate-y-1/2 shadow-[0_2px_4px_var(--color-black-40)] cursor-ew-resize touch-none"
                            aria-label={`BPM ${end === 'lo' ? 'minimum' : 'maximum'}`}
                            aria-valuemax={BPM_MAX}
                            aria-valuemin={BPM_MIN}
                            aria-valuenow={end === 'lo' ? low : high}
                            key={end}
                            onKeyDown={e => handleKeyDown(end, e)}
                            onPointerDown={e => handlePointerDown(end, e)}
                            role="slider"
                            style={{ left: `${end === 'lo' ? percentLow : percentHigh}%` }}
                            tabIndex={0}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function CatalogInner({ tracks }: { tracks: Track[] }) {
    const headingRef = useRef<HTMLDivElement>(null);
    const pinModal = usePinModal();
    const player = usePlayer();
    const sectionRef = useRef<HTMLElement>(null);
    const trackList = useTrackList(tracks);

    function handlePageChange(page: number) {
        if (page === trackList.page) return;

        trackList.setPage(page);

        if (headingRef.current) {
            const playerHeight = document.querySelector<HTMLElement>('[aria-label="Audio player"]')?.offsetHeight ?? 0;

            const top = headingRef.current.getBoundingClientRect().top + window.scrollY - playerHeight;

            window.scrollTo({ behavior: 'smooth', top });
        }
    }

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

    return (
        <section
            className="py-24 font-mono text-base"
            aria-label="Catalog"
            ref={sectionRef}
        >
            <div className="max-w-7xl mx-auto">
                <div
                    className="flex items-baseline justify-between gap-6 mb-6 px-5"
                    ref={headingRef}
                >
                    <h2 className="m-0 font-inter font-medium text-4xl tracking-[-0.025em]">Catalog</h2>
                    <span
                        className="text-xl tracking-[0.02em] text-zinc-400"
                        aria-live="polite"
                    >
                        {trackList.total}
                        {' of '}
                        {tracks.length}
                    </span>
                </div>
                <Filters
                    list={trackList}
                    tracks={tracks}
                />
                <div
                    className="catalog__grid grid mb-6"
                    aria-label="Track catalog"
                    role="list"
                >
                    <div className="catalog__row grid items-center gap-6 px-5 py-3 border border-zinc-800 text-xs tracking-[0.2em] bg-zinc-900 text-zinc-400">
                        <span aria-hidden="true" />
                        <SortHeader
                            field="id"
                            label="ID"
                            list={trackList}
                        />
                        <SortHeader
                            field="title"
                            label="TITLE"
                            list={trackList}
                        />
                        <SortHeader
                            align="right"
                            field="duration"
                            label="LENGTH"
                            list={trackList}
                        />
                        <span className="pl-4 text-left">DOWNLOAD</span>
                    </div>
                    <div className="catalog__body col-span-full grid grid-cols-subgrid border border-t-0 border-zinc-800">
                        {trackList.visible.length === 0 && (
                            <div
                                className="col-span-full p-16 text-base text-center text-zinc-400"
                                aria-live="polite"
                                role="status"
                            >
                                No tracks match the current filters.
                            </div>
                        )}
                        {trackList.visible.length > 0 && trackList.visible.map(track => (
                            <CatalogRow
                                isActive={player.trackId === track.id}
                                isPlaying={player.trackId === track.id && player.playing}
                                key={track.id}
                                pinModal={pinModal}
                                track={track}
                            />
                        ))}
                    </div>
                </div>
                <Pagination
                    list={trackList}
                    setPage={handlePageChange}
                />
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

function FavoriteChip({ active, icon, label, onClick, variant }: {
    active: boolean; icon: React.ReactNode; label: string; onClick: () => void; variant: 'gold' | 'rose';
}) {
    const activeClass = variant === 'gold' ? 'bg-gold border-gold' : 'bg-rose border-rose';
    const textClass = variant === 'gold' ? 'text-gold' : 'text-rose';

    return (
        <button
            className={`catalog__favorite flex items-center justify-center h-9 w-9 border rounded-sm cursor-pointer duration-150 transition-[background,border-color,color] ${active ? `${activeClass} text-black` : `bg-transparent border-white-20 ${textClass}`}`}
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
        >
            {icon}
        </button>
    );
}

function Filters({ list, tracks }: { list: TrackListState; tracks: Track[] }) {
    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Escape') {
            e.stopPropagation();
            list.setQuery('');
        }
    }

    return (
        <search className="flex flex-col gap-4 mb-6 p-6 border border-zinc-800 rounded-sm bg-zinc-800">
            <div className="flex items-center gap-4">
                <div className="focus-within:border-orange-80 hover:border-orange-80 flex flex-1 items-center gap-3 px-4 py-2.5 border border-transparent rounded-sm bg-zinc-900 duration-150 transition-[border-color]">
                    <IconSearch />
                    <input
                        className="flex-1 border-none outline-none text-base bg-transparent text-zinc-100"
                        aria-label="Search by ID or title"
                        maxLength={100}
                        onChange={e => list.setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search by ID or title"
                        value={list.query}
                    />
                    {list.query && (
                        <button
                            className="active:opacity-70 hover:opacity-80 border-none text-base bg-transparent text-zinc-400 cursor-pointer"
                            aria-label="Clear search"
                            onClick={() => list.setQuery('')}
                        >
                            &#10005;
                        </button>
                    )}
                </div>
                <div className="flex rounded-sm bg-zinc-900">
                    {(['music', 'sessions', 'productions'] as const).map((category, i) => (
                        <Fragment key={category}>
                            {i > 0 && <div className="w-px my-2 bg-zinc-700" aria-hidden="true" />}
                            <button
                                className={`catalog__category ${list.categories[category] ? 'catalog__category--active' : 'text-zinc-400'} px-4 py-2.5 border-0 text-sm tracking-[0.2em] cursor-pointer duration-150 transition-[background,color,opacity]`}
                                aria-pressed={list.categories[category]}
                                onClick={() => list.setCategories({ ...list.categories, [category]: !list.categories[category] })}
                            >
                                {categoryLabel(category)}
                            </button>
                        </Fragment>
                    ))}
                </div>
                <div className="flex gap-2">
                    <FavoriteChip
                        active={list.favorites.star}
                        icon={<IconStar />}
                        label="Starred only"
                        onClick={() => list.setFavorites({ ...list.favorites, star: !list.favorites.star })}
                        variant="gold"
                    />
                    <FavoriteChip
                        active={list.favorites.heart}
                        icon={<IconHeart />}
                        label="Hearted only"
                        onClick={() => list.setFavorites({ ...list.favorites, heart: !list.favorites.heart })}
                        variant="rose"
                    />
                </div>
            </div>
            <div className="grid grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_240px] items-end gap-4">
                <MultiSelect
                    label="YEAR"
                    onChange={list.setYears}
                    options={allYears(tracks).map(year => [year, String(year)] as [number, string])}
                    placeholder="All"
                    selected={list.years}
                />
                <MultiSelect
                    label="KEY"
                    onChange={list.setKeys}
                    options={allKeys(tracks).map(key => [key, key] as [string, string])}
                    placeholder="All"
                    selected={list.keys}
                />
                <BPMSlider
                    onChange={list.setBpmRange}
                    value={list.bpmRange}
                />
            </div>
        </search>
    );
}

function MultiSelect<T extends number | string>({ label, onChange, options, placeholder, selected }: {
    label: string; onChange: (values: T[]) => void; options: [T, string][]; placeholder: string; selected: T[];
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);

    let summary: string;

    if (selected.length === 0) summary = placeholder;
    else if (selected.length <= MAX_INLINE_SELECTED) summary = options.filter(([key]) => selected.includes(key)).map(([, label]) => label).join(', ');
    else summary = `${selected.length} selected`;

    useEffect(() => {
        if (!open) return;

        function onPointerDown(e: PointerEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        }

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                setOpen(false);
                (document.activeElement as HTMLElement)?.blur();
            }
        }

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <div
            className="flex flex-col relative gap-2"
            ref={containerRef}
        >
            <span className="text-xs tracking-[0.2em] text-zinc-400">{label}</span>
            <button
                className={`active:opacity-70 flex items-center justify-between px-4 py-2.5 border rounded-sm text-base text-left bg-zinc-900 cursor-pointer duration-150 select-none transition-[border-color] ${open ? 'border-orange-80' : 'border-transparent hover:border-orange-80'} ${selected.length ? 'text-white' : 'text-white-60'}`}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label={`${label.charAt(0)}${label.slice(1).toLowerCase()} filter`}
                onClick={() => setOpen(!open)}
            >
                <span className="truncate">{summary}</span>
                <IconChevron open={open} />
            </button>
            {open && (
                <MultiSelectPopover
                    onChange={onChange}
                    options={options}
                    selected={selected}
                />
            )}
        </div>
    );
}

function MultiSelectPopover<T extends number | string>({ onChange, options, selected }: {
    onChange: (values: T[]) => void; options: [T, string][]; selected: T[];
}) {
    const [search, setSearch] = useState('');

    const filtered = options.filter(([, label]) => !search || label.toLowerCase().includes(search.toLowerCase()));

    function toggleSelection(value: T) {
        if (selected.includes(value)) onChange(selected.filter(item => item !== value));
        else onChange([...selected, value]);
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
                    className={`active:opacity-70 hover:opacity-80 border-none text-xs tracking-[0.2em] bg-transparent cursor-pointer ${selected.length ? 'text-orange-80' : 'text-white-40'}`}
                    disabled={!selected.length}
                    onClick={() => onChange([])}
                >
                    CLEAR
                </button>
            </div>
            <input
                className="focus:border-orange-80 hover:border-orange-80 px-4 py-2.5 border border-zinc-700 outline-none rounded-sm text-sm bg-zinc-900 text-zinc-100 duration-150 transition-[border-color]"
                aria-label="Filter options"
                maxLength={20}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter"
                value={search}
            />
            <ul
                className="overflow-y-auto max-h-[400px] m-0 p-1.5 list-none"
                role="listbox"
            >
                {filtered.length === 0 && (
                    <li className="p-4 text-center text-sm text-zinc-400">No matches.</li>
                )}
                {filtered.length > 0 && filtered.map(([value, label]) => {
                    const isSelected = selected.includes(value);

                    return (
                        <li
                            aria-selected={isSelected}
                            key={String(value)}
                            role="option"
                        >
                            <label className={`catalog__option flex items-center gap-2 px-3 py-2.5 rounded-sm text-sm cursor-pointer ${isSelected ? 'bg-orange-20' : ''}`}>
                                <span className={`flex items-center justify-center h-3.5 w-3.5 border rounded-sm text-xs text-white ${isSelected ? 'bg-orange-80 border-orange-80' : 'bg-transparent border-zinc-500'}`}>
                                    {isSelected ? '\u2713' : ''}
                                </span>
                                <input
                                    className="sr-only"
                                    checked={isSelected}
                                    onChange={() => toggleSelection(value)}
                                    type="checkbox"
                                />
                                <span>{label}</span>
                            </label>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function PageButton({ active, children, disabled, label, onClick }: {
    active?: boolean; children: React.ReactNode; disabled?: boolean; label: string; onClick: () => void;
}) {
    return (
        <button
            className={`catalog__page ${active ? 'catalog__page--active cursor-default' : ''} min-w-9 px-3 py-2 border border-zinc-700 rounded-sm font-medium text-sm bg-transparent ${!active && !disabled ? 'text-zinc-400' : ''} ${disabled ? 'text-zinc-500' : ''} duration-150 select-none transition-[background,border-color,color,opacity] ${!active && !disabled ? 'cursor-pointer' : ''}`}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function Pagination({ list, setPage }: {
    list: TrackListState; setPage: (page: number) => void;
}) {
    const showPages: (number | '\u2026')[] = [];

    for (let i = 0; i < list.pageCount; i++) {
        if (i === 0 || i === list.pageCount - 1 || Math.abs(i - list.page) <= PAGE_ADJACENT) showPages.push(i);
        else if (showPages[showPages.length - 1] !== '\u2026') showPages.push('\u2026');
    }

    return (
        <div className="flex items-center justify-between px-5 text-sm tracking-[0.2em]">
            <span className="text-zinc-400">
                {list.total === 0 ? '0' : `${list.page * PAGE_SIZE + 1}\u2013${Math.min((list.page + 1) * PAGE_SIZE, list.total)}`}
                {' OF '}
                {list.total}
            </span>
            <div className="flex gap-1">
                <PageButton
                    disabled={list.page === 0}
                    label="Previous page"
                    onClick={() => setPage(Math.max(0, list.page - 1))}
                >
                    <span className="leading-none text-base">&lsaquo;</span>
                </PageButton>
                {showPages.map((page, i) => {
                    if (page === '\u2026') {
                        return (
                            <span
                                className="px-3 py-2 text-zinc-500"
                                key={`e${i}`}
                            >
                                &hellip;
                            </span>
                        );
                    }

                    return (
                        <PageButton
                            active={page === list.page}
                            key={page}
                            label={`Page ${page + 1}`}
                            onClick={() => setPage(page)}
                        >
                            {page + 1}
                        </PageButton>
                    );
                })}
                <PageButton
                    disabled={list.page === list.pageCount - 1}
                    label="Next page"
                    onClick={() => setPage(Math.min(list.pageCount - 1, list.page + 1))}
                >
                    <span className="leading-none text-base">&rsaquo;</span>
                </PageButton>
            </div>
        </div>
    );
}

function PinModalDialog({ close, inputRef, pin, setPin, state, submit, target }: {
    close: () => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
    pin: string;
    setPin: (value: string) => void;
    state: 'checking' | 'error' | 'idle' | 'success';
    submit: (e: React.SubmitEvent) => void;
    target: PinModalTarget;
}) {
    const formRef = useRef<HTMLFormElement>(null);
    const pinInputId = useId();
    const titleId = useId();
    const slug = buildSlug(target.track.id, target.track.data.title);

    function handleKeyDown(e: KeyboardEvent) {
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
    }

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
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
                <h2
                    id={titleId}
                    className="mb-1 font-medium text-2xl tracking-[-0.01em]"
                >
                    {target.track.data.title}
                </h2>
                <div className="mb-6 text-xs tracking-[0.2em] text-zinc-400">
                    {formatDetails(target.track)}
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
                    disabled={state === 'checking' || state === 'success'}
                    maxLength={10}
                    onChange={e => setPin(e.target.value)}
                    ref={inputRef}
                    type="password"
                    value={pin}
                />
                <div
                    className={`min-h-5 mb-6 text-xs ${state === 'error' ? 'text-red' : state === 'success' ? 'text-sage' : 'text-white-60'}`}
                    aria-live="polite"
                    role="status"
                >
                    {(state === 'checking' || state === 'idle') && ' '}
                    {state === 'error' && 'Invalid pin.'}
                    {state === 'success' && 'Downloading\u2026'}
                </div>
                <div className="flex gap-2">
                    <button
                        className={`enabled:active:opacity-70 enabled:hover:opacity-90 flex-[2] px-4 py-2.5 border-none font-medium text-sm tracking-[0.2em] bg-orange-80 text-white duration-150 transition-[background,opacity] ${state === 'checking' || state === 'success' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        disabled={state === 'checking' || state === 'success'}
                        type="submit"
                    >
                        {state === 'checking' ? 'VERIFYING\u2026' : 'DOWNLOAD'}
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
    const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [pin, setPin] = useState('');
    const [state, setState] = useState<'checking' | 'error' | 'idle' | 'success'>('idle');
    const [target, setTarget] = useState<PinModalTarget | null>(null);
    const triggerRef = useRef<HTMLElement | null>(null);

    function close() {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);

        setPin('');
        setState('idle');
        setTarget(null);
        triggerRef.current?.focus();
        triggerRef.current = null;
    }

    async function handleSubmit(e: React.SubmitEvent) {
        if (!target || state === 'checking') return;

        e.preventDefault();
        setState('checking');

        try {
            const [res] = await Promise.all([
                fetch('/api/verify-pin', {
                    body: JSON.stringify({ pin }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                }),

                new Promise(resolve => setTimeout(resolve, PIN_MIN_DELAY)),
            ]);

            const { ok } = await res.json();

            if (!ok) {
                setState('error');
                return;
            }

            setState('success');
            downloadTrack(target);
            closeTimerRef.current = setTimeout(close, PIN_SUCCESS_DELAY);
        } catch {
            setState('error');
        }
    }

    function open(track: Track, kind: 'master' | 'mixdown') {
        triggerRef.current = document.activeElement as HTMLElement;
        setPin('');
        setState('idle');
        setTarget({ kind, track });
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape' && target && state !== 'success') close();
    }

    useEffect(() => {
        if (!target) return;

        const timer = setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY);

        return () => clearTimeout(timer);
    }, [target]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [close, state, target]);

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

function SortHeader({ align, field, label, list }: {
    align?: 'right'; field: SortConfig['field']; label: string; list: TrackListState;
}) {
    const isActive = list.sort.field === field;

    function handleClick() {
        if (!isActive) list.setSort({ direction: 'asc', field });
        else if (list.sort.direction === 'asc') list.setSort({ direction: 'desc', field });
        else list.setSort({ direction: 'asc', field: 'id' });
    }

    return (
        <span className={align === 'right' ? 'text-right' : ''}>
            <button
                className={`catalog__sort ${isActive ? 'catalog__sort--active' : ''} inline-flex items-center gap-1 border-none bg-transparent cursor-pointer duration-150 transition-[color] ${isActive ? '' : 'text-zinc-400'}`}
                aria-label={isActive ? `Sort by ${label.toLowerCase()}, ${list.sort.direction === 'asc' ? 'ascending' : 'descending'}` : `Sort by ${label.toLowerCase()}`}
                onClick={handleClick}
            >
                {label}
                {isActive && (
                    <span className="leading-none text-xs">{list.sort.direction === 'asc' ? '\u25B2' : '\u25BC'}</span>
                )}
            </button>
        </span>
    );
}

gsap.registerPlugin(ScrollTrigger);

export default function Catalog({ tracks }: { tracks: Track[] }) {
    return (
        <ErrorBoundary>
            <PinModalProvider>
                <CatalogInner tracks={tracks} />
            </PinModalProvider>
        </ErrorBoundary>
    );
}
