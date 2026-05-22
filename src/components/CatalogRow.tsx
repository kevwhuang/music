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
            className="catalog__download px-3.5 py-2 rounded-sm border border-zinc-700 font-medium text-xs tracking-[0.2em] font-mono bg-transparent text-zinc-400 transition-[background,border-color,color,opacity] duration-150 cursor-pointer"
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
                className="inline-block px-3.5 py-2 rounded-sm border border-zinc-700 font-medium text-xs tracking-[0.2em] no-underline font-mono bg-transparent text-zinc-400 opacity-40 cursor-not-allowed"
            >
                {children}
            </span>
        );
    }

    return (
        <a
            className="catalog__download inline-block px-3.5 py-2 rounded-sm border border-zinc-700 font-medium text-xs tracking-[0.2em] no-underline font-mono bg-transparent text-zinc-400 transition-[background,border-color,color,opacity] duration-150 cursor-pointer"
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

export function CatalogRow({ index, isActive, isPlaying, pinModal, track }: {
    index: number;
    isActive: boolean;
    isPlaying: boolean;
    pinModal: Pick<PinModalActions, 'open'>;
    track: Track;
}) {
    const hasMaster = track.flags.master;
    const hasMixdown = track.flags.mixdown;
    const noMaster = !hasMaster;
    const slug = buildSlug(track.id, track.data.title);

    function handlePlay() {
        if (!noMaster) PLAYER.load(track);
    }

    function handleClick() {
        handlePlay();
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            handlePlay();
        }
    }

    return (
        <div
            className={`catalog__row ${isActive ? 'catalog__row--playing' : ''} ${noMaster ? 'catalog__row--disabled' : ''} grid items-center gap-6 px-5 py-6 text-base transition-[background] duration-150 delay-[10ms] ${noMaster ? '' : 'cursor-pointer'}`}
            onClick={noMaster ? undefined : handleClick}
            onKeyDown={noMaster ? undefined : handleKeyDown}
            role="listitem"
            style={{ boxShadow: index ? 'inset 0 1px 0 var(--color-white-20)' : 'none' }}
            tabIndex={noMaster ? -1 : 0}
        >
            <div className="flex items-center justify-center">
                {isActive && <PlayingDots paused={!isPlaying} />}
                {!isActive && track.flags.star && (
                    <span className="text-[var(--color-gold)]">
                        <StarIcon />
                        <span className="sr-only">Starred</span>
                    </span>
                )}
                {!isActive && !track.flags.star && track.flags.heart && (
                    <span className="text-[var(--color-rose)]">
                        <HeartIcon />
                        <span className="sr-only">Hearted</span>
                    </span>
                )}
            </div>
            <span className="text-sm tracking-[0.04em] tabular-nums text-zinc-400">{track.id}</span>
            <div className="flex flex-col min-w-0 gap-[5px]">
                <div className={`catalog__track font-medium text-base truncate leading-tight font-inter ${track.data.title ? 'text-zinc-100' : 'text-zinc-500 italic'}`}>
                    {track.data.title || ' '}
                </div>
                <div className="min-h-4 font-mono text-xs tracking-[0.04em] text-zinc-400">
                    {[
                        track.data.year > 0 && String(track.data.year),
                        track.data.bpm > 0 && `BPM ${track.data.bpm}${track.data.tempo ? ` ${track.data.tempo}` : ''}`,
                        track.data.keys.length > 0 && track.data.keys.join(', '),
                    ].filter(Boolean).join(' │ ')}
                </div>
            </div>
            <span className="text-sm tabular-nums text-right text-zinc-400">{track.data.title ? formatDuration(track.data.duration) : ''}</span>
            <div className="flex justify-start gap-1.5 pl-4" aria-label="Download options" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} role="toolbar" tabIndex={-1}>
                <DownloadLink disabled={!hasMaster} href={`/audio/${slug}.mp3`}>MP3</DownloadLink>
                <DownloadButton disabled={!hasMaster} onClick={() => pinModal.open(track, 'master')}>WAV</DownloadButton>
                <DownloadButton disabled={!hasMixdown} onClick={() => { if (hasMixdown) pinModal.open(track, 'mixdown'); }}>MIX</DownloadButton>
            </div>
        </div>
    );
}
