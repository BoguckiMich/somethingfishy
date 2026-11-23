import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the build works from a GitHub Pages sub-path.
  base: './',
  plugins: [
    // Production only: the plugin does nothing on the dev server (no devOptions).
    VitePWA({
      registerType: 'prompt', // a waiting update is announced by a toast, never applied on its own
      injectRegister: false, // src/ui/updateToast.ts registers the service worker
      strategies: 'generateSW',
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'Something Fishy',
        short_name: 'Fishy',
        description: 'A cosy little fishing game.',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1b2b3a',
        background_color: '#1b2b3a',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,txt,png,svg,ico,webmanifest}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
