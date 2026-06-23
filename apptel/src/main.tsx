import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initAppTheme } from './lib/appTheme';
import { IS_NATIVE_BUILD } from './lib/nativeServer';
import { requestNativePermissions } from './lib/nativeBoot';
import { initNativeDeepLinks } from './lib/nativeDeepLink';
import App from './App.tsx';

initAppTheme();

if (IS_NATIVE_BUILD) {
  void requestNativePermissions();
  initNativeDeepLinks();
}
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { DmUnreadProvider } from './context/DmUnreadContext.tsx';

const isMsdevBuild = import.meta.env.VITE_APP_ENV === 'msdev';

/** PWA uniquement navigateur — pas de service worker en build Capacitor natif. */
if (import.meta.env.PROD && !isMsdevBuild && !IS_NATIVE_BUILD) {
  void import(/* @vite-ignore */ 'virtual:pwa-register').then(({ registerSW }) =>
    registerSW({ immediate: true })
  );
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
