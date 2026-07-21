import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import {
  blockUser,
  unblockUser,
  hasBlocked,
  getBlockedIds,
  shouldDeliverToReceiver,
} from '../lib/blocks';
import {
  muteUser,
  unmuteUser,
  hasMuted,
  getMutedIds,
} from '../lib/mutes';
import { isUserOnline, getOnlineUserIds } from '../lib/presence';
import { getActiveLiveHosts } from '../lib/liveStatus';
import { userAllowsPrivateMessages } from '../lib/locationPrivacy';
import { getIo } from '../lib/ioInstance';
import { hideDmForUser, isDmVisibleToUser } from '../lib/dmVisibility';
import { schedulePersist } from '../lib/persist';
import {
  scheduleDeleteDirectMessageFromPg,
  schedulePersistDirectMessageToPg,
} from '../lib/pgDirectMessages';
import { findMatch } from '../lib/matches';
import {
  countDmUnreadForUser,
  countDmUnreadWithPeer,
  markDmThreadRead,
} from '../lib/dmRead';
import { countGroupUnreadForUser, countGroupUnreadInGroup } from '../lib/groupRead';
import { isGroupMessageVisibleToUser } from '../lib/groupVisibility';
import { notifyDmReceived } from '../lib/notifications';
import { trackEvent, trackUserActive } from '../lib/analytics';
import { moderateDmAttachment, moderationRejectionMessage } from '../lib/contentModeration';
import { isAllowedChatAttachmentUrl } from '../lib/chatAttachmentUrl';
import { checkChatRateLimit } from '../lib/chatRateLimit';
import { sanitizeChatText } from '../lib/sanitizeUserText';

export const dmRouter = Router();

// ── Helpers demande de conversation ────────────────────────────────────────

function dmPairKey(senderId: string, receiverId: string): string {
  return `${senderId}::${receiverId}`;
}

// ── Lazy cache for legacy accepted DM pairs ─────────────────────────────────
// Older data may not have entries in db.dmPendingPairs ('accepted' state).
// Building this Set once avoids O(n) db.directMessages.some() on every send.
let _legacyAcceptedCache: Set<string> | null = null;

function getLegacyAcceptedCache(): Set<string> {
  if (_legacyAcceptedCache) return _legacyAcceptedCache;
  const cache = new Set<string>();
  for (const m of db.directMessages) {
    if (m.accepted) {
      cache.add(dmPairKey(m.senderId, m.receiverId));
      cache.add(dmPairKey(m.receiverId, m.senderId));
    }
  }
  _legacyAcceptedCache = cache;
  return cache;
}

/** Call after any operation that mutates accepted status (request accept / delete). */
function invalidateLegacyAcceptedCache(): void {
  _legacyAcceptedCache = null;
}

/**
 * Retourne le statut de la relation A→B.
 * - 'accepted' si des messages acceptés existent (rétro-compat) ou explicitement accepté
 * - 'pending' si une demande est en attente
 * - 'refused' si refusé
 * - 'none' si aucune relation
 */
function getDmRelationStatus(
  senderId: string,
  receiverId: string
): 'none' | 'pending' | 'accepted' | 'refused' {
  const explicit = db.dmPendingPairs.get(dmPairKey(senderId, receiverId));
  if (explicit) return explicit;
  // Rétro-compat: use pre-built O(1) cache instead of O(n) db.directMessages.some().
  return getLegacyAcceptedCache().has(dmPairKey(senderId, receiverId)) ? 'accepted' : 'none';
}

function emitDmUnreadToUser(userId: string): void {
  getIo()?.to(`user_${userId}`).emit('dm_unread', {
    unreadCount: countDmUnreadForUser(userId) + countGroupUnreadForUser(userId),
  });
}

