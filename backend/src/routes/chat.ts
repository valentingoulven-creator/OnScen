import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { getIo } from '../lib/ioInstance';
import { canDeleteLiveChatMessage, deleteLiveChatMessage } from '../lib/liveModeration';

export const chatRouter = Router();

chatRouter.get('/salon/:salonId', authenticateJWT, (req: Request, res: Response) => {
  res.json({ messages: db.salonChats.get(req.params.salonId) || [] });
});

chatRouter.get('/live/:liveId', authenticateJWT, (req: Request, res: Response) => {
  res.json({ messages: db.liveChats.get(req.params.liveId) || [] });
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
      const isOwn = msg.senderId === me;
      if (!isOwn) {
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
