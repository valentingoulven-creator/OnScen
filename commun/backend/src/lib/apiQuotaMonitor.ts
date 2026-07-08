/**
 * Lightweight in-memory quota/error-rate monitor for third-party APIs
 * (ACRCloud, Sightengine) that don't expose a quota-remaining header.
 *
 * Pattern mirrors serverMonitor.ts (rolling window + sendMonitoringAlert),
 * kept in-memory (no DB table exists for this) — acceptable because a
 * single-process VPS deployment (pm2, no horizontal scaling) means the
 * window naturally resets on deploy/restart, which is fine for an
 * operational "quota exhausted / API degraded" signal, not a billing record.
 *
 * Audit Medium #3/#4 — no ACRCloud/Sightengine quota monitoring.
 */

import { sendMonitoringAlert, type AlertType } from './alertNotifier';

export type MonitoredApiService = 'acrcloud' | 'sightengine';

const WINDOW_SIZE = parseInt(process.env.API_QUOTA_WINDOW_SIZE ?? '50', 10);
const ERROR_RATE_THRESHOLD = parseFloat(process.env.API_QUOTA_ERROR_RATE_THRESHOLD ?? '0.2'); // 20%
const MIN_SAMPLES_BEFORE_ALERT = 10;

interface ServiceStats {
  /** Rolling window of the last N call outcomes (true = success). */
  window: boolean[];
  totalCalls: number;
  totalErrors: number;
}

const stats = new Map<MonitoredApiService, ServiceStats>();

const ALERT_TYPE_BY_SERVICE: Record<MonitoredApiService, AlertType> = {
  acrcloud: 'acrcloud_error_rate',
  sightengine: 'sightengine_error_rate',
};

const SERVICE_LABEL: Record<MonitoredApiService, string> = {
  acrcloud: 'ACRCloud',
  sightengine: 'Sightengine',
};

function getStats(service: MonitoredApiService): ServiceStats {
  let s = stats.get(service);
  if (!s) {
    s = { window: [], totalCalls: 0, totalErrors: 0 };
    stats.set(service, s);
  }
  return s;
}

/**
 * Records the outcome of one API call and triggers a monitoring alert
 * (via alertNotifier.ts) when the error rate over the last WINDOW_SIZE
 * calls exceeds ERROR_RATE_THRESHOLD. Fire-and-forget: never throws, never
 * blocks the caller's request path.
 */
export function recordApiCall(service: MonitoredApiService, success: boolean): void {
  const s = getStats(service);
  s.window.push(success);
  if (s.window.length > WINDOW_SIZE) s.window.shift();
  s.totalCalls += 1;
  if (!success) s.totalErrors += 1;

  if (s.window.length < MIN_SAMPLES_BEFORE_ALERT) return;

  const errors = s.window.filter((ok) => !ok).length;
  const errorRate = errors / s.window.length;
  if (errorRate <= ERROR_RATE_THRESHOLD) return;

  const percent = Math.round(errorRate * 100);
  void sendMonitoringAlert({
    type: ALERT_TYPE_BY_SERVICE[service],
    severity: errorRate >= 0.5 ? 'critical' : 'warning',
    message:
      `Taux d'erreur ${SERVICE_LABEL[service]} à ${percent}% sur les ${s.window.length} derniers appels ` +
      `(seuil : ${Math.round(ERROR_RATE_THRESHOLD * 100)}%).\n` +
      `Cumulé depuis le démarrage : ${s.totalErrors}/${s.totalCalls} erreurs. ` +
      `Cause probable : quota dépassé, credentials invalides, ou panne API tierce.`,
    value: percent,
    threshold: Math.round(ERROR_RATE_THRESHOLD * 100),
  }).catch((err) => {
    console.error(`[apiQuotaMonitor] Échec envoi alerte ${service}:`, err);
  });
}

/** Snapshot for admin/debug endpoints (no PII, in-memory counters only). */
export function getApiQuotaStatsSnapshot(): Record<
  MonitoredApiService,
  { windowSize: number; windowErrorRate: number; totalCalls: number; totalErrors: number }
> {
  const snapshot = {} as ReturnType<typeof getApiQuotaStatsSnapshot>;
  for (const service of ['acrcloud', 'sightengine'] as MonitoredApiService[]) {
    const s = getStats(service);
    const errors = s.window.filter((ok) => !ok).length;
    snapshot[service] = {
      windowSize: s.window.length,
      windowErrorRate: s.window.length > 0 ? errors / s.window.length : 0,
      totalCalls: s.totalCalls,
      totalErrors: s.totalErrors,
    };
  }
  return snapshot;
}

/** Test-only: reset in-memory counters between test cases. */
export function resetApiQuotaMonitorForTests(): void {
  stats.clear();
}