function dmContactDto(u: {
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

dmRouter.get('/unread-count', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  res.json({ unreadCount: countDmUnreadForUser(me) + countGroupUnreadForUser(me) });
});

dmRouter.post('/thread/:userId/read', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const other = req.params.userId;
  const at = typeof req.body?.at === 'number' ? req.body.at : Date.now();
  markDmThreadRead(me, other, at);
  schedulePersist();
  const unreadCount = countDmUnreadForUser(me) + countGroupUnreadForUser(me);
  res.json({ ok: true, unreadCount });
  emitDmUnreadToUser(me);
});

dmRouter.get('/presence', authenticateJWT, (_req: Request, res: Response) => {
  const liveHosts = getActiveLiveHosts();
  res.json({
    onlineUserIds: getOnlineUserIds(),
    liveUserIds: liveHosts.map((h) => h.userId),
    liveViewersByUserId: Object.fromEntries(liveHosts.map((h) => [h.userId, h.viewersCount])),
  });
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

dmRouter.get('/mutes/list', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  res.json({ mutedUserIds: getMutedIds(me) });
});

dmRouter.post('/mute/:userId', authenticateJWT, (req: Request, res: Response) => {
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
  muteUser(me, target);
  schedulePersist();
  emitDmUnreadToUser(me);
  res.json({ ok: true, mutedUserId: target });
});

dmRouter.delete('/mute/:userId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  unmuteUser(me, req.params.userId);
  schedulePersist();
  emitDmUnreadToUser(me);
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

  const dmConversations = [...byOther.entries()]
    .map(([otherId, meta]) => {
      const other = db.users.get(otherId);
      // Vérifier si c'est une demande reçue en attente
      const isPendingRequest =
        db.dmPendingPairs.get(dmPairKey(otherId, me)) === 'pending';
      // Vérifier si notre propre demande est en attente (envoyée, pas encore acceptée)
      const isPendingSent =
        db.dmPendingPairs.get(dmPairKey(me, otherId)) === 'pending';
      return {
        kind: 'dm' as const,
        userId: otherId,
        username: other?.username ?? 'Utilisateur',
        usernameColor: other?.usernameColor,
        usernameWaveFrom: other?.usernameWaveFrom,
        usernameWaveTo: other?.usernameWaveTo,
        avatarUrl: other?.avatarUrl,
        lastMessage: meta.lastContent,
        lastTimestamp: meta.lastTimestamp,
        isFromMe: meta.lastSenderId === me,
        isOnline: isUserOnline(otherId),
        isMatch: Boolean(findMatch(me, otherId)),
        isMuted: hasMuted(me, otherId),
        unreadCount: countDmUnreadWithPeer(me, otherId),
        isPendingRequest,
        isPendingSent,
      };
    });

  // Pre-index group messages by groupId: O(total_messages) once instead of
  // O(groups × total_messages) with nested .filter() inside the .map() below.
  const groupMsgsByGroupId = new Map<string, typeof db.groupMessages>();
  for (const m of db.groupMessages) {
    let bucket = groupMsgsByGroupId.get(m.groupId);
    if (!bucket) {
      bucket = [];
      groupMsgsByGroupId.set(m.groupId, bucket);
    }
    bucket.push(m);
  }

  const groupConversations = db.messageGroups
    .filter((g) => g.memberIds.includes(me))
    .map((g) => {
      const msgs = groupMsgsByGroupId.get(g.id) ?? [];
      // Find most recent visible message without a full sort (O(n) max instead of O(n log n)).
      let last: (typeof msgs)[number] | undefined;
      for (const m of msgs) {
        if (!isGroupMessageVisibleToUser(m, me)) continue;
        if (!last || m.timestamp > last.timestamp) last = m;
      }
      const lastSender = last ? db.users.get(last.senderId) : undefined;
      return {
        kind: 'group' as const,
        groupId: g.id,
        username: g.name,
        memberCount: g.memberIds.length,
        lastMessage: last?.content ?? '',
        lastMessageKind: last?.kind,
        lastSystemEvent: last?.systemEvent,
        lastSystemMeta: last?.systemMeta,
        lastTimestamp: last?.timestamp ?? g.createdAt,
        isFromMe: last?.kind === 'system' ? false : last?.senderId === me,
        lastSenderName: last?.kind === 'system' ? undefined : lastSender?.username,
        unreadCount: countGroupUnreadInGroup(me, g.id),
      };
    });

  const conversations = [...dmConversations, ...groupConversations].sort(
    (a, b) => b.lastTimestamp - a.lastTimestamp
  );

  res.json({
    conversations,
    unreadCount: countDmUnreadForUser(me) + countGroupUnreadForUser(me),
  });
});

