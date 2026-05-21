import { useRef, useState } from 'react';

import { HeartIcon } from '@components/HeartIcon';
import { PLAYER } from '@lib/store';
import { StarIcon } from '@components/StarIcon';
import { buildSlug, formatDuration } from '@lib/utils';

const BOUNCE_DURATION = 0.6;
const BOUNCE_STAGGER = 0.1;
const DOWNLOAD_COOLDOWN = 3000;

function DownloadButton({ children, disabled, onClick }: {
    children: React.ReactNode; disabled?: boolean; onClick: () => void;
}) {
    return (
        <button
            className="catalog__download px-3.5 py-2 rounded-sm border border-zinc-700 font-medium text-[0.6875rem] tracking-[0.18em] [font-family:inherit] bg-transparent text-zinc-400 transition-[background,border-color,color,opacity] duration-150 cursor-pointer"
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function DownloadLink({ children, disabled, href }: {
    children: React.ReactNode; disabled?: boolean; href: string;
}) {
    const [cooldown, setCooldown] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

    if (disabled || cooldown) {
        return (
            <span
                className="inline-block px-3.5 py-2 rounded-sm border border-zinc-700 font-medium text-[0.6875rem] tracking-[0.18em] no-underline bg-transparent text-zinc-400 opacity-40 cursor-not-allowed"
            >
                {children}
            </span>
        );
    }

    return (
        <a
            className="catalog__download inline-block px-3.5 py-2 rounded-sm border border-zinc-700 font-medium text-[0.6875rem] tracking-[0.18em] no-underline [font-family:inherit] bg-transparent text-zinc-400 transition-[background,border-color,color,opacity] duration-150 cursor-pointer"
            download
            href={href}
            onClick={() => {
                if (timerRef.current) clearTimeout(timerRef.current);
                setCooldown(true);
                timerRef.current = setTimeout(() => setCooldown(false), DOWNLOAD_COOLDOWN);
            }}
        >
            {children}
        </a>
    );
}

function PlayingDots({ paused }: { paused: boolean }) {
    return (
        <div className="flex items-center gap-0.5 h-3.5">
            {[0, 1, 2, 3].map(i => (
                <div
                    className="w-0.5 h-3.5 bg-[var(--color-orange-80)]"
                    key={i}
                    style={{ animation: `player__vu-bounce ${BOUNCE_DURATION}s ease-in-out ${i * BOUNCE_STAGGER}s infinite`, animationPlayState: paused ? 'paused' : 'running', transformOrigin: 'center' }}
                />
            ))}
        </div>
    );
}

export function CatalogRow({ idx, isActive, isPlaying, pin, t }: {
    idx: number;
    isActive: boolean;
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
            className={`catalog__row ${isActive ? 'catalog__row--playing' : ''} ${noMaster ? 'catalog__row--disabled' : ''} grid items-center gap-5 px-5 py-6 text-sm transition-[background] duration-150 delay-[10ms] ${noMaster ? '' : 'cursor-pointer'}`}
            onClick={noMaster
                ? undefined
                : (e) => {
                        onPlay();
                        (e.currentTarget as HTMLElement).blur();
                    }}
            onKeyDown={noMaster
                ? undefined
                : (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onPlay();
                        }
                    }}
            role="row"
            style={{ boxShadow: idx ? 'inset 0 1px 0 var(--color-white-20)' : 'none' }}
            tabIndex={noMaster ? -1 : 0}
        >
            <div className="flex items-center justify-center" role="gridcell">
                {isActive && <PlayingDots paused={!isPlaying} />}
                {!isActive && t.star && (
                    <span className="text-[var(--color-gold)]">
                        <StarIcon />
                        <span className="sr-only">Starred</span>
                    </span>
                )}
                {!isActive && !t.star && t.heart && (
                    <span className="text-[var(--color-rose)]">
                        <HeartIcon />
                        <span className="sr-only">Hearted</span>
                    </span>
                )}
            </div>
            <span className="text-[0.8125rem] tracking-[0.04em] tabular-nums text-zinc-400" role="gridcell">{t.id}</span>
            <div className="flex flex-col min-w-0 gap-[5px]" role="gridcell">
                <div className={`catalog__track font-medium text-sm truncate tracking-[-0.005em] leading-[1.2] font-inter ${t.title ? 'text-zinc-100' : 'text-zinc-500 italic'}`}>
                    {t.title || ' '}
                </div>
                <div className="min-h-4 font-mono text-[0.6875rem] tracking-[0.04em] text-zinc-400">
                    {[
                        t.year > 0 && String(t.year),
                        t.bpm.length > 0 && `BPM ${t.bpm.join(' ')}`,
                        t.key.length > 0 && t.key.join(', '),
                    ].filter(Boolean).join(' │ ')}
                </div>
            </div>
            <span className="text-[0.8125rem] tabular-nums text-right text-zinc-400" role="gridcell">{t.title ? formatDuration(t.duration) : ''}</span>
            <div className="flex justify-start gap-1.5 pl-4" aria-label="Download options" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} role="gridcell" tabIndex={-1}>
                <DownloadLink disabled={!t.master} href={`/audio/${slug}.mp3`}>MP3</DownloadLink>
                <DownloadButton disabled={!t.master} onClick={() => pin.open(t, 'master')}>WAV</DownloadButton>
                <DownloadButton disabled={!t.mixdown} onClick={() => { if (t.mixdown) pin.open(t, 'mixdown'); }}>MIX</DownloadButton>
            </div>
        </div>
    );
}
