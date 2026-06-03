import { db, AppNotification } from '../models/schema';
import { getIo } from './ioInstance';

/** Heart-sent alerts are intentionally disabled — only match/live/don notifications. */
export function isDeliverableNotificationType(type: string): boolean {
  return type !== 'heart';
}

export function purgeHeartNotifications(): number {
  const before = db.notifications.length;
  const kept = db.notifications.filter((n) => isDeliverableNotificationType(n.type));
  db.notifications.length = 0;
  db.notifications.push(...kept);
  return before - kept.length;
}

export function pushNotification(
  n: Omit<AppNotification, 'id' | 'read' | 'createdAt'> & { id?: string }
): AppNotification | null {
  if (!isDeliverableNotificationType(n.type)) return null;

  const notification: AppNotification = {
    id: n.id ?? `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recipientId: n.recipientId,
    senderId: n.senderId,
    senderName: n.senderName,
    senderAvatarUrl: n.senderAvatarUrl,
    type: n.type,
    message: n.message,
    matchId: n.matchId,
    liveId: n.liveId,
    read: false,
    createdAt: Date.now(),
  };
  db.notifications.push(notification);
  getIo()?.to(`user_${n.recipientId}`).emit('notification', {
    id: notification.id,
    type: notification.type,
    senderId: notification.senderId,
    senderName: notification.senderName,
    senderAvatarUrl: notification.senderAvatarUrl,
    message: notification.message,
    read: notification.read,
    createdAt: notification.createdAt,
    matchId: notification.matchId,
    liveId: notification.liveId,
  });
  return notification;
}

export function notifyHostLiveDon(params: {
  hostId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  amount: number;
  liveId: string;
}): void {
  if (params.hostId === params.senderId) return;
  pushNotification({
    recipientId: params.hostId,
    senderId: params.senderId,
    senderName: params.senderName,
    senderAvatarUrl: params.senderAvatarUrl,
    type: 'live_don',
    message: `${params.senderName} vous a envoyé un don de ${params.amount} €`,
    liveId: params.liveId,
  });
}
