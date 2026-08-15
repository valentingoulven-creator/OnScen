import type { Request, Response } from 'express';

export const ONSCEN_CLIENT_HEADER = 'x-onscen-client';

export type OnScenClient = 'ios-native' | 'android-native' | 'web';

export function getOnScenClient(req: Request): OnScenClient {
  const raw = String(req.headers[ONSCEN_CLIENT_HEADER] || '').trim().toLowerCase();
  if (raw === 'ios-native' || raw === 'android-native' || raw === 'web') return raw;
  const ua = String(req.headers['user-agent'] || '');
  if (/Capacitor/i.test(ua)) {
    if (/iPhone|iPad|iOS/i.test(ua)) return 'ios-native';
    if (/Android/i.test(ua)) return 'android-native';
  }
  return 'web';
}

export function isNativeClient(req: Request): boolean {
  const client = getOnScenClient(req);
  return client === 'ios-native' || client === 'android-native';
}

/** Bloque Stripe / achats numériques dans le WebView natif (App Store 3.1.1 / Play Billing). */
export function rejectIfNativePayments(req: Request, res: Response): boolean {
  if (!isNativeClient(req)) return false;
  res.status(403).json({
    error: 'Les paiements numériques ne sont pas disponibles dans l’application mobile.',
    code: 'NATIVE_IAP_REQUIRED',
  });
  return true;
}
