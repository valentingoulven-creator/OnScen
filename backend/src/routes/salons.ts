import { Router, Request, Response } from 'express';
import { db, Salon, MusicPlatform, SalonTrackProposal } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { blurCoordinate } from '../lib/geo';
import { getPublicMapCoords } from '../lib/locationPrivacy';
import { isBotHost } from '../seed-bots';
import { canJoinSalon, isSalonVisibleOnMap, normalizeSalonAccess } from '../lib/salonAccess';
import { assertSalonAccessible } from '../lib/adminContentModeration';
import { isDevUser } from '../lib/accessControl';
import { parseMusicLink, parseYoutubePlaylistId, parseSpotifyPlaylistId, buildPlatformTrackUrl } from '../lib/musicLinks';
import { computePlaybackPositionMs } from '../lib/playbackClock';
import { resolveTrackForPlatform } from '../lib/trackResolver';
import {
  ensurePlatformAccountsFromLegacy,
  HOST_PLATFORM_NOT_LINKED,
  hostPlatformLinkMessage,
  isPlatformConnected,
  getYoutubeAccessToken,
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
  hostChangePlaybackTrack,
  hostLoadYoutubePlaylist,
  enqueueItem,
  proposalToQueueItem,
  removeTrackFromSalonQueue,
} from '../lib/salonPlaybackOps';
import { searchYoutube } from '../lib/youtubeSearch';
import {
  normalizeSpotifySearchLimit,
  searchSpotifyTracks,
  SpotifySearchError,
} from '../lib/spotifySearch';
import { isRealSpotifyAccount } from '../lib/spotifyOAuth';
import {
  addSpotifyTrackToQueue,
  controlSpotifyPlayback,
  getSpotifyNowPlaying,
  playSpotifyTrackNow,
  SpotifyPlaybackError,
} from '../lib/spotifyPlayback';
import { resolvePlaylistVideos } from '../lib/youtubePlaylists';
import { resolveSpotifyPlaylistTracks, SpotifyPlaylistError } from '../lib/spotifyPlaylists';
import { notifyFavoritesSalonStarted } from '../lib/favorites';
import { notifySalonInvite } from '../lib/notifications';
import { normalizeSpotifyJamUrl } from '../lib/spotifyJam';
import { getIo } from '../lib/ioInstance';
import { getSalonConnectedParticipants } from '../lib/salonParticipants';
import {
  broadcastSalonUpdated,
  canControlSalonPlayback,
  setSalonVipModerator,
} from '../lib/salonModeration';

export const salonsRouter = Router();

/**
 * YouTube search result cache — TTL 1 hour (well within the YouTube API ToS 24-hour limit).
 * Keys are the lower-cased query string. Cached results expire after YOUTUBE_SEARCH_TTL_MS.
 */
const YOUTUBE_SEARCH_TTL_MS = 60 * 60 * 1000; // 1 hour
const ytSearchCache = new Map<string, { results: unknown; expiresAt: number }>();

function getYtSearchCached(q: string): unknown | null {
  const entry = ytSearchCache.get(q);
  if (entry && Date.now() < entry.expiresAt) return entry.results;
  if (entry) ytSearchCache.delete(q);
  return null;
}

function setYtSearchCached(q: string, results: unknown): void {
  if (ytSearchCache.size > 500) {
    const now = Date.now();
    for (const [key, entry] of ytSearchCache) {
      if (now >= entry.expiresAt) ytSearchCache.delete(key);
    }
  }
  ytSearchCache.set(q, { results, expiresAt: Date.now() + YOUTUBE_SEARCH_TTL_MS });
}

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

/** Salon Spotify : hôte avec OAuth réel (pas mock/legacy) pour recherche et playlists. */
function requireRealSpotifyHost(
  user: import('../models/schema').User | undefined,
  res: Response
): user is import('../models/schema').User {
  if (!requireHostPlatform(user, 'spotify', res)) return false;
  if (!isRealSpotifyAccount(user)) {
    res.status(403).json({
      error: 'Reconnectez votre compte Spotify (connexion OAuth requise pour la recherche).',
      code: 'spotify_not_connected',
      platform: 'spotify',
    });
    return false;
  }
  return true;
}

