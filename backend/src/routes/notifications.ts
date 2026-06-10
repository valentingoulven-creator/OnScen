import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { isDeliverableNotificationType, notifyHeartReceived } from '../lib/notifications';
import {
  recordHeart,
  hasHeart,
  findMatch,
  createMatchIfMutual,
  notifyMatch,
  publicMatchDto,
} from '../lib/matches';
import { heartSendDeniedReason } from '../lib/canSendHeart';

export const notificationsRouter = Router();

function publicNotification(n: (typeof db.notifications)[0]) {
  return {
    id: n.id,
    type: n.type,
    senderId: n.senderId,
    senderName: n.senderName,
    senderAvatarUrl: n.senderAvatarUrl,
    message: n.message,
    read: n.read,
    createdAt: n.createdAt,
    matchId: n.matchId,
    liveId: n.liveId,
    salonId: n.salonId,
    peerUserId: n.peerUserId,
    groupId: n.groupId,
    postId: n.postId,
    reelId: n.reelId,
  };
}

notificationsRouter.get('/list', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const visible = (n: (typeof db.notifications)[0]) =>
    n.recipientId === me && isDeliverableNotificationType(n.type);
  const list = db.notifications
    .filter(visible)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50)
    .map(publicNotification);
  const unreadCount = db.notifications.filter((n) => visible(n) && !n.read).length;
  res.json({ notifications: list, unreadCount });
});

notificationsRouter.get('/matches/list', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const matches = db.matches
    .filter((m) => m.userIdA === me || m.userIdB === me)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((m) => publicMatchDto(m, me));
  res.json({ matches });
});

notificationsRouter.get('/matches/with/:userId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const otherId = req.params.userId;
  const match = findMatch(me, otherId);
  const theySentHeart = hasHeart(otherId, me);
  const iSentHeart = hasHeart(me, otherId);
  res.json({
    matched: Boolean(match),
    match: match ? publicMatchDto(match, me) : null,
    theySentHeart,
    iSentHeart,
  });
});

notificationsRouter.patch('/read-all', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  for (const n of db.notifications) {
    if (n.recipientId === me) n.read = true;
  }
  res.json({ ok: true });
});

notificationsRouter.post('/heart/:userId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const recipientId = req.params.userId;

  if (recipientId === me) {
    res.status(400).json({ error: 'Action impossible' });
    return;
  }

  const recipient = db.users.get(recipientId);
  const sender = db.users.get(me);
  if (!recipient || !sender) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  const heartDenied = heartSendDeniedReason(sender, recipient);
  if (heartDenied) {
    res.status(403).json({ error: heartDenied });
    return;
  }

  const existingMatch = findMatch(me, recipientId);
  if (existingMatch) {
    res.status(400).json({ error: 'Vous êtes déjà en match avec cette personne' });
    return;
  }

  if (hasHeart(me, recipientId)) {
    res.status(400).json({ error: 'Cœur déjà envoyé' });
    return;
  }

  recordHeart(me, recipientId);

  const mutual = createMatchIfMutual(me, recipientId);
  let matchDto = null;
  if (mutual) {
    notifyMatch(mutual, sender, recipient);
    matchDto = publicMatchDto(mutual, me);
  } else {
    notifyHeartReceived({
      recipientId,
      sender: { id: me, username: sender.username, avatarUrl: sender.avatarUrl },
    });
  }

  res.status(201).json({
    ok: true,
    matched: Boolean(mutual),
    match: matchDto,
    waitingForReply: !mutual && !hasHeart(recipientId, me),
  });
});
