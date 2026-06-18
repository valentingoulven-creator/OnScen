/**
 * Monitoring alert notifier.
 * Sends email alerts via SMTP (nodemailer) and keeps an in-memory history.
 * Re-uses SMTP config from .env: SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM.
 * Recipients: SMTP_ADMIN_EMAIL (default valentin.goulven@gmail.com) + ALERT_EXTRA_EMAILS (comma-sep).
 * Cooldown: same alert type cannot be emailed more than once per 30 min (configurable).
 */

import nodemailer from 'nodemailer';

export type AlertSeverity = 'warning' | 'critical';

export type AlertType =
  | 'disk'
  | 'ram'
  | 'cpu'
  | 'latency'
  | 'pm2_crash'
  | 'db_error'
  | 'stripe_error'
  | 'uncaught_exception'
  | 'unhandled_rejection';

export interface MonitoringAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  value?: number;
  threshold?: number;
  timestamp: string;
  sentEmail: boolean;
}

const MAX_HISTORY = 200;
const alertHistory: MonitoringAlert[] = [];

const cooldowns = new Map<AlertType, number>();
const COOLDOWN_MS = parseInt(process.env.ALERT_COOLDOWN_MS ?? '1800000', 10); // 30 min

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return _transporter;
}

function getRecipients(): string[] {
  const recipients = new Set<string>();
  recipients.add('valentin.goulven@gmail.com');
  const adminEmail = process.env.SMTP_ADMIN_EMAIL;
  if (adminEmail) recipients.add(adminEmail);
  const extra = process.env.ALERT_EXTRA_EMAILS ?? '';
  extra
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
    .forEach((e) => recipients.add(e));
  return Array.from(recipients);
}

function isCoolingDown(type: AlertType): boolean {
  const last = cooldowns.get(type);
  if (!last) return false;
  return Date.now() - last < COOLDOWN_MS;
}

const ALERT_ICONS: Record<AlertType, string> = {
  disk: '💾',
  ram: '🧠',
  cpu: '⚙️',
  latency: '⚡',
  pm2_crash: '💥',
  db_error: '🗄️',
  stripe_error: '💳',
  uncaught_exception: '🚨',
  unhandled_rejection: '⚠️',
};

const ALERT_LABELS: Record<AlertType, string> = {
  disk: 'Stockage disque élevé',
  ram: 'RAM élevée',
  cpu: 'CPU élevé',
  latency: 'Latence API élevée',
  pm2_crash: 'Crash PM2 détecté',
  db_error: 'Erreur base de données',
  stripe_error: 'Erreur webhook Stripe',
  uncaught_exception: 'Exception non capturée',
  unhandled_rejection: 'Promise rejection non gérée',
};

const ALERT_UNITS: Partial<Record<AlertType, string>> = {
  disk: '%',
  ram: '%',
  cpu: '%',
  latency: 'ms',
};

