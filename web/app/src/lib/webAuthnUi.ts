import { isNativeApp } from './nativePlatform';

/**
 * Face ID / empreinte (WebAuthn) : offert en natif partout,
 * et sur le web hors production uniquement.
 */
export function isWebAuthnOffered(): boolean {
  if (isNativeApp()) return true;
  return import.meta.env.VITE_APP_ENV !== 'production';
}
