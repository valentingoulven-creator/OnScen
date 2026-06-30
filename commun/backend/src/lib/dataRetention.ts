import { db } from '../models/schema';
import { purgeExpiredStories } from './stories';
import { purgeUnboundedChatHistory } from './chatHistory';
import { schedulePersist } from './persist';

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

export function runDataRetentionPass(now = Date.now()): {
  stories: number;
  notifications: number;
  resetTokens: number;
  chatTrimmed: boolean;
} {
  const storiesBefore = db.stories.length;
  purgeExpiredStories();
  const storiesRemoved = storiesBefore - db.stories.length;

  const notifications = purgeStaleNotifications(now);
  const resetTokens = purgeExpiredPasswordResetTokens(now);

  purgeUnboundedChatHistory();

  if (storiesRemoved > 0 || notifications > 0 || resetTokens > 0) {
    schedulePersist();
  }

  return {
    stories: storiesRemoved,
    notifications,
    resetTokens,
    chatTrimmed: true,
  };
}

export function startDataRetentionScheduler(): void {
  if (intervalId !== null) return;
  runDataRetentionPass();
  intervalId = setInterval(() => runDataRetentionPass(), CHECK_INTERVAL_MS);
}

export function stopDataRetentionScheduler(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
