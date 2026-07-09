import { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';

/**
 * Gère le bouton retour matériel Android (Capacitor `backButton`).
 *
 * Sans ce listener, la navigation interne (overlays profil/salon/live, onglets)
 * vit uniquement dans l'état React et n'est pas reliée à l'historique du
 * WebView : le bouton retour matériel ferme alors directement l'app (ou a un
 * comportement WebView imprévisible) au lieu de fermer l'overlay ouvert.
 *
 * `onBack` doit retourner `true` s'il a consommé l'appui (fermé un overlay,
 * changé d'onglet, etc.), ou `false` si l'app est déjà à son état "racine" —
 * dans ce cas on minimise l'app (comportement standard Android) plutôt que de
 * la tuer brutalement avec `exitApp()`.
 *
 * `onBack` est lu via une ref à chaque appui (mise à jour à chaque render) :
 * l'abonnement natif Capacitor n'est fait qu'une seule fois au montage, pour
 * éviter un remove/add du listener natif à chaque changement de state.
 */
export function useAndroidBackButton(onBack: () => boolean): void {
  const onBackRef = useRef(onBack);

  // Pattern "latest ref" : la mise à jour se fait dans un effet (pas pendant le
  // render, cf. règle react-hooks/refs — React Compiler) pour toujours appeler
  // la version la plus récente de `onBack` sans réabonner le listener natif.
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    let cancelled = false;

    void CapApp.addListener('backButton', () => {
      const consumed = onBackRef.current();
      if (!consumed) {
        void CapApp.minimizeApp().catch(() => {
          /* no-op web/iOS : minimizeApp est Android-only, rejette sans crasher */
        });
      }
    }).then((h) => {
      if (cancelled) {
        h.remove();
        return;
      }
      handle = h;
    });

    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, []);
}
