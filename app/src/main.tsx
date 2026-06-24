import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import './index.css';
import { initAppTheme } from './lib/appTheme';
import { initDiagnosticLogs } from './lib/diagnosticLogs';
import App from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import { MsdevEnvIndicator } from './components/MsdevEnvBadge.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { DmUnreadProvider } from './context/DmUnreadContext.tsx';
import { PhoneWebShell } from './components/PhoneWebShell.tsx';
import {
  isPhoneWebViewport,
  subscribePhoneWebViewport,
  syncPhoneWebViewportClass,
} from './lib/phoneViewport';
import { isNativeApp } from './lib/nativePlatform';

initAppTheme();
initDiagnosticLogs();

syncPhoneWebViewportClass();
subscribePhoneWebViewport(() => {
  syncPhoneWebViewportClass();
});

/** Design quick wins — build prod ou navigateur mobile (getsoundy.com). Pas de Google Fonts en natif Capacitor. */
const enableDesignQuickWins =
  !isNativeApp() &&
  (import.meta.env.VITE_DESIGN_QUICK_WINS === '1' || isPhoneWebViewport());
if (enableDesignQuickWins) {
  document.documentElement.setAttribute('data-design-quick-wins', '1');
  void import('@fontsource/plus-jakarta-sans/400.css');
  void import('@fontsource/plus-jakarta-sans/500.css');
  void import('@fontsource/plus-jakarta-sans/600.css');
  void import('@fontsource/plus-jakarta-sans/700.css');
}

const isMsdevBuild = import.meta.env.VITE_APP_ENV === 'msdev';

function showPwaUpdateBar(onUpdate: () => void): void {
  if (document.getElementById('pwa-update-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'pwa-update-bar';
  bar.setAttribute('role', 'status');
  bar.style.cssText =
    'position:fixed;bottom:calc(var(--tab-nav-total-h,4.5rem) + 0.5rem);left:0.75rem;right:0.75rem;z-index:65;' +
    'display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;' +
    'padding:0.625rem 0.875rem;border-radius:0.75rem;border:1px solid rgba(167,139,250,0.35);' +
    'background:#1a1a28;color:#e5e7eb;font:500 0.8125rem/1.35 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.35);' +
    'pointer-events:auto;max-width:calc(100vw - 1.5rem);margin:0 auto;';
  const text = document.createElement('span');
  text.textContent = 'Une nouvelle version de Soundy est disponible.';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:0.5rem;flex-shrink:0;';
  const later = document.createElement('button');
  later.type = 'button';
  later.textContent = 'Plus tard';
  later.style.cssText =
    'padding:0.4rem 0.75rem;border-radius:0.5rem;border:1px solid #4b5563;background:transparent;color:#9ca3af;cursor:pointer;';
  later.onclick = () => bar.remove();
  const update = document.createElement('button');
  update.type = 'button';
  update.textContent = 'Mettre à jour';
  update.style.cssText =
    'padding:0.4rem 0.75rem;border-radius:0.5rem;border:none;background:#7c3aed;color:#fff;font-weight:600;cursor:pointer;';
  update.onclick = () => {
    update.disabled = true;
    onUpdate();
  };
  actions.append(later, update);
  bar.append(text, actions);
  document.body.append(bar);
}

/** msdev : pas de SW actif (évite écran noir après app:build). Production : mise à jour PWA sur action utilisateur. */
if (import.meta.env.PROD && !isMsdevBuild) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      showPwaUpdateBar(() => {
        void updateSW(true);
      });
    },
  });
}

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(
  <StrictMode>
    <PhoneWebShell>
      <AppErrorBoundary>
        <AuthProvider>
          <DmUnreadProvider>
            <MsdevEnvIndicator />
            <App />
          </DmUnreadProvider>
        </AuthProvider>
      </AppErrorBoundary>
    </PhoneWebShell>
  </StrictMode>
);

document.getElementById('melosong-boot')?.remove();
