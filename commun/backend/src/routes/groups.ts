import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { hasBlocked } from '../lib/blocks';
import { isUserOnline } from '../lib/presence';
import { getIo } from '../lib/ioInstance';
import { schedulePersist } from '../lib/persist';
import {
  countGroupUnreadForUser,
  countGroupUnreadInGroup,
  isGroupMember,
  markGroupThreadRead,
} from '../lib/groupRead';
import { isGroupMessageVisibleToUser, hideGroupMessageForUser } from '../lib/groupVisibility';
import { countDmUnreadForUser } from '../lib/dmRead';
import { notifyGroupMessageReceived } from '../lib/notifications';
import { hasMuted } from '../lib/mutes';
import {
  canAddGroupMember,
  canRemoveGroupMember,
  canRenameGroup,
  canDeleteGroup,
  canTransferGroupCreator,
} from '../lib/groupMembers';
import { checkChatRateLimit } from '../lib/chatRateLimit';
import { appendGroupSystemMessage, usernameOf } from '../lib/groupSystemMessages';
import { clientTriedForgedSystemMessage } from '../lib/groupMessageValidation';

export const groupsRouter = Router();

const MAX_GROUP_MEMBERS = 50;

function emitMessagesUnreadToUser(userId: string): void {
  getIo()?.to(`user_${userId}`).emit('dm_unread', {
    unreadCount: countDmUnreadForUser(userId) + countGroupUnreadForUser(userId),
  });
}

function memberDto(u: {
  id: string;
  username: string;
  avatarUrl?: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
}) {
  return {
    id: u.id,
    username: u.username,
    usernameColor: u.usernameColor,
    usernameWaveFrom: u.usernameWaveFrom,
    usernameWaveTo: u.usernameWaveTo,
    avatarUrl: u.avatarUrl,
    isOnline: isUserOnline(u.id),
  };
}

function groupDetailDto(groupId: string, me: string) {
  const group = db.messageGroups.find((g) => g.id === groupId);
  if (!group) return null;
  const members = group.memberIds
    .map((id) => db.users.get(id))
    .filter(Boolean)
    .map((u) => memberDto(u!));
  return {
    id: group.id,
    name: group.name,
    creatorId: group.creatorId,
    memberIds: group.memberIds,
    memberCount: group.memberIds.length,
    createdAt: group.createdAt,
    members,
    unreadCount: countGroupUnreadInGroup(me, group.id),
  };
}

groupsRouter.post('/', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const { name, memberIds } = req.body as { name?: string; memberIds?: string[] };

  const trimmedName = name?.trim();
  if (!trimmedName) {
    res.status(400).json({ error: 'Nom du groupe requis' });
    return;
  }
  if (trimmedName.length > 60) {
    res.status(400).json({ error: 'Nom du groupe trop long (60 caractères max)' });
    return;
  }

  const rawIds = Array.isArray(memberIds) ? memberIds.filter((id) => typeof id === 'string') : [];
  const uniqueOthers = [...new Set(rawIds.filter((id) => id !== me && db.users.has(id)))];
  if (uniqueOthers.length === 0) {
    res.status(400).json({ error: 'Sélectionnez au moins un membre' });
    return;
  }

  for (const id of uniqueOthers) {
    if (hasBlocked(me, id)) {
      res.status(403).json({ error: 'Débloquez cet utilisateur pour l\'ajouter au groupe' });
      return;
    }
  }

  const group = {
    id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: trimmedName,
    creatorId: me,
    memberIds: [me, ...uniqueOthers],
    createdAt: Date.now(),
  };
  db.messageGroups.push(group);
  schedulePersist();

  appendGroupSystemMessage(group.id, me, 'group_created', {
    actorName: usernameOf(me),
    newName: trimmedName,
  });

  res.status(201).json({ group: groupDetailDto(group.id, me) });
});

function emitGroupMembersChanged(groupId: string): void {
  const group = db.messageGroups.find((g) => g.id === groupId);
  if (!group) return;
  for (const memberId of group.memberIds) {
    const detail = groupDetailDto(groupId, memberId);
    if (detail) {
      getIo()?.to(`user_${memberId}`).emit('group_members_changed', { groupId, group: detail });
    }
  }
}

