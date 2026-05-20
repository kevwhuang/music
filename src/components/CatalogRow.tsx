import { PLAYER } from '@lib/store';
import { buildSlug, fmtDuration } from '@lib/utils';
import { HeartIcon } from '@components/HeartIcon';
import { StarIcon } from '@components/StarIcon';

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

export function CatalogRow({ idx, isPlaying, pin, t }: {
    idx: number;
    isPlaying: boolean;
    pin: { open: (track: Track, kind: 'master' | 'mixdown') => void };
    t: Track;
}) {
    const noMaster = !t.master;
    const onPlay = () => {
        if (!noMaster) PLAYER.load(t);
    };
    const slug = buildSlug(t.id, t.title);

    return (
        <div
            className={`catalog__row grid items-center gap-3.5 px-5 py-[clamp(0.875rem,calc(0.67rem+1.04vw),1.5rem)] text-sm transition-[background] duration-150 delay-[15ms] cursor-pointer ${isPlaying ? 'catalog__row--playing' : ''} ${noMaster ? 'catalog__row--disabled' : ''}`}
            role="button"
            style={{ boxShadow: idx ? 'inset 0 1px 0 var(--color-white-20)' : 'none' }}
            tabIndex={0}
            onClick={(e) => {
                onPlay();
                (e.currentTarget as HTMLElement).blur();
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onPlay();
                }
            }}
        >
            <div className="hidden md:flex items-center justify-center">
                {isPlaying
                    ? <PlayingDots />
                    : t.star
                        ? (
                                <span className="text-[var(--color-gold)]">
                                    <StarIcon />
                                    <span className="sr-only">Starred</span>
                                </span>
                            )
                        : t.heart
                            ? (
                                    <span className="text-[var(--color-rose)]">
                                        <HeartIcon />
                                        <span className="sr-only">Hearted</span>
                                    </span>
                                )
                            : null}
            </div>
            <span className="hidden md:inline text-[0.8125rem] tracking-[0.04em] tabular-nums text-zinc-400">{t.id}</span>
            <div className="min-w-0 flex flex-col gap-[5px]">
                <div className={`catalog__track-title font-medium text-sm truncate tracking-[-0.005em] leading-[1.2] font-inter ${t.title ? 'text-zinc-100' : 'text-zinc-500 italic'}`}>
                    {t.title || ' '}
                </div>
                <div className="flex flex-wrap items-center gap-3.5 min-h-4 text-xs tracking-[0.02em] [font-family:var(--font-mono)] text-zinc-500">
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
            <span className="hidden md:inline text-[0.8125rem] tabular-nums text-zinc-400">{t.title ? t.year : ''}</span>
            <span className="hidden md:inline text-[0.8125rem] tabular-nums text-zinc-400">{t.title ? fmtDuration(t.duration) : ''}</span>
            <div className="flex gap-1.5 justify-start" aria-label="Download options" role="toolbar" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                <DLLink disabled={!t.master} href={`/audio/${slug}.mp3`} title="Download MP3">MP3</DLLink>
                <DLBtn disabled={!t.master} title={t.master ? 'Download WAV master' : 'No master available'} onClick={() => pin.open(t, 'master')}>WAV</DLBtn>
                <DLBtn disabled={!t.mixdown} title={t.mixdown ? 'Download mixdown' : 'No mixdown available'} onClick={() => { if (t.mixdown) pin.open(t, 'mixdown'); }}>MIX</DLBtn>
            </div>
        </div>
    );
}
