import { db, AppNotification } from '../models/schema';
import { getFollowerIds } from './follows';
import { getFanIds } from './favorites';
import { getIo } from './ioInstance';

export function isDeliverableNotificationType(type: string): boolean {
  return true;
}

function publicNotificationPayload(notification: AppNotification) {
  return {
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
    postId: notification.postId,
    reelId: notification.reelId,
  };
}

export function hasUnreadDmFromSender(recipientId: string, senderId: string): boolean {
  return db.notifications.some(
    (n) =>
      n.recipientId === recipientId &&
      n.type === 'dm_message' &&
      !n.read &&
      (n.peerUserId === senderId || n.senderId === senderId)
  );
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
    postId: n.postId,
    reelId: n.reelId,
    read: false,
    createdAt: Date.now(),
  };
  db.notifications.push(notification);
  getIo()?.to(`user_${n.recipientId}`).emit('notification', publicNotificationPayload(notification));
  return notification;
}

export function notifyFollowReceived(params: {
  recipientId: string;
  sender: { id: string; username: string; avatarUrl?: string };
}): void {
  if (params.recipientId === params.sender.id) return;
  pushNotification({
    recipientId: params.recipientId,
    senderId: params.sender.id,
    senderName: params.sender.username,
    senderAvatarUrl: params.sender.avatarUrl,
    type: 'follow',
    message: `${params.sender.username} vous suit maintenant 👤`,
    peerUserId: params.sender.id,
  });
}

export function notifyDmReceived(params: {
  recipientId: string;
  sender: { id: string; username: string; avatarUrl?: string };
  preview: string;
}): void {
  if (params.recipientId === params.sender.id) return;
  if (hasUnreadDmFromSender(params.recipientId, params.sender.id)) return;

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

export function notifyHeartReceived(params: {
  recipientId: string;
  sender: { id: string; username: string; avatarUrl?: string };
}): void {
  if (params.recipientId === params.sender.id) return;
  pushNotification({
    recipientId: params.recipientId,
    senderId: params.sender.id,
    senderName: params.sender.username,
    senderAvatarUrl: params.sender.avatarUrl,
    type: 'heart',
    message: `${params.sender.username} vous a envoyé un cœur 💜`,
    peerUserId: params.sender.id,
  });
}

export function notifyContentHeartReceived(params: {
  recipientId: string;
  sender: { id: string; username: string; avatarUrl?: string };
  target: { kind: 'post'; id: string } | { kind: 'reel'; id: string };
}): void {
  if (params.recipientId === params.sender.id) return;

  const label = params.target.kind === 'post' ? 'publication' : 'reel';
  pushNotification({
    recipientId: params.recipientId,
    senderId: params.sender.id,
    senderName: params.sender.username,
    senderAvatarUrl: params.sender.avatarUrl,
    type: 'content_heart',
    message: `${params.sender.username} a aimé votre ${label} ❤️`,
    peerUserId: params.sender.id,
    ...(params.target.kind === 'post' ? { postId: params.target.id } : { reelId: params.target.id }),
  });
}

export function notifyEventCreated(params: {
  creator: { id: string; username: string; avatarUrl?: string };
  postId: string;
  eventLocation?: string;
}): void {
  const recipientIds = new Set<string>();

  for (const followerId of getFollowerIds(params.creator.id)) {
    if (followerId !== params.creator.id) recipientIds.add(followerId);
  }

  for (const fanId of getFanIds(params.creator.id)) {
    if (fanId === params.creator.id) continue;
    const entry = db.userFavorites.get(fanId)?.get(params.creator.id);
    if (entry?.notificationsEnabled === false) continue;
    recipientIds.add(fanId);
  }

  const locHint = params.eventLocation ? ` — ${params.eventLocation}` : '';
  const message = `${params.creator.username} a créé un événement 📅${locHint}`;

  for (const recipientId of recipientIds) {
    pushNotification({
      recipientId,
      senderId: params.creator.id,
      senderName: params.creator.username,
      senderAvatarUrl: params.creator.avatarUrl,
      type: 'event_created',
      message,
      postId: params.postId,
      peerUserId: params.creator.id,
    });
  }
}