/** Hôte ou VIP autorisé à piloter la lecture ; le jeton Spotify/YouTube reste celui de l'hôte. */
function requireSalonPlaybackController(
  salon: Salon | undefined,
  actorId: string,
  res: Response
): salon is Salon {
  if (!salon) {
    res.status(404).json({ error: 'Salon introuvable' });
    return false;
  }
  if (!canControlSalonPlayback(salon, actorId)) {
    res.status(403).json({ error: 'Non autorisé' });
    return false;
  }
  return true;
}

function getSalonHostUser(salon: Salon, res: Response): import('../models/schema').User | undefined {
  const hostUser = db.users.get(salon.hostId);
  if (!hostUser) {
    res.status(404).json({ error: 'Hôte introuvable' });
    return undefined;
  }
  return hostUser;
}

/** Lance un morceau sur Spotify Connect (hôte) avant mise à jour file Soundy. */
async function tryPlaySpotifyTrackForSalon(
  hostUser: import('../models/schema').User,
  salon: Salon,
  trackId: string | undefined
): Promise<SpotifyPlaybackError | null> {
  if (salon.platform !== 'spotify') return null;
  const safeId = trackId?.trim();
  if (!safeId || safeId === 'demo') return null;
  try {
    await playSpotifyTrackNow(hostUser, safeId);
    return null;
  } catch (e) {
    if (e instanceof SpotifyPlaybackError) return e;
    throw e;
  }
}

salonsRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salons = [...db.salons.values()]
    .filter((s) => isSalonVisibleOnMap(s, me))
    .map((s) => publicSalon(s, me));
  res.json({ salons });
});

salonsRouter.get('/youtube-search', authenticateJWT, async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    res.json({ results: [] });
    return;
  }
  const cacheKey = q.toLowerCase();
  const cached = getYtSearchCached(cacheKey);
  if (cached) {
    // TTL 1 hour — compliant with YouTube API ToS (max 24h)
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.json({ results: cached, fromCache: true });
    return;
  }
  try {
    const results = await searchYoutube(q);
    setYtSearchCached(cacheKey, results);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.json({ results });
  } catch {
    res.status(502).json({ error: 'Recherche YouTube indisponible' });
  }
});

salonsRouter.get('/spotify-search', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(me);
  if (!requireRealSpotifyHost(user, res)) return;

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    res.json({ results: [] });
    return;
  }

  const limit = normalizeSpotifySearchLimit(req.query.limit);

  try {
    const results = await searchSpotifyTracks(user, q, { limit });
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ results });
  } catch (e) {
    if (e instanceof SpotifySearchError) {
      res.status(e.status).json({ error: e.message, code: e.code });
      return;
    }
    console.warn('[spotify-search]', e);
    res.status(502).json({
      error: 'Recherche Spotify indisponible (erreur serveur).',
      code: 'spotify_search_failed',
    });
  }
});

salonsRouter.get('/:id', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon) {
    res.status(404).json({ error: 'Salon introuvable' });
    return;
  }
  if (!assertSalonAccessible(salon, me)) {
    res.status(403).json({ error: 'Salon indisponible', code: 'content_blocked' });
    return;
  }
  normalizeSalonAccess(salon);
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

salonsRouter.get('/:id/participants', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon) {
    res.status(404).json({ error: 'Salon introuvable' });
    return;
  }
  if (salon.hostId !== me) {
    res.status(403).json({ error: 'Réservé au host' });
    return;
  }
  const vipIds = salon.vipModeratorIds ?? [];
  res.json({
    participants: getSalonConnectedParticipants(salon.id, salon.hostId, vipIds),
    listenersCount: salon.listenersCount,
  });
});

salonsRouter.patch('/:id/participants/:userId/vip', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const { add } = req.body as { add?: unknown };
  if (typeof add !== 'boolean') {
    res.status(400).json({ error: 'Paramètre add (boolean) requis' });
    return;
  }
  const result = setSalonVipModerator(req.params.id, me, req.params.userId, add);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ salon: publicSalon(result.salon, me) });
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

