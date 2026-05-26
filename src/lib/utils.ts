export function buildSlug(id: string, title: string): string {
    return `${id} ${title || ''}`
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/['()]/g, '')
        .replace(/\s+/g, '_');
}

export function categoryLabel(category: Track['category']): string {
    return { music: 'MUSIC', productions: 'PRODUCTIONS', sessions: 'SESSIONS' }[category] ?? category;
}

export function formatDetails(track: Track): string {
    const parts = [
        categoryLabel(track.category),
        track.id,
        String(track.data.year),
    ];

    if (track.data.bpm > 0) {
        parts.push(`BPM ${track.data.bpm}${track.data.tempo ? ` ${track.data.tempo}` : ''}`);
    }

    parts.push(track.data.keys.map(key => key.toUpperCase().replace(/([A-G])B/g, '$1b')).join(', '));

    return parts.join(' \u00B7 ');
}

export function formatDuration(seconds: number | null): string {
    if (seconds === null) return '\u2014';

    const minutes = Math.floor(seconds / 60);
    const remaining = String(Math.floor(seconds % 60)).padStart(2, '0');

    return `${minutes}:${remaining}`;
}
