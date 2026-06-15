import { getJwtSecret, isProductionEnv } from './jwtSecret';
import { resolveCorsOrigin } from './corsConfig';

/** Fail fast when critical production env vars are missing. */
export function assertProductionStartup(): void {
  if (!isProductionEnv()) return;

  getJwtSecret();

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  if (!corsOrigin) {
    throw new Error(
      '[startup] CORS_ORIGIN must be set in production — refusing to start with origin "*".'
    );
  }

  // Validates parse logic (throws on empty origin list).
  resolveCorsOrigin();

  if (!process.env.DATABASE_URL?.trim()) {
    console.warn(
      '[startup] DATABASE_URL absent — falling back to store.json local persistence (not recommended in production).'
    );
  }
}
