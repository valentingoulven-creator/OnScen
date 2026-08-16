import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import {
  db,
  type SupportContactMessage,
  type SupportThreadMessage,
} from '../models/schema';
import { schedulePersist } from '../lib/persist';
import {
  notifySupportContact,
  notifySupportReply,
  notifySupportResolved,
  notifySupportUserReply,
} from '../lib/notifications';
import { broadcastSupportTicketUpdated } from '../lib/supportBroadcast';
import { getAccountStatus } from '../lib/accessControl';
import { logAdminAction } from '../lib/adminAuditLog';
import { canAdminReplyToTicket, canReopenTicket, canResolveTicket } from '../lib/supportDesk';

export const supportRouter = Router();
export const supportAdminRouter = Router();

function buildThread(msg: SupportContactMessage): SupportThreadMessage[] {
  if (msg.thread && msg.thread.length > 0) return msg.thread;
  const thread: SupportThreadMessage[] = [
    {
      id: `${msg.id}_u0`,
      role: 'user',
      body: msg.body,
      createdAt: msg.createdAt,
      authorUserId: msg.fromUserId,
    },
  ];
  if (msg.adminReply && msg.repliedAt && msg.repliedByUserId) {
    thread.push({
      id: `${msg.id}_a0`,
      role: 'admin',
      body: msg.adminReply,
      createdAt: msg.repliedAt,
      authorUserId: msg.repliedByUserId,
    });
  }
  if (msg.userReply && msg.userRepliedAt) {
    thread.push({
      id: `${msg.id}_u1`,
      role: 'user',
      body: msg.userReply,
      createdAt: msg.userRepliedAt,
      authorUserId: msg.fromUserId,
    });
  }
  return thread;
}

function syncLegacyFields(msg: SupportContactMessage): void {
  const thread = buildThread(msg);
  msg.thread = thread;
  const firstUser = thread.find((t) => t.role === 'user');
  const lastAdmin = [...thread].reverse().find((t) => t.role === 'admin');
  if (firstUser) {
    msg.body = firstUser.body;
    msg.createdAt = firstUser.createdAt;
  }
  if (lastAdmin) {
    msg.adminReply = lastAdmin.body;
    msg.repliedAt = lastAdmin.createdAt;
    msg.repliedByUserId = lastAdmin.authorUserId;
  } else {
    delete msg.adminReply;
    delete msg.repliedAt;
    delete msg.repliedByUserId;
  }
  const userFollowUps = thread.filter((t) => t.role === 'user');
  if (userFollowUps.length > 1) {
    const followUp = userFollowUps[userFollowUps.length - 1];
    msg.userReply = followUp.body;
    msg.userRepliedAt = followUp.createdAt;
  } else {
    delete msg.userReply;
    delete msg.userRepliedAt;
  }
}

