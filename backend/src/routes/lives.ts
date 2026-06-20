import { Router, Request, Response } from 'express';
import { db, Live, MusicPlatform } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { blurCoordinate, getDistanceKm } from '../lib/geo';
import { getPublicMapCoords, userSharesDistance } from '../lib/locationPrivacy';
import { notifyFollowersLiveStarted } from '../lib/follows';
import { notifyFavoritesLiveStarted } from '../lib/favorites';
import { trackEvent } from '../lib/analytics';
import { publicSalon } from './salons';
import { isLiveViewBanned, liveBanMessage, getLiveBan } from '../lib/liveBans';
import { parseDistanceFilterQuery, resolveNearbyRadiusKm } from '../lib/geoLimits';
import { DEFAULT_MAP_LAT, DEFAULT_MAP_LON, isValidLatLng } from '../lib/mapCoords';
import { MIN_LIVE_AGE, userMeetsLiveAge } from '../lib/ageGates';
import { serializePublicLive } from '../lib/livePublic';
import { assertLiveAccessible } from '../lib/adminContentModeration';
import {
  getLiveConnectedParticipants,
  assertViewerCanAccessLive,
  canAccessLiveIceServers,
} from '../lib/liveParticipants';
import {
  endLiveSession,
  listHostedArchivedLives,
  serializeArchivedLive,
} from '../lib/liveArchive';
import {
  createCloudflareLiveInput,
  disableCloudflareLiveInput,
  getCloudflareLiveInput,
  isCloudflareStreamConfigured,
} from '../lib/cloudflareStream';
import { persistLiveToPgAsync } from '../lib/pgSalonsLives';
import {
  assertCanStartLive,
  assertCanUseCloudflareObs,
  canAccessArchivedLives,
  getUserPlatformPlan,
  PlatformPlanError,
  resolveStreamModeForHost,
} from '../lib/platformPlans';
import {
  createLiveKitToken,
  getLiveKitUrl,
  getLiveKitEgressId,
  isLiveKitConfigured,
  liveKitRoomName,
  startLiveKitEgress,
  stopLiveKitEgress,
} from '../lib/livekit';
import { getIo } from '../lib/ioInstance';
import { buildIceServers } from '../lib/iceServers';

export const livesRouter = Router();

/** ICE servers for WebRTC live relay — TURN only for host or active viewer of liveId. */
livesRouter.get('/ice-servers', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const liveId = typeof req.query.liveId === 'string' ? req.query.liveId.trim() : '';
  if (!liveId) {
    res.status(400).json({ error: 'Paramètre liveId requis' });
    return;
  }
  if (!canAccessLiveIceServers(liveId, me)) {
    res.status(403).json({ error: 'Accès refusé — rejoignez le live en cours' });
    return;
  }
  res.json({ iceServers: buildIceServers() });
});

livesRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  const latStr = req.query.latitude as string | undefined;
  const lonStr = req.query.longitude as string | undefined;
  const hasGeoFilter = latStr !== undefined && lonStr !== undefined;
  const lat = hasGeoFilter ? parseFloat(latStr!) : NaN;
  const lon = hasGeoFilter ? parseFloat(lonStr!) : NaN;
  const radiusKm = parseFloat((req.query.radiusKm as string) || '50');
  const distanceFilter = parseDistanceFilterQuery(req.query.distanceFilter as string | undefined);

  if (hasGeoFilter && !isValidLatLng(lat, lon)) {
    res.status(400).json({ error: 'latitude et longitude invalides' });
    return;
  }

  const active = [...db.lives.values()].filter((l) => l.isActive && !l.adminBlocked);

  if (hasGeoFilter) {
    const maxRadiusKm = resolveNearbyRadiusKm(radiusKm, distanceFilter);
    const withinRadius = (d: number) => maxRadiusKm == null || d <= maxRadiusKm;
    const me = (req as Request & { user: { id: string } }).user.id;
    const filtered = active
      .map((l) => {
        const host = db.users.get(l.hostId);
        const coords =
          host != null
            ? getPublicMapCoords(host, l.latitude, l.longitude, l.blurredLatitude, l.blurredLongitude, me)
            : { latitude: l.blurredLatitude, longitude: l.blurredLongitude };
        return {
          live: l,
          host,
          distanceKm: getDistanceKm(lat, lon, coords.latitude, coords.longitude),
        };
      })
      .filter(
        ({ distanceKm, live: l }) =>
          withinRadius(distanceKm) && isValidLatLng(l.latitude, l.longitude)
      )
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({
      lives: filtered.map(({ live, host, distanceKm }) =>
        publicLive(live, host && userSharesDistance(host) ? distanceKm : undefined, me)
      ),
    });
    return;
  }

  const me = (req as Request & { user: { id: string } }).user.id;
  res.json({ lives: active.map((l) => publicLive(l, undefined, me)) });
});

