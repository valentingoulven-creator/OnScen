/**
 * System resource monitor — RAM & CPU alerting via email.
 *
 * Env vars (all optional):
 *   RAM_ALERT_THRESHOLD   – RAM % that triggers a warning alert (default 85)
 *   CPU_ALERT_THRESHOLD   – CPU load % (1-min avg / cores) that triggers a warning (default 90)
 *   ALERT_EMAIL           – primary recipient for system alerts (default valentin.goulven@gmail.com)
 *
 * Debounce: at most one alert email per metric per hour.
 * Checks are run every 5 minutes (same as serverMonitor.ts).
 *
 * This module delegates to serverMonitor.ts (which also monitors disk and API latency).
 * RAM_ALERT_THRESHOLD / CPU_ALERT_THRESHOLD are mapped to the ALERT_RAM_PERCENT /
 * ALERT_CPU_PERCENT env vars expected by serverMonitor.ts so both naming conventions work.
 */

import os from 'os';
import { getEmailFrom, isEmailConfigured, sendEmail } from './emailSend';

const RAM_THRESHOLD = parseInt(process.env.RAM_ALERT_THRESHOLD ?? process.env.ALERT_RAM_PERCENT ?? '85', 10);
const CPU_THRESHOLD = parseInt(process.env.CPU_ALERT_THRESHOLD ?? process.env.ALERT_CPU_PERCENT ?? '90', 10);
const CHECK_INTERVAL_MS = parseInt(process.env.MONITOR_INTERVAL_MS ?? '300000', 10);
const DEBOUNCE_MS = 60 * 60 * 1000; // 1 hour per metric

const alertEmail = process.env.ALERT_EMAIL?.trim() || process.env.SMTP_ADMIN_EMAIL?.trim() || '';
if (!alertEmail && process.env.APP_ENV === 'production') {
  console.warn('[systemMonitor] AVERTISSEMENT : ALERT_EMAIL non défini — les alertes RAM/CPU ne seront pas envoyées.');
}

const lastAlertTime = new Map<'ram' | 'cpu', number>();

function isCoolingDown(metric: 'ram' | 'cpu'): boolean {
  const last = lastAlertTime.get(metric);
  return last !== undefined && Date.now() - last < DEBOUNCE_MS;
}

function getRamPercent(): number {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return Math.round((used / total) * 1000) / 10;
}

function getCpuPercent(): number | null {
  if (process.platform === 'win32') return null;
  const [load1m] = os.loadavg();
  const cores = os.cpus().length;
  if (!cores) return null;
  return Math.round((load1m / cores) * 1000) / 10;
}

async function sendSystemAlert(params: {
  metric: 'ram' | 'cpu';
  value: number;
  threshold: number;
}): Promise<void> {
  if (!isEmailConfigured()) return;
  if (isCoolingDown(params.metric)) return;

  lastAlertTime.set(params.metric, Date.now());

  const label = params.metric === 'ram' ? 'RAM' : 'CPU';
  const ts = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const subject = `🚨 [Soundy VPS] ${label} ${params.value}% - Action requise`;
  const adminUrl = `${process.env.WEB_APP_URL ?? 'https://getsoundy.com'}/admin?tab=monitoring`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <div style="background:#dc2626;color:#fff;padding:12px 16px;border-radius:8px 8px 0 0;">
        <span style="font-size:20px;">🚨</span>
        <strong style="font-size:16px;margin-left:8px;">ALERTE — ${label} élevé(e)</strong>
      </div>
      <div style="border:2px solid #dc2626;border-top:none;border-radius:0 0 8px 8px;padding:20px;">
        <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
          <tr>
            <td style="padding:4px 8px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Serveur</td>
            <td style="padding:4px 0;font-weight:600;">getsoundy.com</td>
          </tr>
          <tr>
            <td style="padding:4px 8px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Heure (Paris)</td>
            <td style="padding:4px 0;">${ts}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Valeur</td>
            <td style="padding:4px 0;font-weight:600;color:#dc2626;">${params.value}%</td>
          </tr>
          <tr>
            <td style="padding:4px 8px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Seuil</td>
            <td style="padding:4px 0;">${params.threshold}%</td>
          </tr>
        </table>
        <a href="${adminUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;margin-top:8px;">
          Voir le monitoring →
        </a>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
        Alerte automatique Soundy — <a href="${adminUrl}" style="color:#7c3aed;">getsoundy.com/admin</a>
      </p>
    </div>`;

  const text = [
    `[Soundy ALERTE] ${label} ${params.value}% (seuil : ${params.threshold}%)`,
    ``,
    `Serveur : getsoundy.com`,
    `Heure   : ${ts}`,
    ``,
    `Voir le monitoring : ${adminUrl}`,
  ].join('\n');

  try {
    if (!alertEmail) return;
    await sendEmail({ from: getEmailFrom('Soundy Monitoring'), to: alertEmail, subject, text, html });
    console.info(`[systemMonitor] Alerte ${label} envoyée à ${alertEmail} (${params.value}% > ${params.threshold}%)`);
  } catch (err) {
    console.error(`[systemMonitor] Échec envoi alerte ${label}:`, err);
  }
}

async function runChecks(): Promise<void> {
  try {
    const ramPercent = getRamPercent();
    if (ramPercent >= RAM_THRESHOLD) {
      await sendSystemAlert({ metric: 'ram', value: ramPercent, threshold: RAM_THRESHOLD });
    }

    const cpuPercent = getCpuPercent();
    if (cpuPercent !== null && cpuPercent >= CPU_THRESHOLD) {
      await sendSystemAlert({ metric: 'cpu', value: cpuPercent, threshold: CPU_THRESHOLD });
    }
  } catch (err) {
    console.error('[systemMonitor] Erreur lors des vérifications:', err);
  }
}

let monitorInterval: ReturnType<typeof setInterval> | null = null;

export function startSystemMonitor(): void {
  if (monitorInterval) return;
  if (process.env.APP_ENV !== 'production') return;

  // First check after 90 s to let the server stabilise, then every CHECK_INTERVAL_MS
  setTimeout(() => {
    void runChecks();
    monitorInterval = setInterval(() => void runChecks(), CHECK_INTERVAL_MS);
  }, 90_000);

  console.log(
    `[systemMonitor] Actif — seuils RAM ${RAM_THRESHOLD}%, CPU ${CPU_THRESHOLD}%, ` +
      `intervalle ${CHECK_INTERVAL_MS / 1000}s, alerte → ${alertEmail || '(non configuré)'}`
  );
}

export function stopSystemMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