/** Contacts disponibles pour nouveau message */
dmRouter.get('/contacts/list', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const MAX_CONTACTS = 200;
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_CONTACTS) : MAX_CONTACTS;
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const contacts = [...db.users.values()]
    .filter((u) => {
      if (u.id === me || hasBlocked(me, u.id)) return false;
      if (q) return u.username.toLowerCase().includes(q);
      return true;
    })
    .sort((a, b) => a.username.localeCompare(b.username, 'fr'))
    .slice(0, limit)
    .map((u) => dmContactDto(u));
  res.json({ contacts, total: contacts.length, limit });
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

  const lastTs = messages.length > 0 ? messages[messages.length - 1].timestamp : Date.now();
  markDmThreadRead(me, other, lastTs);
  schedulePersist();
  emitDmUnreadToUser(me);

  res.json({
    messages,
    otherUser: otherUser
      ? {
          ...dmContactDto(otherUser),
          isBlockedByMe: hasBlocked(me, other),
          isMutedByMe: hasMuted(me, other),
          isMatch: Boolean(findMatch(me, other)),
          acceptsPrivateMessages: userAllowsPrivateMessages(otherUser),
        }
      : {
          id: other,
          username: 'Utilisateur',
          avatarUrl: undefined,
          isOnline: false,
          isMatch: Boolean(findMatch(me, other)),
          isMutedByMe: hasMuted(me, other),
          acceptsPrivateMessages: true,
        },
    isBlockedByMe: hasBlocked(me, other),
    isBlockedByThem: hasBlocked(other, me),
    isMutedByMe: hasMuted(me, other),
  });
});

/** Masquer une conversation DM (tous les messages visibles du fil pour moi). */
dmRouter.delete('/thread/:userId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const other = req.params.userId;

  let hiddenCount = 0;
  for (const msg of db.directMessages) {
    if (
      ((msg.senderId === me && msg.receiverId === other) ||
        (msg.senderId === other && msg.receiverId === me)) &&
      isDmVisibleToUser(msg, me)
    ) {
      hideDmForUser(msg, me);
      schedulePersistDirectMessageToPg(msg);
      hiddenCount++;
    }
  }

  markDmThreadRead(me, other, Date.now());
  schedulePersist();
  emitDmUnreadToUser(me);

  res.json({ ok: true, hiddenCount });
});