salonsRouter.post('/:id/proposals/:proposalId/accept', authenticateJWT, async (req: Request, res: Response) => {
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
    if (salon.platform === 'spotify') {
      if (!requireRealSpotifyHost(hostUser, res)) return;
      const spotifyErr = await tryPlaySpotifyTrackForSalon(hostUser, salon, item.trackId);
      if (spotifyErr && spotifyErr.code !== 'no_active_device') {
        res.status(spotifyErr.status).json({ error: spotifyErr.message, code: spotifyErr.code });
        return;
      }
      const played = hostPlayQueueItem(salon, item.id);
      if (played) playbackState = played;
      if (spotifyErr?.code === 'no_active_device' && played) {
        broadcastSalonProposals(salon.id);
        res.status(spotifyErr.status).json({
          error: spotifyErr.message,
          code: spotifyErr.code,
          proposal,
          queueItem: item,
          queue: ensureSalonQueue(salon.id),
          playbackState,
        });
        return;
      }
    } else {
      const played = hostPlayQueueItem(salon, item.id);
      if (played) playbackState = played;
    }
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

salonsRouter.post('/:id/playback/skip', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!requireSalonPlaybackController(salon, me, res)) return;
  const hostUser = getSalonHostUser(salon, res);
  if (!hostUser || !requireHostPlatform(hostUser, salon.platform, res)) return;

  const queue = ensureSalonQueue(salon.id);
  if (queue.length === 0) {
    res.status(400).json({ error: 'File vide' });
    return;
  }

  if (salon.platform === 'spotify' && !requireRealSpotifyHost(hostUser, res)) return;

  const spotifyErr = await tryPlaySpotifyTrackForSalon(hostUser, salon, queue[0]?.trackId);
  if (spotifyErr && spotifyErr.code !== 'no_active_device') {
    res.status(spotifyErr.status).json({ error: spotifyErr.message, code: spotifyErr.code });
    return;
  }

  const state = hostSkipNext(salon);
  if (!state) {
    res.status(400).json({ error: 'File vide' });
    return;
  }

  if (spotifyErr?.code === 'no_active_device') {
    res.status(spotifyErr.status).json({
      error: spotifyErr.message,
      code: spotifyErr.code,
      playbackState: state,
      queue: ensureSalonQueue(salon.id),
    });
    return;
  }

  res.json({ playbackState: state, queue: ensureSalonQueue(salon.id) });
});

salonsRouter.post('/:id/playback/play-queue', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!requireSalonPlaybackController(salon, me, res)) return;
  const hostUser = getSalonHostUser(salon, res);
  if (!hostUser || !requireHostPlatform(hostUser, salon.platform, res)) return;
  const { queueItemId } = req.body;
  if (!queueItemId) {
    res.status(400).json({ error: 'queueItemId requis' });
    return;
  }

  const queue = ensureSalonQueue(salon.id);
  const item = queue.find((q) => q.id === String(queueItemId));
  if (!item) {
    res.status(404).json({ error: 'Morceau introuvable dans la file' });
    return;
  }

  if (salon.platform === 'spotify' && !requireRealSpotifyHost(hostUser, res)) return;

  const spotifyErr = await tryPlaySpotifyTrackForSalon(hostUser, salon, item.trackId);
  if (spotifyErr && spotifyErr.code !== 'no_active_device') {
    res.status(spotifyErr.status).json({ error: spotifyErr.message, code: spotifyErr.code });
    return;
  }

  const state = hostPlayQueueItem(salon, String(queueItemId));
  if (!state) {
    res.status(404).json({ error: 'Morceau introuvable dans la file' });
    return;
  }

  if (spotifyErr?.code === 'no_active_device') {
    res.status(spotifyErr.status).json({
      error: spotifyErr.message,
      code: spotifyErr.code,
      playbackState: state,
      queue: ensureSalonQueue(salon.id),
    });
    return;
  }

  res.json({ playbackState: state, queue: ensureSalonQueue(salon.id) });
});

