import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import {
  blockUser,
  unblockUser,
  hasBlocked,
  getBlockedIds,
  shouldDeliverToReceiver,
} from '../lib/blocks';
import { isUserOnline, getOnlineUserIds } from '../lib/presence';
import { getIo } from '../lib/ioInstance';
import { hideDmForUser, isDmVisibleToUser } from '../lib/dmVisibility';
import { schedulePersist } from '../lib/persist';
import { findMatch } from '../lib/matches';

export const dmRouter = Router();

function dmContactDto(u: { id: string; username: string; avatarUrl?: string }) {
  return {
    id: u.id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    isOnline: isUserOnline(u.id),
  };
}

dmRouter.get('/presence', authenticateJWT, (_req: Request, res: Response) => {
  res.json({ onlineUserIds: getOnlineUserIds() });
});

dmRouter.get('/blocks/list', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const blockedIds = getBlockedIds(me);
  const blocked = blockedIds
    .map((id) => db.users.get(id))
    .filter(Boolean)
    .map((u) => dmContactDto(u!));
  res.json({ blocked });
});

dmRouter.post('/block/:userId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const target = req.params.userId;
  if (!db.users.has(target)) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (target === me) {
    res.status(400).json({ error: 'Action impossible' });
    return;
  }
  blockUser(me, target);
  res.json({ ok: true, blockedUserId: target });
});

dmRouter.delete('/block/:userId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  unblockUser(me, req.params.userId);
  res.json({ ok: true });
});

/** Liste des conversations avec dernier message */
dmRouter.get('/conversations/list', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;

  const byOther = new Map<
    string,
    { lastContent: string; lastTimestamp: number; lastSenderId: string }
  >();

  for (const m of db.directMessages) {
    if (m.senderId !== me && m.receiverId !== me) continue;
    if (!isDmVisibleToUser(m, me)) continue;
    const otherId = m.senderId === me ? m.receiverId : m.senderId;
    if (hasBlocked(me, otherId)) continue;
    const prev = byOther.get(otherId);
    if (!prev || m.timestamp > prev.lastTimestamp) {
      byOther.set(otherId, {
        lastContent: m.content,
        lastTimestamp: m.timestamp,
        lastSenderId: m.senderId,
      });
    }
  }

  const conversations = [...byOther.entries()]
    .map(([otherId, meta]) => {
      const other = db.users.get(otherId);
      return {
        userId: otherId,
        username: other?.username ?? 'Utilisateur',
        avatarUrl: other?.avatarUrl,
        lastMessage: meta.lastContent,
        lastTimestamp: meta.lastTimestamp,
        isFromMe: meta.lastSenderId === me,
        isOnline: isUserOnline(otherId),
        isMatch: Boolean(findMatch(me, otherId)),
      };
    })
    .sort((a, b) => b.lastTimestamp - a.lastTimestamp);

  res.json({ conversations });
});

/** Contacts disponibles pour nouveau message */
dmRouter.get('/contacts/list', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const contacts = [...db.users.values()]
    .filter((u) => u.id !== me && !hasBlocked(me, u.id))
    .map((u) => dmContactDto(u))
    .sort((a, b) => a.username.localeCompare(b.username));
  res.json({ contacts });
});

dmRouter.get('/thread/:userId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const other = req.params.userId;

  if (hasBlocked(me, other)) {
    res.status(403).json({ error: 'Utilisateur bloqué' });
    return;
  }

  const otherUser = db.users.get(other);

  const messages = db.directMessages
    .filter(
      (m) =>
        ((m.senderId === me && m.receiverId === other) ||
          (m.senderId === other && m.receiverId === me)) &&
        isDmVisibleToUser(m, me) &&
        shouldDeliverToReceiver(m.senderId, m.receiverId)
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  res.json({
    messages,
    otherUser: otherUser
      ? {
          ...dmContactDto(otherUser),
          isBlockedByMe: hasBlocked(me, other),
          isMatch: Boolean(findMatch(me, other)),
        }
      : {
          id: other,
          username: 'Utilisateur',
          avatarUrl: undefined,
          isOnline: false,
          isMatch: Boolean(findMatch(me, other)),
        },
    isBlockedByMe: hasBlocked(me, other),
  });
});

dmRouter.post('/thread/:userId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const receiverId = req.params.userId;
  const { content } = req.body;

  if (!content?.trim()) {
    res.status(400).json({ error: 'Message vide' });
    return;
  }
  if (!db.users.has(receiverId)) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (hasBlocked(me, receiverId)) {
    res.status(403).json({ error: 'Débloquez cet utilisateur pour lui écrire' });
    return;
  }

  const msg = {
    id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    senderId: me,
    receiverId,
    content: content.trim(),
    timestamp: Date.now(),
    accepted: true,
  };
  db.directMessages.push(msg);

  const canDeliver = shouldDeliverToReceiver(me, receiverId);
  if (canDeliver) {
    getIo()?.to(`user_${receiverId}`).emit('dm', msg);
  }

  schedulePersist();
  res.status(201).json({ message: msg, delivered: canDeliver });
});

dmRouter.delete('/messages/:messageId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const forAll = req.query.forAll === 'true';
  const idx = db.directMessages.findIndex((m) => m.id === req.params.messageId);
  if (idx < 0) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }
  const msg = db.directMessages[idx];
  if (msg.senderId !== me && msg.receiverId !== me) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  if (forAll) {
    if (msg.senderId !== me) {
      res.status(403).json({ error: 'Seul l\'expéditeur peut supprimer pour tous' });
      return;
    }
    db.directMessages.splice(idx, 1);
    const otherId = msg.receiverId;
    getIo()?.to(`user_${otherId}`).emit('dm_deleted', { messageId: msg.id });
    getIo()?.to(`user_${me}`).emit('dm_deleted', { messageId: msg.id });
    schedulePersist();
    res.json({ ok: true, messageId: msg.id, scope: 'all' });
    return;
  }

  hideDmForUser(msg, me);
    getIo()?.to(`user_${me}`).emit('dm_hidden', { messageId: msg.id });
  schedulePersist();
  res.json({ ok: true, messageId: msg.id, scope: 'hidden' });
});
