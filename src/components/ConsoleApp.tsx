import { useEffect } from 'react';

import ConsoleFooter from './ConsoleFooter';
import ConsoleHero from './ConsoleHero';
import ConsoleList from './ConsoleList';
import ConsolePlayer from './ConsolePlayer';
import { PinModalProvider } from './PinModal';
import { PLAYER } from '@lib/store';
import { TRACKS } from '@lib/tracks';

export default function ConsoleApp() {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement).isContentEditable) return;
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                PLAYER.toggle();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const s = PLAYER.get();
                const step = e.shiftKey ? 10 : 5;
                PLAYER.seek(Math.max(0, s.position - step));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                const s = PLAYER.get();
                const t = TRACKS.find(x => x.id === s.trackId);
                if (!t) return;
                const step = e.shiftKey ? 10 : 5;
                PLAYER.seek(Math.min(t.duration, s.position + step));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <PinModalProvider>
            <div style={{
                background: 'var(--cn-bg)',
                color: 'var(--cn-text)',
                fontFamily: 'var(--cn-font)',
                fontSize: 14,
                minHeight: '100vh',
            }}
            >
                <style>
                    {`
                    .cn-row { transition: background .12s; cursor: pointer; }
                    .cn-row:hover { background: var(--cn-panel); }
                    .cn-row.is-playing { background: linear-gradient(90deg, rgba(201,122,74,0.10) 0%, rgba(201,122,74,0.02) 100%); }
                    .cn-tab { transition: color .12s; cursor: pointer; user-select: none; }
                    .cn-tab:hover { color: var(--cn-text); }
                    @keyframes cnVU { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
                    @keyframes cnFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
                    .cn-fade-in { animation: cnFadeIn .25s ease both; }
                    @keyframes cnReeling { to { transform: rotate(360deg); } }
                    .cn-reel { animation: cnReeling 5s linear infinite; }
                    .cn-reel.paused { animation-play-state: paused; }
                    @keyframes cnBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.3; } }
                    .cn-blink { animation: cnBlink 1.4s steps(2) infinite; }
                `}
                </style>
                <ConsolePlayer />
                <ConsoleHero />
                <ConsoleList />
                <ConsoleFooter />
            </div>
        </PinModalProvider>
    );
}