salonsRouter.post('/:id/playback/change-track', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!requireSalonPlaybackController(salon, me, res)) return;
  if (salon.platform !== 'youtube' && salon.platform !== 'spotify') {
    res.status(400).json({ error: 'Changement de morceau non supporté pour cette plateforme' });
    return;
  }
  const hostUser = getSalonHostUser(salon, res);
  if (!hostUser || !requireHostPlatform(hostUser, salon.platform, res)) return;

  const { trackId, title, artist, trackLink, albumArtUrl } = req.body;
  let resolvedId = typeof trackId === 'string' ? trackId.trim() : '';
  if (!resolvedId && trackLink && typeof trackLink === 'string') {
    const parsed = parseMusicLink(salon.platform, trackLink);
    if (parsed) resolvedId = parsed.trackId;
  }
  if (!resolvedId || resolvedId === 'demo') {
    res.status(400).json({
      error:
        salon.platform === 'spotify'
          ? 'trackId ou lien Spotify requis'
          : 'trackId ou lien YouTube requis',
    });
    return;
  }

  if (salon.platform === 'youtube') {
    const state = hostChangePlaybackTrack(salon, {
      trackId: resolvedId,
      title: typeof title === 'string' && title.trim() ? title.trim() : 'Morceau YouTube',
      artist: typeof artist === 'string' && artist.trim() ? artist.trim() : 'YouTube',
      externalUrl: buildPlatformTrackUrl('youtube', resolvedId),
      albumArtUrl: `https://img.youtube.com/vi/${resolvedId}/hqdefault.jpg`,
    });
    res.json({ playbackState: state });
    return;
  }

  if (!requireRealSpotifyHost(hostUser, res)) return;

  const trackPayload = {
    trackId: resolvedId,
    title: typeof title === 'string' && title.trim() ? title.trim() : 'Morceau Spotify',
    artist: typeof artist === 'string' && artist.trim() ? artist.trim() : 'Spotify',
    externalUrl: buildPlatformTrackUrl('spotify', resolvedId),
    albumArtUrl: typeof albumArtUrl === 'string' && albumArtUrl.trim() ? albumArtUrl.trim() : undefined,
  };

  try {
    await playSpotifyTrackNow(hostUser, resolvedId);
  } catch (e) {
    if (e instanceof SpotifyPlaybackError) {
      if (e.code === 'no_active_device') {
        const state = hostChangePlaybackTrack(salon, trackPayload);
        removeTrackFromSalonQueue(salon.id, resolvedId);
        res.status(e.status).json({ error: e.message, code: e.code, playbackState: state });
        return;
      }
      res.status(e.status).json({ error: e.message, code: e.code });
      return;
    }
    res.status(502).json({ error: 'Lecture Spotify indisponible' });
    return;
  }

  const state = hostChangePlaybackTrack(salon, trackPayload);
  removeTrackFromSalonQueue(salon.id, resolvedId);
  res.json({ playbackState: state });
});

salonsRouter.post('/:id/playback/add-to-queue', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string; username: string } }).user;
  const salon = db.salons.get(req.params.id);
  if (!requireSalonPlaybackController(salon, me.id, res)) return;
  if (salon.platform !== 'spotify') {
    res.status(400).json({ error: 'Ajout à la file disponible uniquement dans un salon Spotify' });
    return;
  }
  const hostUser = getSalonHostUser(salon, res);
  if (!hostUser || !requireHostPlatform(hostUser, salon.platform, res)) return;
  if (!requireRealSpotifyHost(hostUser, res)) return;

  const { trackId, title, artist, trackLink, albumArtUrl } = req.body;
  let resolvedId = typeof trackId === 'string' ? trackId.trim() : '';
  if (!resolvedId && trackLink && typeof trackLink === 'string') {
    const parsed = parseMusicLink(salon.platform, trackLink);
    if (parsed) resolvedId = parsed.trackId;
  }
  if (!resolvedId || resolvedId === 'demo') {
    res.status(400).json({ error: 'trackId ou lien Spotify requis' });
    return;
  }

  const queueItem = enqueueItem(salon.id, {
    title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 120) : 'Morceau Spotify',
    artist: typeof artist === 'string' && artist.trim() ? artist.trim().slice(0, 80) : 'Spotify',
    trackId: resolvedId,
    externalUrl: buildPlatformTrackUrl('spotify', resolvedId),
    albumArtUrl: typeof albumArtUrl === 'string' && albumArtUrl.trim() ? albumArtUrl.trim() : undefined,
    addedById: me.id,
    addedByName: me.username,
    source: 'host',
  });

  try {
    await addSpotifyTrackToQueue(hostUser, resolvedId);
  } catch (e) {
    if (e instanceof SpotifyPlaybackError) {
      if (e.code === 'no_active_device') {
        res.status(e.status).json({
          error: e.message,
          code: e.code,
          queueItem,
          queue: ensureSalonQueue(salon.id),
          playbackState: salon.playbackState,
        });
        return;
      }
      res.status(e.status).json({ error: e.message, code: e.code });
      return;
    }
    res.status(502).json({ error: 'File Spotify indisponible' });
    return;
  }

  res.json({
    queueItem,
    queue: ensureSalonQueue(salon.id),
    playbackState: salon.playbackState,
  });
});

