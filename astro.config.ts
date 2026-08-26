import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import robots from 'astro-robots-txt';
import sitemap from '@astrojs/sitemap';
import tailwind from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

export default defineConfig({
    adapter: netlify(),
    build: {
        format: 'file',
    },
    devToolbar: {
        enabled: false,
    },
    fonts: [
        {
            cssVariable: '--font-geist-sans',
            display: 'block',
            name: 'Geist Sans',
            provider: fontProviders.fontsource(),
            styles: ['normal'],
            subsets: ['latin'],
            weights: [400, 600],
        },
        {
            cssVariable: '--font-ibm-plex-mono',
            display: 'block',
            fallbacks: ['Courier New', 'monospace'],
            name: 'IBM Plex Mono',
            provider: fontProviders.fontsource(),
            styles: ['normal'],
            subsets: ['latin'],
            weights: [400, 500, 600],
        },
        {
            cssVariable: '--font-inter',
            display: 'block',
            name: 'Inter',
            provider: fontProviders.fontsource(),
            styles: ['normal'],
            subsets: ['latin'],
            weights: [500, 600],
        },
    ],
    integrations: [
        react(),
        robots(),
        sitemap({ lastmod: new Date() }),
    ],
    site: 'https://music.aephonics.com',
    trailingSlash: 'never',
    vite: {
        plugins: [tailwind()],
    },
});
