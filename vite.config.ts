import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/kuntorastit/',
  server: {
    port: 8080,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/kuntorastit\/data\/events.json/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'events-data-cache',
              expiration: {
                maxEntries: 1
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:js|css|html|png|jpg|jpeg|svg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          }
        ]
      },
      manifest: {
        name: 'Kuntorastit',
        short_name: 'Kuntorastit',
        start_url: '/kuntorastit/',
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
      manifestFilename: 'manifest.json', // Explicitly set filename
      includeAssets: ['icon-192.png'],   // Precache key assets
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom'
  }
})