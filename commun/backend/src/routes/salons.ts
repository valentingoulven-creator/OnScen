import { Router, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import crypto from 'node:crypto';
import { createRateLimitStore } from '../lib/rateLimitStore';
import { isMsdevRuntime } from '../lib/msdevGuard';
import { DEFAULT_PLAYBACK_SESSION_TITLE } from '../lib/brandName';
import { db, Salon, MusicPlatform, SalonTrackProposal } from '../models/schema';
import { recordWeeklyVote } from '../lib/weeklyVotes';
import { schedulePersist } from '../lib/persist';
import { authenticateJWT } from '../middleware/auth';
import { blurCoordinate } from '../lib/geo';
import { getPublicMapCoords } from '../lib/locationPrivacy';
import { isBotHost } from '../seed-bots';
import { canJoinSalon, isSalonVisibleOnMap, normalizeSalonAccess } from '../lib/salonAccess';
import { assertSalonAccessible } from '../lib/adminContentModeration';
import { isDevUser } from '../lib/accessControl';
import { trackEvent } from '../lib/analytics';
import {
  parseMusicLink,
  resolveYoutubePlaylistId,
  buildPlatformTrackUrl,
  isValidYoutubeVideoId,
} from '../lib/musicLinks';
import { computePlaybackPositionMs } from '../lib/playbackClock';
import { resolveTrackForPlatform } from '../lib/trackResolver';
import {
  ensurePlatformAccountsFromLegacy,
  HOST_PLATFORM_NOT_LINKED,
  PARTICIPANT_PLATFORM_NOT_LINKED,
  hostPlatformLinkMessage,
  participantPlatformLinkMessage,
  isPlatformConnected,
  getYoutubeAccessToken,
} from '../lib/platformConnect';
import {
  ensureSalonQueue,
  ensureSalonProposals,
  clearSalonPlaybackData,
  getPendingProposals,
  broadcastSalonProposals,
  hostSkipNext,
  hostPlayQueueItem,
  hostChangePlaybackTrack,
  hostLoadYoutubePlaylist,
  enqueueItem,
  albumArtForTrack,
  proposalToQueueItem,
  reorderSalonQueue,
} from '../lib/salonPlaybackOps';
import { searchYoutube } from '../lib/youtubeSearch';
import { youtubeDataApiKey, YoutubeDataApiError } from '../lib/youtubeDataApi';
import { getValidYoutubeHostToken } from '../lib/youtubeOAuth';
import { resolvePlaylistVideos } from '../lib/youtubePlaylists';
import { notifyFavoritesSalonStarted } from '../lib/favorites';
import { notifyFollowersSalonCreated } from '../lib/follows';
import { notifySalonInvite } from '../lib/notifications';
import { getIo } from '../lib/ioInstance';
import { endLiveSession } from '../lib/liveArchive';
import { clearNearbyCache } from '../lib/nearbyResponseCache';
import { getSalonConnectedParticipants } from '../lib/salonParticipants';
import {
  canControlSalonPlayback,
  setSalonVipModerator,
} from '../lib/salonModeration';
import { getActiveSalonForHost } from '../lib/profile';
import { upsertSalonToPg, markSalonInactivePgAsync, reconcileHostSalonsWithPostgres, getSalonFromStore, hydrateSalonFromPostgres } from '../lib/pgSalonsLives';
import { refreshStaleYoutubeSalonMetadata, hasStaleYoutubeMetadata } from '../lib/youtubeMetadata';

export const salonsRouter = Router();

/** Désactive les autres salons du même hôte (un seul salon actif à la fois). */
function deactivateOtherHostSalons(hostId: string, keepId?: string): void {
  const io = getIo();
  let removed = false;
  for (const s of [...db.salons.values()]) {
    if (s.hostId !== hostId || s.id === keepId) continue;
    const salonId = s.id;
    io?.to(`salon_${salonId}`).emit('salon_ended', { salonId, reason: 'replaced' });
    const linkedLive = db.lives.get(salonId);
    if (linkedLive?.isActive) {
      endLiveSession(linkedLive, Date.now(), { reason: 'salon_replaced' });
    }
    db.salons.delete(salonId);
    db.salonChats.delete(salonId);
    clearSalonPlaybackData(salonId);
    markSalonInactivePgAsync(salonId);
    removed = true;
  }
  if (removed) clearNearbyCache();
}

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

/**
 * Protège le bucket dédié search.list (100 appels/jour, tout le projet — voir
 * youtubeQuotaBudget.ts) contre un abus par un seul utilisateur/IP qui épuiserait la
 * recherche YouTube pour tout le monde. Le debounce client (350 ms) limite déjà le flux
 * normal ; cette limite est un filet de sécurité contre les scripts/bots.
 */
const youtubeSearchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de recherches YouTube. Réessayez dans quelques minutes.' },
  skip: () => isMsdevRuntime(),
  keyGenerator: (req: Request) =>
    (req as Request & { user?: { id: string } }).user?.id ?? ipKeyGenerator(req.ip ?? ''),
  store: createRateLimitStore('youtube-search'),
});

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

