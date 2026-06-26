import { getJwtSecret, isDeployedEnv, isProductionEnv } from './jwtSecret';
import { resolveCorsOrigin } from './corsConfig';
import { isPublisherConfigComplete } from './legalPublisher';
import { isAcrCloudConfigured } from './acrCloudConfig';

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

  if (!isPublisherConfigComplete()) {
    console.warn(
      '[startup] legal-publisher.json incomplet (LCEN art. 6) — renseignez l\'adresse postale ' +
        'dans legal-publisher.json ou LEGAL_PUBLISHER_ADDRESS dans .env (mentions non conformes tant que absent).'
    );
  }

  if (isProductionEnv() && !isAcrCloudConfigured()) {
    console.warn(
      '[startup] ACRCloud non configuré — uploads audio/vidéo sans scan empreinte catalogue commercial. ' +
        'Définissez ACRCLOUD_ACCESS_KEY et ACRCLOUD_ACCESS_SECRET (voir backend/.env.production.example).'
    );
  } else if (isAcrCloudConfigured()) {
    console.log('[startup] ACRCloud actif — scan copyright sur uploads compositions/reels');
  }

  const pm2Instances = Number(process.env.PM2_INSTANCES || process.env.NODE_APP_INSTANCE);
  if (!process.env.REDIS_URL?.trim() && pm2Instances > 1) {
    console.warn(
      '[startup] PM2 multi-instances sans REDIS_URL — Socket.io et rate limits peuvent diverger entre workers.'
    );
  }
}