salonsRouter.get('/:id/playback/spotify-now-playing', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon || salon.hostId !== me) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  if (salon.platform !== 'spotify') {
    res.status(400).json({ error: 'Lecture Spotify disponible uniquement dans un salon Spotify' });
    return;
  }
  const hostUser = db.users.get(me);
  if (!hostUser || !requireHostPlatform(hostUser, salon.platform, res)) return;

  try {
    const nowPlaying = await getSpotifyNowPlaying(hostUser);
    res.json({ nowPlaying });
  } catch (e) {
    if (e instanceof SpotifyPlaybackError) {
      res.status(e.status).json({ error: e.message, code: e.code });
      return;
    }
    res.status(502).json({ error: 'État Spotify indisponible' });
  }
});

salonsRouter.post('/:id/playback/spotify-control', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!requireSalonPlaybackController(salon, me, res)) return;
  if (salon.platform !== 'spotify') {
    res.status(400).json({ error: 'Contrôle Spotify disponible uniquement dans un salon Spotify' });
    return;
  }
  const hostUser = getSalonHostUser(salon, res);
  if (!hostUser || !requireHostPlatform(hostUser, salon.platform, res)) return;

  const action = req.body?.action;
  if (action !== 'pause' && action !== 'play' && action !== 'stop' && action !== 'seek' && action !== 'next') {
    res.status(400).json({ error: 'action requise : pause, play, stop, seek ou next' });
    return;
  }

  const positionMs =
    action === 'seek' && typeof req.body?.positionMs === 'number' && Number.isFinite(req.body.positionMs)
      ? req.body.positionMs
      : undefined;
  if (action === 'seek' && positionMs === undefined) {
    res.status(400).json({ error: 'positionMs requis pour seek' });
    return;
  }

  try {
    await controlSpotifyPlayback(hostUser, action, positionMs);
    res.json({ ok: true, action, ...(action === 'seek' ? { positionMs } : {}) });
  } catch (e) {
    if (e instanceof SpotifyPlaybackError) {
      res.status(e.status).json({ error: e.message, code: e.code });
      return;
    }
    res.status(502).json({ error: 'Contrôle Spotify indisponible' });
  }
});

