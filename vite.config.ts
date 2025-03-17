import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command, mode }) => {
  // Placeholder for base URL, replaced by GitHub Action. Stays intact in a local development environment.
  const maybeBase = 'VITE_BASE_URL_PLACEHOLDER' as string;
  const base = maybeBase.startsWith('VITE') ? '/' : maybeBase
  // Extract the repo-specific path (e.g., '/kuntorastit/') from the base URL or default to '/'
  const repoPath = maybeBase.startsWith('VITE') ? '/' : maybeBase.match(/\/[^/]+\/$/)?.[0];
  
  console.log({ base, repoPath });
  return {
    base,
    server: {
      port: 8080,
      host: true,
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    plugins: [
      VitePWA({
        devOptions: {
          enabled: true, // Enable PWA in dev mode
          type: 'module', // Use 'module' type for service worker (optional, depending on your setup)
        },
        registerType: 'autoUpdate',
        workbox: {
          runtimeCaching: [
            {
              urlPattern: new RegExp(`${base}data/events.json`),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'events-data-cache',
                expiration: {
                  maxEntries: 1,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\.(?:js|css|html|png|jpg|jpeg|svg)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-assets-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
              },
            },
          ],
        },
        manifest: {
          name: 'Kuntorastit',
          short_name: 'Kuntorastit',
          start_url: repoPath,
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#000000',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
          ],
        },
        manifestFilename: 'manifest.json',
        includeAssets: ['icon-192.png'],
      }),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
    },
  };
});