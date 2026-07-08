import { db } from '../models/schema';
import { purgeExpiredStories } from './stories';
import { purgeUnboundedChatHistory } from './chatHistory';
import { schedulePersist } from './persist';
import { canPersistDiagnosticLogs, pruneOldDiagnosticLogs } from './appDiagnosticLogs';

/** Notifications lues conservées 90 jours. */
const READ_NOTIFICATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
/** Notifications non lues conservées 180 jours. */
const UNREAD_NOTIFICATION_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
/** Jetons reset mot de passe expirés depuis > 7 jours. */
const RESET_TOKEN_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;

export function purgeStaleNotifications(now = Date.now()): number {
  const before = db.notifications.length;
  db.notifications = db.notifications.filter((n) => {
    const age = now - n.createdAt;
    if (n.read) return age <= READ_NOTIFICATION_RETENTION_MS;
    return age <= UNREAD_NOTIFICATION_RETENTION_MS;
  });
  return before - db.notifications.length;
}

export function purgeExpiredPasswordResetTokens(now = Date.now()): number {
  let cleared = 0;
  for (const user of db.users.values()) {
    if (!user.resetTokenExpiry) continue;
    if (now <= user.resetTokenExpiry) continue;
    if (now - user.resetTokenExpiry > RESET_TOKEN_GRACE_MS) {
      delete user.resetToken;
      delete user.resetTokenExpiry;
      cleared++;
    }
  }
  return cleared;
}

export async function runDataRetentionPass(now = Date.now()): Promise<{
  stories: number;
  notifications: number;
  resetTokens: number;
  diagnosticLogs: number;
  chatTrimmed: boolean;
}> {
  const storiesBefore = db.stories.length;
  purgeExpiredStories();
  const storiesRemoved = storiesBefore - db.stories.length;

  const notifications = purgeStaleNotifications(now);
  const resetTokens = purgeExpiredPasswordResetTokens(now);

  purgeUnboundedChatHistory();

  // RGPD : app_diagnostic_logs (user_id, username, user_agent, url, context — potentiellement
  // PII) n'avait jusqu'ici de purge que déclenchée au démarrage/après insertion (voir
  // appDiagnosticLogs.ts), jamais via ce passage périodique (toutes les 6h) commun au reste
  // du système de rétention. Rétention alignée sur RETENTION_INTERVAL (5 mois, dans la
  // fourchette 90-180 j recommandée par l'audit RGPD-2). No-op si PostgreSQL non configuré.
  let diagnosticLogs = 0;
  if (canPersistDiagnosticLogs()) {
    try {
      diagnosticLogs = await pruneOldDiagnosticLogs();
    } catch (err) {
      console.error('[data-retention] purge app_diagnostic_logs échouée:', err);
    }
  }

  if (storiesRemoved > 0 || notifications > 0 || resetTokens > 0) {
    schedulePersist();
  }

  return {
    stories: storiesRemoved,
    notifications,
    resetTokens,
    diagnosticLogs,
    chatTrimmed: true,
  };
}

export function startDataRetentionScheduler(): void {
  if (intervalId !== null) return;
  void runDataRetentionPass().catch((err) => {
    console.error('[data-retention] passe initiale échouée:', err);
  });
  intervalId = setInterval(() => {
    void runDataRetentionPass().catch((err) => {
      console.error('[data-retention] passe périodique échouée:', err);
    });
  }, CHECK_INTERVAL_MS);
}

export function stopDataRetentionScheduler(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
