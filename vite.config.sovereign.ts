// ============================================
// INOPAY SOVEREIGN - Configuration Vite Production
// Utilisé uniquement pour les builds d'export souverain
// Usage: vite build --config vite.config.sovereign.ts
// ============================================

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['inopay-logo-email.png', 'favicon.ico'],
      manifest: {
        name: 'Inopay Sovereign',
        short_name: 'Inopay',
        description: 'Plateforme de libération de code souverain',
        theme_color: '#1a1a2e',
        background_color: '#0f0f23',
        display: 'standalone',
        icons: [
          {
            src: '/inopay-logo-email.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/inopay-logo-email.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 }
            }
          },
          {
            urlPattern: /^https?:\/\/.*\/storage\/v1\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'storage-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 }
            }
          }
        ]
      }
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Build optimisé pour déploiement souverain
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2,
      },
      mangle: {
        properties: {
          regex: /^_private_/,
        },
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks: (id: string) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('@radix-ui') || id.includes('@tanstack')) return 'vendor-ui';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('recharts') || id.includes('d3')) return 'vendor-charts';
            if (id.includes('@supabase')) return 'vendor-supabase';
            return 'vendor';
          }
          return undefined;
        },
      },
    },
    sourcemap: false,
    emptyOutDir: true,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
  },
  // Variables d'environnement pour self-hosted
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  // Pas de logs en production
  logLevel: 'warn',
});