function resolveStartCoordinates(
  user: { latitude?: number; longitude?: number },
  body: { latitude?: unknown; longitude?: unknown }
): { latitude: number; longitude: number } {
  const bodyLat = typeof body.latitude === 'number' ? body.latitude : parseFloat(String(body.latitude ?? ''));
  const bodyLon = typeof body.longitude === 'number' ? body.longitude : parseFloat(String(body.longitude ?? ''));
  if (Number.isFinite(bodyLat) && Number.isFinite(bodyLon)) {
    return { latitude: bodyLat, longitude: bodyLon };
  }
  if (isValidLatLng(user.latitude, user.longitude)) {
    return { latitude: user.latitude!, longitude: user.longitude! };
  }
  return { latitude: DEFAULT_MAP_LAT, longitude: DEFAULT_MAP_LON };
}

function defaultStandalonePlayback(hostName: string, platform: MusicPlatform) {
  return {
    platform,
    trackId: 'demo',
    title: 'Soundly Session',
    artist: hostName,
    albumArtUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
    isPlaying: true,
    progressMs: 0,
    updatedAt: Date.now(),
  };
}

async function provisionCloudflareStreamForLive(live: Live): Promise<void> {
  assertCanUseCloudflareObs(live.hostId);
  if (!isCloudflareStreamConfigured()) return;
  live.streamMode = 'cloudflare';
  try {
    const creds = await createCloudflareLiveInput({
      name: `Soundy — ${live.title} (${live.id})`,
    });
    live.cloudflareLiveInputId = creds.uid;
    live.cloudflarePlaybackUrl = creds.playbackHlsUrl;
    live.cloudflareCustomerSubdomain = creds.customerSubdomain;
  } catch (err) {
    console.error('[cloudflare-stream] Échec création live input:', err);
    live.streamMode = 'webrtc';
  }
}

async function archiveCloudflareStreamForLive(live: Live): Promise<void> {
  const inputId = live.cloudflareLiveInputId;
  const playbackUrl = live.cloudflarePlaybackUrl;
  if (!inputId || !isCloudflareStreamConfigured()) return;
  try {
    await disableCloudflareLiveInput(inputId);
  } catch (err) {
    console.warn('[cloudflare-stream] disable live input:', err);
  }
  // Conserver l'URL HLS pour la rediff VOD — ne pas supprimer le live input Cloudflare.
  if (playbackUrl) {
    live.cloudflareVodPlaybackUrl = playbackUrl;
  }
}

livesRouter.post('/start', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  if (!userMeetsLiveAge(user.age)) {
    res.status(403).json({
      error: `Vous devez avoir au moins ${MIN_LIVE_AGE} ans pour lancer un live.`,
      code: 'LIVE_AGE_REQUIRED',
    });
    return;
  }

  const stripeConnectSkipped = req.body.stripeConnectSkipped === true;
  if (!user.stripeConnectAccountId && !stripeConnectSkipped) {
    res.status(403).json({
      error: 'Configurez Stripe Connect pour pouvoir lancer un live et recevoir des pourboires.',
      code: 'STRIPE_CONNECT_REQUIRED',
    });
    return;
  }

  if (!user.liveTermsAcceptedAt) {
    res.status(403).json({
      error: 'Vous devez accepter les règles de diffusion Soundy avant de lancer un live.',
      code: 'LIVE_TERMS_REQUIRED',
    });
    return;
  }

  const existing = [...db.lives.values()].find((l) => l.hostId === userId && l.isActive);
  if (existing) {
    res.json({ live: publicLive(existing, undefined, userId) });
    return;
  }

  try {
    assertCanStartLive(userId);
  } catch (e) {
    if (e instanceof PlatformPlanError) {
      res.status(403).json({ error: e.message, code: e.code });
      return;
    }
    throw e;
  }

  const salon = [...db.salons.values()].find((s) => s.hostId === userId);
  let live: Live;
  const streamMode = resolveStreamModeForHost(userId);

  if (salon) {
    /** playbackState reprend le salon (métadonnées morceau) ; la vidéo YouTube reste côté SalonPage, pas LivePage. */
    live = {
      id: salon.id,
      salonId: salon.id,
      hostId: salon.hostId,
      hostName: salon.hostName,
      title: req.body.title || `Live — ${salon.title}`,
      platform: salon.platform,
      playbackState: salon.playbackState,
      latitude: salon.latitude,
      longitude: salon.longitude,
      blurredLatitude: blurCoordinate(salon.latitude),
      blurredLongitude: blurCoordinate(salon.longitude),
      viewersCount: 0,
      isActive: true,
      startedAt: Date.now(),
      vipModeratorIds: [],
      streamMode,
    };
  } else {
    const { latitude, longitude } = resolveStartCoordinates(user, req.body);
    const platform: MusicPlatform = req.body.platform === 'youtube' ? 'youtube' : 'spotify';
    live = {
      id: `live_${Date.now()}`,
      hostId: userId,
      hostName: user.username,
      title: req.body.title || `Live — ${user.username}`,
      platform,
      playbackState: defaultStandalonePlayback(user.username, platform),
      latitude,
      longitude,
      blurredLatitude: blurCoordinate(latitude),
      blurredLongitude: blurCoordinate(longitude),
      viewersCount: 0,
      isActive: true,
      startedAt: Date.now(),
      vipModeratorIds: [],
      streamMode,
    };
  }

  if (streamMode === 'cloudflare') {
    await provisionCloudflareStreamForLive(live);
  }

  db.lives.set(live.id, live);
  persistLiveToPgAsync(live);
  trackEvent('live_started', userId);
  db.liveChats.set(live.id, []);
  db.liveBans.set(live.id, new Map());
  const host = db.users.get(live.hostId);
  if (host) {
    notifyFollowersLiveStarted(live, host);
    notifyFavoritesLiveStarted(host, live);
  }
  res.status(201).json({ live: publicLive(live, undefined, userId) });
});

