import { isAcrCloudConfigured, isAcrCloudEnabled, isMsdevRuntime } from './acrCloudConfig';
import { isCloudflareStreamConfigured } from './cloudflareStream';
import { isStripeConfigured } from './donations';
import { isEmailConfigured } from './emailSend';
import { isLiveKitConfigured } from './livekit';
import { isDeployedEnv, isPreproductionEnv, isProductionEnv } from './jwtSecret';
import { isPublisherConfigComplete } from './legalPublisher';
import { isSightengineConfigured } from './sightengineConfig';
import { getStripeKeyMode, isStripeTestMode } from './stripeConfig';
import { isWebPushConfigured } from './webPush';
import { isYoutubeOAuthConfigured } from './youtubeOAuth';
import {
  PROD_SAAS_CATALOG,
  PROD_SAAS_LINK_GROUPS,
  type ProdSaasCatalogEntry,
  type ProdSaasLinkGroup,
} from './prodSaasCatalog';

export type ProdSaasEnvironment = 'production' | 'preproduction' | 'msdev' | 'development';
export type ProdSaasServiceStatus = 'configured' | 'missing' | 'external' | 'disabled';
export type ProdSaasAlertSeverity = 'critical' | 'warning' | 'info';

export interface ProdSaasAlert {
  id: string;
  severity: ProdSaasAlertSeverity;
  messageKey: string;
}

export interface ProdSaasServiceReport {
  id: string;
  category: ProdSaasCatalogEntry['category'];
  requiredInProd: boolean;
  status: ProdSaasServiceStatus;
  configured: boolean;
  indicativeCost: string;
  note?: string;
  dashboardUrl?: string;
  docsUrl?: string;
  flags?: Record<string, boolean | string>;
}

export interface ProdSaasStatusReport {
  fetchedAt: string;
  environment: ProdSaasEnvironment;
  services: ProdSaasServiceReport[];
  linkGroups: ProdSaasLinkGroup[];
  alerts: ProdSaasAlert[];
}

function resolveEnvironment(): ProdSaasEnvironment {
  if (isProductionEnv()) return 'production';
  if (isPreproductionEnv()) return 'preproduction';
  if (isMsdevRuntime()) return 'msdev';
  return 'development';
}

function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_CALLBACK_URL?.trim()
  );
}

function isYoutubeApiKeyConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY?.trim());
}

function isScalewayObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.SCW_BUCKET?.trim() &&
      process.env.SCW_ACCESS_KEY?.trim() &&
      process.env.SCW_SECRET_KEY?.trim()
  );
}

function isS3UploadsConfigured(): boolean {
  return Boolean(process.env.S3_BUCKET?.trim() && process.env.S3_ACCESS_KEY_ID?.trim());
}

function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function isSentryConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim());
}

function isCoturnConfigured(): boolean {
  return Boolean(
    process.env.TURN_URL?.trim() &&
      process.env.TURN_USERNAME?.trim() &&
      process.env.TURN_CREDENTIAL?.trim()
  );
}

function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function buildAlerts(env: ProdSaasEnvironment): ProdSaasAlert[] {
  const alerts: ProdSaasAlert[] = [];

  if (env === 'production' && isStripeConfigured() && isStripeTestMode()) {
    alerts.push({
      id: 'stripe_test_on_production',
      severity: 'critical',
      messageKey: 'admin.costs.saas.alerts.stripeTestOnProd',
    });
  }

  if (isProductionEnv() && !isAcrCloudConfigured()) {
    alerts.push({
      id: 'acrcloud_missing',
      severity: 'warning',
      messageKey: 'admin.costs.saas.alerts.acrcloudMissing',
    });
  }

  if (isDeployedEnv() && !isPublisherConfigComplete()) {
    alerts.push({
      id: 'legal_incomplete',
      severity: 'critical',
      messageKey: 'admin.costs.saas.alerts.legalIncomplete',
    });
  }

  if (isDeployedEnv() && !isAnthropicConfigured() && !isOpenAiConfigured()) {
    alerts.push({
      id: 'ai_agents_unconfigured',
      severity: 'info',
      messageKey: 'admin.costs.saas.alerts.aiAgentsMissing',
    });
  }

  if (isPreproductionEnv() && !isS3UploadsConfigured()) {
    alerts.push({
      id: 'staging_s3_missing',
      severity: 'warning',
      messageKey: 'admin.costs.saas.alerts.stagingS3Missing',
    });
  }

  if (!isSentryConfigured()) {
    alerts.push({
      id: 'sentry_missing',
      severity: 'info',
      messageKey: 'admin.costs.saas.alerts.sentryMissing',
    });
  }

  return alerts;
}

