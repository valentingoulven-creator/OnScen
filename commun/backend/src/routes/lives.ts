import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import { DEFAULT_PLAYBACK_SESSION_TITLE } from '../lib/brandName';
import { db, Live, MusicPlatform, User } from '../models/schema';
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
import { MIN_LIVE_AGE, userMeetsLiveAgeFromProfile } from '../lib/ageGates';
import { getUserLiveMediaSetup, isLiveContentCategory } from '../lib/liveMediaSetup';
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
  getCloudflareLiveInputLifecycle,
  isCloudflareStreamConfigured,
  normalizeCloudflareIngestForObs,
  resolveLatestRecordingHlsUrl,
  type CloudflareLiveInputCredentials,
} from '../lib/cloudflareStream';
import {
  fetchUserObsIngest,
  getOrCreateUserObsLiveInput,
  isUserPersistentObsLiveInput,
} from '../lib/userObsStream';
import { persistLiveToPgAsync } from '../lib/pgSalonsLives';
import { resolveLiveTipsEnabledAtStart } from '../lib/donations';
import { defaultDonationOptionsForLive } from '../lib/liveDonationDefaults';
import {
  assertCanStartLive,
  assertCanUseCloudflareObs,
  canAccessArchivedLives,
  getUserPlatformPlan,
  isCloudflareStreamAllowedForUser,
  isObsAllowedForUser,
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

/**
 * Exécute `fn`; si elle lève une PlatformPlanError, répond en 403 avec le code plan
 * et renvoie `false` (l'appelant doit alors faire `return`). Toute autre erreur est
 * re-lancée. Évite de dupliquer le même bloc try/catch à chaque garde de plan.
 */
function runOrRespondPlanError(res: Response, fn: () => void): boolean {
  try {
    fn();
    return true;
  } catch (e) {
    if (e instanceof PlatformPlanError) {
      res.status(403).json({ error: e.message, code: e.code });
      return false;
    }
    throw e;
  }
}

const MAX_LIVE_TITLE_LENGTH = 120;

/** Nettoie/plafonne un titre de live fourni par le client (évite un titre vide, avec espaces superflus, ou démesuré). */
function sanitizeLiveTitle(raw: unknown, fallback: string): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return fallback;
  return trimmed.slice(0, MAX_LIVE_TITLE_LENGTH);
}

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
  if (Number.isFinite(bodyLat) && Number.isFinite(bodyLon) && isValidLatLng(bodyLat, bodyLon)) {
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
    title: DEFAULT_PLAYBACK_SESSION_TITLE,
    artist: hostName,
    albumArtUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
    isPlaying: true,
    progressMs: 0,
    updatedAt: Date.now(),
  };
}

/**
 * Provisionne un live input Cloudflare pour ce live et renvoie explicitement le
 * streamMode résultant ('cloudflare' si succès, 'webrtc' en repli sur échec) — à
 * l'appelant de faire `live.streamMode = await provisionCloudflareStreamForLive(live)`.
 * (Auparavant la fonction mutait `live.streamMode` en silence, un effet de bord
 * caché qui rendait le comportement des appelants peu évident à la lecture.)
 */
async function provisionCloudflareStreamForLive(live: Live): Promise<Live['streamMode']> {
  assertCanUseCloudflareObs(live.hostId);
  if (!isCloudflareStreamConfigured()) return live.streamMode;
  try {
    const creds = await getOrCreateUserObsLiveInput(live.hostId);
    live.cloudflareLiveInputId = creds.uid;
    live.cloudflarePlaybackUrl = creds.playbackHlsUrl;
    live.cloudflareCustomerSubdomain = creds.customerSubdomain;
    return 'cloudflare';
  } catch (err) {
    console.error('[cloudflare-stream] Échec création live input:', err);
    return 'webrtc';
  }
}

async function archiveCloudflareStreamForLive(live: Live): Promise<void> {
  const inputId = live.cloudflareLiveInputId;
  if (!inputId || !isCloudflareStreamConfigured()) return;

  if (!isUserPersistentObsLiveInput(live.hostId, inputId)) {
    try {
      await disableCloudflareLiveInput(inputId);
    } catch (err) {
      console.warn('[cloudflare-stream] disable live input:', err);
    }
  }

  let vodUrl = live.cloudflarePlaybackUrl;
  try {
    const recording = await resolveLatestRecordingHlsUrl(inputId, live.startedAt);
    if (recording) vodUrl = recording;
  } catch (err) {
    console.warn('[cloudflare-stream] enregistrement VOD:', err);
  }
  if (vodUrl) {
    live.cloudflareVodPlaybackUrl = vodUrl;
  }
}