livesRouter.post('/stop', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const live = [...db.lives.values()].find((l) => l.hostId === userId && l.isActive);
  if (!live) {
    res.status(404).json({ error: 'Aucun live actif' });
    return;
  }
  live.isActive = false;
  if (live.streamMode === 'cloudflare') {
    await archiveCloudflareStreamForLive(live);
  }
  endLiveSession(live);
  getIo()?.to(`live_${live.id}`).emit('live_ended', {
    liveId: live.id,
    reason: 'host_stopped',
  });
  getIo()?.to(`live_${live.id}`).emit('live_updated', serializePublicLive(live));
  res.json({ ok: true });
});

livesRouter.get('/stream-capabilities', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const plan = getUserPlatformPlan(userId);
  res.json({
    cloudflareStreamAvailable: isCloudflareStreamConfigured() && plan.limits.allowCloudflare,
    livekitAvailable: isLiveKitConfigured() && plan.limits.allowLiveKit,
    obsAllowed: plan.limits.allowObs,
    platformPlanId: plan.id,
  });
});

livesRouter.get('/user/:userId', authenticateJWT, (req: Request, res: Response) => {
  const userId = req.params.userId;
  const me = (req as Request & { user: { id: string } }).user.id;
  if (!db.users.has(userId)) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (userId === me && !canAccessArchivedLives(me)) {
    res.status(403).json({
      error: 'Les rediffusions sont réservées aux abonné·e·s Soundy+.',
      code: 'ARCHIVED_LIVES_PLUS_REQUIRED',
    });
    return;
  }
  const lives = listHostedArchivedLives(userId, me).map(serializeArchivedLive);
  res.json({ lives });
});

livesRouter.get('/:id', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const live = db.lives.get(req.params.id);
  if (!live) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  if (!assertLiveAccessible(live, me)) {
    res.status(403).json({ error: 'Live indisponible', code: 'content_blocked' });
    return;
  }
  if (live.hostId !== me && isLiveViewBanned(live.id, me)) {
    const ban = getLiveBan(live.id, me);
    res.status(403).json({
      error: ban ? liveBanMessage(ban) : 'Vous êtes banni de ce live.',
      code: 'live_banned',
      permanent: ban?.permanent,
      until: ban?.until,
    });
    return;
  }
  res.json({
    live: publicLive(live, undefined, me),
    salon:
      live.salonId && db.salons.get(live.salonId)
        ? publicSalon(db.salons.get(live.salonId)!, me)
        : null,
  });
});

livesRouter.get('/:id/participants', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const live = db.lives.get(req.params.id);
  if (!live) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  if (!assertLiveAccessible(live, me)) {
    res.status(403).json({ error: 'Live indisponible', code: 'content_blocked' });
    return;
  }
  if (live.hostId !== me && isLiveViewBanned(live.id, me)) {
    const ban = getLiveBan(live.id, me);
    res.status(403).json({
      error: ban ? liveBanMessage(ban) : 'Vous êtes banni de ce live.',
      code: 'live_banned',
    });
    return;
  }
  const vipIds = live.vipModeratorIds ?? [];
  res.json({
    participants: getLiveConnectedParticipants(live.id, live.hostId, vipIds),
    viewersCount: live.viewersCount,
  });
});

