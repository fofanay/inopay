import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['inopay-logo-email.png'],
      manifest: false, // Using external manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB limit
        runtimeCaching: [
          {
            // INOPAY: Support for self-hosted Supabase instance
            urlPattern: new RegExp(`^${process.env.VITE_SUPABASE_URL || 'http://localhost:54321'}/.*`),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              }
            }
          },
          {
            // INOPAY: Cache Ollama API requests for better performance
            urlPattern: new RegExp(`^${process.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'}/.*`),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ollama-api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 2 // 2 minutes
              }
            }
          },
          {
            // INOPAY: Cache Meilisearch API requests
            urlPattern: new RegExp(`^${process.env.VITE_MEILISEARCH_URL || 'http://localhost:7700'}/.*`),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'meilisearch-api-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 10 // 10 minutes
              }
            }
          },
          {
            // INOPAY: Cache MinIO/S3 compatible storage requests
            urlPattern: new RegExp(`^${process.env.VITE_MINIO_URL || 'http://localhost:9000'}/.*`),
            handler: 'CacheFirst',
            options: {
              cacheName: 'minio-storage-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      }
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      // INOPAY: Keep @/ alias for imports - configure path mapping for TypeScript in tsconfig.json
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // INOPAY: Define environment variables for self-hosted services
    __SUPABASE_URL__: JSON.stringify(process.env.VITE_SUPABASE_URL || 'http://localhost:54321'),
    __OLLAMA_BASE_URL__: JSON.stringify(process.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'),
    __MEILISEARCH_URL__: JSON.stringify(process.env.VITE_MEILISEARCH_URL || 'http://localhost:7700'),
    __MINIO_URL__: JSON.stringify(process.env.VITE_MINIO_URL || 'http://localhost:9000'),
    __SOKETI_HOST__: JSON.stringify(process.env.VITE_SOKETI_HOST || 'localhost'),
    __SOKETI_PORT__: JSON.stringify(process.env.VITE_SOKETI_PORT || '6001'),
  }
}));