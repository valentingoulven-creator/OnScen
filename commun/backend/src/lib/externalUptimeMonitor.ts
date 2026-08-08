/**
 * Ping public /health periodically — alerte email si indisponible (complète cron VPS).
 * Désactivé en msdev. Debounce 15 min par défaut.
 */
import { isDeployedEnv } from './jwtSecret';
import { isEmailConfigured, sendEmail } from './emailSend';

const CHECK_INTERVAL_MS = parseInt(process.env.UPTIME_CHECK_INTERVAL_MS ?? '300000', 10);
const DEBOUNCE_MS = parseInt(process.env.UPTIME_ALERT_DEBOUNCE_MS ?? '900000', 10);
const TIMEOUT_MS = parseInt(process.env.UPTIME_CHECK_TIMEOUT_MS ?? '10000', 10);

let lastOk = true;
let lastAlertAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function uptimeUrl(): string {
  const base = process.env.WEB_APP_URL?.trim() || 'https://getsoundy.com';
  return `${base.replace(/\/$/, '')}/health`;
}

async function checkPublicHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(uptimeUrl(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === 'OK' || body.status === 'degraded';
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendUptimeAlert(detail: string): Promise<void> {
  if (!isEmailConfigured()) return;
  if (Date.now() - lastAlertAt < DEBOUNCE_MS) return;
  lastAlertAt = Date.now();

  const adminEmail =
    process.env.ALERT_EMAIL?.trim() ||
    process.env.SMTP_ADMIN_EMAIL?.trim() ||
    'admin@getsoundy.com';
  const url = uptimeUrl();
  const ts = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  await sendEmail({
    to: adminEmail,
    subject: `[OnScen] Uptime — ${url} indisponible`,
    text: `Health check public failed at ${ts}. URL: ${url}. ${detail}`,
    html: `<p>Le health check public a échoué à <strong>${ts}</strong>.</p><p>URL : ${url}</p><p>${detail}</p>`,
  });
}

export function startExternalUptimeMonitor(): void {
  if (!isDeployedEnv()) return;
  if (process.env.UPTIME_MONITOR_ENABLED === '0') return;
  if (timer) return;

  void (async () => {
    const ok = await checkPublicHealth();
    lastOk = ok;
    if (!ok) {
      console.warn('[uptime] Health public KO au démarrage:', uptimeUrl());
    } else {
      console.log('[uptime] Monitor actif —', uptimeUrl());
    }
  })();

  timer = setInterval(() => {
    void (async () => {
      const ok = await checkPublicHealth();
      if (ok) {
        if (!lastOk) {
          console.log('[uptime] Health public rétabli:', uptimeUrl());
        }
        lastOk = true;
        return;
      }
      if (lastOk) {
        console.error('[uptime] Health public DOWN:', uptimeUrl());
        await sendUptimeAlert('Transition OK → échec détectée par le monitor applicatif.');
      }
      lastOk = false;
    })();
  }, CHECK_INTERVAL_MS);
}

/** Reset timer (tests). */
export function stopExternalUptimeMonitorForTests(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
