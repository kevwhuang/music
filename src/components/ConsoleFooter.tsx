export default function ConsoleFooter() {
    return (
        <footer style={{
            borderTop: '1px solid var(--cn-line)',
            background: 'var(--cn-bg2)',
            padding: '48px 32px', fontSize: 13, color: 'var(--cn-dim)',
            display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24,
        }}
        >
            <div>
                <div style={{ fontFamily: 'var(--cn-sans)', fontSize: 16, color: 'var(--cn-text)', marginBottom: 6, fontWeight: 500, letterSpacing: '-0.01em' }}>aephonics</div>
                <div>&copy; 2015&ndash;2026. All rights reserved.</div>
            </div>
            <div style={{ display: 'flex', gap: 36, fontSize: 12, letterSpacing: '0.14em' }}>
                <FootLink label="INSTAGRAM" value="@aephonics" href="https://instagram.com/aephonics" />
                <FootLink label="EMAIL" value="kevin@aephonics.com" href="mailto:kevin@aephonics.com" />
                <FootLink label="ALLIANCE" value="austinproduceralliance.com" href="https://austinproduceralliance.com" />
            </div>
        </footer>
    );
}

function FootLink({ label, value, href }: { label: string; value: string; href: string }) {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ color: 'var(--cn-dim2)', fontSize: 10, letterSpacing: '0.22em' }}>{label}</span>
            <span style={{ color: 'var(--cn-text)', fontFamily: 'var(--cn-font)', fontSize: 13 }}>{value}</span>
        </a>
    );
}
