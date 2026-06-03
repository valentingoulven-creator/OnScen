import { Router, Request, Response } from 'express';
import { db, Salon, MusicPlatform, SalonTrackProposal } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { blurCoordinate } from '../lib/geo';
import { getPublicMapCoords } from '../lib/locationPrivacy';
import { isBotHost } from '../seed-bots';
import { canJoinSalon, isSalonVisibleOnMap, normalizeSalonAccess } from '../lib/salonAccess';
import { parseMusicLink, buildPlatformTrackUrl } from '../lib/musicLinks';
import { computePlaybackPositionMs } from '../lib/playbackClock';
import { resolveTrackForPlatform } from '../lib/trackResolver';
import {
  ensurePlatformAccountsFromLegacy,
  HOST_PLATFORM_NOT_LINKED,
  hostPlatformLinkMessage,
  isPlatformConnected,
} from '../lib/platformConnect';
import {
  ensureSalonQueue,
  ensureSalonProposals,
  clearSalonPlaybackData,
  getPendingProposals,
  broadcastSalonProposals,
  broadcastSalonPlayback,
  hostSkipNext,
  hostPlayQueueItem,
  enqueueItem,
  proposalToQueueItem,
} from '../lib/salonPlaybackOps';

export const salonsRouter = Router();

function requireHostPlatform(
  user: import('../models/schema').User | undefined,
  platform: MusicPlatform,
  res: Response
): user is import('../models/schema').User {
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return false;
  }
  ensurePlatformAccountsFromLegacy(user);
  if (!isPlatformConnected(user, platform)) {
    res.status(403).json({
      error: hostPlatformLinkMessage(platform),
      code: HOST_PLATFORM_NOT_LINKED,
      platform,
    });
    return false;
  }
  return true;
}

salonsRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salons = [...db.salons.values()]
    .filter((s) => isSalonVisibleOnMap(s, me))
    .map((s) => publicSalon(s, me));
  res.json({ salons });
});

salonsRouter.get('/:id', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon) {
    res.status(404).json({ error: 'Salon introuvable' });
    return;
  }
  normalizeSalonAccess(salon);
  if (!canJoinSalon(salon, me)) {
    res.status(403).json({
      error: 'Salon sur invitation — demandez au host de vous autoriser',
      accessMode: salon.accessMode,
    });
    return;
  }
  res.json({ salon: publicSalon(salon, me) });
});

salonsRouter.get('/:id/resolve-track', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon) {
    res.status(404).json({ error: 'Salon introuvable' });
    return;
  }
  normalizeSalonAccess(salon);
  if (!canJoinSalon(salon, me)) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const platformParam = String(req.query.platform ?? '');
  const targetPlatform: MusicPlatform = platformParam === 'youtube' ? 'youtube' : 'spotify';
  const ps = salon.playbackState;
  const resolved = resolveTrackForPlatform(
    ps.title,
    ps.artist,
    targetPlatform,
    salon.platform,
    ps.trackId
  );

  res.json({
    track: {
      ...resolved,
      hostPlatform: salon.platform,
      playbackPositionMs: computePlaybackPositionMs(ps),
    },
  });
});

function salonMemberOr403(salon: Salon | undefined, me: string, res: Response): salon is Salon {
  if (!salon) {
    res.status(404).json({ error: 'Salon introuvable' });
    return false;
  }
  normalizeSalonAccess(salon);
  if (!canJoinSalon(salon, me)) {
    res.status(403).json({ error: 'Accès refusé' });
    return false;
  }
  return true;
}

salonsRouter.get('/:id/queue', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salonMemberOr403(salon, me, res)) return;
  res.json({ queue: ensureSalonQueue(salon.id) });
});

salonsRouter.get('/:id/proposals', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salonMemberOr403(salon, me, res)) return;
  if (salon.hostId !== me) {
    res.status(403).json({ error: 'Réservé au host' });
    return;
  }
  res.json({ proposals: getPendingProposals(salon.id) });
});

