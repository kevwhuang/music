import { useRef, useState } from 'react';

import { IconHeart } from '@components/IconHeart';
import { IconStar } from '@components/IconStar';
import { playerStore } from '@lib/store';
import { buildSlug, formatDuration } from '@lib/utils';

const BOUNCE_DURATION = 0.6;
const BOUNCE_STAGGER = 0.1;
const DOWNLOAD_COOLDOWN = 3_000;

function DownloadButton({ children, disabled, onClick }: {
    children: React.ReactNode; disabled?: boolean; onClick: () => void;
}) {
    return (
        <button
            className="catalog__download px-3 py-2 border border-zinc-700 rounded-sm font-medium text-xs tracking-[0.2em] bg-transparent text-zinc-400 duration-150 transition-[background,border-color,color,opacity] cursor-pointer"
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
            <span className="inline-block px-3 py-2 border border-zinc-700 rounded-sm font-medium no-underline text-xs tracking-[0.2em] bg-transparent text-zinc-400 opacity-40 cursor-not-allowed">{children}</span>
        );
    }

    return (
        <a
            className="catalog__download inline-block px-3 py-2 border border-zinc-700 rounded-sm font-medium no-underline text-xs tracking-[0.2em] bg-transparent text-zinc-400 duration-150 transition-[background,border-color,color,opacity] cursor-pointer"
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
        <div className="flex items-center h-3.5 gap-0.5">
            {[0, 1, 2, 3].map(i => (
                <div
                    className="h-3.5 w-0.5 bg-orange-80"
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
        if (!noMaster) playerStore.load(track);
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
            className={`catalog__row ${isActive ? 'catalog__row--playing' : ''} ${noMaster ? 'catalog__row--disabled' : ''} grid items-center gap-6 px-5 py-6 text-base delay-[10ms] duration-150 transition-[background] ${noMaster ? '' : 'cursor-pointer'}`}
            onClick={noMaster ? undefined : handleClick}
            onKeyDown={noMaster ? undefined : handleKeyDown}
            role="listitem"
            style={{ boxShadow: index ? 'inset 0 1px 0 var(--color-white-20)' : 'none' }}
            tabIndex={noMaster ? -1 : 0}
        >
            <div className="flex items-center justify-center">
                {isActive && <PlayingDots paused={!isPlaying} />}
                {!isActive && track.flags.star && (
                    <span className="text-gold">
                        <IconStar />
                        <span className="sr-only">Starred</span>
                    </span>
                )}
                {!isActive && !track.flags.star && track.flags.heart && (
                    <span className="text-rose">
                        <IconHeart />
                        <span className="sr-only">Hearted</span>
                    </span>
                )}
            </div>
            <span className="tabular-nums text-sm tracking-[0.04em] text-zinc-400">{track.id}</span>
            <div className="flex flex-col min-w-0 gap-1">
                <div className={`catalog__track font-inter font-medium leading-tight text-base truncate ${track.data.title ? 'text-zinc-100' : 'text-zinc-500 italic'}`}>
                    {track.data.title || ' '}
                </div>
                <div className="min-h-4 text-xs tracking-[0.04em] text-zinc-400">
                    {[
                        track.data.year > 0 && String(track.data.year),
                        track.data.bpm > 0 && `BPM ${track.data.bpm}${track.data.tempo ? ` ${track.data.tempo}` : ''}`,
                        track.data.keys.length > 0 && track.data.keys.join(', '),
                    ].filter(Boolean).join(' │ ')}
                </div>
            </div>
            <span className="tabular-nums text-right text-sm text-zinc-400">{track.data.title ? formatDuration(track.data.duration) : ''}</span>
            <div
                className="flex justify-start gap-2 pl-4"
                aria-label="Download options"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
                role="group"
                tabIndex={-1}
            >
                <DownloadLink
                    disabled={!hasMaster}
                    href={`/audio/${slug}.mp3`}
                >
                    MP3
                </DownloadLink>
                <DownloadButton
                    disabled={!hasMaster}
                    onClick={() => pinModal.open(track, 'master')}
                >
                    WAV
                </DownloadButton>
                <DownloadButton
                    disabled={!hasMixdown}
                    onClick={() => { if (hasMixdown) pinModal.open(track, 'mixdown'); }}
                >
                    MIX
                </DownloadButton>
            </div>
        </div>
    );
}
