import { isProductionEnv } from './jwtSecret';

export function isGoogleOAuthKeysPresent(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_CALLBACK_URL?.trim()
  );
}

/**
 * Login / YouTube OAuth publics.
 * En prod le client Google actuel est `deleted_client` — rester coupé
 * jusqu’à GOOGLE_OAUTH_PROD_ENABLED=1 (après recréation console).
 */
export function isGoogleOAuthPubliclyEnabled(): boolean {
  if (!isGoogleOAuthKeysPresent()) return false;
  if (isProductionEnv() && process.env.GOOGLE_OAUTH_PROD_ENABLED !== '1') return false;
  return true;
}
