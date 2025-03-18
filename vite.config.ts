import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Placeholder for base URL, replaced by GitHub Action.
// Stays intact in a local development environment.
const maybeBase = 'VITE_BASE_URL_PLACEHOLDER' as string;
const base = maybeBase.startsWith('VITE') ? '/' : maybeBase;
const repoPath = maybeBase.startsWith('VITE') ? '/' : maybeBase.match(/\/[^/]+\/$/)?.[0];

export default defineConfig(({ command, mode }) => {
  console.log({ base, repoPath, mode });

  const definedConfig = (alternatives[mode] ?? alternatives.default)({
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
    plugins: []
  });

  console.log(definedConfig);
  return definedConfig;
});

const alternatives = {
  singlefile: config => ({
    ...config,
    define: {
      'import.meta.env.ACTUAL_BASE_URL': base, // Workaround for some substitution confusion.
    },
    plugins: [...config.plugins, viteSingleFile()],
    build: {
      ...config.build,
      assetsInlineLimit: 0, // Prevent small assets from being inlined as base64 unnecessarily
      cssCodeSplit: false, // Bundle all CSS into one
    },
  }),
  default: config => ({
    ...config,
    plugins: [
      VitePWA({
        devOptions: {
          enabled: true,
          type: 'module',
        },
        registerType: 'autoUpdate',
        workbox: {
          runtimeCaching: [
            {
              urlPattern: new RegExp(`${repoPath}data/events.json`),
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
  }),
};
