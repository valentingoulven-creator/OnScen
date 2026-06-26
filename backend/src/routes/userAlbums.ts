import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { db } from '../models/schema';
import {
  createUserAlbum,
  deleteUserAlbum,
  listAlbumTracks,
  listUserAlbums,
  looseTrackCount,
} from '../lib/albums';
import { createUserComposition } from '../lib/compositions';
import { enrichCompositionWithUpvotes } from '../lib/compositionUpvotes';
import { COMPOSITION_UPLOAD_JSON_BODY_LIMIT } from '../lib/compositionUploadLimits';

export const userAlbumsRouter = Router();

userAlbumsRouter.get('/me/albums', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  res.json({
    albums: listUserAlbums(me),
    looseTrackCount: looseTrackCount(me),
  });
});

userAlbumsRouter.post('/me/albums', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const body = req.body ?? {};
  const result = createUserAlbum(me, {
    title: String(body.title ?? ''),
    description: body.description != null ? String(body.description) : undefined,
    coverUrl: body.coverUrl != null ? String(body.coverUrl) : undefined,
  });
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json({ album: result });
});

userAlbumsRouter.delete('/me/albums/:albumId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const ok = deleteUserAlbum(req.params.albumId, me);
  if (!ok) {
    res.status(404).json({ error: 'Album introuvable' });
    return;
  }
  res.json({ ok: true });
});

userAlbumsRouter.post(
  '/me/albums/:albumId/tracks',
  authenticateJWT,
  async (req: Request, res: Response) => {
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
      albumId: req.params.albumId,
      rightsConfirmed: body.rightsConfirmed === true,
    });
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ track: result });
  }
);

/** Morceaux sans album (propriétaire). */
userAlbumsRouter.post('/me/loose-tracks', authenticateJWT, async (req: Request, res: Response) => {
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
    rightsConfirmed: body.rightsConfirmed === true,
  });
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json({ track: result });
});

userAlbumsRouter.get('/:userId/albums', authenticateJWT, (req: Request, res: Response) => {
  const userId = req.params.userId;
  if (!db.users.has(userId)) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  res.json({
    albums: listUserAlbums(userId),
    looseTrackCount: looseTrackCount(userId),
  });
});

userAlbumsRouter.get(
  '/:userId/albums/:albumId/tracks',
  authenticateJWT,
  (req: Request, res: Response) => {
    const viewerId = (req as Request & { user: { id: string } }).user.id;
    const { userId, albumId } = req.params;
    if (!db.users.has(userId)) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    const tracks = listAlbumTracks(userId, albumId === 'loose' ? null : albumId);
    if (albumId !== 'loose' && tracks.length === 0) {
      const albumExists = db.albums.some((a) => a.id === albumId && a.userId === userId);
      if (!albumExists) {
        res.status(404).json({ error: 'Album introuvable' });
        return;
      }
    }
    res.json({
      tracks: tracks.map((track) => enrichCompositionWithUpvotes(track, viewerId)),
    });
  }
);