groupsRouter.post('/:groupId/members', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const { groupId } = req.params;
  const { userId } = req.body as { userId?: string };

  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ error: 'Utilisateur requis' });
    return;
  }

  const group = db.messageGroups.find((g) => g.id === groupId);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }

  const allowed = canAddGroupMember(group, me, userId);
  if (!allowed.ok) {
    res.status(allowed.error === 'Accès refusé' ? 403 : 400).json({ error: allowed.error });
    return;
  }

  if (!db.users.has(userId)) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  if (hasBlocked(me, userId)) {
    res.status(403).json({ error: 'Débloquez cet utilisateur pour l\'ajouter au groupe' });
    return;
  }

  if (group.memberIds.length >= MAX_GROUP_MEMBERS) {
    res.status(400).json({ error: `Limite de ${MAX_GROUP_MEMBERS} membres atteinte` });
    return;
  }

  group.memberIds.push(userId);
  schedulePersist();

  appendGroupSystemMessage(groupId, me, 'member_added', {
    actorName: usernameOf(me),
    targetName: usernameOf(userId),
  });

  const detail = groupDetailDto(groupId, me);
  emitGroupMembersChanged(groupId);
  getIo()?.to(`user_${userId}`).emit('group_member_added', { groupId, group: groupDetailDto(groupId, userId) });
  emitMessagesUnreadToUser(userId);

  res.status(201).json({ group: detail });
});

groupsRouter.delete('/:groupId/members/:userId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const { groupId, userId: targetUserId } = req.params;

  const group = db.messageGroups.find((g) => g.id === groupId);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }

  const allowed = canRemoveGroupMember(group, me, targetUserId);
  if (!allowed.ok) {
    res.status(allowed.error === 'Accès refusé' ? 403 : 403).json({ error: allowed.error });
    return;
  }

  group.memberIds = group.memberIds.filter((id) => id !== targetUserId);
  schedulePersist();

  const isSelfLeave = me === targetUserId;
  appendGroupSystemMessage(
    groupId,
    me,
    isSelfLeave ? 'member_left' : 'member_removed',
    isSelfLeave
      ? { actorName: usernameOf(me), targetName: usernameOf(targetUserId) }
      : { actorName: usernameOf(me), targetName: usernameOf(targetUserId) }
  );

  const detail = groupDetailDto(groupId, me);
  getIo()?.to(`user_${targetUserId}`).emit('group_member_removed', { groupId, userId: targetUserId });
  emitGroupMembersChanged(groupId);
  emitMessagesUnreadToUser(targetUserId);

  res.json({ group: detail, removedUserId: targetUserId });
});

groupsRouter.delete('/messages/:messageId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const forAll = req.query.forAll === 'true';
  const idx = db.groupMessages.findIndex((m) => m.id === req.params.messageId);
  if (idx < 0) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }
  const msg = db.groupMessages[idx];
  if (!isGroupMember(msg.groupId, me)) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  if (msg.kind === 'system') {
    res.status(403).json({ error: 'Message système non supprimable' });
    return;
  }

  const group = db.messageGroups.find((g) => g.id === msg.groupId);

  if (forAll) {
    if (msg.senderId !== me) {
      res.status(403).json({ error: 'Seul l\'expéditeur peut supprimer pour tous' });
      return;
    }
    db.groupMessages.splice(idx, 1);
    if (group) {
      for (const memberId of group.memberIds) {
        getIo()?.to(`user_${memberId}`).emit('group_message_deleted', { messageId: msg.id, groupId: msg.groupId });
      }
    }
    schedulePersist();
    res.json({ ok: true, messageId: msg.id, scope: 'all' });
    return;
  }

  hideGroupMessageForUser(msg, me);
  getIo()?.to(`user_${me}`).emit('group_message_hidden', { messageId: msg.id, groupId: msg.groupId });
  schedulePersist();
  res.json({ ok: true, messageId: msg.id, scope: 'hidden' });
});

groupsRouter.patch('/:groupId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const { groupId } = req.params;
  const { name } = req.body as { name?: string };

  const group = db.messageGroups.find((g) => g.id === groupId);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }

  const allowed = canRenameGroup(group, me);
  if (!allowed.ok) {
    res.status(403).json({ error: allowed.error });
    return;
  }

  const trimmedName = name?.trim();
  if (!trimmedName) {
    res.status(400).json({ error: 'Nom du groupe requis' });
    return;
  }
  if (trimmedName.length > 60) {
    res.status(400).json({ error: 'Nom du groupe trop long (60 caractères max)' });
    return;
  }

  const oldName = group.name;
  if (oldName !== trimmedName) {
    group.name = trimmedName;
    schedulePersist();
    appendGroupSystemMessage(groupId, me, 'group_renamed', {
      actorName: usernameOf(me),
      oldName,
      newName: trimmedName,
    });
  }

  emitGroupMembersChanged(groupId);

  const detail = groupDetailDto(groupId, me);
  res.json({ group: detail });
});

