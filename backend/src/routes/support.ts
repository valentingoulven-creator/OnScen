import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { db, type SupportContactMessage } from '../models/schema';
import { schedulePersist } from '../lib/persist';
import { isAccessAdmin } from '../lib/accessControl';
import { notifySupportContact, notifySupportReply } from '../lib/notifications';

export const supportRouter = Router();
export const supportAdminRouter = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentification requise' });
    return false;
  }
  const user = db.users.get(userId);
  if (!user || !isAccessAdmin(user)) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return false;
  }
  return true;
}

function mapSupportMessage(msg: SupportContactMessage) {
  const fromUser = db.users.get(msg.fromUserId);
  return {
    id: msg.id,
    fromUserId: msg.fromUserId,
    fromUsername: fromUser?.username ?? '—',
    body: msg.body,
    createdAt: msg.createdAt,
    status: msg.status,
    adminReply: msg.adminReply,
    repliedAt: msg.repliedAt,
    threadId: msg.threadId,
  };
}

supportRouter.post('/contact', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (body.length < 3) {
    res.status(400).json({ error: 'Message trop court (3 caractères minimum)' });
    return;
  }
  if (body.length > 4000) {
    res.status(400).json({ error: 'Message trop long (4000 caractères maximum)' });
    return;
  }

  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  const msg: SupportContactMessage = {
    id: `support_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fromUserId: userId,
    body,
    createdAt: Date.now(),
    status: 'open',
  };
  db.supportContactMessages.push(msg);
  schedulePersist();
  notifySupportContact({
    message: msg,
    sender: { id: user.id, username: user.username, avatarUrl: user.avatarUrl },
  });
  res.status(201).json({ message: mapSupportMessage(msg) });
});

supportRouter.get('/my', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const messages = db.supportContactMessages
    .filter((m) => m.fromUserId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(mapSupportMessage);
  res.json({ messages });
});

supportAdminRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const status = req.query.status;
  let messages = [...db.supportContactMessages];
  if (status === 'open' || status === 'replied') {
    messages = messages.filter((m) => m.status === status);
  }
  messages.sort((a, b) => b.createdAt - a.createdAt);
  res.json({ messages: messages.map(mapSupportMessage) });
});

supportAdminRouter.post('/:id/reply', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const adminId = (req as Request & { user: { id: string } }).user.id;
  const admin = db.users.get(adminId);
  const msg = db.supportContactMessages.find((m) => m.id === req.params.id);
  if (!msg) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }

  const reply = typeof req.body?.reply === 'string' ? req.body.reply.trim() : '';
  if (reply.length < 1) {
    res.status(400).json({ error: 'Réponse vide' });
    return;
  }
  if (reply.length > 4000) {
    res.status(400).json({ error: 'Réponse trop longue (4000 caractères maximum)' });
    return;
  }

  msg.adminReply = reply;
  msg.repliedAt = Date.now();
  msg.repliedByUserId = adminId;
  msg.status = 'replied';
  schedulePersist();

  if (admin) {
    notifySupportReply({
      message: msg,
      admin: { id: admin.id, username: admin.username, avatarUrl: admin.avatarUrl },
      replyPreview: reply,
    });
  }

  res.json({ message: mapSupportMessage(msg) });
});