/** Salons YouTube : auditeur avec compte plateforme lié (hôte exempté). */
function requireSalonParticipantPlatform(
  user: import('../models/schema').User | undefined,
  salon: Salon,
  viewerId: string,
  res: Response
): user is import('../models/schema').User {
  if (salon.hostId === viewerId) return true;
  if (salon.platform !== 'youtube') return true;
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return false;
  }
  ensurePlatformAccountsFromLegacy(user);
  if (!isPlatformConnected(user, salon.platform)) {
    res.status(403).json({
      error: participantPlatformLinkMessage(salon.platform),
      code: PARTICIPANT_PLATFORM_NOT_LINKED,
      platform: salon.platform,
    });
    return false;
  }
  return true;
}

/** Hôte ou VIP autorisé à piloter la lecture ; le jeton YouTube reste celui de l'hôte. */
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

salonsRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salons = [...db.salons.values()]
    .filter((s) => isSalonVisibleOnMap(s, me))
    .map((s) => publicSalon(s, me));
  res.json({ salons });
});

salonsRouter.get(
  '/youtube-search',
  authenticateJWT,
  youtubeSearchLimiter,
  async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) {
      res.json({ results: [] });
      return;
    }

    // Le cache (TTL 1 h) est vérifié AVANT toute résolution/rafraîchissement du token OAuth :
    // un hit de cache ne doit rien coûter côté Google (ni quota, ni aller-retour réseau).
    const cacheKey = q.toLowerCase();
    const cached = getYtSearchCached(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.json({ results: cached, fromCache: true });
      return;
    }

    const me = (req as Request & { user: { id: string } }).user.id;
    const user = db.users.get(me);
    if (user) ensurePlatformAccountsFromLegacy(user);
    let accessToken: string | undefined;
    if (user) {
      const tokenResult = await getValidYoutubeHostToken(user);
      accessToken = tokenResult.ok ? tokenResult.accessToken : undefined;
    }
    const canSearch = Boolean(youtubeDataApiKey() || accessToken);

    try {
      const results = await searchYoutube(q, accessToken);
      if (!canSearch && results.length === 0) {
        res.status(503).json({
          error:
            'Recherche YouTube indisponible. Connectez votre compte YouTube ou contactez le support.',
          code: 'youtube_search_not_configured',
        });
        return;
      }
      if (results.length > 0) {
        setYtSearchCached(cacheKey, results);
        res.setHeader('Cache-Control', 'private, max-age=3600');
      } else {
        res.setHeader('Cache-Control', 'private, no-store');
      }
      res.json({ results });
    } catch (e) {
      if (e instanceof YoutubeDataApiError) {
        if (e.isQuotaExceeded) {
          res.status(503).json({
            error: 'Quota YouTube API dépassé. Réessayez plus tard.',
            code: 'youtube_quota_exceeded',
          });
          return;
        }
        if (e.code === 'auth_failed') {
          res.status(401).json({
            error: 'Session YouTube expirée. Reconnectez votre compte.',
            code: 'youtube_token_expired',
          });
          return;
        }
        res.status(502).json({
          error: 'Recherche YouTube indisponible',
          code: 'youtube_api_error',
        });
        return;
      }
      res.status(502).json({ error: 'Recherche YouTube indisponible' });
    }
  }
);