salonsRouter.post('/:id/playback/load-playlist', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon || salon.hostId !== me) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  if (salon.platform !== 'youtube' && salon.platform !== 'spotify') {
    res.status(400).json({ error: 'Playlists disponibles uniquement dans un salon YouTube ou Spotify' });
    return;
  }
  const hostUser = db.users.get(me);
  if (!hostUser) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (salon.platform === 'spotify') {
    if (!requireRealSpotifyHost(hostUser, res)) return;
  } else if (!requireHostPlatform(hostUser, salon.platform, res)) {
    return;
  }

  const { playlistId, playlistUrl } = req.body;
  const rawPlaylistRef =
    (typeof playlistId === 'string' ? playlistId.trim() : '') ||
    (typeof playlistUrl === 'string' ? playlistUrl.trim() : '') ||
    '';

  if (salon.platform === 'youtube') {
    const resolvedPlaylistId =
      rawPlaylistRef ||
      (typeof playlistUrl === 'string' ? parseYoutubePlaylistId(playlistUrl) : null) ||
      '';
    if (!resolvedPlaylistId) {
      res.status(400).json({ error: 'playlistId ou lien playlist requis' });
      return;
    }

    const accessToken = getYoutubeAccessToken(hostUser);
    let videos: Awaited<ReturnType<typeof resolvePlaylistVideos>>;
    try {
      videos = await resolvePlaylistVideos(resolvedPlaylistId, accessToken);
    } catch {
      res.status(502).json({ error: 'Erreur lors du chargement de la playlist YouTube' });
      return;
    }
    if (!videos.length) {
      res.status(400).json({
        error:
          'Playlist introuvable ou vide. Ajoutez YOUTUBE_API_KEY côté serveur ou collez une playlist publique.',
      });
      return;
    }

    const items = videos.map((v) => ({
      title: v.title,
      artist: v.artist,
      trackId: v.videoId,
      externalUrl: v.externalUrl,
      albumArtUrl: v.thumbnailUrl,
      addedById: me,
      addedByName: hostUser.username,
      source: 'host' as const,
    }));

    const state = hostLoadYoutubePlaylist(salon, items, me, hostUser.username);
    if (!state) {
      res.status(400).json({ error: 'Impossible de charger la playlist' });
      return;
    }
    res.json({ playbackState: state, queue: ensureSalonQueue(salon.id) });
    return;
  }

  const resolvedSpotifyPlaylistId = parseSpotifyPlaylistId(rawPlaylistRef) ?? rawPlaylistRef;
  if (!resolvedSpotifyPlaylistId) {
    res.status(400).json({ error: 'playlistId ou lien playlist Spotify requis' });
    return;
  }

  let tracks: Awaited<ReturnType<typeof resolveSpotifyPlaylistTracks>>;
  try {
    tracks = await resolveSpotifyPlaylistTracks(hostUser, resolvedSpotifyPlaylistId);
  } catch (e) {
    if (e instanceof SpotifyPlaylistError) {
      console.warn('[load-playlist] spotify error', {
        salonId: salon.id,
        userId: me,
        playlistId: resolvedSpotifyPlaylistId,
        status: e.status,
        code: e.code,
        message: e.message,
      });
      res.status(e.status).json({ error: e.message, code: e.code });
      return;
    }
    res.status(502).json({ error: 'Erreur lors du chargement de la playlist Spotify' });
    return;
  }
  if (!tracks.length) {
    res.status(400).json({ error: 'Playlist Spotify introuvable ou vide.' });
    return;
  }

  const items = tracks.map((t) => ({
    title: t.title,
    artist: t.artist,
    trackId: t.trackId,
    externalUrl: t.externalUrl,
    albumArtUrl: t.albumArtUrl,
    addedById: me,
    addedByName: hostUser.username,
    source: 'host' as const,
  }));

  const state = hostLoadYoutubePlaylist(salon, items, me, hostUser.username);
  if (!state) {
    res.status(400).json({ error: 'Impossible de charger la playlist' });
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

  const {
    accessMode,
    allowedUserIds,
    vipModeratorIds,
    isPublic,
    allowQueue,
    title,
    platform,
    trackLink,
    trackTitle,
    artist,
    spotifyJamUrl,
  } = req.body;

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

  if (Array.isArray(vipModeratorIds)) {
    salon.vipModeratorIds = vipModeratorIds
      .map(String)
      .filter((id) => id !== me && db.users.has(id));
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

  if (spotifyJamUrl !== undefined && salon.platform === 'spotify') {
    if (spotifyJamUrl === null || spotifyJamUrl === '') {
      salon.spotifyJamUrl = undefined;
    } else if (typeof spotifyJamUrl === 'string') {
      const normalized = normalizeSpotifyJamUrl(spotifyJamUrl);
      if (!normalized) {
        res.status(400).json({ error: 'Lien Jam Spotify invalide (socialsession attendu)' });
        return;
      }
      salon.spotifyJamUrl = normalized;
    }
  }

  const playbackClockTouched =
    platform === 'spotify' ||
    platform === 'youtube' ||
    (trackLink && typeof trackLink === 'string') ||
    trackTitle ||
    artist;
  if (playbackClockTouched) {
    salon.playbackState.updatedAt = Date.now();
  }

  normalizeSalonAccess(salon);
  db.salons.set(salon.id, salon);
  if (spotifyJamUrl !== undefined && salon.platform === 'spotify') {
    broadcastSalonUpdated(salon);
  }
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

salonsRouter.post('/:id/validate-guests', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon || salon.hostId !== me) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  if (salon.accessMode !== 'invite') {
    res.status(400).json({ error: 'Le salon doit être en mode invitation' });
    return;
  }

  const hostUser = db.users.get(me);
  if (!hostUser) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  const rawIds: unknown[] = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
  const guestIds = [
    ...new Set(
      rawIds.map((id) => String(id)).filter((id: string) => id !== me && db.users.has(id))
    ),
  ];

  normalizeSalonAccess(salon);

  salon.allowedUserIds = [me, ...guestIds];
  normalizeSalonAccess(salon);
  db.salons.set(salon.id, salon);

  let invitedCount = 0;
  for (const userId of guestIds) {
    notifySalonInvite({
      recipientId: userId,
      host: { id: hostUser.id, username: hostUser.username, avatarUrl: hostUser.avatarUrl },
      salon: { id: salon.id, title: salon.title },
    });
    invitedCount++;
  }

  res.json({ salon: publicSalon(salon, me), invitedCount });
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
    spotifyJamUrl,
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

  let normalizedJamUrl: string | undefined;
  if (plat === 'spotify' && spotifyJamUrl && typeof spotifyJamUrl === 'string') {
    const normalized = normalizeSpotifyJamUrl(spotifyJamUrl);
    if (!normalized) {
      res.status(400).json({ error: 'Lien Jam Spotify invalide (socialsession attendu)' });
      return;
    }
    normalizedJamUrl = normalized;
  }

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
      title: trackTitle || 'Soundly Session',
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
      ...(plat === 'youtube' ? { showVideo: true } : {}),
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
    ...(normalizedJamUrl ? { spotifyJamUrl: normalizedJamUrl } : {}),
  };

  normalizeSalonAccess(salon);
  db.salons.set(salon.id, salon);
  db.salonChats.set(salon.id, []);
  ensureSalonQueue(salon.id);
  ensureSalonProposals(salon.id);

  notifyFavoritesSalonStarted(user, salon);

  res.status(201).json({ salon: publicSalon(salon, userId) });
});