salonsRouter.post('/:id/proposals', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string; username: string } }).user;
  const salon = db.salons.get(req.params.id);
  if (!salonMemberOr403(salon, me.id, res)) return;
  if (salon.hostId === me.id) {
    res.status(400).json({ error: 'Le host ne propose pas — ajoutez directement à la file' });
    return;
  }
  if (!salon.allowQueue) {
    res.status(400).json({ error: 'File désactivée dans ce salon' });
    return;
  }
  const { title, artist, spotifyUrl, youtubeUrl } = req.body;
  if (!title || !artist) {
    res.status(400).json({ error: 'Titre et artiste requis' });
    return;
  }
  const proposal: SalonTrackProposal = {
    id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    salonId: salon.id,
    proposerId: me.id,
    proposerName: me.username,
    title: String(title).slice(0, 120),
    artist: String(artist).slice(0, 80),
    spotifyUrl: spotifyUrl ? String(spotifyUrl).slice(0, 500) : undefined,
    youtubeUrl: youtubeUrl ? String(youtubeUrl).slice(0, 500) : undefined,
    status: 'pending',
    createdAt: Date.now(),
  };
  const list = ensureSalonProposals(salon.id);
  list.push(proposal);
  db.salonProposals.set(salon.id, list);
  broadcastSalonProposals(salon.id);
  res.status(201).json({ proposal });
});

salonsRouter.post('/:id/proposals/:proposalId/accept', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string; username: string } }).user;
  const salon = db.salons.get(req.params.id);
  if (!salon || salon.hostId !== me.id) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  const hostUser = db.users.get(me.id);
  if (!requireHostPlatform(hostUser, salon.platform, res)) return;
  const list = ensureSalonProposals(salon.id);
  const proposal = list.find((p) => p.id === req.params.proposalId && p.status === 'pending');
  if (!proposal) {
    res.status(404).json({ error: 'Proposition introuvable' });
    return;
  }
  proposal.status = 'accepted';
  const item = enqueueItem(
    salon.id,
    proposalToQueueItem(salon, proposal, me.id, me.username)
  );
  const playNow = req.body?.playNow === true;
  let playbackState = salon.playbackState;
  if (playNow) {
    const played = hostPlayQueueItem(salon, item.id);
    if (played) playbackState = played;
  }
  broadcastSalonProposals(salon.id);
  res.json({
    proposal,
    queueItem: item,
    queue: ensureSalonQueue(salon.id),
    ...(playNow ? { playbackState } : {}),
  });
});

salonsRouter.post('/:id/proposals/:proposalId/reject', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon || salon.hostId !== me) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  const list = ensureSalonProposals(salon.id);
  const proposal = list.find((p) => p.id === req.params.proposalId && p.status === 'pending');
  if (!proposal) {
    res.status(404).json({ error: 'Proposition introuvable' });
    return;
  }
  proposal.status = 'rejected';
  broadcastSalonProposals(salon.id);
  res.json({ proposal });
});

salonsRouter.post('/:id/playback/skip', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon || salon.hostId !== me) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  const hostUser = db.users.get(me);
  if (!requireHostPlatform(hostUser, salon.platform, res)) return;
  const state = hostSkipNext(salon);
  if (!state) {
    res.status(400).json({ error: 'File vide' });
    return;
  }
  res.json({ playbackState: state, queue: ensureSalonQueue(salon.id) });
});

salonsRouter.post('/:id/playback/play-queue', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon || salon.hostId !== me) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  const hostUser = db.users.get(me);
  if (!requireHostPlatform(hostUser, salon.platform, res)) return;
  const { queueItemId } = req.body;
  if (!queueItemId) {
    res.status(400).json({ error: 'queueItemId requis' });
    return;
  }
  const state = hostPlayQueueItem(salon, String(queueItemId));
  if (!state) {
    res.status(404).json({ error: 'Morceau introuvable dans la file' });
    return;
  }
  res.json({ playbackState: state, queue: ensureSalonQueue(salon.id) });
});