salonsRouter.get('/:id', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await getSalonFromStore(req.params.id);
  if (!salon) {
    res.status(404).json({ error: 'Salon introuvable' });
    return;
  }
  if (!assertSalonAccessible(salon, me)) {
    res.status(403).json({ error: 'Salon indisponible', code: 'content_blocked' });
    return;
  }
  if (!salonMemberOr403(salon, me, res)) return;
  if (salon.platform === 'youtube') {
    const queue = ensureSalonQueue(salon.id);
    // On ne résout/rafraîchit le token OAuth de l'hôte (aller-retour Google potentiel) que si
    // au moins une métadonnée est réellement expirée — évite un coût réseau inutile sur
    // chaque affichage de salon alors que la plupart du temps rien n'a besoin d'être rafraîchi.
    if (hasStaleYoutubeMetadata(salon, queue)) {
      const host = db.users.get(salon.hostId);
      let hostToken: string | undefined;
      if (host) {
        const tokenResult = await getValidYoutubeHostToken(host);
        hostToken = tokenResult.ok ? tokenResult.accessToken : undefined;
      }
      await refreshStaleYoutubeSalonMetadata(salon, queue, hostToken);
    }
  }
  res.json({ salon: publicSalon(salon, me) });
});

salonsRouter.get('/:id/resolve-track', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
  if (!salon) {
    res.status(404).json({ error: 'Salon introuvable' });
    return;
  }
  normalizeSalonAccess(salon);
  if (!canJoinSalon(salon, me)) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const viewer = db.users.get(me);
  if (!requireSalonParticipantPlatform(viewer, salon, me, res)) return;

  const targetPlatform: MusicPlatform = 'youtube';
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

salonsRouter.get('/:id/queue', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
  if (!salonMemberOr403(salon, me, res)) return;
  res.json({ queue: ensureSalonQueue(salon.id) });
});

salonsRouter.patch('/:id/queue/reorder', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
  if (!requireSalonPlaybackController(salon, me, res)) return;
  if (!salon.allowQueue) {
    res.status(400).json({ error: 'File désactivée dans ce salon' });
    return;
  }
  const { order } = req.body as { order?: unknown };
  if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
    res.status(400).json({ error: 'Paramètre order (string[]) requis' });
    return;
  }
  const reordered = reorderSalonQueue(salon.id, order.map(String));
  if (!reordered) {
    res.status(400).json({ error: 'Ordre invalide' });
    return;
  }
  res.json({ queue: reordered });
});

salonsRouter.get('/:id/proposals', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
  if (!salonMemberOr403(salon, me, res)) return;
  if (salon.hostId !== me) {
    res.status(403).json({ error: 'Réservé au host' });
    return;
  }
  res.json({ proposals: getPendingProposals(salon.id) });
});

salonsRouter.get('/:id/participants', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
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

salonsRouter.patch('/:id/participants/:userId/vip', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const { add } = req.body as { add?: unknown };
  if (typeof add !== 'boolean') {
    res.status(400).json({ error: 'Paramètre add (boolean) requis' });
    return;
  }
  const result = await setSalonVipModerator(req.params.id, me, req.params.userId, add);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ salon: publicSalon(result.salon, me) });
});

salonsRouter.post('/:id/proposals', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string; username: string } }).user;
  const salon = await hydrateSalonFromPostgres(req.params.id);
  if (!salonMemberOr403(salon, me.id, res)) return;
  if (salon.hostId === me.id || canControlSalonPlayback(salon, me.id)) {
    res.status(400).json({ error: 'Ajoutez directement à la file ou changez le morceau' });
    return;
  }
  if (!salon.allowQueue) {
    res.status(400).json({ error: 'File désactivée dans ce salon' });
    return;
  }
  const { title, artist, youtubeUrl } = req.body;
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
    youtubeUrl: youtubeUrl ? String(youtubeUrl).slice(0, 500) : undefined,
    status: 'pending',
    createdAt: Date.now(),
    upvotes: [],
  };
  const list = ensureSalonProposals(salon.id);
  list.push(proposal);
  db.salonProposals.set(salon.id, list);
  broadcastSalonProposals(salon.id);
  res.status(201).json({ proposal });
});

salonsRouter.post('/:id/proposals/:proposalId/accept', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string; username: string } }).user;
  const salon = await hydrateSalonFromPostgres(req.params.id);
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

