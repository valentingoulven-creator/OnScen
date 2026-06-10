import { db, MusicPlatform, User } from '../models/schema';
import { getDistanceKm } from './geo';
import { getUserPublicCoords, userSharesDistance } from './locationPrivacy';
import { applyProfileDefaults, type PublicCurrentListening } from './profile';
import { getHostRatingSummary } from './ratings';
import { isBotHost } from '../seed-bots';
import { isSalonVisibleOnMap } from './salonAccess';
import { resolveGeoNearbyLimits, resolveNearbyRadiusKm } from './geoLimits';
import { isValidLatLng } from './mapCoords';

export interface NearbyPersonDto {
  id: string;
  username: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
  avatarUrl?: string;
  listeningRole?: string;
  city?: string;
  distanceKm?: number;
  isBot?: boolean;
  salonId?: string;
  salonTitle?: string;
  isLive?: boolean;
  liveId?: string;
  liveViewersCount?: number;
  /** Auditeurs dans le salon (si hôte de salon). */
  listenersCount?: number;
  hostRatingAverage?: number;
  hostRatingCount?: number;
  /** Plateforme d’écoute actuelle (salon, live ou compte connecté). */
  listeningPlatform?: MusicPlatform;
  /** Morceau en cours (salon ou live de l’hôte). */
  currentListening?: PublicCurrentListening;
  /** Position affichée sur la carte (respecte la confidentialité). */
  latitude?: number;
  longitude?: number;
  interests?: string[];
  favoriteGenres?: string[];
  favoriteArtists?: string[];
}

/** Position personne sur la carte : géolocalisation live de l'utilisateur (pas le salon). */
function mapCoordsForUser(
  u: User,
  viewerId: string
): { latitude: number; longitude: number } | null {
  const pos = getUserPublicCoords(u, viewerId);
  if (!pos || !isValidLatLng(pos.lat, pos.lon)) return null;
  return { latitude: pos.lat, longitude: pos.lon };
}

function hostDistanceKm(
  viewerLat: number,
  viewerLon: number,
  host: User,
  viewerId: string
): number | null {
  const pos = getUserPublicCoords(host, viewerId);
  if (!pos) return null;
  return getDistanceKm(viewerLat, viewerLon, pos.lat, pos.lon);
}

function listeningFromSalon(salonId: string): PublicCurrentListening | undefined {
  const salon = db.salons.get(salonId);
  if (!salon?.playbackState?.title?.trim()) return undefined;
  const ps = salon.playbackState;
  return {
    title: ps.title.trim(),
    artist: ps.artist?.trim() || 'Artiste inconnu',
    albumArtUrl: ps.albumArtUrl,
    platform: ps.platform ?? salon.platform,
    isPlaying: ps.isPlaying,
  };
}

function listeningFromLive(liveId: string): PublicCurrentListening | undefined {
  const live = db.lives.get(liveId);
  if (!live?.playbackState?.title?.trim()) return undefined;
  const ps = live.playbackState;
  return {
    title: ps.title.trim(),
    artist: ps.artist?.trim() || 'Artiste inconnu',
    albumArtUrl: ps.albumArtUrl,
    platform: ps.platform,
    isPlaying: ps.isPlaying,
  };
}

function resolveListeningPlatform(
  u: User,
  extra?: { salonId?: string; platform?: MusicPlatform }
): MusicPlatform | undefined {
  if (extra?.platform) return extra.platform;
  if (extra?.salonId) {
    const salon = db.salons.get(extra.salonId);
    if (salon) return salon.platform;
  }
  const standaloneLive = [...db.lives.values()].find((l) => l.isActive && l.hostId === u.id && !l.salonId);
  if (standaloneLive) return standaloneLive.platform;
  const hostedSalon = [...db.salons.values()].find((s) => s.hostId === u.id);
  if (hostedSalon) return hostedSalon.platform;
  const connected = u.connectedPlatforms ?? [];
  if (connected.length === 1) return connected[0];
  if (connected.length > 0) return connected[0];
  return undefined;
}

