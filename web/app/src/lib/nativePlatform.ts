/**
 * Détection plateforme native Capacitor — sans import @capacitor/core.
 *
 * window.Capacitor est injecté par le bridge Capacitor AVANT le démarrage de React.
 * En PWA / navigateur web, cet objet est absent → retourne false.
 * Cela permet d'utiliser ce helper dans app/src/ (sans dépendance Capacitor)
 * tout en fonctionnant correctement dans ios/apptel/ (build Capacitor natif).
 */

type CapacitorBridge = { getPlatform?: () => string };

function getCapacitorBridge(): CapacitorBridge | undefined {
  try {
    return (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
  } catch {
    return undefined;
  }
}

/**
 * Retourne true uniquement dans un build Capacitor natif iOS (App Store).
 *
 * Utilisation : bloquer les paiements Stripe sur iOS natif et rediriger
 * vers les achats in-app (App Store Guideline 3.1.1).
 */
export function isNativeIos(): boolean {
  return getCapacitorBridge()?.getPlatform?.() === 'ios';
}

/** Retourne true dans tout build Capacitor natif (iOS ou Android). */
export function isNativeApp(): boolean {
  const platform = getCapacitorBridge()?.getPlatform?.();
  return platform === 'ios' || platform === 'android';
}
