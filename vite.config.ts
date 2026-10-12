import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Hirsimestari',
        short_name: 'Hirsimestari',
        description: 'Rakenna hirsirakennuksia ja maalaa ne omilla väreillä.',
        lang: 'fi',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f1e7',
        theme_color: '#8a5a2b',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
  test: { environment: 'node' },
});
