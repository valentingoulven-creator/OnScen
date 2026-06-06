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
    salonId: n.salonId,
    peerUserId: n.peerUserId,
    groupId: n.groupId,
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
    salonId: notification.salonId,
    peerUserId: notification.peerUserId,
    groupId: notification.groupId,
  });
  return notification;
}

export function notifyDmReceived(params: {
  recipientId: string;
  sender: { id: string; username: string; avatarUrl?: string };
  preview: string;
}): void {
  const preview =
    params.preview.length > 80 ? `${params.preview.slice(0, 77)}…` : params.preview;
  pushNotification({
    recipientId: params.recipientId,
    senderId: params.sender.id,
    senderName: params.sender.username,
    senderAvatarUrl: params.sender.avatarUrl,
    type: 'dm_message',
    message: `${params.sender.username} : ${preview}`,
    peerUserId: params.sender.id,
  });
}

export function notifyGroupMessageReceived(params: {
  recipientId: string;
  groupId: string;
  groupName: string;
  sender: { id: string; username: string; avatarUrl?: string };
  preview: string;
}): void {
  const preview =
    params.preview.length > 80 ? `${params.preview.slice(0, 77)}…` : params.preview;
  pushNotification({
    recipientId: params.recipientId,
    senderId: params.sender.id,
    senderName: params.sender.username,
    senderAvatarUrl: params.sender.avatarUrl,
    type: 'group_message',
    message: `${params.groupName} — ${params.sender.username} : ${preview}`,
    groupId: params.groupId,
    peerUserId: params.sender.id,
  });
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
