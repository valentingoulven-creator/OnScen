import type { Live, NearbyPerson, Salon } from '../types';
import { isValidLatLng } from './mapCoords';

export function isActiveMapLive(live: Live): boolean {
  return live.isActive !== false;
}

/** Live actif avec coordonnées carte valides (GET /lives ou nearby). */
export function isGeolocatedMapLive(live: Live): boolean {
  return isActiveMapLive(live) && isValidLatLng(live.latitude, live.longitude);
}

/** Live éligible au badge LIVE des anneaux stories — source autoritaire : GET /lives. */
export function isStoryRingLive(live: Live): boolean {
  if (!isGeolocatedMapLive(live)) return false;
  if (live.cameraActive) return true;
  if (live.streamMode === 'livekit' || live.streamMode === 'cloudflare') return true;
  return false;
}

export type ActiveLiveHostInfo = { liveId: string; liveViewersCount?: number };

export function buildActiveLiveByHost(lives: Live[]): Map<string, ActiveLiveHostInfo> {
  const map = new Map<string, ActiveLiveHostInfo>();
  for (const live of lives) {
    if (!isStoryRingLive(live)) continue;
    const prev = map.get(live.hostId);
    if (!prev || (live.viewersCount ?? 0) >= (prev.liveViewersCount ?? 0)) {
      map.set(live.hostId, { liveId: live.id, liveViewersCount: live.viewersCount });
    }
  }
  return map;
}

export function purgeEndedLiveFromMapState(
  endedLiveId: string,
  hostId: string | undefined,
  salons: Salon[],
  lives: Live[],
  people: NearbyPerson[]
): { salons: Salon[]; lives: Live[]; people: NearbyPerson[] } {
  const matchesHostLive = (host?: string, liveId?: string, isLive?: boolean) =>
    liveId === endedLiveId || (hostId != null && host === hostId && isLive);

  return {
    lives: lives.filter(
      (l) => l.id !== endedLiveId && l.salonId !== endedLiveId && isActiveMapLive(l)
    ),
    salons: salons.map((s) =>
      s.id === endedLiveId || (hostId != null && s.hostId === hostId && s.isLive)
        ? { ...s, isLive: false }
        : s
    ),
    people: people.map((p) =>
      matchesHostLive(p.id, p.liveId, p.isLive)
        ? { ...p, isLive: false, liveId: undefined, liveViewersCount: undefined }
        : p
    ),
  };
}
