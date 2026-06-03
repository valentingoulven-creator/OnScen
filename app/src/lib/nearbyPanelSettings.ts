import type { NearbyPerson } from '../types';
import { getNearbyRadiusKm, setNearbyRadiusKm } from './settings';

export type NearbyPlatformFilter = 'all' | 'spotify' | 'youtube';

export interface NearbyPanelPreferences {
  radiusKm: number;
  platformFilter: NearbyPlatformFilter;
  livesOnly: boolean;
}

const STORAGE_KEY = 'melosong_nearby_panel_prefs';

export const NEARBY_PANEL_CHANGED_EVENT = 'melosong-nearby-panel-changed';

const DEFAULT_PREFS: Omit<NearbyPanelPreferences, 'radiusKm'> = {
  platformFilter: 'all',
  livesOnly: false,
};

export function getNearbyPanelPreferences(): NearbyPanelPreferences {
  let platformFilter: NearbyPlatformFilter = DEFAULT_PREFS.platformFilter;
  let livesOnly = DEFAULT_PREFS.livesOnly;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NearbyPanelPreferences>;
      if (parsed.platformFilter === 'spotify' || parsed.platformFilter === 'youtube' || parsed.platformFilter === 'all') {
        platformFilter = parsed.platformFilter;
      }
      if (typeof parsed.livesOnly === 'boolean') livesOnly = parsed.livesOnly;
    }
  } catch {
    /* ignore */
  }
  return {
    radiusKm: getNearbyRadiusKm(),
    platformFilter,
    livesOnly,
  };
}

export function setNearbyPanelPreferences(
  patch: Partial<Pick<NearbyPanelPreferences, 'platformFilter' | 'livesOnly'>>
): NearbyPanelPreferences {
  const current = getNearbyPanelPreferences();
  const next: NearbyPanelPreferences = {
    ...current,
    ...patch,
  };
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      platformFilter: next.platformFilter,
      livesOnly: next.livesOnly,
    })
  );
  window.dispatchEvent(new Event(NEARBY_PANEL_CHANGED_EVENT));
  return next;
}

/** Salons dont l’hôte ou le salon figure dans la liste filtrée. */
export function filterSalonsForNearbyPanel<T extends { id: string; hostId: string }>(
  salons: T[],
  people: NearbyPerson[]
): T[] {
  const hostIds = new Set(people.map((p) => p.id));
  const salonIds = new Set(people.map((p) => p.salonId).filter((id): id is string => !!id));
  return salons.filter((s) => hostIds.has(s.hostId) || salonIds.has(s.id));
}

/** Lives dont le host figure dans la liste filtrée. */
export function filterLivesForNearbyPanel<T extends { hostId: string }>(
  lives: T[],
  people: NearbyPerson[]
): T[] {
  const hostIds = new Set(people.map((p) => p.id));
  return lives.filter((l) => hostIds.has(l.hostId));
}

/** Personnes seules sur la carte (pas déjà représentées par un salon/live). */
export function peopleMarkersOnMap(people: NearbyPerson[]): NearbyPerson[] {
  return people.filter(
    (p) =>
      p.latitude != null &&
      p.longitude != null &&
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude) &&
      !p.salonId &&
      !p.isLive
  );
}

export function setNearbyPanelRadiusKm(km: number): number {
  setNearbyRadiusKm(km);
  return getNearbyRadiusKm();
}

export function filterNearbyPeople(
  people: NearbyPerson[],
  prefs: Pick<NearbyPanelPreferences, 'platformFilter' | 'livesOnly'>
): NearbyPerson[] {
  return people.filter((p) => {
    if (prefs.livesOnly && !p.isLive) return false;
    if (prefs.platformFilter !== 'all') {
      if (p.listeningPlatform !== prefs.platformFilter) return false;
    }
    return true;
  });
}

export function nearbyPanelFiltersActive(prefs: Pick<NearbyPanelPreferences, 'platformFilter' | 'livesOnly'>): boolean {
  return prefs.platformFilter !== 'all' || prefs.livesOnly;
}
