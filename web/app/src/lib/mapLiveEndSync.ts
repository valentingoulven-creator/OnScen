import type { Live, NearbyPerson, Salon } from '../types';

export function isActiveMapLive(live: Live): boolean {
  return live.isActive !== false;
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
