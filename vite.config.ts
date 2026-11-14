import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Forma — Entrenamiento personal',
        short_name: 'Forma',
        description: 'Entrenamiento de fuerza local-first, sin cuentas ni suscripciones.',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // Biblioteca de ejercicios: no se precarga; se guarda en caché al consultarla (carga bajo demanda)
        runtimeCaching: [
          { urlPattern: /\/data\/library\/(index|ex\/[^/]+)\.json$/, handler: 'StaleWhileRevalidate', options: { cacheName: 'library-data', expiration: { maxEntries: 1000 } } },
          { urlPattern: /\/data\/library\/img\/.+\.webp$/, handler: 'CacheFirst', options: { cacheName: 'library-img', expiration: { maxEntries: 150 } } },
          { urlPattern: /\/media\/.+\.(gif|mp4|webm)$/, handler: 'CacheFirst', options: { cacheName: 'exercise-media', expiration: { maxEntries: 60 } } },
          { urlPattern: /^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\//, handler: 'CacheFirst', options: { cacheName: 'library-photos', expiration: { maxEntries: 80 }, cacheableResponse: { statuses: [0, 200] } } },
        ],
      },
    }),
  ],
})
