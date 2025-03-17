import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve' || mode === 'development';
  // Placeholder for base URL, replaced by GitHub Action
  const baseUrl = 'VITE_BASE_URL_PLACEHOLDER' as string;
  // Extract the repo-specific path (e.g., '/kuntorastit/') from the base URL or default to '/'
  const repoPath = baseUrl === 'VITE_BASE_URL_PLACEHOLDER' ? '/' : baseUrl.match(/\/[^/]+\/$/)?.[0] || '/';

  console.log({ baseUrl, repoPath, isDev });
  return {
    base: isDev ? '/' : (baseUrl === 'VITE_BASE_URL_PLACEHOLDER' ? '/' : baseUrl),
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
        registerType: 'autoUpdate',
        workbox: {
          runtimeCaching: [
            {
              // Dynamically construct the urlPattern using baseUrl
              urlPattern: new RegExp(`${baseUrl === 'VITE_BASE_URL_PLACEHOLDER' ? '/' : baseUrl}data/events.json`),
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
          start_url: isDev ? '/' : repoPath, // Dynamic start_url based on repo path
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
        includeAssets: ['icon-192.png'],
      }),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
    },
  };
});