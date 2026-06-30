import { Router, Request, Response } from 'express';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { getHostRatingSummary } from '../lib/ratings';
import { schedulePersist } from '../lib/persist';
import { isBotHost } from '../seed-bots';

export const ratingsRouter = Router();

ratingsRouter.get('/host/:hostId', authenticateJWT, (req: Request, res: Response) => {
  const hostId = req.params.hostId;
  const host = db.users.get(hostId);
  if (!host) {
    res.status(404).json({ error: 'Host introuvable' });
    return;
  }

  const me = (req as Request & { user: { id: string } }).user.id;
  res.json({ rating: getHostRatingSummary(hostId, me) });
});

ratingsRouter.post('/', authenticateJWT, (req: Request, res: Response) => {
  const raterId = (req as Request & { user: { id: string } }).user.id;
  const { hostId, stars, salonId, liveId } = req.body;

  if (!hostId || stars == null) {
    res.status(400).json({ error: 'hostId et stars requis' });
    return;
  }

  const n = Number(stars);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    res.status(400).json({ error: 'Note entre 1 et 5 étoiles' });
    return;
  }

  if (hostId === raterId) {
    res.status(400).json({ error: 'Vous ne pouvez pas vous noter vous-même' });
    return;
  }

  if (!db.users.get(hostId)) {
    res.status(404).json({ error: 'Host introuvable' });
    return;
  }

  if (isBotHost(hostId)) {
    res.status(400).json({ error: 'Les comptes démo bot ne peuvent pas être notés' });
    return;
  }

  const existing = db.hostRatings.find((r) => r.hostId === hostId && r.raterId === raterId);
  if (existing) {
    existing.stars = n;
    existing.salonId = salonId || existing.salonId;
    existing.liveId = liveId || existing.liveId;
    existing.timestamp = Date.now();
  } else {
    db.hostRatings.push({
      id: `rating_${Date.now()}_${raterId}`,
      hostId,
      raterId,
      stars: n,
      salonId,
      liveId,
      timestamp: Date.now(),
    });
  }

  schedulePersist();
  res.status(201).json({ rating: getHostRatingSummary(hostId, raterId) });
});
