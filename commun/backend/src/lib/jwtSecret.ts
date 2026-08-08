import type { SignOptions, VerifyOptions } from 'jsonwebtoken';

const DEV_FALLBACK = 'onscen_secret_dev_fallback';

/** Explicit algorithm whitelist — prevents JWT algorithm confusion attacks. */
export const JWT_VERIFY_OPTIONS: VerifyOptions = { algorithms: ['HS256'] };
export const JWT_SIGN_OPTIONS: SignOptions = { algorithm: 'HS256' };

export function isPreproductionEnv(): boolean {
  return process.env.APP_ENV === 'preproduction';
}

/** Production strict (getsoundy.com) — pas la pré-prod (NODE_ENV=production sur staging). */
export function isProductionEnv(): boolean {
  return process.env.APP_ENV === 'production';
}

/** VPS déployé (prod ou pré-prod) — PostgreSQL, CORS, cookies secure, modération. */
export function isDeployedEnv(): boolean {
  return isProductionEnv() || isPreproductionEnv();
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (isDeployedEnv()) {
    throw new Error('[jwt] JWT_SECRET must be set in production — refusing to start with default key.');
  }
  if (process.env.NODE_ENV === 'test') {
    return DEV_FALLBACK;
  }
  throw new Error(
    '[jwt] JWT_SECRET must be set — refusing to start without an explicit secret. Set JWT_SECRET in your .env file (see .env.example).'
  );
}