salonsRouter.post('/:id/join', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon) {
    res.status(404).json({ error: 'Salon introuvable' });
    return;
  }
  normalizeSalonAccess(salon);
  if (!canJoinSalon(salon, me)) {
    res.status(403).json({ error: 'Accès refusé — salon sur invitation uniquement' });
    return;
  }
  res.json({ ok: true, salon: publicSalon(salon, me) });
});

salonsRouter.patch('/:id/settings', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon || salon.hostId !== me) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  const hostUser = db.users.get(me);
  if (!requireHostPlatform(hostUser, salon.platform, res)) return;

  const { accessMode, allowedUserIds, isPublic, allowQueue, title, platform, trackLink, trackTitle, artist } =
    req.body;

  if (accessMode === 'public' || accessMode === 'invite') {
    salon.accessMode = accessMode;
    salon.isPublic = accessMode === 'public';
  } else if (typeof isPublic === 'boolean') {
    salon.isPublic = isPublic;
    salon.accessMode = isPublic ? 'public' : 'invite';
  }

  if (Array.isArray(allowedUserIds)) {
    salon.allowedUserIds = [...new Set([me, ...allowedUserIds.map(String)])];
  }

  if (title && typeof title === 'string') salon.title = title.trim().slice(0, 80);
  if (allowQueue !== undefined) salon.allowQueue = Boolean(allowQueue);

  if (platform === 'spotify' || platform === 'youtube') {
    if (!requireHostPlatform(hostUser, platform, res)) return;
    salon.platform = platform;
    salon.playbackState.platform = platform;
  }

  if (trackLink && typeof trackLink === 'string') {
    const parsed = parseMusicLink(salon.platform, trackLink);
    if (parsed) {
      salon.playbackState.trackId = parsed.trackId;
      salon.playbackState.externalUrl = buildPlatformTrackUrl(salon.platform, parsed.trackId);
      if (salon.platform === 'youtube') {
        salon.playbackState.albumArtUrl = `https://img.youtube.com/vi/${parsed.trackId}/hqdefault.jpg`;
      }
    }
  }
  if (trackTitle) salon.playbackState.title = String(trackTitle).slice(0, 120);
  if (artist) salon.playbackState.artist = String(artist).slice(0, 80);
  salon.playbackState.updatedAt = Date.now();

  normalizeSalonAccess(salon);
  db.salons.set(salon.id, salon);
  res.json({ salon: publicSalon(salon, me) });
});

salonsRouter.post('/:id/allowed', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  const { userId } = req.body;
  if (!salon || salon.hostId !== me) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  if (!userId || !db.users.has(userId)) {
    res.status(400).json({ error: 'Utilisateur invalide' });
    return;
  }
  normalizeSalonAccess(salon);
  if (!salon.allowedUserIds.includes(userId)) {
    salon.allowedUserIds.push(userId);
    db.salons.set(salon.id, salon);
  }
  res.json({ salon: publicSalon(salon, me) });
});

salonsRouter.delete('/:id/allowed/:userId', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  const target = req.params.userId;
  if (!salon || salon.hostId !== me) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  if (target === me) {
    res.status(400).json({ error: 'Impossible de retirer le host' });
    return;
  }
  salon.allowedUserIds = salon.allowedUserIds.filter((id) => id !== target);
  normalizeSalonAccess(salon);
  db.salons.set(salon.id, salon);
  res.json({ salon: publicSalon(salon, me) });
});

