import type { Live, Salon } from '../types';

/** Sépare salons d’écoute (pin SALON) et sessions live salon (pin LIVE). */
export function splitSalonsForMapMarkers(salons: Salon[]): {
  offlineSalons: Salon[];
  liveSalons: Salon[];
} {
  const offlineSalons: Salon[] = [];
  const liveSalons: Salon[] = [];
  for (const s of salons) {
    if (s.isLive) liveSalons.push(s);
    else offlineSalons.push(s);
  }
  return { offlineSalons, liveSalons };
}

/** Ids salons hors direct — seuls cas où un live standalone peut être masqué (legacy). */
export function linkedSalonIdsForLiveDedup(salons: Salon[]): Set<string> {
  return new Set(salons.filter((s) => !s.isLive).map((s) => s.id));
}

/** Convertit un salon live (live.id === salon.id) en marqueur live carte. */
export function salonToMapLive(s: Salon): Live {
  return {
    id: s.id,
    salonId: s.id,
    hostId: s.hostId,
    hostName: s.hostName,
    hostAvatarUrl: s.hostAvatarUrl,
    hostUsernameColor: s.hostUsernameColor,
    hostUsernameWaveFrom: s.hostUsernameWaveFrom,
    hostUsernameWaveTo: s.hostUsernameWaveTo,
    title: s.title,
    platform: s.platform,
    playbackState: s.playbackState,
    latitude: s.latitude,
    longitude: s.longitude,
    viewersCount: s.listenersCount ?? 0,
    isActive: true,
  };
}

/** Fusionne lives API + salons live absents du slice lives (ex. salon-backed). */
export function mergeLivesWithLiveSalons(lives: Live[], liveSalons: Salon[]): Live[] {
  const byId = new Map<string, Live>();
  for (const l of lives) byId.set(l.id, l);
  for (const s of liveSalons) {
    if (!byId.has(s.id)) byId.set(s.id, salonToMapLive(s));
  }
  return [...byId.values()];
}