function buildEmailContent(alert: MonitoringAlert): { subject: string; html: string; text: string } {
  const icon = ALERT_ICONS[alert.type];
  const label = ALERT_LABELS[alert.type];
  const unit = ALERT_UNITS[alert.type] ?? '';
  const severityColor = alert.severity === 'critical' ? '#dc2626' : '#d97706';
  const severityLabel = alert.severity === 'critical' ? 'CRITIQUE' : 'AVERTISSEMENT';
  const adminUrl = `${process.env.WEB_APP_URL ?? 'https://getsoundy.com'}/admin?tab=monitoring`;
  const ts = new Date(alert.timestamp).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const safeMsgHtml = alert.message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const valueRows =
    alert.value !== undefined && alert.threshold !== undefined
      ? `<tr>
           <td style="padding:4px 8px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Valeur</td>
           <td style="padding:4px 0;font-weight:600;color:${severityColor};">${alert.value}${unit}</td>
         </tr>
         <tr>
           <td style="padding:4px 8px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Seuil</td>
           <td style="padding:4px 0;">${alert.threshold}${unit}</td>
         </tr>`
      : '';

  const subject = `${icon} [Soundy ${severityLabel}] ${label} — ${ts}`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <div style="background:${severityColor};color:#fff;padding:12px 16px;border-radius:8px 8px 0 0;">
        <span style="font-size:20px;">${icon}</span>
        <strong style="font-size:16px;margin-left:8px;">${severityLabel} — ${label}</strong>
      </div>
      <div style="border:2px solid ${severityColor};border-top:none;border-radius:0 0 8px 8px;padding:20px;">
        <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
          <tr>
            <td style="padding:4px 8px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Serveur</td>
            <td style="padding:4px 0;font-weight:600;">getsoundy.com (51.159.164.100)</td>
          </tr>
          <tr>
            <td style="padding:4px 8px 4px 0;color:#6b7280;font-size:14px;white-space:nowrap;">Heure (Paris)</td>
            <td style="padding:4px 0;">${ts}</td>
          </tr>
          ${valueRows}
        </table>
        <div style="background:#fef2f2;border-left:4px solid ${severityColor};padding:12px 16px;border-radius:4px;margin:16px 0;">
          <p style="margin:0;font-size:15px;white-space:pre-wrap;">${safeMsgHtml}</p>
        </div>
        <a href="${adminUrl}" style="display:inline-block;background:${severityColor};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;margin-top:8px;">
          Voir le monitoring →
        </a>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
        Alerte automatique Soundy — <a href="${adminUrl}" style="color:#7c3aed;">getsoundy.com/admin</a>
      </p>
    </div>`;

  const textLines = [
    `[Soundy ${severityLabel}] ${label}`,
    ``,
    `Serveur : getsoundy.com (51.159.164.100)`,
    `Heure   : ${ts}`,
    ...(alert.value !== undefined ? [`Valeur  : ${alert.value}${unit}`] : []),
    ...(alert.threshold !== undefined ? [`Seuil   : ${alert.threshold}${unit}`] : []),
    ``,
    alert.message,
    ``,
    `Voir le monitoring : ${adminUrl}`,
  ];

  return { subject, html, text: textLines.join('\n') };
}

export function getAlertHistory(): MonitoringAlert[] {
  return [...alertHistory].reverse();
}

export async function sendMonitoringAlert(params: {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  value?: number;
  threshold?: number;
  /** Bypass cooldown — use for critical one-time events */
  forceSend?: boolean;
}): Promise<void> {
  const { type, severity, message, value, threshold, forceSend } = params;

  const alert: MonitoringAlert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    severity,
    message,
    value,
    threshold,
    timestamp: new Date().toISOString(),
    sentEmail: false,
  };

  alertHistory.push(alert);
  if (alertHistory.length > MAX_HISTORY) alertHistory.shift();

  const transporter = getTransporter();
  if (!transporter) {
    if (process.env.APP_ENV === 'production') {
      console.warn(`[monitor] Alerte ${type} enregistrée — SMTP non configuré, email ignoré.`);
    }
    return;
  }

  const bypass = forceSend === true || severity === 'critical';
  if (!bypass && isCoolingDown(type)) {
    console.info(`[monitor] Alerte ${type} en cooldown (${COOLDOWN_MS / 60000} min) — email ignoré`);
    return;
  }

  cooldowns.set(type, Date.now());

  const recipients = getRecipients();
  const { subject, html, text } = buildEmailContent(alert);
  const from = process.env.SMTP_FROM ?? `Soundy Monitoring <${process.env.SMTP_USER}>`;

  try {
    await transporter.sendMail({ from, to: recipients.join(', '), subject, text, html });
    alert.sentEmail = true;
    console.info(`[monitor] Alerte email envoyée : ${type} (${severity}) → ${recipients.join(', ')}`);
  } catch (err) {
    console.error('[monitor] Échec envoi alerte email:', err);
  }
}