dmRouter.post('/thread/:userId', authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;

  if (!(await checkChatRateLimit(me))) {
    res.status(429).json({ error: 'Trop de messages. Réessayez dans quelques secondes.' });
    return;
  }

  const receiverId = req.params.userId;
  const { content, attachmentUrl, attachmentName, attachmentSize, attachmentMimeType } = req.body;

  if (!content?.trim() && !attachmentUrl) {
    res.status(400).json({ error: 'Message vide' });
    return;
  }

  if (attachmentSize && attachmentSize > 10 * 1024 * 1024) {
    res.status(413).json({ error: 'Fichier trop volumineux (max 10 Mo)' });
    return;
  }

  if (attachmentUrl) {
    if (!isAllowedChatAttachmentUrl(String(attachmentUrl))) {
      res.status(400).json({ error: 'URL de pièce jointe invalide (HTTPS requis).' });
      return;
    }
    const moderation = await moderateDmAttachment(
      String(attachmentUrl),
      attachmentMimeType,
    );
    if (!moderation.allowed) {
      res.status(422).json({ error: moderationRejectionMessage(moderation) });
      return;
    }
  }

  if (!db.users.has(receiverId)) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (hasBlocked(me, receiverId)) {
    res.status(403).json({ error: 'Débloquez cet utilisateur pour lui écrire' });
    return;
  }
  if (hasBlocked(receiverId, me)) {
    res.status(403).json({ error: 'Vous avez été bloqué par cet utilisateur' });
    return;
  }

  const recipient = db.users.get(receiverId);
  if (recipient && !userAllowsPrivateMessages(recipient)) {
    res.status(403).json({
      error: 'Cet utilisateur n\'accepte pas les messages privés.',
      code: 'dm_disabled',
    });
    return;
  }

  let status = getDmRelationStatus(me, receiverId);

  if (status === 'pending') {
    db.dmPendingPairs.set(dmPairKey(me, receiverId), 'accepted');
    for (const m of db.directMessages) {
      if (m.senderId === me && m.receiverId === receiverId && !m.accepted) {
        m.accepted = true;
        schedulePersistDirectMessageToPg(m);
      }
    }
    invalidateLegacyAcceptedCache();
    status = 'accepted';
  }

  if (status === 'refused') {
    res.status(403).json({ error: 'Votre demande de conversation a été refusée' });
    return;
  }

  const msg = {
    id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    senderId: me,
    receiverId,
    content: content ? sanitizeChatText(String(content).slice(0, 2000)) : '',
    timestamp: Date.now(),
    accepted: true,
    ...(attachmentUrl ? { attachmentUrl, attachmentName, attachmentSize, attachmentMimeType } : {}),
  };
  db.directMessages.push(msg);
  schedulePersistDirectMessageToPg(msg);

  if (status === 'none') {
    db.dmPendingPairs.set(dmPairKey(me, receiverId), 'accepted');
    invalidateLegacyAcceptedCache();
  }

  const canDeliver = shouldDeliverToReceiver(me, receiverId);
  if (canDeliver) {
    const sender = db.users.get(me);
    getIo()?.to(`user_${receiverId}`).emit('dm', {
      ...msg,
      senderName: sender?.username,
      senderAvatarUrl: sender?.avatarUrl,
    });
    emitDmUnreadToUser(receiverId);
    if (sender && !hasMuted(receiverId, me)) {
      notifyDmReceived({
        recipientId: receiverId,
        sender: { id: me, username: sender.username, avatarUrl: sender.avatarUrl },
        preview: msg.content,
      });
    }
  }

  trackEvent('message_sent', me);
  trackUserActive(me);
  schedulePersist();
  res.status(201).json({ message: msg, delivered: canDeliver, status: 'accepted' });
}));

// ── Demandes de conversation (requêtes en attente) ─────────────────────────

/** Liste des demandes reçues en attente pour l'utilisateur connecté. */
dmRouter.get('/requests/list', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const requests: {
    senderId: string;
    username: string;
    avatarUrl?: string;
    preview: string;
    timestamp: number;
  }[] = [];

  for (const [key, status] of db.dmPendingPairs.entries()) {
    if (status !== 'pending') continue;
    const [senderId, receiverId] = key.split('::');
    if (receiverId !== me) continue;
    const sender = db.users.get(senderId);
    const lastMsg = db.directMessages
      .filter((m) => m.senderId === senderId && m.receiverId === me && !m.accepted)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (!lastMsg) continue;
    requests.push({
      senderId,
      username: sender?.username ?? 'Utilisateur',
      avatarUrl: sender?.avatarUrl,
      preview: lastMsg.content,
      timestamp: lastMsg.timestamp,
    });
  }

  requests.sort((a, b) => b.timestamp - a.timestamp);
  res.json({ requests });
});

