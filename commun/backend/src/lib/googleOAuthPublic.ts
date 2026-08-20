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
 * En prod, rester coupé tant que GOOGLE_OAUTH_PROD_ENABLED≠1
 * (évite d’exposer un client Console cassé).
 */
export function isGoogleOAuthPubliclyEnabled(): boolean {
  if (!isGoogleOAuthKeysPresent()) return false;
  if (isProductionEnv() && process.env.GOOGLE_OAUTH_PROD_ENABLED !== '1') return false;
  return true;
}
