import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import './index.css';
import { initAppTheme } from './lib/appTheme';
import { initDiagnosticLogs } from './lib/diagnosticLogs';
import { initSentry } from './lib/sentry';
import { migrateAllLegacyStorageKeys } from './lib/storageKeys';
import App from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import { GlobalErrorPopup } from './components/GlobalErrorPopup.tsx';
import { MsdevEnvIndicator } from './components/MsdevEnvBadge.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { DmUnreadProvider } from './context/DmUnreadContext.tsx';
import { MusicPlayerProvider } from './context/MusicPlayerContext.tsx';
import { PhoneWebShell } from './components/PhoneWebShell.tsx';
import {
  isPhoneWebViewport,
  subscribePhoneWebViewport,
  syncPhoneWebViewportClass,
} from './lib/phoneViewport';
import { isNativeApp } from './lib/nativePlatform';

migrateAllLegacyStorageKeys();
initSentry();
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
  const text = document.createElement('span');
  text.textContent = 'Une nouvelle version de Soundy est disponible.';
  const actions = document.createElement('div');
  actions.className = 'pwa-update-bar__actions';
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'pwa-update-bar__btn';
  later.textContent = 'Plus tard';
  later.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    bar.remove();
  });
  const update = document.createElement('button');
  update.type = 'button';
  update.className = 'pwa-update-bar__btn pwa-update-bar__btn--primary';
  update.textContent = 'Mettre à jour';
  update.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    update.disabled = true;
    onUpdate();
  });
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
        <GlobalErrorPopup />
        <AuthProvider>
          <DmUnreadProvider>
            <MusicPlayerProvider>
              <MsdevEnvIndicator />
              <App />
            </MusicPlayerProvider>
          </DmUnreadProvider>
        </AuthProvider>
      </AppErrorBoundary>
    </PhoneWebShell>
  </StrictMode>
);

document.getElementById('melosong-boot')?.remove();
