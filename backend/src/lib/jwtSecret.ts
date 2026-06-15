const DEV_FALLBACK = 'melosong_secret_dev_fallback';

export function isProductionEnv(): boolean {
  return process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (isProductionEnv()) {
    throw new Error('[jwt] JWT_SECRET must be set in production — refusing to start with default key.');
  }
  console.warn(
    '[jwt] JWT_SECRET not set — using insecure development default. Set JWT_SECRET in .env before deploying to production.'
  );
  return DEV_FALLBACK;
}