/** LiveKit access token for host (publish) or viewer (subscribe). */
livesRouter.get('/:id/livekit-token', authenticateJWT, async (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string; username?: string } }).user;
  const live = db.lives.get(req.params.id);
  if (!live) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  if (!assertLiveAccessible(live, me.id)) {
    res.status(403).json({ error: 'Live indisponible', code: 'content_blocked' });
    return;
  }
  if (live.hostId !== me.id && isLiveViewBanned(live.id, me.id)) {
    res.status(403).json({ error: 'Vous êtes banni de ce live.', code: 'live_banned' });
    return;
  }
  if (live.streamMode !== 'livekit') {
    res.status(404).json({
      error: 'Ce live n’utilise pas LiveKit.',
      code: 'livekit_unavailable',
      streamMode: live.streamMode ?? 'webrtc',
    });
    return;
  }
  const isHost = live.hostId === me.id;
  if (!isHost) {
    try {
      assertViewerCanAccessLive(live, me.id);
    } catch (e) {
      if (e instanceof PlatformPlanError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
  }
  if (!isLiveKitConfigured()) {
    res.status(503).json({
      error: 'LiveKit non configuré sur le serveur.',
      code: 'livekit_not_configured',
    });
    return;
  }

  const user = db.users.get(me.id);
  const roomName = liveKitRoomName(live.id);

  try {
    const token = await createLiveKitToken({
      roomName,
      participantIdentity: me.id,
      participantName: user?.username ?? me.id,
      canPublish: isHost,
    });
    res.json({
      token,
      serverUrl: getLiveKitUrl(),
      roomName,
      canPublish: isHost,
      streamMode: 'livekit' as const,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur LiveKit';
    res.status(502).json({ error: message, code: 'livekit_error' });
  }
});

/** HLS playback URL for Cloudflare Stream spectators. */
livesRouter.get('/:id/playback', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const live = db.lives.get(req.params.id);
  if (!live) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  if (!assertLiveAccessible(live, me)) {
    res.status(403).json({ error: 'Live indisponible', code: 'content_blocked' });
    return;
  }
  if (live.hostId !== me && isLiveViewBanned(live.id, me)) {
    res.status(403).json({ error: 'Vous êtes banni de ce live.', code: 'live_banned' });
    return;
  }
  if (live.isActive && live.hostId !== me) {
    try {
      assertViewerCanAccessLive(live, me);
    } catch (e) {
      if (e instanceof PlatformPlanError) {
        res.status(403).json({ error: e.message, code: e.code });
        return;
      }
      throw e;
    }
  }
  const playbackUrl =
    live.cloudflareVodPlaybackUrl ?? live.cloudflarePlaybackUrl;
  if (live.streamMode !== 'cloudflare' || !playbackUrl) {
    res.status(404).json({
      error: 'Flux CDN non disponible pour ce live.',
      code: 'playback_unavailable',
      streamMode: live.streamMode ?? 'webrtc',
      isArchived: !live.isActive,
    });
    return;
  }
  res.json({
    streamMode: 'cloudflare',
    playbackUrl,
    liveInputId: live.cloudflareLiveInputId,
    isArchived: !live.isActive,
  });
});

/** Create or refresh Cloudflare live input (host only). */
livesRouter.post('/:id/cloudflare-stream', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const live = db.lives.get(req.params.id);
  if (!live) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  if (live.hostId !== userId) {
    res.status(403).json({ error: 'Réservé à l’hôte du live.' });
    return;
  }
  if (!isCloudflareStreamConfigured()) {
    res.status(503).json({
      error: 'Cloudflare Stream non configuré sur le serveur.',
      code: 'cloudflare_not_configured',
    });
    return;
  }

  try {
    if (live.cloudflareLiveInputId) {
      const creds = await getCloudflareLiveInput(live.cloudflareLiveInputId);
      live.cloudflarePlaybackUrl = creds.playbackHlsUrl;
      live.cloudflareCustomerSubdomain = creds.customerSubdomain;
      live.streamMode = 'cloudflare';
    } else {
      await provisionCloudflareStreamForLive(live);
    }
    db.lives.set(live.id, live);
    getIo()?.to(`live_${live.id}`).emit('live_updated', serializePublicLive(live));
    res.json({ live: publicLive(live, undefined, userId) });
  } catch (err) {
    if (err instanceof PlatformPlanError) {
      res.status(403).json({ error: err.message, code: err.code });
      return;
    }
    const message = err instanceof Error ? err.message : 'Erreur Cloudflare Stream';
    res.status(502).json({ error: message, code: 'cloudflare_error' });
  }
});

