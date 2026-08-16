import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './components/RoomTheaterLayout.mobile.css';
import './components/MapChrome.mobile.css';
import { initAppTheme } from './lib/appTheme';
import { IS_NATIVE_BUILD } from './lib/nativeServer';
import { requestNativePermissions } from './lib/nativeBoot';
import { initNativeDeepLinks } from './lib/nativeDeepLink';
import { initNativeOfflineDetection } from './lib/nativeOfflineDetection';
import { initNativeSentry } from './lib/sentryNative';
import App from './App.tsx';

initNativeSentry();

initAppTheme();

if (IS_NATIVE_BUILD) {
  void requestNativePermissions();
  initNativeDeepLinks();
  initNativeOfflineDetection();
}
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';
import { AuthProvider } from './context/AuthContext';
import { DmUnreadProvider } from './context/DmUnreadContext.tsx';
import { MusicPlayerProvider } from './context/MusicPlayerContext.tsx';
import { GlobalErrorPopup } from './components/GlobalErrorPopup.tsx';
import { MsdevEnvIndicator } from './components/MsdevEnvBadge.tsx';

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
  </StrictMode>
);

document.getElementById('onscen-boot')?.remove();
