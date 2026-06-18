import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

function msdevBackendUsesHttps(): boolean {
  if (process.env.MSDEV_HTTPS === '1' || process.env.MSDEV_HTTPS_PROXY === '1') return true;
  try {
    const envPath = path.resolve(__dirname, '../msdev/.env');
    if (!fs.existsSync(envPath)) return false;
    const text = fs.readFileSync(envPath, 'utf-8');
    return /^MSDEV_HTTPS\s*=\s*1\s*$/m.test(text) || /^WEB_APP_URL\s*=\s*https:\/\//m.test(text);
  } catch {
    return false;
  }
}

const msdevProxyTarget = msdevBackendUsesHttps()
  ? 'https://localhost:4080'
  : 'http://localhost:4080';

const msdevProxy = { target: msdevProxyTarget, secure: false, changeOrigin: true };

const swPurgeKey = `melosong_sw_purge_${Date.now().toString(36)}`;

export default defineConfig(({ mode }) => {
  // loadEnv lit .env.production (ou .env.msdev, etc.) selon le mode de build,
  // contrairement à process.env qui ne voit que les variables du shell.
  const envFromFile = loadEnv(mode, process.cwd(), '');
  const appEnv = envFromFile.VITE_APP_ENV ?? process.env.VITE_APP_ENV ?? 'msdev';

  return {
  define: {
    'import.meta.env.VITE_APP_ENV': JSON.stringify(appEnv),
  },
  optimizeDeps: {
    exclude: ['heic2any'],
  },
  plugins: [
    react(),
    tailwindcss(),
    /**
     * Remplace SW_CLEAR_KEY dans index.html par une clé unique à ce build.
     * Cela déclenche une purge automatique du cache SW côté client au premier
     * chargement de chaque nouveau déploiement.
     */
    {
      name: 'inject-sw-purge-key',
      transformIndexHtml: {
        order: 'post' as const,
        handler: (html: string) => html.replace(/melosong_sw_purge_\w+/g, swPurgeKey),
      },
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Soundy',
        short_name: 'Soundy',
        description: "Salons d'écoute musicale géolocalisés — Spotify & YouTube",
        start_url: '/',
        display: 'standalone' as const,
        background_color: '#0b0b0f',
        theme_color: '#7c3aed',
        orientation: 'any' as const,
        lang: 'fr',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        screenshots: [
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Salons d\'écoute musicale géolocalisés',
          },
        ],
        categories: ['music', 'social', 'entertainment'],
        iarc_rating_id: '',
      },
      workbox: {
        /**
         * Clé de cache versionnée : changer manuellement si un conflit de cache
         * majeur survient et que la purge automatique (index.html) ne suffit pas.
         */
        cacheId: 'melosong-soundy-v12',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        /**
         * Exclure les icônes déjà listées dans includeAssets pour éviter les
         * doublons dans le manifeste de précache du service worker.
         */
        globPatterns: ['**/*.{js,css,html,ico,woff2}'],
        globIgnores: [
          '**/icon*.svg',
          '**/favicon*.svg',
          '**/pwa-192x192.png',
          '**/pwa-512x512.png',
          '**/workbox-*.js',
          '**/sw.js',
          '**/vendor-heic2any*.js',
          '**/vendor-globe*.js',
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/, /^\/msdev-mobile$/, /^\/clear-pwa/, /^\/phone-preview/, /^\/tel\//],
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/socket\.io/,
            handler: 'NetworkOnly',
          },
        ],
        importScripts: ['push-sw.js'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': msdevProxy,
      '/uploads': msdevProxy,
      '/socket.io': { ...msdevProxy, ws: true },
    },
  },
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    modulePreload: { polyfill: true },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            if (id.includes('PhotoImageEditor') || id.includes('PhotoInlineCrop')) {
              return 'photo-editor';
            }
            return undefined;
          }
          // heic2any : chunk isolé (worker libheif ; ne pas fusionner dans vendor-misc)
          if (id.includes('heic2any')) return 'vendor-heic2any';
          if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react';
          if (id.includes('socket.io-client')) return 'vendor-socketio';
          if (id.includes('livekit-client') || id.includes('@livekit/')) return 'vendor-livekit';
          if (id.includes('leaflet') || id.includes('react-leaflet') || id.includes('leaflet.markercluster')) return 'vendor-map';
          // Globe/Three/D3 : chunk nommé explicitement pour que Rolldown
          // ne les fusionne PAS dans vendor-misc (retourner undefined laisse
          // Rolldown les y injecter malgré le lazy-import de GlobeView).
          // vendor-globe n'est PAS préchargé car il n'est atteint que via
          // le dynamic-import de GlobeView.
          if (
            id.includes('react-globe') ||
            id.includes('/three/') ||
            id.includes('/three-') ||
            id.includes('@react-three') ||
            id.includes('/d3-') ||
            id.includes('topojson') ||
            id.includes('kapsule') ||
            id.includes('accessor-fn')
          ) return 'vendor-globe';
          return 'vendor-misc';
        },
      },
    },
  },
  };
});
