import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { buildSlug, fmtDuration } from '@lib/utils';

interface PinModalCtx {
    close: () => void;
    open: (track: Track, kind: 'master' | 'mixdown') => void;
}

interface Target {
    kind: 'master' | 'mixdown';
    track: Track;
}

const PinModalContext = createContext<PinModalCtx | null>(null);

export function usePinModal() {
    return useContext(PinModalContext)!;
}

export function PinModalProvider({ children }: { children: React.ReactNode }) {
    const [target, setTarget] = useState<Target | null>(null);
    const [pin, setPin] = useState('');
    const [state, setState] = useState<'checking' | 'error' | 'idle' | 'success'>('idle');
    const inputRef = useRef<HTMLInputElement>(null);

    const open = useCallback((track: Track, kind: 'master' | 'mixdown') => {
        setTarget({ kind, track });
        setPin('');
        setState('idle');
    }, []);

    const close = useCallback(() => {
        setTarget(null);
        setPin('');
        setState('idle');
    }, []);

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

    const submit = (e?: React.FormEvent) => {
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

function PinModalChrome({ close, inputRef, pin, setPin, state, submit, target }: {
    close: () => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
    pin: string;
    setPin: (v: string) => void;
    state: 'checking' | 'error' | 'idle' | 'success';
    submit: (e?: React.FormEvent) => void;
    target: Target;
}) {
    const slug = buildSlug(target.track.id, target.track.title);
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
                    htmlFor="pin-input"
                >
                    AUTHORIZATION
                </label>
                <input
                    className={`pin-modal__input w-full px-4 py-3.5 rounded-none font-mono text-[1.375rem] tracking-[0.5em] transition-[border-color,box-shadow] duration-150 ${state === 'error' ? 'pin-modal__input--error' : ''}`}
                    autoComplete="off"
                    id="pin-input"
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
