import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// INOPAY: Import conditionnel du tagger uniquement en dev
const loadComponentTagger = async () => {
  try {
    const { componentTagger } = await import("lovable-tagger");
    return componentTagger;
  } catch {
    return null;
  }
};

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  // En dev uniquement, charger le tagger
  const tagger = mode === 'development' ? await loadComponentTagger() : null;
  
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      // INOPAY: Tagger uniquement en dev, jamais en production
      mode === 'development' && tagger && tagger(),
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
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // INOPAY: Build optimisé pour l'exil souverain
    build: {
      // Minification agressive avec terser
      minify: 'terser' as const,
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
          passes: 2,
        },
        mangle: {
          // Obfusquer les noms de propriétés
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
          // INOPAY: Noms de chunks aléatoires pour empêcher l'analyse de structure
          chunkFileNames: () => {
            const hash = Math.random().toString(36).substring(2, 10);
            return `assets/${hash}-[hash].js`;
          },
          entryFileNames: () => {
            const hash = Math.random().toString(36).substring(2, 10);
            return `assets/${hash}-[hash].js`;
          },
          assetFileNames: () => {
            const hash = Math.random().toString(36).substring(2, 10);
            return `assets/${hash}-[hash][extname]`;
          },
          // Mangling des noms d'exports
          manualChunks: (id: string) => {
            if (id.includes('node_modules')) {
              // Grouper les vendors dans des chunks anonymes
              const vendorHash = Math.random().toString(36).substring(2, 6);
              if (id.includes('react')) return `v-${vendorHash}`;
              if (id.includes('@radix') || id.includes('shadcn')) return `u-${vendorHash}`;
              if (id.includes('framer')) return `m-${vendorHash}`;
              return `d-${vendorHash}`;
            }
            return undefined;
          },
        },
      },
      // Supprimer les sourcemaps en production
      sourcemap: mode !== 'production',
      // Nettoyer le dossier de build
      emptyOutDir: true,
    },
    define: {
      // INOPAY: Variables d'environnement pour services self-hosted
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
      __INFRA_MODE__: JSON.stringify(process.env.VITE_INFRA_MODE || 'cloud'),
    },
    // INOPAY: Suppression des logs de build sensibles
    logLevel: (mode === 'production' ? 'warn' : 'info') as 'info' | 'warn' | 'error' | 'silent',
  };
});