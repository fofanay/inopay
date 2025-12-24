import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['inopay-logo-email.png'],
      manifest: false, // Using external manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MB limit
        runtimeCaching: [
          {
            // INOPAY: Cache self-hosted Supabase instance
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
            // INOPAY: Cache Ollama AI model requests (replaces OpenAI)
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
            // INOPAY: Cache Meilisearch API requests (replaces Algolia)
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
            // INOPAY: Cache MinIO storage requests (replaces Cloudinary)
            urlPattern: new RegExp(`^${process.env.VITE_MINIO_URL || 'http://localhost:9000'}/.*`),
            handler: 'CacheFirst',
            options: {
              cacheName: 'minio-storage-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          },
          {
            // INOPAY: Cache PocketBase requests (alternative auth provider)
            urlPattern: new RegExp(`^${process.env.VITE_POCKETBASE_URL || 'http://localhost:8090'}/.*`),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pocketbase-api-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 5 // 5 minutes
              }
            }
          }
        ]
      }
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      // INOPAY: Configure @/ alias in tsconfig.json paths: { "@/*": ["./src/*"] }
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // INOPAY: Environment variables for self-hosted open-source services
    __SUPABASE_URL__: JSON.stringify(process.env.VITE_SUPABASE_URL || 'http://localhost:54321'),
    __SUPABASE_ANON_KEY__: JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ''),
    __OLLAMA_BASE_URL__: JSON.stringify(process.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'),
    __MEILISEARCH_URL__: JSON.stringify(process.env.VITE_MEILISEARCH_URL || 'http://localhost:7700'),
    __MEILISEARCH_API_KEY__: JSON.stringify(process.env.VITE_MEILISEARCH_API_KEY || ''),
    __MINIO_URL__: JSON.stringify(process.env.VITE_MINIO_URL || 'http://localhost:9000'),
    __MINIO_ACCESS_KEY__: JSON.stringify(process.env.VITE_MINIO_ACCESS_KEY || 'minioadmin'),
    __MINIO_SECRET_KEY__: JSON.stringify(process.env.VITE_MINIO_SECRET_KEY || 'minioadmin'),
    __SOKETI_HOST__: JSON.stringify(process.env.VITE_SOKETI_HOST || 'localhost'),
    __SOKETI_PORT__: JSON.stringify(process.env.VITE_SOKETI_PORT || '6001'),
    __POCKETBASE_URL__: JSON.stringify(process.env.VITE_POCKETBASE_URL || 'http://localhost:8090'),
    __SMTP_HOST__: JSON.stringify(process.env.VITE_SMTP_HOST || 'localhost'),
    __SMTP_PORT__: JSON.stringify(process.env.VITE_SMTP_PORT || '587'),
    __POSTGRES_URL__: JSON.stringify(process.env.VITE_POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/inopay'),
  }
}));