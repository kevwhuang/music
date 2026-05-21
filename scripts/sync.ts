import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { buildSlug } from '../src/lib/utils';

const AUDIO_DIR = path.resolve(import.meta.dirname, '../public/audio');
const WAVEFORM_BARS = 500;
const CATEGORIES = ['music', 'productions', 'sessions'] as const;
const CONTENT_DIR = path.resolve(import.meta.dirname, '../src/content');
const PRECISION = 1000;


function extractPeaks(audioPath: string): number[] {
    const buffer = execSync(
        `ffmpeg -i "${audioPath}" -ac 1 -ar 22050 -f f32le -acodec pcm_f32le pipe:1`,
        { maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
    );

    const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    const binSize = Math.floor(samples.length / WAVEFORM_BARS);
    const peaks: number[] = [];
    let max = 0;

    for (let i = 0; i < WAVEFORM_BARS; i++) {
        const start = i * binSize;
        const end = i === WAVEFORM_BARS - 1 ? samples.length : start + binSize;
        let sum = 0;

        for (let j = start; j < end; j++) {
            sum += samples[j] * samples[j];
        }

        const rms = Math.sqrt(sum / (end - start));

        if (rms > max) max = rms;
        peaks.push(rms);
    }

    if (max > 0) {
        for (let i = 0; i < peaks.length; i++) {
            peaks[i] = Math.round((peaks[i] / max) * PRECISION) / PRECISION;
        }
    }

    return peaks;
}

for (const category of CATEGORIES) {
    const dir = path.join(CONTENT_DIR, category);

    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.json')) continue;

        const jsonPath = path.join(dir, file);
        const track = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        const slug = buildSlug(track.id, track.title);
        const audioPath = path.join(AUDIO_DIR, `${slug}.mp3`);

        if (!fs.existsSync(audioPath)) continue;

        track.peaks = extractPeaks(audioPath);
        fs.writeFileSync(jsonPath, JSON.stringify(track, null, 4));
    }
}
