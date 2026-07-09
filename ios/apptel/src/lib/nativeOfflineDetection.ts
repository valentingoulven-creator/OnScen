import { showErrorPopup } from './errorPopups';
import i18n from '../i18n';

/**
 * Bandeau global perte de connexion réseau (natif uniquement — le web a déjà
 * un signal équivalent via le disconnect socket + les popups d'erreur API).
 *
 * Sans ce listener, l'app native se dégrade silencieusement hors-ligne : pas
 * de spinner infini visible, pas d'erreur claire, juste des données vides ou
 * périmées (carte, fil, DM) sans que l'utilisateur comprenne pourquoi — cf.
 * audit mobile, gap "aucune détection offline globale".
 */
export function initNativeOfflineDetection(): void {
  if (typeof window === 'undefined' || !('addEventListener' in window)) return;

  window.addEventListener('offline', () => {
    showErrorPopup(i18n.t('errors.offline'), { kind: 'warning' });
  });

  window.addEventListener('online', () => {
    showErrorPopup(i18n.t('errors.backOnline'), { kind: 'warning' });
  });

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    showErrorPopup(i18n.t('errors.offline'), { kind: 'warning' });
  }
}
