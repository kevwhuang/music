import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { buildSlug, fmtDuration } from '@lib/utils';

interface PinModalCtx {
    open: (track: Track, kind: 'master' | 'mixdown') => void;
    close: () => void;
}

const PinModalContext = createContext<PinModalCtx | null>(null);

export function usePinModal() {
    return useContext(PinModalContext)!;
}

interface Target {
    track: Track;
    kind: 'master' | 'mixdown';
}

export function PinModalProvider({ children }: { children: React.ReactNode }) {
    const [target, setTarget] = useState<Target | null>(null);
    const [pin, setPin] = useState('');
    const [state, setState] = useState<'idle' | 'checking' | 'error' | 'success'>('idle');
    const inputRef = useRef<HTMLInputElement>(null);

    const open = useCallback((track: Track, kind: 'master' | 'mixdown') => {
        setTarget({ track, kind });
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
        <PinModalContext.Provider value={{ open, close }}>
            {children}
            {target && (
                <PinModalChrome
                    target={target}
                    pin={pin}
                    setPin={setPin}
                    state={state}
                    submit={submit}
                    close={close}
                    inputRef={inputRef}
                />
            )}
        </PinModalContext.Provider>
    );
}

function PinModalChrome({
    target, pin, setPin, state, submit, close, inputRef,
}: {
    target: Target;
    pin: string;
    setPin: (v: string) => void;
    state: 'idle' | 'checking' | 'error' | 'success';
    submit: (e?: React.FormEvent) => void;
    close: () => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
}) {
    const slug = buildSlug(target.track.id, target.track.title);
    return (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
            onClick={close}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'inherit',
                animation: 'pinModalFadeIn .18s ease',
            }}
        >
            <style>
                {`
                @keyframes pinModalFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes pinModalSlide {
                    from { opacity: 0; transform: translateY(8px) scale(.98); }
                    to { opacity: 1; transform: none; }
                }
                @keyframes pinShake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-6px); }
                    40%, 80% { transform: translateX(6px); }
                }
            `}
            </style>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
            <form
                onClick={e => e.stopPropagation()}
                onSubmit={submit}
                style={{
                    background: '#0e0e0e',
                    border: '1px solid var(--cn-border2)',
                    width: 460, maxWidth: '90vw',
                    padding: '28px 32px',
                    color: 'var(--cn-text)',
                    fontFamily: 'var(--cn-font)',
                    animation: state === 'error' ? 'pinShake .35s ease' : 'pinModalSlide .22s cubic-bezier(.2,.7,.3,1)',
                    boxShadow: '0 24px 80px rgba(0,0,0,.6)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 11, letterSpacing: '0.18em', color: 'var(--cn-dim)' }}>
                    <span>AUTHORIZATION</span>
                    <button type="button" onClick={close} style={{ background: 'none', border: 'none', color: 'var(--cn-dim)', cursor: 'pointer', font: 'inherit', fontSize: 11 }}>ESC</button>
                </div>
                <div style={{ fontSize: 22, marginBottom: 4, fontWeight: 500, letterSpacing: '-0.01em' }}>
                    {target.track.title || '(untitled)'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--cn-dim)', marginBottom: 24 }}>
                    {target.track.id}
                    {' '}
                    ·
                    {fmtDuration(target.track.duration)}
                    {' '}
                    ·
                    {target.track.bpm.join('/')}
                    {' '}
                    bpm ·
                    {target.track.key.join(', ')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                    <DLChip kind="master" active={target.kind === 'master'}>
                        {slug}
                        .wav
                    </DLChip>
                    <DLChip kind="mixdown" active={target.kind === 'mixdown'} disabled={!target.track.mixdown}>
                        {target.track.mixdown ? `${slug}_mixdown.wav` : 'no mixdown'}
                    </DLChip>
                </div>
                <label
                    htmlFor="pin-input"
                    style={{ display: 'block', fontSize: 11, letterSpacing: '0.18em', color: 'var(--cn-dim)', marginBottom: 8 }}
                >
                    AUTHORIZATION
                </label>
                <input
                    id="pin-input"
                    ref={inputRef}
                    type="password"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    maxLength={6}
                    placeholder="• • • •"
                    autoComplete="off"
                    style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#000', border: `1px solid ${state === 'error' ? 'var(--cn-danger)' : 'var(--cn-border2)'}`,
                        color: 'var(--cn-text)', font: 'inherit', fontSize: 22,
                        letterSpacing: '0.5em', padding: '14px 16px',
                        outline: 'none', transition: 'border-color .15s, box-shadow .15s',
                        boxShadow: state === 'error' ? '0 0 0 3px rgba(193,74,58,0.18)' : 'none',
                    }}
                    onFocus={(e) => { if (state !== 'error') e.target.style.borderColor = 'var(--cn-accent)'; }}
                    onBlur={(e) => { if (state !== 'error') e.target.style.borderColor = 'var(--cn-border2-raw, #2a2a2a)'; }}
                />
                <div style={{ minHeight: 18, marginTop: 8, fontSize: 11, color: state === 'error' ? 'var(--cn-danger)' : state === 'success' ? 'var(--cn-sage)' : 'var(--cn-dim)' }}>
                    {state === 'error' && 'Invalid pin'}
                    {state === 'success' && '✓ Verified — generating signed url'}
                    {state === 'idle' && ' '}
                    {state === 'checking' && 'Verifying…'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                    <button
                        type="button"
                        onClick={close}
                        style={{
                            flex: 1,
                            background: 'transparent', border: '1px solid var(--cn-border2)',
                            color: 'var(--cn-dim)', font: 'inherit', fontSize: 12,
                            letterSpacing: '0.18em', padding: '12px 16px', cursor: 'pointer',
                        }}
                    >
                        CANCEL
                    </button>
                    <button
                        type="submit"
                        disabled={state === 'checking' || state === 'success'}
                        style={{
                            flex: 2,
                            background: state === 'success' ? '#3a4a35' : 'var(--cn-accent)',
                            border: 'none',
                            color: '#fff', font: 'inherit', fontSize: 12, fontWeight: 500,
                            letterSpacing: '0.18em', padding: '12px 16px',
                            cursor: state === 'checking' ? 'wait' : 'pointer',
                            transition: 'background .15s, opacity .15s',
                            opacity: state === 'checking' ? 0.6 : 1,
                        }}
                    >
                        {state === 'success' ? '✓ DOWNLOAD READY' : state === 'checking' ? 'VERIFYING…' : 'DOWNLOAD'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function DLChip({ kind, active, disabled, children }: {
    kind: string;
    active: boolean;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div style={{
            background: active ? 'rgba(255,255,255,.04)' : 'transparent',
            border: `1px solid ${active ? 'var(--cn-accent)' : 'var(--cn-border2)'}`,
            padding: '10px 12px',
            opacity: disabled ? 0.4 : 1,
            fontSize: 11,
        }}
        >
            <div style={{ color: 'var(--cn-dim)', letterSpacing: '0.18em', marginBottom: 4 }}>
                {kind === 'master' ? 'MASTER' : 'MIXDOWN'}
            </div>
            <div style={{ color: 'var(--cn-text)', wordBreak: 'break-all', lineHeight: 1.3 }}>
                {children}
            </div>
        </div>
    );
}