export function getNearbyPeople(
  viewerId: string,
  lat: number,
  lon: number,
  radiusKm: number,
  distanceFilter = true
): NearbyPersonDto[] {
  const maxRadiusKm = resolveNearbyRadiusKm(radiusKm, distanceFilter);
  const byId = new Map<string, NearbyPersonDto>();

  const withinRadius = (d: number) => maxRadiusKm == null || d <= maxRadiusKm;

  const upsert = (
    u: User,
    distanceKm: number,
    extra?: {
      salonId?: string;
      salonTitle?: string;
      isLive?: boolean;
      liveId?: string;
      liveViewersCount?: number;
      listenersCount?: number;
      platform?: MusicPlatform;
      currentListening?: PublicCurrentListening;
    }
  ) => {
    if (u.id === viewerId || u.isGhostMode) return;

    const rounded = Math.round(distanceKm * 10) / 10;
    const prev = byId.get(u.id);
    if (prev && (prev.distanceKm ?? Infinity) < rounded) {
      if (extra) {
        const mergedSalonId = extra.salonId ?? prev.salonId;
        const isLive = Boolean(extra.isLive || prev.isLive);
        const mergedLiveId = isLive ? extra.liveId ?? prev.liveId : prev.liveId;
        const mergedListening =
          extra.currentListening ??
          (mergedLiveId ? listeningFromLive(mergedLiveId) : undefined) ??
          (mergedSalonId ? listeningFromSalon(mergedSalonId) : undefined) ??
          prev.currentListening;
        const coords = mapCoordsForUser(u, viewerId);
        byId.set(u.id, {
          ...prev,
          usernameColor: u.usernameColor ?? prev.usernameColor,
          usernameWaveFrom: u.usernameWaveFrom ?? prev.usernameWaveFrom,
          usernameWaveTo: u.usernameWaveTo ?? prev.usernameWaveTo,
          salonId: mergedSalonId,
          salonTitle: extra.salonTitle ?? prev.salonTitle,
          isLive,
          liveId: mergedLiveId,
          liveViewersCount: extra.liveViewersCount ?? prev.liveViewersCount,
          listenersCount: extra.listenersCount ?? prev.listenersCount,
          listeningPlatform: resolveListeningPlatform(u, {
            salonId: mergedSalonId,
            platform: extra.platform ?? prev.listeningPlatform,
          }),
          currentListening: mergedListening,
          ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        });
      }
      return;
    }

    applyProfileDefaults(u);
    const role = u.listeningRole;
    const isHost = role === 'host' || role === 'les_deux';
    const rating = isHost ? getHostRatingSummary(u.id) : undefined;

    const salonId = extra?.salonId ?? prev?.salonId;
    const isLive = extra?.isLive ?? prev?.isLive;
    const liveId = extra?.liveId ?? prev?.liveId;
    const currentListening =
      extra?.currentListening ??
      (isLive && liveId ? listeningFromLive(liveId) : undefined) ??
      (salonId ? listeningFromSalon(salonId) : undefined) ??
      prev?.currentListening;
    const coords = mapCoordsForUser(u, viewerId);

    byId.set(u.id, {
      id: u.id,
      username: u.username,
      usernameColor: u.usernameColor,
      usernameWaveFrom: u.usernameWaveFrom,
      usernameWaveTo: u.usernameWaveTo,
      avatarUrl: u.avatarUrl,
      listeningRole: u.listeningRole,
      city: u.city,
      distanceKm: userSharesDistance(u) ? rounded : undefined,
      isBot: isBotHost(u.id),
      salonId,
      salonTitle: extra?.salonTitle ?? prev?.salonTitle,
      isLive,
      liveId,
      liveViewersCount: extra?.liveViewersCount ?? prev?.liveViewersCount,
      listenersCount: extra?.listenersCount ?? prev?.listenersCount,
      hostRatingAverage: rating && rating.count > 0 ? rating.average : undefined,
      hostRatingCount: rating && rating.count > 0 ? rating.count : undefined,
      listeningPlatform: resolveListeningPlatform(u, {
        salonId,
        platform: extra?.platform ?? prev?.listeningPlatform,
      }),
      currentListening,
      interests: u.interests?.length ? [...u.interests] : undefined,
      favoriteGenres: u.favoriteGenres?.length ? [...u.favoriteGenres] : undefined,
      favoriteArtists: u.favoriteArtists?.length ? [...u.favoriteArtists] : undefined,
      ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
    });
  };

  for (const u of db.users.values()) {
    const pos = getUserPublicCoords(u, viewerId);
    if (!pos) continue;
    const d = getDistanceKm(lat, lon, pos.lat, pos.lon);
    if (withinRadius(d)) upsert(u, d);
  }

  for (const s of db.salons.values()) {
    if (!isSalonVisibleOnMap(s, viewerId)) continue;
    if (!isValidLatLng(s.latitude, s.longitude)) continue;
    const host = db.users.get(s.hostId);
    if (!host) continue;
    const d = hostDistanceKm(lat, lon, host, viewerId);
    if (d == null || !withinRadius(d)) continue;
    const live = db.lives.get(s.id);
    upsert(host, d, {
      salonId: s.id,
      salonTitle: s.title,
      isLive: Boolean(live?.isActive),
      liveId: live?.isActive ? live.id : undefined,
      liveViewersCount: live?.isActive ? live.viewersCount : undefined,
      listenersCount: s.listenersCount,
      platform: s.platform,
      currentListening: listeningFromSalon(s.id),
    });
  }

  for (const l of db.lives.values()) {
    if (!l.isActive || l.salonId) continue;
    if (!isValidLatLng(l.latitude, l.longitude)) continue;
    const host = db.users.get(l.hostId);
    if (!host) continue;
    const d = hostDistanceKm(lat, lon, host, viewerId);
    if (d == null || !withinRadius(d)) continue;
    upsert(host, d, {
      isLive: true,
      liveId: l.id,
      liveViewersCount: l.viewersCount,
      platform: l.platform,
      currentListening: listeningFromLive(l.id),
    });
  }

  const sorted = [...byId.values()].sort(
    (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
  );

  const { nearbyPeopleLimit } = resolveGeoNearbyLimits(distanceFilter);
  return sorted.slice(0, nearbyPeopleLimit);
}