livesRouter.post('/start', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }

  if (!userMeetsLiveAgeFromProfile(user)) {
    res.status(403).json({
      error: `Vous devez avoir au moins ${MIN_LIVE_AGE} ans pour lancer un live.`,
      code: 'LIVE_AGE_REQUIRED',
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

  // Fast-path O(1) via l'index hostId → liveId actif (au lieu d'un scan complet de
  // db.lives à chaque appel). C'est aussi la première moitié de la garde anti-doublon :
  // voir la réservation posée plus bas, avant tout point d'attente (await).
  const existingId = db.activeLiveByHost.get(userId);
  const existing = existingId ? db.lives.get(existingId) : undefined;
  if (existing?.isActive) {
    res.json({ live: publicLive(existing, undefined, userId) });
    return;
  }
  if (existingId) db.activeLiveByHost.delete(userId); // entrée obsolète (live terminé/introuvable)

  if (!runOrRespondPlanError(res, () => assertCanStartLive(userId))) return;

  const salon = [...db.salons.values()].find((s) => s.hostId === userId);
  let live: Live;
  const useObs = req.body.useObs === true;
  let streamMode = resolveStreamModeForHost(userId);
  if (useObs) {
    if (!isCloudflareStreamConfigured()) {
      res.status(503).json({
        error: 'Cloudflare Stream non configuré sur le serveur.',
        code: 'cloudflare_not_configured',
      });
      return;
    }
    if (!runOrRespondPlanError(res, () => assertCanUseCloudflareObs(userId))) return;
    streamMode = 'cloudflare';
  }

  if (salon) {
    // Un live archivé (terminé) peut déjà occuper la clé `salon.id` si ce salon a déjà
    // hébergé un live précédent (host qui redémarre). On le re-clé avant d'écraser cette
    // entrée, pour ne pas perdre son historique (rediffusion, stats) — cf. finding I1.
    const previousLive = db.lives.get(salon.id);
    if (previousLive && !previousLive.isActive) {
      const archivedKey = `live_${previousLive.endedAt ?? previousLive.startedAt}_${randomUUID()}`;
      previousLive.id = archivedKey;
      db.lives.delete(salon.id);
      db.lives.set(archivedKey, previousLive);
    }
    /** playbackState reprend le salon (métadonnées morceau) ; la vidéo YouTube reste côté SalonPage, pas LivePage. */
    live = {
      id: salon.id,
      salonId: salon.id,
      hostId: salon.hostId,
      hostName: salon.hostName,
      title: sanitizeLiveTitle(req.body.title, `Live — ${salon.title}`),
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
    const platform: MusicPlatform = 'youtube';
    live = {
      // UUID plutôt que Date.now() : deux requêtes concurrentes dans la même milliseconde
      // (double-tap, retry réseau) généraient sinon le même id → collision/état incohérent.
      id: `live_${randomUUID()}`,
      hostId: userId,
      hostName: user.username,
      title: sanitizeLiveTitle(req.body.title, `Live — ${user.username}`),
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

  // Réservation atomique — posée AVANT le premier `await` qui suit. Tout ce qui précède
  // depuis la vérification `existingId` ci-dessus est strictement synchrone (Node.js ne
  // peut donc pas interléaver une requête concurrente du même hôte entre les deux) : c'est
  // ce qui rend cette garde anti-doublon fiable (cf. finding C1 — race condition).
  db.activeLiveByHost.set(userId, live.id);

  try {
    if (streamMode === 'cloudflare') {
      live.streamMode = await provisionCloudflareStreamForLive(live);
    }

    const stripeConnectSkipped = req.body.stripeConnectSkipped === true;
    live.tipsEnabled = await resolveLiveTipsEnabledAtStart(userId, stripeConnectSkipped);
    if (live.tipsEnabled !== false) {
      live.donationOptions = defaultDonationOptionsForLive();
    }
    live.contentCategory = resolveLiveStartContentCategory(req.body, user);

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
  } catch (err) {
    // Libère la réservation : sinon cet hôte ne pourrait plus jamais démarrer de live
    // après une erreur transitoire (provisioning Cloudflare, résolution des pourboires…).
    if (db.activeLiveByHost.get(userId) === live.id) db.activeLiveByHost.delete(userId);
    console.error('[lives] Échec démarrage du live:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erreur lors du démarrage du live.', code: 'live_start_failed' });
    }
  }
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
  endLiveSession(live, Date.now(), { reason: 'host_stopped' });
  getIo()?.to(`live_${live.id}`).emit('live_updated', serializePublicLive(live));
  res.json({ ok: true });
});

livesRouter.get('/stream-capabilities', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const plan = getUserPlatformPlan(userId);
  res.json({
    cloudflareStreamAvailable: isCloudflareStreamAllowedForUser(userId),
    cloudflareConfigured: isCloudflareStreamConfigured(),
    livekitAvailable: isLiveKitConfigured() && plan.limits.allowLiveKit,
    obsAllowed: isObsAllowedForUser(userId),
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
  if (!live.isActive) {
    res.status(404).json({
      error: 'Ce live est terminé.',
      code: 'live_ended',
    });
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
    if (!runOrRespondPlanError(res, () => assertViewerCanAccessLive(live, me.id))) return;
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
    if (!runOrRespondPlanError(res, () => assertViewerCanAccessLive(live, me))) return;
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
      live.streamMode = await provisionCloudflareStreamForLive(live);
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
  if (!runOrRespondPlanError(res, () => assertCanUseCloudflareObs(userId))) return;
  if (!live.cloudflareLiveInputId) {
    try {
      live.streamMode = await provisionCloudflareStreamForLive(live);
      db.lives.set(live.id, live);
    } catch {
      /* provisionCloudflareStreamForLive gère les erreurs internes (fallback webrtc) ;
         seule assertCanUseCloudflareObs peut throw ici, ignoré volontairement (best effort) */
    }
  }
  if (!live.cloudflareLiveInputId) {
    res.status(404).json({ error: 'Aucun flux Cloudflare pour ce live.', code: 'no_cloudflare_input' });
    return;
  }

  try {
    const ingest = await fetchUserObsIngest(userId);
    if (live.cloudflareLiveInputId !== ingest.liveInputId || !live.cloudflarePlaybackUrl) {
      live.cloudflareLiveInputId = ingest.liveInputId;
      live.cloudflarePlaybackUrl = ingest.playbackUrl;
      db.lives.set(live.id, live);
      persistLiveToPgAsync(live);
      getIo()?.to(`live_${live.id}`).emit('live_updated', serializePublicLive(live));
    }
    res.json(ingest);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur Cloudflare Stream';
    res.status(502).json({ error: message, code: 'cloudflare_error' });
  }
});

/** État connexion OBS → Cloudflare (lifecycle RTMP). Hôte + spectateurs du live. */
livesRouter.get('/:id/cloudflare-stream-status', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const live = db.lives.get(req.params.id);
  if (!live) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  if (live.hostId !== userId) {
    if (!live.isActive) {
      res.status(403).json({ error: 'Live terminé.' });
      return;
    }
    if (!runOrRespondPlanError(res, () => assertViewerCanAccessLive(live, userId))) return;
  }
  const isHost = live.hostId === userId;
  const obsStatusForLivekitHost = isHost && live.streamMode === 'livekit' && live.isActive;

  if (!obsStatusForLivekitHost && (live.streamMode !== 'cloudflare' || !live.cloudflareLiveInputId)) {
    res.status(404).json({ error: 'Flux Cloudflare indisponible.', code: 'no_cloudflare_input' });
    return;
  }
  try {
    let liveInputId = live.cloudflareLiveInputId;
    let playbackUrl = live.cloudflarePlaybackUrl;
    const customerSubdomain = live.cloudflareCustomerSubdomain;

    if (isHost) {
      try {
        const ingest = await fetchUserObsIngest(live.hostId);
        liveInputId = ingest.liveInputId;
        playbackUrl = ingest.playbackUrl;
        if (
          live.streamMode === 'cloudflare' &&
          (live.cloudflareLiveInputId !== ingest.liveInputId || !live.cloudflarePlaybackUrl)
        ) {
          live.cloudflareLiveInputId = ingest.liveInputId;
          live.cloudflarePlaybackUrl = ingest.playbackUrl;
          db.lives.set(live.id, live);
          persistLiveToPgAsync(live);
          getIo()?.to(`live_${live.id}`).emit('live_updated', serializePublicLive(live));
        }
      } catch {
        /* best effort — lifecycle sur l’input courant */
      }
    }

    if (!liveInputId) {
      res.status(404).json({ error: 'Flux Cloudflare indisponible.', code: 'no_cloudflare_input' });
      return;
    }

    const lifecycle = await getCloudflareLiveInputLifecycle(liveInputId, customerSubdomain);
    res.json({
      live: lifecycle.live,
      videoUid: lifecycle.videoUid,
      status: lifecycle.status,
      liveInputId,
      playbackUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur Cloudflare Stream';
    res.status(502).json({ error: message, code: 'cloudflare_error' });
  }
});

/** Cloudflare live input RTMP credentials for LiveKit CDN (host only). */
async function ensureLiveKitCdnCloudflareInput(live: Live): Promise<CloudflareLiveInputCredentials> {
  if (live.cloudflareLiveInputId) {
    return getCloudflareLiveInput(live.cloudflareLiveInputId);
  }
  const cfCreds = await createCloudflareLiveInput({ name: `soundy-egress-${live.id}` });
  live.cloudflareLiveInputId = cfCreds.uid;
  live.cloudflarePlaybackUrl = cfCreds.playbackHlsUrl;
  live.cloudflareCustomerSubdomain = cfCreds.customerSubdomain;
  db.lives.set(live.id, live);
  persistLiveToPgAsync(live);
  return cfCreds;
}

/** RTMP/OBS credentials for LiveKit → Cloudflare CDN relay (host only, livekit mode). */
livesRouter.get('/:id/livekit-cdn-ingest', authenticateJWT, async (req: Request, res: Response) => {
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
  if (live.streamMode !== 'livekit') {
    res.status(400).json({ error: 'Ce live n’est pas en mode LiveKit.', code: 'not_livekit' });
    return;
  }
  if (!isCloudflareStreamConfigured()) {
    res.status(503).json({ error: 'Cloudflare Stream non configuré.', code: 'cloudflare_not_configured' });
    return;
  }
  if (!runOrRespondPlanError(res, () => assertCanUseCloudflareObs(userId))) return;

  try {
    const cfCreds = await ensureLiveKitCdnCloudflareInput(live);
    const ingest = normalizeCloudflareIngestForObs(cfCreds);
    res.json({
      ...ingest,
      playbackUrl: cfCreds.playbackHlsUrl,
      liveInputId: cfCreds.uid,
      egressActive: Boolean(await getLiveKitEgressId(live.id)),
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
  if (await getLiveKitEgressId(live.id)) {
    res.status(409).json({ error: 'Un egress est déjà actif pour ce live.', code: 'egress_already_active' });
    return;
  }

  try {
    const cfCreds = await ensureLiveKitCdnCloudflareInput(live);
    const rtmpUrl = `${cfCreds.rtmpsUrl}${cfCreds.rtmpsStreamKey}`;
    const egressId = await startLiveKitEgress(live.id, rtmpUrl);
    const ingest = normalizeCloudflareIngestForObs(cfCreds);
    res.json({
      egressId,
      hlsUrl: cfCreds.playbackHlsUrl,
      ...ingest,
      playbackUrl: cfCreds.playbackHlsUrl,
      liveInputId: cfCreds.uid,
    });
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
  if (!(await getLiveKitEgressId(live.id))) {
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

function resolveLiveStartContentCategory(body: unknown, user: User): Live['contentCategory'] {
  const raw = (body as { contentCategory?: unknown })?.contentCategory;
  if (isLiveContentCategory(raw)) return raw;
  const saved = getUserLiveMediaSetup(user);
  if (saved?.contentCategory) return saved.contentCategory;
  return 'music';
}

function publicLive(l: Live, distanceKm?: number, viewerId?: string) {
  return serializePublicLive(l, distanceKm, viewerId);
}
