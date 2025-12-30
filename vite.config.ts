import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// INOPAY SOVEREIGN: Configuration Vite 100% autonome
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['inopay-logo-email.png'],
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: new RegExp(`^${process.env.VITE_SUPABASE_URL || 'http://localhost:54321'}/.*`),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 }
              }
            },
            {
              urlPattern: new RegExp(`^${process.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'}/.*`),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'ollama-api-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 2 }
              }
            },
            {
              urlPattern: new RegExp(`^${process.env.VITE_MEILISEARCH_URL || 'http://localhost:7700'}/.*`),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'meilisearch-api-cache',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 10 }
              }
            },
            {
              urlPattern: new RegExp(`^${process.env.VITE_MINIO_URL || 'http://localhost:9000'}/.*`),
              handler: 'CacheFirst',
              options: {
                cacheName: 'minio-storage-cache',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }
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
      minify: 'terser' as const,
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
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
              if (id.includes('react')) return 'vendor-react';
              if (id.includes('@radix') || id.includes('shadcn')) return 'vendor-ui';
              if (id.includes('framer')) return 'vendor-motion';
              return 'vendor';
            }
            return undefined;
          },
        },
      },
      sourcemap: mode !== 'production',
      emptyOutDir: true,
    },
    define: {
      __SUPABASE_URL__: JSON.stringify(process.env.VITE_SUPABASE_URL || 'http://localhost:54321'),
      __SUPABASE_ANON_KEY__: JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ''),
      __OLLAMA_BASE_URL__: JSON.stringify(process.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'),
      __MEILISEARCH_URL__: JSON.stringify(process.env.VITE_MEILISEARCH_URL || 'http://localhost:7700'),
      __MEILISEARCH_API_KEY__: JSON.stringify(process.env.VITE_MEILISEARCH_API_KEY || ''),
      __MINIO_URL__: JSON.stringify(process.env.VITE_MINIO_URL || 'http://localhost:9000'),
      __MINIO_ACCESS_KEY__: JSON.stringify(process.env.VITE_MINIO_ACCESS_KEY || 'minioadmin'),
      __SOKETI_HOST__: JSON.stringify(process.env.VITE_SOKETI_HOST || 'localhost'),
      __SOKETI_PORT__: JSON.stringify(process.env.VITE_SOKETI_PORT || '6001'),
      __POCKETBASE_URL__: JSON.stringify(process.env.VITE_POCKETBASE_URL || 'http://localhost:8090'),
      __INFRA_MODE__: JSON.stringify(process.env.VITE_INFRA_MODE || 'self-hosted'),
    },
    logLevel: (mode === 'production' ? 'warn' : 'info') as 'info' | 'warn' | 'error' | 'silent',
  };
});
