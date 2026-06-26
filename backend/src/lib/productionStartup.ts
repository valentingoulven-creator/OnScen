import { getJwtSecret, isDeployedEnv } from './jwtSecret';
import { resolveCorsOrigin } from './corsConfig';

/** Fail fast when critical production env vars are missing. */
export function assertProductionStartup(): void {
  if (!isDeployedEnv()) return;

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
    throw new Error(
      '[startup] SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET must be set in production — UGC moderation is mandatory.'
    );
  }

  if (process.env.REDIS_URL?.trim()) {
    console.log('[startup] REDIS_URL configuré — adapter Socket.io cluster actif si deps présentes');
  } else {
    console.warn('[startup] REDIS_URL absent — Socket.io mono-processus (OK pour 1 worker PM2)');
  }

  if (process.env.S3_BUCKET?.trim()) {
    console.log(`[startup] S3 uploads actifs — bucket ${process.env.S3_BUCKET.trim()}`);
  }
}