function mapSupportMessage(msg: SupportContactMessage) {
  const fromUser = db.users.get(msg.fromUserId);
  const thread = buildThread(msg);
  return {
    id: msg.id,
    fromUserId: msg.fromUserId,
    fromUsername: fromUser?.username ?? '—',
    fromEmail: fromUser?.email,
    fromAvatarUrl: fromUser?.avatarUrl,
    accountStatus: fromUser ? getAccountStatus(fromUser) : undefined,
    fromCity: fromUser?.city,
    body: msg.body,
    createdAt: msg.createdAt,
    status: msg.status,
    adminReply: msg.adminReply,
    repliedAt: msg.repliedAt,
    userReply: msg.userReply,
    userRepliedAt: msg.userRepliedAt,
    threadId: msg.threadId ?? msg.id,
    thread,
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

  const id = `support_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const msg: SupportContactMessage = {
    id,
    fromUserId: userId,
    body,
    createdAt: Date.now(),
    status: 'open',
    threadId: id,
    thread: [
      {
        id: `${id}_0`,
        role: 'user',
        body,
        createdAt: Date.now(),
        authorUserId: userId,
      },
    ],
  };
  db.supportContactMessages.push(msg);
  schedulePersist();
  notifySupportContact({
    message: msg,
    sender: { id: user.id, username: user.username, avatarUrl: user.avatarUrl },
  });
  broadcastSupportTicketUpdated(msg);
  res.status(201).json({ message: mapSupportMessage(msg) });
});

supportRouter.get('/my', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const messages = db.supportContactMessages
    .filter((m) => m.fromUserId === userId && m.status !== 'resolved')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(mapSupportMessage);
  res.json({ messages });
});

supportRouter.post('/contact/:id/reply', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const msg = db.supportContactMessages.find((m) => m.id === req.params.id);
  if (!msg) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }
  if (msg.fromUserId !== userId) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  if (msg.status !== 'replied') {
    res.status(400).json({ error: 'Réponse possible uniquement après une réponse OnScen' });
    return;
  }

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

  const thread = buildThread(msg);
  thread.push({
    id: `${msg.id}_${Date.now()}`,
    role: 'user',
    body,
    createdAt: Date.now(),
    authorUserId: userId,
  });
  msg.thread = thread;
  msg.userReply = body;
  msg.userRepliedAt = Date.now();
  msg.status = 'open';
  syncLegacyFields(msg);
  schedulePersist();

  notifySupportUserReply({
    message: msg,
    sender: { id: user.id, username: user.username, avatarUrl: user.avatarUrl },
    replyPreview: body,
  });
  broadcastSupportTicketUpdated(msg);

  res.json({ message: mapSupportMessage(msg) });
});

supportRouter.patch('/contact/:id/status', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const msg = db.supportContactMessages.find((m) => m.id === req.params.id);
  if (!msg) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }
  if (msg.fromUserId !== userId) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const status = req.body?.status;
  if (status !== 'resolved') {
    res.status(400).json({ error: 'Statut invalide' });
    return;
  }
  if (msg.status !== 'replied') {
    res.status(400).json({ error: 'Marquage résolu possible uniquement après une réponse OnScen' });
    return;
  }

  msg.status = 'resolved';
  schedulePersist();
  broadcastSupportTicketUpdated(msg);
  res.json({ message: mapSupportMessage(msg) });
});

supportAdminRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  if (requireAdmin(req, res) == null) return;
  const status = req.query.status;
  const q = String(req.query.q || '')
    .trim()
    .toLowerCase();
  const all = [...db.supportContactMessages];
  const counts = {
    total: all.length,
    open: all.filter((m) => m.status === 'open').length,
    replied: all.filter((m) => m.status === 'replied').length,
    resolved: all.filter((m) => m.status === 'resolved').length,
  };
  let messages = all;
  if (status === 'open' || status === 'replied' || status === 'resolved') {
    messages = messages.filter((m) => m.status === status);
  }
  if (q) {
    messages = messages.filter((m) => {
      const user = db.users.get(m.fromUserId);
      return (
        m.body.toLowerCase().includes(q) ||
        (user?.username.toLowerCase().includes(q) ?? false) ||
        (user?.email.toLowerCase().includes(q) ?? false)
      );
    });
  }
  messages.sort((a, b) => b.createdAt - a.createdAt);
  res.json({ messages: messages.map(mapSupportMessage), counts });
});

supportAdminRouter.post('/:id/reply', authenticateJWT, (req: Request, res: Response) => {
  if (requireAdmin(req, res) == null) return;
  const adminId = (req as Request & { user: { id: string } }).user.id;
  const admin = db.users.get(adminId);
  const msg = db.supportContactMessages.find((m) => m.id === req.params.id);
  if (!msg) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }
  if (!canAdminReplyToTicket(msg.status)) {
    res.status(400).json({ error: 'Ce ticket ne peut plus recevoir de réponse' });
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

  const thread = buildThread(msg);
  thread.push({
    id: `${msg.id}_${Date.now()}`,
    role: 'admin',
    body: reply,
    createdAt: Date.now(),
    authorUserId: adminId,
  });
  msg.thread = thread;
  msg.adminReply = reply;
  msg.repliedAt = Date.now();
  msg.repliedByUserId = adminId;
  msg.status = 'replied';
  syncLegacyFields(msg);
  schedulePersist();

  if (admin) {
    notifySupportReply({
      message: msg,
      admin: { id: admin.id, username: admin.username, avatarUrl: admin.avatarUrl },
      replyPreview: reply,
    });
  }
  logAdminAction({
    adminId,
    action: 'support_reply',
    targetType: 'support_ticket',
    targetId: msg.id,
    details: { fromUserId: msg.fromUserId },
    ip: req.ip,
  });
  broadcastSupportTicketUpdated(msg);

  res.json({ message: mapSupportMessage(msg) });
});

supportAdminRouter.post('/:id/reopen', authenticateJWT, (req: Request, res: Response) => {
  if (requireAdmin(req, res) == null) return;
  const adminId = (req as Request & { user: { id: string } }).user.id;
  const msg = db.supportContactMessages.find((m) => m.id === req.params.id);
  if (!msg) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }
  if (!canReopenTicket(msg.status)) {
    res.status(400).json({ error: 'Seuls les tickets résolus peuvent être rouverts' });
    return;
  }
  msg.status = 'open';
  schedulePersist();
  logAdminAction({
    adminId,
    action: 'support_reopen',
    targetType: 'support_ticket',
    targetId: msg.id,
    details: { fromUserId: msg.fromUserId },
    ip: req.ip,
  });
  broadcastSupportTicketUpdated(msg);
  res.json({ message: mapSupportMessage(msg) });
});

supportAdminRouter.patch('/:id/status', authenticateJWT, (req: Request, res: Response) => {
  if (requireAdmin(req, res) == null) return;
  const adminId = (req as Request & { user: { id: string } }).user.id;
  const admin = db.users.get(adminId);
  const msg = db.supportContactMessages.find((m) => m.id === req.params.id);
  if (!msg) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }

  const status = req.body?.status;
  if (status !== 'resolved') {
    res.status(400).json({ error: 'Statut invalide' });
    return;
  }
  if (!canResolveTicket(msg.status)) {
    res.status(400).json({ error: 'Ticket déjà résolu' });
    return;
  }

  msg.status = 'resolved';
  schedulePersist();
  logAdminAction({
    adminId,
    action: 'support_resolve',
    targetType: 'support_ticket',
    targetId: msg.id,
    details: { fromUserId: msg.fromUserId },
    ip: req.ip,
  });
  if (admin) {
    notifySupportResolved({
      message: msg,
      admin: { id: admin.id, username: admin.username, avatarUrl: admin.avatarUrl },
    });
  }
  broadcastSupportTicketUpdated(msg);
  res.json({ message: mapSupportMessage(msg) });
});
