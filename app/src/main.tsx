import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import './index.css';
import { initAppTheme } from './lib/appTheme';
import App from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import { MsdevEnvIndicator } from './components/MsdevEnvBadge.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { DmUnreadProvider } from './context/DmUnreadContext.tsx';

initAppTheme();

/** Design quick wins locaux — activer via VITE_DESIGN_QUICK_WINS=1 (.env.development.local). */
if (import.meta.env.VITE_DESIGN_QUICK_WINS === '1') {
  document.documentElement.setAttribute('data-design-quick-wins', '1');
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href =
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
  document.head.appendChild(fontLink);
}

const isMsdevBuild = import.meta.env.VITE_APP_ENV === 'msdev';

/** msdev : pas de SW actif (évite écran noir après app:build). Production : mise à jour PWA automatique. */
if (import.meta.env.PROD && !isMsdevBuild) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Nouveau déploiement : activer le SW immédiatement puis recharger (chunks hashés).
      void updateSW(true).then(() => {
        window.location.reload();
      });
    },
  });
}

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(
  <StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <DmUnreadProvider>
          <MsdevEnvIndicator />
          <App />
        </DmUnreadProvider>
      </AuthProvider>
    </AppErrorBoundary>
  </StrictMode>
);

document.getElementById('melosong-boot')?.remove();