groupsRouter.post('/:groupId/transfer-creator', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const { groupId } = req.params;
  const { userId } = req.body as { userId?: string };

  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ error: 'Utilisateur requis' });
    return;
  }

  const group = db.messageGroups.find((g) => g.id === groupId);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }

  const allowed = canTransferGroupCreator(group, me, userId);
  if (!allowed.ok) {
    res.status(allowed.error === 'Accès refusé' || allowed.error.includes('administrateur') ? 403 : 400).json({
      error: allowed.error,
    });
    return;
  }

  group.creatorId = userId;
  schedulePersist();

  appendGroupSystemMessage(groupId, me, 'admin_transferred', {
    actorName: usernameOf(me),
    targetName: usernameOf(userId),
  });

  emitGroupMembersChanged(groupId);

  res.json({ group: groupDetailDto(groupId, me) });
});

function deleteGroupCompletely(groupId: string): string[] {
  const group = db.messageGroups.find((g) => g.id === groupId);
  if (!group) return [];
  const memberIds = [...group.memberIds];

  db.messageGroups = db.messageGroups.filter((g) => g.id !== groupId);
  db.groupMessages = db.groupMessages.filter((m) => m.groupId !== groupId);
  for (const cursors of db.groupReadCursors.values()) {
    cursors.delete(groupId);
  }
  schedulePersist();

  for (const memberId of memberIds) {
    getIo()?.to(`user_${memberId}`).emit('group_deleted', { groupId });
    emitMessagesUnreadToUser(memberId);
  }

  return memberIds;
}

groupsRouter.delete('/:groupId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const { groupId } = req.params;

  const group = db.messageGroups.find((g) => g.id === groupId);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }

  const allowed = canDeleteGroup(group, me);
  if (!allowed.ok) {
    res.status(403).json({ error: allowed.error });
    return;
  }

  deleteGroupCompletely(groupId);
  res.json({ ok: true, groupId });
});

groupsRouter.get('/:groupId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const { groupId } = req.params;

  if (!isGroupMember(groupId, me)) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const detail = groupDetailDto(groupId, me);
  if (!detail) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }
  res.json({ group: detail });
});

groupsRouter.get('/:groupId/thread', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const { groupId } = req.params;

  if (!isGroupMember(groupId, me)) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const detail = groupDetailDto(groupId, me);
  if (!detail) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }

  const messages = db.groupMessages
    .filter((m) => m.groupId === groupId && isGroupMessageVisibleToUser(m, me))
    .sort((a, b) => a.timestamp - b.timestamp);

  const lastTs = messages.length > 0 ? messages[messages.length - 1].timestamp : Date.now();
  markGroupThreadRead(me, groupId, lastTs);
  schedulePersist();
  emitMessagesUnreadToUser(me);

  res.json({ messages, group: detail });
});

groupsRouter.post('/:groupId/read', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const { groupId } = req.params;

  if (!isGroupMember(groupId, me)) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const at = typeof req.body?.at === 'number' ? req.body.at : Date.now();
  markGroupThreadRead(me, groupId, at);
  schedulePersist();
  const unreadCount = countDmUnreadForUser(me) + countGroupUnreadForUser(me);
  res.json({ ok: true, unreadCount });
  emitMessagesUnreadToUser(me);
});

groupsRouter.post('/:groupId/messages', authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;

  if (!(await checkChatRateLimit(me))) {
    res.status(429).json({ error: 'Trop de messages. Réessayez dans quelques secondes.' });
    return;
  }

  const { groupId } = req.params;

  if (clientTriedForgedSystemMessage(req.body)) {
    res.status(400).json({ error: 'Champs message système non autorisés' });
    return;
  }

  const { content } = req.body as { content?: string };

  if (!isGroupMember(groupId, me)) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  if (!content?.trim()) {
    res.status(400).json({ error: 'Message vide' });
    return;
  }

  const group = db.messageGroups.find((g) => g.id === groupId);
  if (!group) {
    res.status(404).json({ error: 'Groupe introuvable' });
    return;
  }

  const msg = {
    id: `gm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    groupId,
    senderId: me,
    content: content.trim(),
    timestamp: Date.now(),
  };
  db.groupMessages.push(msg);

  const sender = db.users.get(me);
  const payload = {
    ...msg,
    senderName: sender?.username,
    senderAvatarUrl: sender?.avatarUrl,
    groupName: group.name,
  };

  for (const memberId of group.memberIds) {
    if (memberId === me) continue;
    getIo()?.to(`user_${memberId}`).emit('group_message', payload);
    emitMessagesUnreadToUser(memberId);
    if (sender && !hasMuted(memberId, me)) {
      notifyGroupMessageReceived({
        recipientId: memberId,
        groupId,
        groupName: group.name,
        sender: { id: me, username: sender.username, avatarUrl: sender.avatarUrl },
        preview: msg.content,
      });
    }
  }

  schedulePersist();
  res.status(201).json({ message: msg });
}));
