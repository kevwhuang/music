export function buildSlug(id: string, title: string): string {
    return `${id} ${title || ''}`
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/['()]/g, '')
        .replace(/\s+/g, '_');
}

export function categoryLabel(category: string): string {
    return { music: 'Music', productions: 'Productions', sessions: 'Sessions' }[category] ?? category;
}

export function formatDuration(seconds: number | undefined | null): string {
    if (seconds === null || seconds === undefined) return '—';

    const minutes = Math.floor(seconds / 60);
    const remaining = String(Math.floor(seconds % 60)).padStart(2, '0');
    return `${minutes}:${remaining}`;
}
