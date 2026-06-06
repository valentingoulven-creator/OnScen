import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Plugin Vite : "overlay" de apptel/src sur app/src.
 *
 * Principe : app/src/ est la source de vérité unique.
 *   - Si un fichier existe dans apptel/src/ → version spécifique téléphone (override).
 *   - Sinon → Vite charge automatiquement le fichier depuis app/src/.
 *
 * Avantage : tout nouveau fichier ajouté dans app/src/ est immédiatement
 * disponible dans apptel SANS aucune copie manuelle.
 */
function apptelSrcFallback() {
  const apptelSrc = path.resolve(__dirname, 'src');
  const appSrc = path.resolve(__dirname, '../app/src');
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

  return {
    name: 'apptel-src-fallback',
    enforce: 'pre' as const,
    resolveId(id: string, importer: string | undefined): string | undefined {
      if (!importer || !id.startsWith('.')) return undefined;

      const importerDir = path.dirname(importer);
      const resolved = path.resolve(importerDir, id);

      const relToApptel = path.relative(apptelSrc, resolved);
      const relToApp = path.relative(appSrc, resolved);
      const inApptel = !relToApptel.startsWith('..');
      const inApp = !relToApp.startsWith('..');

      if (inApptel) {
        // Import dans le territoire apptel/src :
        // si le fichier existe → Vite gère normalement
        // sinon → fallback vers app/src (fichier partagé)
        if (tryResolve(apptelSrc, relToApptel)) return undefined;
        return tryResolve(appSrc, relToApptel);
      }

      if (inApp) {
        // Import dans le territoire app/src :
        // si apptel/src a un override → l'utiliser
        return tryResolve(apptelSrc, relToApp);
      }

      return undefined;
    },
  };
}

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

export default defineConfig({
  base: '/tel/',
  define: {
    'import.meta.env.VITE_APP_ENV': JSON.stringify(process.env.VITE_APP_ENV || 'msdev'),
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
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Soundly Tel',
        short_name: 'Soundly',
        description: "Salons d'écoute musicale géolocalisés — optimisé téléphone",
        start_url: '/tel/',
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
      },
      workbox: {
        /**
         * Clé de cache versionnée : changer manuellement si un conflit de cache
         * majeur survient et que la purge automatique (index.html) ne suffit pas.
         */
        cacheId: 'melosong-msdev-v7',
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
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 4082,
    proxy: {
      '/api': msdevProxy,
      '/socket.io': { ...msdevProxy, ws: true },
    },
  },
  build: {
    outDir: '../backend/public/tel',
    emptyOutDir: true,
  },
});
