import fs from 'fs';
import path from 'path';
import { execSync } from 'node:child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

function resolveSentryRelease(slug = 'soundy-web'): string {
  const pkgPath = path.resolve(__dirname, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = String(pkg.version || '0.0.0');
  let sha =
    process.env.SENTRY_RELEASE_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim()?.slice(0, 7) ||
    '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD', {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      sha = '';
    }
  }
  return sha ? `${slug}@${version}+${sha}` : `${slug}@${version}`;
}

function msdevBackendUsesHttps(): boolean {
  if (process.env.MSDEV_HTTPS === '1' || process.env.MSDEV_HTTPS_PROXY === '1') return true;
  try {
    const envPath = path.resolve(__dirname, '../../commun/msdev/.env');
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

function loadSentryBuildPluginEnv(): Record<string, string> {
  const filePath = path.resolve(__dirname, '.env.sentry-build-plugin');
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

export default defineConfig(({ mode }) => {
  // loadEnv lit .env.production (ou .env.msdev, etc.) selon le mode de build,
  // contrairement à process.env qui ne voit que les variables du shell.
  const envFromFile = loadEnv(mode, process.cwd(), '');
  const sentryBuildEnv = loadSentryBuildPluginEnv();
  const sentryEnv = { ...sentryBuildEnv, ...envFromFile, ...process.env };
  const appEnv = envFromFile.VITE_APP_ENV ?? process.env.VITE_APP_ENV ?? 'msdev';
  const sentryRelease =
    envFromFile.VITE_SENTRY_RELEASE?.trim() ||
    process.env.VITE_SENTRY_RELEASE?.trim() ||
    resolveSentryRelease('soundy-web');
  const sentryUploadEnabled = Boolean(
    sentryEnv.SENTRY_AUTH_TOKEN?.trim() &&
      sentryEnv.SENTRY_ORG?.trim() &&
      sentryEnv.SENTRY_PROJECT?.trim()
  );
  const sentryClientEnabled = Boolean(
    (envFromFile.VITE_SENTRY_DSN ?? process.env.VITE_SENTRY_DSN)?.trim() &&
      appEnv !== 'msdev'
  );

  return {
  define: {
    'import.meta.env.VITE_APP_ENV': JSON.stringify(appEnv),
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(sentryRelease),
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    // Vite 8 / Rolldown résout parfois react/jsx-runtime → react/index.js/jsx-runtime (bug).
    alias: {
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
    },
  },
  optimizeDeps: {
    exclude: ['heic2any'],
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
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
        description: "Salons d'écoute musicale géolocalisés — YouTube",
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
        cacheId: 'melosong-soundy-v15',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        /**
         * App-shell precache only — route chunks load on demand (runtime cache below).
         */
        globPatterns: [
          'index.html',
          'assets/index-*.js',
          'assets/index-*.css',
          'assets/vendor-react-*.js',
          'assets/auth-context-*.js',
          'assets/rolldown-runtime-*.js',
        ],
        globIgnores: [
          '**/icon*.svg',
          '**/favicon*.svg',
          '**/pwa-192x192.png',
          '**/pwa-512x512.png',
          '**/workbox-*.js',
          '**/sw.js',
          '**/vendor-heic2any*.js',
          '**/vendor-globe*.js',
          '**/vendor-livekit*.js',
          '**/vendor-map*.js',
          '**/vendor-socketio*.js',
          '**/vendor-zxcvbn*.js',
          '**/vendor-hls*.js',
          '**/photo-editor*.js',
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
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'melosong-assets',
              expiration: {
                maxEntries: 256,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
        importScripts: ['push-sw.js'],
      },
      devOptions: {
        enabled: false,
      },
    }),
    ...(sentryUploadEnabled
      ? [
          sentryVitePlugin({
            org: sentryEnv.SENTRY_ORG,
            project: sentryEnv.SENTRY_PROJECT,
            authToken: sentryEnv.SENTRY_AUTH_TOKEN,
            release: { name: sentryRelease },
            sourcemaps: {
              assets: '../../commun/backend/public/**',
              filesToDeleteAfterUpload: ['../../commun/backend/public/**/*.map'],
            },
            telemetry: false,
          }),
        ]
      : []),
  ],
  server: {
    port: 5173,
    // Windows : sans host explicite, Vite peut n’écouter que sur [::1] → localhost (127.0.0.1) bloqué.
    host: '127.0.0.1',
    strictPort: true,
    proxy: {
      '/api': msdevProxy,
      '/uploads': msdevProxy,
      '/tiles': msdevProxy,
      '/socket.io': { ...msdevProxy, ws: true },
    },
  },
  build: {
    outDir: '../../commun/backend/public',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    modulePreload: false,
    sourcemap: sentryUploadEnabled || sentryClientEnabled ? 'hidden' : false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/');
          if (norm.includes('/context/AuthContext')) return 'auth-context';
          if (!id.includes('node_modules')) {
            return undefined;
          }
          // heic2any : chunk isolé (worker libheif ; ne pas fusionner dans vendor-misc)
          if (id.includes('heic2any')) return 'vendor-heic2any';
          if (id.includes('zxcvbn')) return 'vendor-zxcvbn';
          if (id.includes('hls.js')) return 'vendor-hls';
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