salonsRouter.post('/:id/proposals/:proposalId/reject', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
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

salonsRouter.post('/:id/proposals/:proposalId/upvote', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
  if (!salonMemberOr403(salon, me, res)) return;
  if (!salon!.allowQueue) {
    res.status(400).json({ error: 'File désactivée dans ce salon' });
    return;
  }
  const list = ensureSalonProposals(salon!.id);
  const proposal = list.find((p) => p.id === req.params.proposalId && p.status === 'pending');
  if (!proposal) {
    res.status(404).json({ error: 'Proposition introuvable' });
    return;
  }
  if (!proposal.upvotes) proposal.upvotes = [];
  const voterIdx = proposal.upvotes.indexOf(me);
  const isAdding = voterIdx < 0;
  if (voterIdx >= 0) {
    proposal.upvotes.splice(voterIdx, 1);
  } else {
    proposal.upvotes.push(me);
  }
  db.salonProposals.set(salon!.id, list);
  recordWeeklyVote(proposal, salon!, me, isAdding);
  schedulePersist();
  broadcastSalonProposals(salon!.id);
  res.json({ proposal });
});

salonsRouter.post('/:id/playback/skip', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
  if (!requireSalonPlaybackController(salon, me, res)) return;
  const hostUser = getSalonHostUser(salon, res);
  if (!hostUser || !requireHostPlatform(hostUser, salon.platform, res)) return;

  const queue = ensureSalonQueue(salon.id);
  if (queue.length === 0) {
    res.status(400).json({ error: 'File vide' });
    return;
  }

  const state = hostSkipNext(salon);
  if (!state) {
    res.status(400).json({ error: 'File vide' });
    return;
  }

  res.json({ playbackState: state, queue: ensureSalonQueue(salon.id) });
});

salonsRouter.post('/:id/playback/play-queue', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
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

  const state = hostPlayQueueItem(salon, String(queueItemId));
  if (!state) {
    res.status(404).json({ error: 'Morceau introuvable dans la file' });
    return;
  }

  res.json({ playbackState: state, queue: ensureSalonQueue(salon.id) });
});

salonsRouter.post('/:id/playback/change-track', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
  if (!requireSalonPlaybackController(salon, me, res)) return;
  if (salon.platform !== 'youtube') {
    res.status(400).json({ error: 'Changement de morceau non supporté pour cette plateforme' });
    return;
  }
  const hostUser = getSalonHostUser(salon, res);
  if (!hostUser || !requireHostPlatform(hostUser, salon.platform, res)) return;

  const { trackId, title, artist, trackLink } = req.body;
  let resolvedId = typeof trackId === 'string' ? trackId.trim() : '';
  if (resolvedId && !isValidYoutubeVideoId(resolvedId)) {
    // Rejette un trackId brut mal formé plutôt que de le persister/diffuser tel quel.
    resolvedId = '';
  }
  if (!resolvedId && trackLink && typeof trackLink === 'string') {
    const parsed = parseMusicLink(salon.platform, trackLink);
    if (parsed) resolvedId = parsed.trackId;
  }
  if (!resolvedId || resolvedId === 'demo') {
    res.status(400).json({ error: 'trackId (format vidéo YouTube valide) ou lien YouTube requis' });
    return;
  }

  const state = hostChangePlaybackTrack(salon, {
    trackId: resolvedId,
    title: typeof title === 'string' && title.trim() ? title.trim() : 'Morceau YouTube',
    artist: typeof artist === 'string' && artist.trim() ? artist.trim() : 'YouTube',
    externalUrl: buildPlatformTrackUrl('youtube', resolvedId),
    albumArtUrl: `https://img.youtube.com/vi/${resolvedId}/hqdefault.jpg`,
  });
  res.json({ playbackState: state });
});

