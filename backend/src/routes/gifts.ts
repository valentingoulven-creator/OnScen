import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { getIo } from '../lib/ioInstance';
import { notifyHostLiveDon } from '../lib/notifications';

export const giftsRouter = Router();

const GIFT_TYPES = new Set(['note', 'heart', 'star', 'crown', 'don']);
const DON_AMOUNT_MIN = 1;
const DON_AMOUNT_MAX = 500;

function isValidDonAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= DON_AMOUNT_MIN && amount <= DON_AMOUNT_MAX;
}

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
  const { liveId, giftType, amount: rawAmount } = req.body;

  if (!user || !liveId || !giftType) {
    res.status(400).json({ error: 'Paramètres invalides' });
    return;
  }

  if (!GIFT_TYPES.has(giftType)) {
    res.status(400).json({ error: 'Réaction invalide' });
    return;
  }

  let amount = 0;
  if (giftType === 'don') {
    amount = Math.trunc(Number(rawAmount));
    if (!isValidDonAmount(amount)) {
      res.status(400).json({
        error: `Montant de don invalide (${DON_AMOUNT_MIN} à ${DON_AMOUNT_MAX} €)`,
      });
      return;
    }
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
    amount,
    timestamp: Date.now(),
  };
  db.gifts.push(gift);

  emitGiftAnimation(liveId, {
    id: gift.id,
    senderId: userId,
    giftType,
    senderName: user.username,
    amount,
    timestamp: gift.timestamp,
  });

  if (giftType === 'don') {
    notifyHostLiveDon({
      hostId: live.hostId,
      senderId: userId,
      senderName: user.username,
      senderAvatarUrl: user.avatarUrl,
      amount,
      liveId,
    });
  }

  res.status(201).json({ gift });
});
