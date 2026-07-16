import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { asyncHandler } from '../lib/asyncHandler';
import { toggleCompositionUpvote } from '../lib/compositionUpvotes';
import { recordCompositionPlay } from '../lib/compositionPlays';
import {
  createUserComposition,
  deleteUserComposition,
  listUserCompositions,
} from '../lib/compositions';
import { schedulePersist } from '../lib/persist';

export const compositionsRouter = Router();

compositionsRouter.get('/mine', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  res.json({ compositions: listUserCompositions(me) });
});

compositionsRouter.post('/', authenticateJWT, asyncHandler(async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const body = req.body ?? {};
  const result = await createUserComposition(me, {
    title: String(body.title ?? ''),
    artist: body.artist != null ? String(body.artist) : undefined,
    fileUrl: String(body.fileUrl ?? body.audioUrl ?? ''),
    durationSec:
      typeof body.durationSec === 'number' && Number.isFinite(body.durationSec)
        ? body.durationSec
        : undefined,
    albumId: body.albumId != null ? String(body.albumId) : undefined,
    rightsConfirmed: body.rightsConfirmed === true,
  });
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json({ composition: result });
}));

compositionsRouter.post('/:id/play', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const result = recordCompositionPlay(req.params.id, me);
  if (!result.ok) {
    res.status(404).json({ error: 'Composition introuvable' });
    return;
  }
  schedulePersist();
  res.json({ weeklyPlayCount: result.weeklyPlayCount });
});

compositionsRouter.post('/:id/upvote', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const result = toggleCompositionUpvote(req.params.id, me);
  if ('error' in result) {
    res.status(404).json({ error: result.error });
    return;
  }
  schedulePersist();
  res.json(result);
});

compositionsRouter.delete('/:id', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const ok = deleteUserComposition(req.params.id, me);
  if (!ok) {
    res.status(404).json({ error: 'Composition introuvable' });
    return;
  }
  res.json({ ok: true });
});