salonsRouter.post('/', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  const {
    title,
    platform,
    latitude,
    longitude,
    trackId,
    trackLink,
    trackTitle,
    artist,
    albumArtUrl,
    allowQueue,
    accessMode,
    allowedUserIds,
    isPublic,
  } = req.body;

  if (latitude === undefined || longitude === undefined) {
    res.status(400).json({ error: 'Géolocalisation requise' });
    return;
  }

  const plat: MusicPlatform = platform === 'youtube' ? 'youtube' : 'spotify';
  if (!requireHostPlatform(user, plat, res)) return;

  let resolvedTrackId = trackId || 'demo';
  let externalUrl: string | undefined;
  if (trackLink && typeof trackLink === 'string') {
    const parsed = parseMusicLink(plat, trackLink);
    if (parsed) {
      resolvedTrackId = parsed.trackId;
      externalUrl = buildPlatformTrackUrl(plat, parsed.trackId);
    }
  } else if (resolvedTrackId !== 'demo') {
    externalUrl = buildPlatformTrackUrl(plat, resolvedTrackId);
  }

  let mode: 'public' | 'invite' = 'public';
  if (accessMode === 'invite') mode = 'invite';
  else if (accessMode === 'public') mode = 'public';
  else if (isPublic === false) mode = 'invite';

  const guestIds = Array.isArray(allowedUserIds)
    ? allowedUserIds.map(String).filter((id: string) => id !== userId && db.users.has(id))
    : [];

  const salon: Salon = {
    id: `salon_${Date.now()}`,
    hostId: userId,
    hostName: user.username,
    hostAvatarUrl: user.avatarUrl,
    title: title || `Salon de ${user.username}`,
    platform: plat,
    playbackState: {
      platform: plat,
      trackId: resolvedTrackId,
      title: trackTitle || 'MeloSong Session',
      artist: artist || user.username,
      albumArtUrl:
        albumArtUrl ||
        (plat === 'youtube' && resolvedTrackId !== 'demo'
          ? `https://img.youtube.com/vi/${resolvedTrackId}/hqdefault.jpg`
          : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400'),
      isPlaying: true,
      progressMs: 0,
      updatedAt: Date.now(),
      startedAt: Date.now(),
      externalUrl,
    },
    latitude,
    longitude,
    blurredLatitude: blurCoordinate(latitude),
    blurredLongitude: blurCoordinate(longitude),
    listenersCount: 0,
    isGhostMode: user.isGhostMode,
    accessMode: mode,
    isPublic: mode === 'public',
    allowedUserIds: [userId, ...guestIds],
    allowQueue: allowQueue ?? true,
    createdAt: Date.now(),
  };

  normalizeSalonAccess(salon);
  db.salons.set(salon.id, salon);
  db.salonChats.set(salon.id, []);
  ensureSalonQueue(salon.id);
  ensureSalonProposals(salon.id);
  res.status(201).json({ salon: publicSalon(salon, userId) });
});

salonsRouter.delete('/:id', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon || salon.hostId !== userId) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  db.salons.delete(salon.id);
  db.salonChats.delete(salon.id);
  clearSalonPlaybackData(salon.id);
  res.json({ ok: true });
});

export function publicSalon(s: Salon, viewerId?: string) {
  normalizeSalonAccess(s);
  const isHost = viewerId === s.hostId;
  const canJoin = viewerId ? canJoinSalon(s, viewerId) : s.accessMode === 'public';
  const host = db.users.get(s.hostId);
  const mapCoords =
    host != null
      ? getPublicMapCoords(
          host,
          s.latitude,
          s.longitude,
          s.blurredLatitude,
          s.blurredLongitude,
          viewerId
        )
      : { latitude: s.blurredLatitude, longitude: s.blurredLongitude };

  return {
    id: s.id,
    hostId: s.hostId,
    hostName: s.hostName,
    hostAvatarUrl: s.hostAvatarUrl,
    title: s.title,
    platform: s.platform,
    playbackState: s.playbackState,
    latitude: mapCoords.latitude,
    longitude: mapCoords.longitude,
    listenersCount: s.listenersCount,
    isLive: db.lives.has(s.id) && db.lives.get(s.id)?.isActive,
    allowQueue: s.allowQueue,
    isBot: isBotHost(s.hostId),
    accessMode: s.accessMode,
    isPublic: s.isPublic,
    canJoin,
    isHost,
    allowedUserIds: isHost ? s.allowedUserIds : undefined,
    allowedCount: s.accessMode === 'invite' ? s.allowedUserIds.length - 1 : undefined,
    queue: ensureSalonQueue(s.id),
    pendingProposalsCount: isHost ? getPendingProposals(s.id).length : undefined,
  };
}
