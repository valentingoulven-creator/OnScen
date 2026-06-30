import Stripe from 'stripe';
import { getOptionalRedis } from './optionalRedis';
import { isEmailConfigured } from './emailSend';
import { isLiveKitConfigured, pingLiveKit } from './livekit';

export type ServiceHealthStatus = 'ok' | 'error' | 'disabled';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

async function checkRedisHealth(): Promise<ServiceHealthStatus> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return 'disabled';
  try {
    const redis = await withTimeout(getOptionalRedis(), 2000);
    return redis?.isOpen ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

async function checkStripeHealth(): Promise<ServiceHealthStatus> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return 'disabled';
  try {
    const stripe = new Stripe(key);
    await withTimeout(stripe.balance.retrieve(), 3000);
    return 'ok';
  } catch {
    return 'error';
  }
}

function checkSmtpHealth(): ServiceHealthStatus {
  return isEmailConfigured() ? 'ok' : 'disabled';
}

async function checkLiveKitHealth(): Promise<ServiceHealthStatus> {
  if (!isLiveKitConfigured()) return 'disabled';
  try {
    const ok = await withTimeout(pingLiveKit(), 3000);
    return ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export interface ExternalServicesHealth {
  redis: ServiceHealthStatus;
  stripe: ServiceHealthStatus;
  smtp: ServiceHealthStatus;
  livekit: ServiceHealthStatus;
}

let cached: { result: ExternalServicesHealth; expiresAt: number } | null = null;
const CACHE_TTL_MS = 15_000;

/**
 * Vérifie l'état des services tiers critiques. N'impacte volontairement PAS
 * le statut HTTP global de /health (lequel reste piloté par PostgreSQL, seul
 * critère utilisé par PM2/Caddy watchdogs pour décider d'un restart) — sinon
 * une panne Stripe/LiveKit/SMTP isolée déclencherait des redémarrages inutiles
 * de l'app. Ces statuts sont exposés à titre d'observabilité (dashboards,
 * alertes manuelles). Résultat mis en cache 15s pour éviter de solliciter
 * Stripe/LiveKit à chaque appel si /health est interrogé fréquemment.
 */
export async function checkExternalServicesHealth(): Promise<ExternalServicesHealth> {
  if (cached && Date.now() < cached.expiresAt) return cached.result;
  const [redis, stripe, livekit] = await Promise.all([
    checkRedisHealth(),
    checkStripeHealth(),
    checkLiveKitHealth(),
  ]);
  const result: ExternalServicesHealth = { redis, stripe, smtp: checkSmtpHealth(), livekit };
  cached = { result, expiresAt: Date.now() + CACHE_TTL_MS };
  return result;
}
