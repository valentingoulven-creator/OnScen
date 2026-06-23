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

  if (process.env.SKIP_EMAIL_VERIFICATION === 'true') {
    throw new Error(
      '[startup] SKIP_EMAIL_VERIFICATION must not be enabled in production.'
    );
  }

  if (!process.env.ENCRYPTION_KEY?.trim()) {
    throw new Error(
      '[startup] ENCRYPTION_KEY must be set in production — OAuth tokens cannot be stored safely.'
    );
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      '[startup] DATABASE_URL must be set in production — refusing to run with store.json fallback.'
    );
  }

  if (!process.env.SIGHTENGINE_API_USER?.trim() || !process.env.SIGHTENGINE_API_SECRET?.trim()) {
    console.warn(
      '[startup] Sightengine not configured — UGC image/video uploads will be rejected in production.'
    );
  }
}
