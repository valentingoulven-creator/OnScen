import { getJwtSecret, isDeployedEnv, isPreproductionEnv, isProductionEnv } from './jwtSecret';
import { resolveCorsOrigin } from './corsConfig';
import { isPublisherConfigComplete } from './legalPublisher';
import { isAcrCloudConfigured } from './acrCloudConfig';
import { assertOpsHealthTokenConfigured } from '../middleware/opsHealthAuth';

function assertTotpEncryptionKey(): void {
  const key = process.env.TOTP_ENCRYPTION_KEY?.trim() ?? '';
  if (!/^[0-9a-f]{64}$/i.test(key)) {
    throw new Error(
      '[startup] TOTP_ENCRYPTION_KEY must be set (64 hex chars) in production — ' +
        'refusing to store 2FA secrets without encryption. Generate: openssl rand -hex 32'
    );
  }
}

function assertEncryptionKeyDistinctFromJwt(): void {
  const enc = process.env.ENCRYPTION_KEY?.trim();
  const jwt = process.env.JWT_SECRET?.trim();
  if (enc && jwt && enc === jwt) {
    throw new Error(
      '[startup] ENCRYPTION_KEY must differ from JWT_SECRET in production/preproduction.'
    );
  }
}

/** Fail fast when critical production env vars are missing. */
export function assertProductionStartup(): void {
  if (!isDeployedEnv()) return;

  getJwtSecret();
  assertEncryptionKeyDistinctFromJwt();
  assertTotpEncryptionKey();
  assertOpsHealthTokenConfigured();

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

  const pm2Instances = Number(process.env.PM2_INSTANCES?.trim() || '1');
  if (!process.env.REDIS_URL?.trim() && pm2Instances > 1) {
    throw new Error(
      '[startup] REDIS_URL is required when PM2_INSTANCES > 1 — rate limits, OAuth and Socket.io must be cluster-safe.'
    );
  }

  if (process.env.REDIS_URL?.trim()) {
    console.log('[startup] REDIS_URL configuré — adapter Socket.io cluster + stores Redis actifs');
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

  if (process.env.DONATIONS_ENABLED === '1' && !process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    throw new Error(
      '[startup] STRIPE_WEBHOOK_SECRET must be set when DONATIONS_ENABLED=1 — ' +
        'refusing to start with an unverifiable donations webhook (risk of unsigned/forged events).'
    );
  }

  if (
    process.env.SUBSCRIPTIONS_ENABLED === '1' &&
    !process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET?.trim() &&
    !process.env.STRIPE_WEBHOOK_SECRET?.trim()
  ) {
    throw new Error(
      '[startup] STRIPE_SUBSCRIPTION_WEBHOOK_SECRET (ou STRIPE_WEBHOOK_SECRET en fallback) must be set ' +
        'when SUBSCRIPTIONS_ENABLED=1 — refusing to start with an unverifiable subscriptions webhook.'
    );
  }

  if (isProductionEnv() && process.env.GOOGLE_OAUTH_PROD_ENABLED !== '1') {
    console.warn(
      '[startup] Google / YouTube OAuth publics coupés (client prod deleted_client). ' +
        'Après recréation du client console : GOOGLE_OAUTH_PROD_ENABLED=1'
    );
  }

  if (isProductionEnv() && process.env.STRIPE_SECRET_KEY?.trim().startsWith('sk_test_')) {
    console.warn(
      '[startup] STRIPE_SECRET_KEY est en mode TEST (sk_test_) sur APP_ENV=production — ' +
        'les paiements réels et Stripe Connect live sont désactivés. Passez à sk_live_ avant ouverture publique.'
    );
  }

  if (!process.env.SENTRY_DSN?.trim()) {
    if (isProductionEnv()) {
      throw new Error(
        '[startup] SENTRY_DSN must be set in production — error monitoring is mandatory.'
      );
    }
    if (isPreproductionEnv()) {
      console.warn('[startup] SENTRY_DSN absent — erreurs staging non remontées.');
    }
  }
}
