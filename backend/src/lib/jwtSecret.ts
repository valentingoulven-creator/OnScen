const DEV_FALLBACK = 'melosong_secret_dev_fallback';

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
  console.warn(
    '[jwt] JWT_SECRET not set — using insecure development default. Set JWT_SECRET in .env before deploying to production.'
  );
  return DEV_FALLBACK;
}