salonsRouter.post('/:id/playback/add-to-queue', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string; username: string } }).user;
  const salon = await hydrateSalonFromPostgres(req.params.id);
  if (!requireSalonPlaybackController(salon, me.id, res)) return;
  if (salon.platform !== 'youtube') {
    res.status(400).json({ error: 'Ajout à la file non supporté pour cette plateforme' });
    return;
  }

  const { trackId, title, artist, trackLink, albumArtUrl } = req.body;
  let resolvedId = typeof trackId === 'string' ? trackId.trim() : '';
  if (resolvedId && !isValidYoutubeVideoId(resolvedId)) {
    resolvedId = '';
  }
  if (!resolvedId && trackLink && typeof trackLink === 'string') {
    const parsed = parseMusicLink(salon.platform, trackLink);
    if (parsed) resolvedId = parsed.trackId;
  }
  if (!resolvedId || resolvedId === 'demo') {
    res.status(400).json({ error: 'trackId (format vidéo YouTube valide) ou lien YouTube requis' });
    return;
  }

  const queueItem = enqueueItem(salon.id, {
    title:
      typeof title === 'string' && title.trim() ? title.trim().slice(0, 120) : 'Morceau YouTube',
    artist: typeof artist === 'string' && artist.trim() ? artist.trim().slice(0, 80) : 'YouTube',
    trackId: resolvedId,
    externalUrl: buildPlatformTrackUrl(salon.platform, resolvedId),
    albumArtUrl:
      typeof albumArtUrl === 'string' && albumArtUrl.trim()
        ? albumArtUrl.trim()
        : albumArtForTrack(salon.platform, resolvedId),
    addedById: me.id,
    addedByName: me.username,
    source: 'host',
  });

  res.json({
    queueItem,
    queue: ensureSalonQueue(salon.id),
    playbackState: salon.playbackState,
  });
});

salonsRouter.post('/:id/playback/load-playlist', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
  if (!salon || salon.hostId !== me) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  if (salon.platform !== 'youtube') {
    res.status(400).json({ error: 'Playlists disponibles uniquement dans un salon YouTube' });
    return;
  }
  const hostUser = db.users.get(me);
  if (!hostUser) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (!requireHostPlatform(hostUser, salon.platform, res)) return;

  const { playlistId, playlistUrl } = req.body;
  const rawPlaylistRef =
    (typeof playlistId === 'string' ? playlistId.trim() : '') ||
    (typeof playlistUrl === 'string' ? playlistUrl.trim() : '') ||
    '';

  const resolvedPlaylistId = resolveYoutubePlaylistId(rawPlaylistRef) ?? '';
  if (!resolvedPlaylistId) {
    res.status(400).json({
      error: rawPlaylistRef
        ? 'Lien playlist invalide — utilisez youtube.com/playlist?list=PL… ou un ID PL…'
        : 'playlistId ou lien playlist requis',
    });
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
    const hasKey = Boolean(youtubeDataApiKey());
    const hasToken = Boolean(accessToken);
    const error =
      !hasKey && !hasToken
        ? 'Playlist introuvable ou vide. Ajoutez YOUTUBE_API_KEY côté serveur ou connectez YouTube.'
        : 'Playlist introuvable, privée ou vide.';
    res.status(400).json({ error });
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
});

salonsRouter.post('/:id/join', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
  if (!salon) {
    res.status(404).json({ error: 'Salon introuvable' });
    return;
  }
  normalizeSalonAccess(salon);
  if (!canJoinSalon(salon, me)) {
    res.status(403).json({ error: 'Accès refusé — salon sur invitation uniquement' });
    return;
  }
  const viewer = db.users.get(me);
  if (!requireSalonParticipantPlatform(viewer, salon, me, res)) return;
  res.json({ ok: true, salon: publicSalon(salon, me) });
});

salonsRouter.patch('/:id/settings', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
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

  if (platform === 'youtube') {
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

  const playbackClockTouched =
    platform === 'youtube' ||
    (trackLink && typeof trackLink === 'string') ||
    trackTitle ||
    artist;
  if (playbackClockTouched) {
    salon.playbackState.updatedAt = Date.now();
  }

  normalizeSalonAccess(salon);
  db.salons.set(salon.id, salon);
  res.json({ salon: publicSalon(salon, me) });
});

