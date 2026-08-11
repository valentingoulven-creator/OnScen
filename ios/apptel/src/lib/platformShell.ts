import { useNativePushRegistration } from '../hooks/useNativePushRegistration';
import { useAndroidBackButton } from '../hooks/useAndroidBackButton';

/**
 * Override natif de `web/app/src/lib/platformShell.ts` — bascule le push et
 * le bouton retour matériel vers les vraies API Capacitor (iOS/Android).
 */
export function usePlatformPushRegistration(token: string | null): void {
  useNativePushRegistration(token);
}

export function usePlatformBackButton(onBack: () => boolean): void {
  useAndroidBackButton(onBack);
}