/** Accepter une demande de conversation. */
dmRouter.post('/requests/:senderId/accept', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const senderId = req.params.senderId;
  const key = dmPairKey(senderId, me);

  if (db.dmPendingPairs.get(key) !== 'pending') {
    res.status(400).json({ error: 'Aucune demande en attente' });
    return;
  }

  db.dmPendingPairs.set(key, 'accepted');
  // Marquer tous les messages en attente comme acceptés
  for (const m of db.directMessages) {
    if (m.senderId === senderId && m.receiverId === me && !m.accepted) {
      m.accepted = true;
      schedulePersistDirectMessageToPg(m);
    }
  }
  invalidateLegacyAcceptedCache();

  const receiver = db.users.get(me);
  getIo()?.to(`user_${senderId}`).emit('dm_request_accepted', {
    receiverId: me,
    receiverName: receiver?.username,
  });
  emitDmUnreadToUser(me);
  schedulePersist();
  res.json({ ok: true });
});

/** Refuser une demande de conversation. */
dmRouter.post('/requests/:senderId/refuse', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const senderId = req.params.senderId;
  const key = dmPairKey(senderId, me);

  if (db.dmPendingPairs.get(key) !== 'pending') {
    res.status(400).json({ error: 'Aucune demande en attente' });
    return;
  }

  db.dmPendingPairs.set(key, 'refused');
  // Masquer les messages en attente pour les deux parties
  for (const m of db.directMessages) {
    if (m.senderId === senderId && m.receiverId === me && !m.accepted) {
      if (!m.hiddenFor) m.hiddenFor = [];
      if (!m.hiddenFor.includes(me)) m.hiddenFor.push(me);
      if (!m.hiddenFor.includes(senderId)) m.hiddenFor.push(senderId);
      schedulePersistDirectMessageToPg(m);
    }
  }
  invalidateLegacyAcceptedCache();

  const receiver = db.users.get(me);
  getIo()?.to(`user_${senderId}`).emit('dm_request_refused', {
    receiverId: me,
    receiverName: receiver?.username,
  });
  schedulePersist();
  res.json({ ok: true });
});

dmRouter.post('/messages/:messageId/react', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const { emoji } = req.body;

  if (emoji !== '❤️') {
    res.status(400).json({ error: 'Emoji non supporté' });
    return;
  }

  const msg = db.directMessages.find((m) => m.id === req.params.messageId);
  if (!msg) {
    res.status(404).json({ error: 'Message introuvable' });
    return;
  }
  if (msg.senderId !== me && msg.receiverId !== me) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  if (!msg.reactions) msg.reactions = {};
  if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

  const idx = msg.reactions[emoji].indexOf(me);
  const added = idx < 0;
  if (added) {
    msg.reactions[emoji].push(me);
  } else {
    msg.reactions[emoji].splice(idx, 1);
  }

  const otherId = msg.senderId === me ? msg.receiverId : msg.senderId;
  const io = getIo();
  const payload = { messageId: msg.id, emoji, reactions: msg.reactions };
  io?.to(`user_${me}`).emit('dm_reaction', payload);
  io?.to(`user_${otherId}`).emit('dm_reaction', payload);

  schedulePersistDirectMessageToPg(msg);
  schedulePersist();
  res.json({ ok: true, added, reactions: msg.reactions });
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
    scheduleDeleteDirectMessageFromPg(msg.id);
    const otherId = msg.receiverId;
    getIo()?.to(`user_${otherId}`).emit('dm_deleted', { messageId: msg.id });
    getIo()?.to(`user_${me}`).emit('dm_deleted', { messageId: msg.id });
    schedulePersist();
    res.json({ ok: true, messageId: msg.id, scope: 'all' });
    return;
  }

  hideDmForUser(msg, me);
  schedulePersistDirectMessageToPg(msg);
    getIo()?.to(`user_${me}`).emit('dm_hidden', { messageId: msg.id });
  schedulePersist();
  res.json({ ok: true, messageId: msg.id, scope: 'hidden' });
});
