export const BPM_MAX = 180;
export const BPM_MIN = 50;

export function bpmNum(bpm: string[]): number | null {
    const n = parseInt(bpm[0], 10);
    return Number.isFinite(n) ? n : null;
}

export function buildSlug(id: string, title: string): string {
    return (id + ' ' + (title || ''))
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/['()]/g, '')
        .replace(/\s+/g, '_');
}

export function categoryFromId(id: string): Category {
    const prefix = id.charAt(0).toUpperCase();
    if (prefix === 'A') return 'music';
    if (prefix === 'B') return 'sessions';
    return 'productions';
}

export function categoryLabel(c: string): string {
    return { music: 'Music', sessions: 'Sessions', productions: 'Productions' }[c] ?? c;
}

export function fmtCounter(s: number): string {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function fmtDuration(s: number | undefined | null): string {
    if (!s && s !== 0) return '—';
    const m = Math.floor(s / 60);
    const ss = String(Math.floor(s % 60)).padStart(2, '0');
    return `${m}:${ss}`;
}

export function fmtKey(key: string): string {
    return key.toUpperCase().replace(/([A-G])B/g, '$1b');
}

export function nextSort(current: { field: string; dir: string }, field: string) {
    if (current.field !== field) return { field, dir: 'asc' as const };
    if (current.dir === 'asc') return { field, dir: 'desc' as const };
    return { field: 'id', dir: 'asc' as const };
}