salonsRouter.post('/:id/allowed', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
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

salonsRouter.delete('/:id/allowed/:userId', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
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

salonsRouter.post('/:id/validate-guests', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
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

salonsRouter.post('/', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  await reconcileHostSalonsWithPostgres(userId);
  const existingSalon = getActiveSalonForHost(userId, { forOwner: true });
  if (existingSalon) {
    deactivateOtherHostSalons(userId);
  }

  const {
    id: requestedSalonId,
    title,
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
    genres,
  } = req.body;

  if (latitude === undefined || longitude === undefined) {
    res.status(400).json({ error: 'Géolocalisation requise' });
    return;
  }

  const plat: MusicPlatform = 'youtube';
  if (!requireHostPlatform(user, plat, res)) return;

  let resolvedTrackId = 'demo';
  let externalUrl: string | undefined;
  if (trackLink && typeof trackLink === 'string') {
    const parsed = parseMusicLink(plat, trackLink);
    if (parsed) {
      resolvedTrackId = parsed.trackId;
      externalUrl = buildPlatformTrackUrl(plat, parsed.trackId);
    }
  } else if (typeof trackId === 'string' && isValidYoutubeVideoId(trackId.trim())) {
    // trackId brut (hors trackLink) : n'accepter que le format vidéo YouTube valide
    // (6-15 car. alphanumériques/_-) pour éviter de stocker/diffuser une valeur arbitraire.
    resolvedTrackId = trackId.trim();
    externalUrl = buildPlatformTrackUrl(plat, resolvedTrackId);
  }

  let mode: 'public' | 'invite' = 'public';
  if (accessMode === 'invite') mode = 'invite';
  else if (accessMode === 'public') mode = 'public';
  else if (isPublic === false) mode = 'invite';

  const guestIds = Array.isArray(allowedUserIds)
    ? allowedUserIds.map(String).filter((id: string) => id !== userId && db.users.has(id))
    : [];

  const salonGenres = Array.isArray(genres)
    ? genres
        .map(String)
        .map((g) => g.trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];

  // Accepte l'ID pré-généré côté client (lien d'invitation copiable avant confirmation serveur) —
  // ancien format numérique (salon_<timestamp>) ou nouveau format UUID (salon_<uuid>).
  const salonId =
    typeof requestedSalonId === 'string' &&
    /^salon_[a-zA-Z0-9_-]{6,64}$/.test(requestedSalonId) &&
    !db.salons.has(requestedSalonId)
      ? requestedSalonId
      : `salon_${crypto.randomUUID()}`;

  const salon: Salon = {
    id: salonId,
    hostId: userId,
    hostName: user.username,
    hostAvatarUrl: user.avatarUrl,
    title: title || `Salon de ${user.username}`,
    platform: plat,
    playbackState: {
      platform: plat,
      trackId: resolvedTrackId,
      title: trackTitle || DEFAULT_PLAYBACK_SESSION_TITLE,
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
    ...(salonGenres.length > 0 ? { genres: salonGenres } : {}),
  };

  normalizeSalonAccess(salon);
  deactivateOtherHostSalons(userId, salon.id);
  db.salons.set(salon.id, salon);
  trackEvent('salon_created', userId);
  db.salonChats.set(salon.id, []);
  ensureSalonQueue(salon.id);
  ensureSalonProposals(salon.id);

  try {
    await upsertSalonToPg(salon);
  } catch (err) {
    console.error('[salons] upsert salon PostgreSQL échoué:', err);
    db.salons.delete(salon.id);
    db.salonChats.delete(salon.id);
    clearSalonPlaybackData(salon.id);
    res.status(503).json({
      error: 'Impossible d’enregistrer le salon. Réessayez dans quelques secondes.',
      code: 'SALON_PERSIST_FAILED',
    });
    return;
  }
  clearNearbyCache();

  notifyFavoritesSalonStarted(user, salon);
  notifyFollowersSalonCreated(user, salon);

  res.status(201).json({ salon: publicSalon(salon, userId) });
});

salonsRouter.delete('/:id', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const salon = await hydrateSalonFromPostgres(req.params.id);
  if (!salon || salon.hostId !== userId) {
    res.status(403).json({ error: 'Non autorisé' });
    return;
  }
  const salonId = salon.id;
  const io = getIo();
  io?.to(`salon_${salonId}`).emit('salon_ended', {
    salonId,
    reason: 'host_deleted',
  });
  const linkedLive = db.lives.get(salonId);
  if (linkedLive?.isActive) {
    endLiveSession(linkedLive, Date.now(), { reason: 'host_deleted' });
  }
  db.salons.delete(salonId);
  db.salonChats.delete(salonId);
  clearSalonPlaybackData(salonId);
  // Fix #3: marquer le salon comme inactif en PG pour ne pas le restaurer au redémarrage
  markSalonInactivePgAsync(salonId);
  clearNearbyCache();
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
    genres: s.genres?.length ? [...s.genres] : undefined,
  };
}
