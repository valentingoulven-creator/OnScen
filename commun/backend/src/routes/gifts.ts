import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { getIo } from '../lib/ioInstance';
import { isDonationSimulationMode } from '../lib/donations';

export const giftsRouter = Router();

const GIFT_TYPES = new Set(['note', 'heart', 'star', 'crown', 'don']);

function emitGiftAnimation(
  liveId: string,
  gift: {
    id: string;
    senderId: string;
    giftType: string;
    senderName: string;
    amount: number;
    timestamp: number;
  }
) {
  getIo()?.to(`live_${liveId}`).emit('gift_animation', { liveId, ...gift });
}

giftsRouter.get('/catalog', authenticateJWT, (_req: Request, res: Response) => {
  res.json({
    gifts: [
      { type: 'note', label: 'Note' },
      { type: 'heart', label: 'Cœur' },
      { type: 'star', label: 'Étoile' },
      { type: 'crown', label: 'Couronne' },
      { type: 'don', label: 'Don' },
    ],
  });
});

giftsRouter.get('/live/:liveId', authenticateJWT, (req: Request, res: Response) => {
  const liveId = req.params.liveId;
  const gifts = db.gifts
    .filter((g) => g.liveId === liveId)
    .slice(-30)
    .reverse();
  res.json({ gifts });
});

giftsRouter.post('/send', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  const { liveId, giftType } = req.body;

  if (!user || !liveId || !giftType) {
    res.status(400).json({ error: 'Paramètres invalides' });
    return;
  }

  if (!GIFT_TYPES.has(giftType)) {
    res.status(400).json({ error: 'Réaction invalide' });
    return;
  }

  if (giftType === 'don') {
    res.status(403).json({
      error: isDonationSimulationMode()
        ? 'Utilisez le flux de don sécurisé (/api/donations/simulate)'
        : 'Utilisez le paiement sécurisé via Stripe (/api/donations/create-intent)',
      code: 'DONATION_PAYMENT_REQUIRED',
    });
    return;
  }

  const live = db.lives.get(liveId);
  if (!live?.isActive) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }

  const gift = {
    id: `gift_${Date.now()}`,
    liveId,
    senderId: userId,
    senderName: user.username,
    giftType,
    amount: 0,
    timestamp: Date.now(),
  };
  db.gifts.push(gift);

  emitGiftAnimation(liveId, {
    id: gift.id,
    senderId: userId,
    giftType,
    senderName: user.username,
    amount: 0,
    timestamp: gift.timestamp,
  });

  res.status(201).json({ gift });
});
