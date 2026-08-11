import { useWebPushRegistration } from '../hooks/useWebPushRegistration';

/**
 * Point d'abstraction plateforme pour les rares fonctionnalités qui diffèrent
 * réellement entre le web (PWA navigateur) et le natif Capacitor (iOS/Android) :
 * l'enregistrement push et le bouton retour matériel Android.
 *
 * Par défaut (ce fichier, chargé sur web), délègue à Web Push et ignore le
 * bouton retour (pas de matériel dédié dans un navigateur).
 *
 * `ios/apptel/src/lib/platformShell.ts` override ce module pour brancher les
 * vraies API natives Capacitor — voir `ios/apptel/vite.config.ts`
 * (`apptelSrcFallback`) pour le mécanisme de résolution.
 */
export function usePlatformPushRegistration(token: string | null): void {
  useWebPushRegistration(token);
}

export function usePlatformBackButton(_onBack: () => boolean): void {
  // No-op sur le web : pas de bouton retour matériel à intercepter.
}