function resolveServiceStatus(
  entry: ProdSaasCatalogEntry
): Pick<ProdSaasServiceReport, 'status' | 'configured' | 'flags'> {
  switch (entry.id) {
    case 'scaleway_vps':
      return {
        status: isDeployedEnv() ? 'external' : 'missing',
        configured: isDeployedEnv(),
      };
    case 'scaleway_pg':
      return {
        status: isDatabaseConfigured() ? 'configured' : 'missing',
        configured: isDatabaseConfigured(),
      };
    case 'scaleway_object_storage': {
      const configured = isScalewayObjectStorageConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 's3_uploads': {
      const configured = isS3UploadsConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'gmail_workspace':
      return { status: 'external', configured: true };
    case 'cloudflare_stream': {
      const configured = isCloudflareStreamConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'livekit': {
      const configured = isLiveKitConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'coturn': {
      const configured = isCoturnConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'sightengine': {
      const configured = isSightengineConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'acrcloud': {
      if (!isAcrCloudEnabled()) {
        return { status: 'disabled', configured: false, flags: { enabled: false } };
      }
      const configured = isAcrCloudConfigured();
      return {
        status: configured ? 'configured' : 'missing',
        configured,
        flags: { enabled: true },
      };
    }
    case 'stripe': {
      const configured = isStripeConfigured();
      const mode = getStripeKeyMode();
      return {
        status: configured ? 'configured' : 'missing',
        configured,
        flags: {
          donationsEnabled: process.env.DONATIONS_ENABLED === '1',
          subscriptionsEnabled: process.env.SUBSCRIPTIONS_ENABLED === '1',
          stripeMode: mode,
          stripeTest: mode === 'test',
          stripeLive: mode === 'live',
        },
      };
    }
    case 'resend': {
      const configured = isEmailConfigured();
      return {
        status: configured ? 'configured' : 'missing',
        configured,
        flags: { resend: Boolean(process.env.RESEND_API_KEY?.trim()) },
      };
    }
    case 'google_oauth': {
      const configured = isGoogleOAuthConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'youtube_oauth': {
      const configured = isYoutubeOAuthConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'youtube_api_key': {
      const configured = isYoutubeApiKeyConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'redis': {
      const configured = isRedisConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'web_push': {
      const configured = isWebPushConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'anthropic': {
      const configured = isAnthropicConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'openai': {
      const configured = isOpenAiConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'sentry': {
      const configured = isSentryConfigured();
      return { status: configured ? 'configured' : 'missing', configured };
    }
    case 'legal_publisher': {
      const configured = isPublisherConfigComplete();
      return {
        status: configured ? 'configured' : 'missing',
        configured,
      };
    }
    case 'geo_apis':
      return { status: 'external', configured: true };
    default:
      return { status: 'missing', configured: false };
  }
}

export function getProdSaasStatusReport(): ProdSaasStatusReport {
  const environment = resolveEnvironment();
  const services: ProdSaasServiceReport[] = PROD_SAAS_CATALOG.map((entry) => {
    const resolved = resolveServiceStatus(entry);
    return {
      id: entry.id,
      category: entry.category,
      requiredInProd: entry.requiredInProd,
      indicativeCost: entry.indicativeCost,
      note: entry.note,
      dashboardUrl: entry.dashboardUrl,
      docsUrl: entry.docsUrl,
      ...resolved,
    };
  });

  return {
    fetchedAt: new Date().toISOString(),
    environment,
    services,
    linkGroups: PROD_SAAS_LINK_GROUPS,
    alerts: buildAlerts(environment),
  };
}