/** RTMP ingest credentials — host only, never expose stream key to spectators. */
livesRouter.get('/:id/cloudflare-ingest', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const live = db.lives.get(req.params.id);
  if (!live) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  if (live.hostId !== userId) {
    res.status(403).json({ error: 'Réservé à l’hôte du live.' });
    return;
  }
  if (!isCloudflareStreamConfigured()) {
    res.status(503).json({ error: 'Cloudflare Stream non configuré.', code: 'cloudflare_not_configured' });
    return;
  }
  try {
    assertCanUseCloudflareObs(userId);
  } catch (e) {
    if (e instanceof PlatformPlanError) {
      res.status(403).json({ error: e.message, code: e.code });
      return;
    }
    throw e;
  }
  if (!live.cloudflareLiveInputId) {
    res.status(404).json({ error: 'Aucun flux Cloudflare pour ce live.', code: 'no_cloudflare_input' });
    return;
  }

  try {
    const creds = await getCloudflareLiveInput(live.cloudflareLiveInputId);
    res.json({
      rtmpsUrl: creds.rtmpsUrl,
      streamKey: creds.rtmpsStreamKey,
      playbackUrl: creds.playbackHlsUrl,
      whipUrl: creds.whipUrl,
      liveInputId: creds.uid,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur Cloudflare Stream';
    res.status(502).json({ error: message, code: 'cloudflare_error' });
  }
});

/** Start LiveKit → Cloudflare Stream RTMP egress (host only, livekit mode). */
livesRouter.post('/:id/start-egress', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const live = db.lives.get(req.params.id);
  if (!live) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  if (live.hostId !== userId) {
    res.status(403).json({ error: 'Réservé à l\'hôte du live.' });
    return;
  }
  if (live.streamMode !== 'livekit') {
    res.status(400).json({ error: 'Ce live n\'est pas en mode LiveKit.', code: 'not_livekit' });
    return;
  }
  if (!isLiveKitConfigured()) {
    res.status(503).json({ error: 'LiveKit non configuré.', code: 'livekit_not_configured' });
    return;
  }
  if (!isCloudflareStreamConfigured()) {
    res.status(503).json({ error: 'Cloudflare Stream non configuré.', code: 'cloudflare_not_configured' });
    return;
  }
  if (getLiveKitEgressId(live.id)) {
    res.status(409).json({ error: 'Un egress est déjà actif pour ce live.', code: 'egress_already_active' });
    return;
  }

  try {
    let cfCreds;
    if (live.cloudflareLiveInputId) {
      cfCreds = await getCloudflareLiveInput(live.cloudflareLiveInputId);
    } else {
      cfCreds = await createCloudflareLiveInput({ name: `soundy-egress-${live.id}` });
      live.cloudflareLiveInputId = cfCreds.uid;
      live.cloudflarePlaybackUrl = cfCreds.playbackHlsUrl;
      live.cloudflareCustomerSubdomain = cfCreds.customerSubdomain;
      db.lives.set(live.id, live);
    }
    const rtmpUrl = `${cfCreds.rtmpsUrl}${cfCreds.rtmpsStreamKey}`;
    const egressId = await startLiveKitEgress(live.id, rtmpUrl);
    res.json({ egressId, hlsUrl: cfCreds.playbackHlsUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur démarrage egress';
    res.status(502).json({ error: message, code: 'egress_error' });
  }
});

/** Stop the active LiveKit RTMP egress (host only). */
livesRouter.post('/:id/stop-egress', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const live = db.lives.get(req.params.id);
  if (!live) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  if (live.hostId !== userId) {
    res.status(403).json({ error: 'Réservé à l\'hôte du live.' });
    return;
  }
  if (!getLiveKitEgressId(live.id)) {
    res.status(404).json({ error: 'Aucun egress actif pour ce live.', code: 'no_active_egress' });
    return;
  }

  try {
    await stopLiveKitEgress(live.id);
    res.json({ stopped: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur arrêt egress';
    res.status(502).json({ error: message, code: 'egress_error' });
  }
});

function publicLive(l: Live, distanceKm?: number, viewerId?: string) {
  return serializePublicLive(l, distanceKm, viewerId);
}
