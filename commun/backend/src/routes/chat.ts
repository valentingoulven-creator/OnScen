import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { getIo } from '../lib/ioInstance';
import { canDeleteLiveChatMessage, deleteLiveChatMessage } from '../lib/liveModeration';
import { canModerateSalon } from '../lib/salonModeration';
import { enrichChatMessages } from '../lib/usernameColor';
import { hasBlocked } from '../lib/blocks';
import { checkChatRateLimit } from '../lib/chatRateLimit';
import { chatAttachmentUploadLimiter } from '../lib/uploadRateLimits';
import { saveChatAttachmentFromDataUrl, deleteChatAttachmentIfLocal } from '../lib/chatAttachmentAssets';
import { moderateImageSource, moderationRejectionMessage } from '../lib/contentModeration';

export const chatRouter = Router();

/**
 * Convertit une pièce jointe (data: URL) en fichier local servi en HTTPS.
 * Étape obligatoire avant d'envoyer un message DM / salon / live avec pièce jointe :
 * le backend n'accepte plus de data: URL brute dans attachmentUrl (voir chatAttachmentUrl.ts).
 */
chatRouter.post('/attachment', authenticateJWT, chatAttachmentUploadLimiter, (req: Request, res: Response) => {
  void (async () => {
    const me = (req as Request & { user: { id: string } }).user.id;
    if (!(await checkChatRateLimit(me))) {
      res.status(429).json({ error: 'Trop de fichiers envoyés. Réessayez dans quelques secondes.' });
      return;
    }
    const { dataUrl, name } = req.body as { dataUrl?: unknown; name?: unknown };
    if (typeof dataUrl !== 'string' || !dataUrl.trim()) {
      res.status(400).json({ error: 'Fichier requis' });
      return;
    }
    let saved;
    try {
      saved = saveChatAttachmentFromDataUrl(dataUrl);
    } catch (e) {
      res.status(413).json({ error: e instanceof Error ? e.message : 'Fichier invalide' });
      return;
    }
    if (saved.isImage) {
      const moderation = await moderateImageSource(dataUrl, 'salon_chat', me);
      if (!moderation.allowed) {
        deleteChatAttachmentIfLocal(saved.url);
        res.status(422).json({ error: moderationRejectionMessage(moderation) });
        return;
      }
    }
    res.json({
      attachmentUrl: saved.url,
      attachmentMimeType: saved.mimeType,
      attachmentSize: saved.size,
      attachmentName: typeof name === 'string' ? name.trim().slice(0, 200) : undefined,
    });
  })();
});

chatRouter.get('/salon/:salonId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const raw = db.salonChats.get(req.params.salonId) || [];
  const messages = raw.filter((m) => !hasBlocked(me, m.senderId));
  res.json({ messages: enrichChatMessages(messages) });
});

chatRouter.get('/live/:liveId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const raw = db.liveChats.get(req.params.liveId) || [];
  const messages = raw.filter((m) => !hasBlocked(me, m.senderId));
  res.json({ messages: enrichChatMessages(messages) });
});

chatRouter.delete(
  '/:roomType/:roomId/messages/:messageId',
  authenticateJWT,
  (req: Request, res: Response) => {
    const me = (req as Request & { user: { id: string } }).user.id;
    const { roomType, roomId, messageId } = req.params;

    if (roomType !== 'salon' && roomType !== 'live') {
      res.status(400).json({ error: 'Type de salon invalide' });
      return;
    }

    const store = roomType === 'salon' ? db.salonChats : db.liveChats;
    const list = store.get(roomId);
    if (!list) {
      res.status(404).json({ error: 'Message introuvable' });
      return;
    }

    const idx = list.findIndex((m) => m.id === messageId);
    if (idx < 0) {
      res.status(404).json({ error: 'Message introuvable' });
      return;
    }

    const msg = list[idx];
    if (roomType === 'live') {
      const live = db.lives.get(roomId);
      if (!live) {
        res.status(404).json({ error: 'Live introuvable' });
        return;
      }
      if (!canDeleteLiveChatMessage(live, me)) {
        res.status(403).json({ error: 'Modération non autorisée' });
        return;
      }
      if (!deleteLiveChatMessage(roomId, messageId)) {
        res.status(404).json({ error: 'Message introuvable' });
        return;
      }
    } else {
      const salon = db.salons.get(roomId);
      const isOwn = msg.senderId === me;
      const canMod = salon ? canModerateSalon(salon, me) : false;
      if (!isOwn && !canMod) {
        res.status(403).json({ error: 'Vous ne pouvez supprimer que vos messages' });
        return;
      }
      list.splice(idx, 1);
      store.set(roomId, list);
    }

    const event = roomType === 'salon' ? 'salon_message_deleted' : 'live_message_deleted';
    const roomChannel = roomType === 'salon' ? `salon_${roomId}` : `live_${roomId}`;
    getIo()?.to(roomChannel).emit(event, { roomId, messageId });

    res.json({ ok: true, messageId });
  }
);
