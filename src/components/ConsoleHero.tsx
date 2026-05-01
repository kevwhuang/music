import { TRACKS } from '@lib/tracks';

export default function ConsoleHero() {
    return (
        <section style={{ padding: '120px 32px 96px', borderBottom: '1px solid var(--cn-line)' }}>
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>
                <h1 style={{
                    fontFamily: 'var(--cn-sans)',
                    fontSize: 'clamp(64px, 10vw, 144px)',
                    fontWeight: 600,
                    letterSpacing: '-0.045em',
                    lineHeight: 1,
                    margin: '0 0 56px',
                    color: 'var(--cn-text)',
                }}
                >
                    aephonics
                    <br />
                    <span style={{ color: 'var(--cn-dim)' }}>writes, records,</span>
                    <br />
                    <span style={{ color: 'var(--cn-accent)' }}>and mixes.</span>
                </h1>
                <p style={{
                    fontFamily: 'var(--cn-sans)',
                    fontSize: 22, lineHeight: 1.5, color: 'var(--cn-text2)',
                    margin: 0, fontWeight: 400, maxWidth: 780,
                }}
                >
                    A producer and engineer based in Austin, TX. Since 2015, the room has churned out original records, scratch sessions, and ghost productions across hip-hop, latin pop, ambient, and a handful of genres that don't have names yet. Catalog is
                    {' '}
                    {TRACKS.length}
                    {' '}
                    tracks deep and growing.
                </p>
                <div style={{
                    marginTop: 88,
                    background: 'var(--cn-panel)', border: '1px solid var(--cn-line)',
                    padding: '28px 32px', borderRadius: 2,
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32,
                }}
                >
                    <ChannelStat label="MUSIC" count={TRACKS.filter(t => t.category === 'music').length} />
                    <ChannelStat label="SESSIONS" count={TRACKS.filter(t => t.category === 'sessions').length} />
                    <ChannelStat label="PRODUCTIONS" count={TRACKS.filter(t => t.category === 'productions').length} />
                    <ChannelStat label="STARRED" count={TRACKS.filter(t => t.star).length} accent />
                </div>
            </div>
        </section>
    );
}

function ChannelStat({ label, count, accent }: { label: string; count: number; accent?: boolean }) {
    return (
        <div style={{ borderLeft: `2px solid ${accent ? 'var(--cn-accent)' : 'var(--cn-border2)'}`, paddingLeft: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--cn-dim)', marginBottom: 10 }}>{label}</div>
            <div style={{
                fontFamily: 'var(--cn-sans)', fontSize: 40, fontWeight: 500,
                color: accent ? 'var(--cn-accent)' : 'var(--cn-text)', letterSpacing: '-0.025em', lineHeight: 1,
            }}
            >
                {count}
            </div>
        </div>
    );
}
