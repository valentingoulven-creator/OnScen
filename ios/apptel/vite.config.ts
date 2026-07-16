import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import viteCompression from 'vite-plugin-compression';

/**
 * Plugin Vite : "overlay" de ios/apptel/src sur app/src.
 *
 * Principe : app/src/ est la source de vérité unique.
 *   - Si un fichier existe dans ios/apptel/src/ → version spécifique téléphone (override).
 *   - Sinon → Vite charge automatiquement le fichier depuis app/src/.
 *
 * Avantage : tout nouveau fichier ajouté dans app/src/ est immédiatement
 * disponible dans apptel SANS aucune copie manuelle.
 */
function apptelSrcFallback() {
  const apptelSrc = path.resolve(__dirname, 'src');
  const appSrc = path.resolve(__dirname, '../../web/app/src');
  const exts = [
    '.tsx', '.ts', '.jsx', '.js',
    '/index.tsx', '/index.ts', '/index.jsx', '/index.js',
  ];

  function tryResolve(base: string, rel: string): string | undefined {
    const candidate = path.join(base, rel);
    const stat = fs.existsSync(candidate) ? fs.statSync(candidate) : null;
    if (stat && !stat.isDirectory()) return candidate;
    for (const ext of exts) {
      const c = candidate + ext;
      if (fs.existsSync(c)) return c;
    }
    return undefined;
  }

  /** Une seule instance AuthContext dans le bundle tel (évite « useAuth outside provider »). */
  function authContextCanonical(importer: string, source: string): string | undefined {
    if (!source.startsWith('.')) return undefined;
    const resolved = path.resolve(path.dirname(importer), source);
    const relToApp = path.relative(appSrc, resolved).replace(/\\/g, '/');
    const relToApptel = path.relative(apptelSrc, resolved).replace(/\\/g, '/');
    const isAuth =
      relToApp === 'context/AuthContext' ||
      relToApp === 'context/AuthContext.tsx' ||
      relToApptel === 'context/AuthContext' ||
      relToApptel === 'context/AuthContext.tsx';
    if (!isAuth) return undefined;
    const canonical = path.join(appSrc, 'context/AuthContext.tsx');
    return fs.existsSync(canonical) ? canonical : undefined;
  }

  return {
    name: 'apptel-src-fallback',
    enforce: 'pre' as const,
    resolveId(id: string, importer: string | undefined): string | undefined {
      if (!importer || !id.startsWith('.')) return undefined;

      const authCanonical = authContextCanonical(importer, id);
      if (authCanonical) return authCanonical;

      const importerDir = path.dirname(importer);
      const resolved = path.resolve(importerDir, id);

      const relToApptel = path.relative(apptelSrc, resolved);
      const relToApp = path.relative(appSrc, resolved);
      const inApptel = !relToApptel.startsWith('..');
      const inApp = !relToApp.startsWith('..');

      if (inApptel) {
        // Import dans le territoire ios/apptel/src :
        // si le fichier existe → Vite gère normalement
        // sinon → fallback vers app/src (fichier partagé)
        if (tryResolve(apptelSrc, relToApptel)) return undefined;
        return tryResolve(appSrc, relToApptel);
      }

      if (inApp) {
        // Import dans le territoire app/src :
        // si ios/apptel/src a un override → l'utiliser
        return tryResolve(apptelSrc, relToApp);
      }

      return undefined;
    },
  };
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
const isCapacitorBuild = process.env.CAPACITOR_BUILD === '1';

export default defineConfig({
  base: isCapacitorBuild ? './' : '/tel/',
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  define: {
    'import.meta.env.VITE_APP_ENV': JSON.stringify(process.env.VITE_APP_ENV || 'msdev'),
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || ''),
    'import.meta.env.VITE_SOCKET_URL': JSON.stringify(process.env.VITE_SOCKET_URL || ''),
  },
  plugins: [
    apptelSrcFallback(),
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
    ...(isCapacitorBuild ? [] : [VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Soundy',
        short_name: 'Soundy',
        description: "Salons d'écoute musicale géolocalisés — optimisé téléphone",
        start_url: '/tel/',
        display: 'standalone' as const,
        background_color: '#0b0b0f',
        theme_color: '#7c3aed',
        orientation: 'portrait' as const,
        lang: 'fr',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
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
      },
      workbox: {
        /**
         * Clé de cache versionnée : changer manuellement si un conflit de cache
         * majeur survient et que la purge automatique (index.html) ne suffit pas.
         */
        cacheId: 'melosong-msdev-v10',
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
        navigateFallback: '/tel/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/, /^\/msdev-mobile$/, /^\/clear-pwa/],
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
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/') || url.pathname.startsWith('/tel/assets/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'melosong-tel-assets',
              expiration: {
                maxEntries: 256,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    })]),
    ...(isCapacitorBuild ? [] : [
      viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 1024,
        deleteOriginFile: false,
      }),
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 1024,
        deleteOriginFile: false,
      }),
    ]),
  ],
  server: {
    port: 4082,
    proxy: {
      '/api': msdevProxy,
      '/socket.io': { ...msdevProxy, ws: true },
    },
  },
  build: {
    outDir: isCapacitorBuild ? 'dist' : '../../commun/backend/public/tel',
    emptyOutDir: true,
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/');
          if (norm.includes('/context/AuthContext')) return 'auth-context';
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react';
          if (id.includes('socket.io-client')) return 'vendor-socketio';
          if (id.includes('livekit-client') || id.includes('@livekit/')) return 'vendor-livekit';
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-map';
          // Globe 3D (Three.js/R3F) : chunk isolé, jamais chargé sur natif
          // (canUseGlobeView() exclut ios/android) — atteint uniquement via
          // le dynamic-import de GlobeView côté PWA/web mobile. Résolu via
          // web/app/node_modules (pas de dépendance @react-three/* propre à
          // apptel — cf. apptelSrcFallback qui overlay web/app/src).
          if (id.includes('/three/') || id.includes('/three-') || id.includes('@react-three')) {
            return 'vendor-globe';
          }
          return 'vendor-misc';
        },
      },
    },
  },
});
