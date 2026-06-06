import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { initAppTheme } from './lib/appTheme';
import App from './App.tsx';

initAppTheme();
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { DmUnreadProvider } from './context/DmUnreadContext.tsx';

const isMsdevBuild = import.meta.env.VITE_APP_ENV === 'msdev';

/** msdev : pas de SW actif (évite écran noir après app:build). Production : mise à jour PWA. */
if (import.meta.env.PROD && !isMsdevBuild) {
  registerSW({ immediate: true });
}

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(
  <StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <DmUnreadProvider>
          <App />
        </DmUnreadProvider>
      </AuthProvider>
    </AppErrorBoundary>
  </StrictMode>
);

document.getElementById('melosong-boot')?.remove();