salonsRouter.delete('/:id', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const salon = db.salons.get(req.params.id);
  if (!salon || salon.hostId !== userId) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  const salonId = salon.id;
  getIo()?.to(`salon_${salonId}`).emit('salon_ended', {
    salonId,
    reason: 'host_deleted',
  });
  db.salons.delete(salonId);
  db.salonChats.delete(salonId);
  clearSalonPlaybackData(salonId);
  res.json({ ok: true });
});

export function publicSalon(s: Salon, viewerId?: string) {
  normalizeSalonAccess(s);
  const isHost = viewerId === s.hostId;
  const isVip = viewerId != null && !isHost && (s.vipModeratorIds ?? []).includes(viewerId);
  const isDev = viewerId != null && !isHost && isDevUser(db.users.get(viewerId));
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
    hostUsernameColor: host?.usernameColor,
    hostUsernameWaveFrom: host?.usernameWaveFrom,
    hostUsernameWaveTo: host?.usernameWaveTo,
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
    isVip: isVip ? true : undefined,
    isDev: isDev ? true : undefined,
    allowedUserIds: isHost ? s.allowedUserIds : undefined,
    allowedCount: s.accessMode === 'invite' ? s.allowedUserIds.length - 1 : undefined,
    vipModeratorIds: isHost ? s.vipModeratorIds : undefined,
    queue: ensureSalonQueue(s.id),
    pendingProposalsCount: isHost ? getPendingProposals(s.id).length : undefined,
    createdAt: s.createdAt,
    spotifyJamUrl: s.platform === 'spotify' ? s.spotifyJamUrl : undefined,
  };
}
