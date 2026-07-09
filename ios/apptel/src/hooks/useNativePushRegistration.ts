import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from '../lib/api';

/**
 * Enregistre les notifications push natives (FCM iOS/Android) une fois l'utilisateur
 * connecté — équivalent natif de `useWebPushRegistration` (Web Push ne fonctionne pas
 * dans une WebView Capacitor packagée, en arrière-plan ou app fermée).
 *
 * Best-effort : toute erreur (permission refusée, plateforme non supportée, backend
 * Firebase non configuré côté serveur) est silencieuse — jamais bloquant pour l'UI.
 */
export function useNativePushRegistration(token: string | null): void {
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!token || attemptedRef.current) return;
    if (!Capacitor.isNativePlatform()) return;
    const platform = Capacitor.getPlatform();
    if (platform !== 'ios' && platform !== 'android') return;

    attemptedRef.current = true;

    let registrationListener: { remove: () => void } | undefined;
    let errorListener: { remove: () => void } | undefined;

    void (async () => {
      try {
        const current = await PushNotifications.checkPermissions();
        let status = current.receive;
        if (status === 'prompt' || status === 'prompt-with-rationale') {
          const requested = await PushNotifications.requestPermissions();
          status = requested.receive;
        }
        if (status !== 'granted') return;

        registrationListener = await PushNotifications.addListener(
          'registration',
          (tokenResult) => {
            void api
              .registerNativePushToken(token, { token: tokenResult.value, platform })
              .catch(() => {
                /* échec silencieux — retentera à la prochaine connexion */
              });
          }
        );
        errorListener = await PushNotifications.addListener('registrationError', (err) => {
          console.warn('[nativePush] registration error:', err);
        });

        await PushNotifications.register();
      } catch (err) {
        console.warn('[nativePush] setup failed:', err);
      }
    })();

    return () => {
      registrationListener?.remove();
      errorListener?.remove();
    };
  }, [token]);
}
