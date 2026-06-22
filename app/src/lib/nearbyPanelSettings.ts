import type { Live, NearbyPerson, Salon } from '../types';
import {
  countMusicalAffinityMatches,
  hasMusicalAffinity,
  type ProfileTastes,
  viewerHasTasteProfile,
} from './musicAffinities';
import { isValidLatLng } from './mapCoords';
import {
  getNearbyRadiusKm,
  setNearbyDistanceFilterEnabled,
  setNearbyRadiusKm,
} from './settings';

export type NearbyPlatformFilter = 'all' | 'spotify' | 'youtube';
export type NearbySortBy = 'distance' | 'audience' | 'audience_asc' | 'none';

export interface NearbyPanelPreferences {
  radiusKm: number;
  /**
   * @deprecated Utilisé par les stories (Accueil). Pour le panneau À proximité, préférer
   * `isNearbyDistanceFilterActive` (lié à `sortBy === 'distance'`).
   */
  filterByDistance: boolean;
  platformFilter: NearbyPlatformFilter;
  livesOnly: boolean;
  sortBy: NearbySortBy;
  /** Mettre les utilisateurs favoris en tête de liste (toujours actif). */
  favoritesFirst: boolean;
  /** Afficher uniquement les personnes avec au moins une affinité musicale (profil). */
  musicalAffinitiesOnly: boolean;
}

/** Filtre par rayon actif lorsque le tri est « distance ». */
export function isNearbyDistanceFilterActive(
  prefs: Pick<NearbyPanelPreferences, 'sortBy'>
): boolean {
  return prefs.sortBy === 'distance';
}

/** Filtre carte Salon actif : pas de filtre rayon / proximité sur les salons. */
export function resolveNearbyDistanceFilterForMap(
  prefs: Pick<NearbyPanelPreferences, 'sortBy'>,
  salonMapBrowse: boolean
): boolean {
  if (salonMapBrowse) return false;
  return isNearbyDistanceFilterActive(prefs);
}

export interface NearbySortOptions {
  favoriteIds?: Set<string>;
  favoritesFirst?: boolean;
  /** Tri secondaire par nombre d'affinités communes (décroissant). */
  sortByMusicalAffinity?: boolean;
  viewerTastes?: ProfileTastes;
}

export type { ProfileTastes };
export { countMusicalAffinityMatches, hasMusicalAffinity, viewerHasTasteProfile };

/** Préférences filtres/tri du panneau À proximité (hors rayon et lieu — voir settings / livesGeo). */
export const NEARBY_PANEL_PREFS_STORAGE_KEY = 'melosong_nearby_panel_prefs';
const STORAGE_KEY = NEARBY_PANEL_PREFS_STORAGE_KEY;

export const NEARBY_PANEL_CHANGED_EVENT = 'melosong-nearby-panel-changed';

/** Visibilité panneau liste carte (sidebar / bottom). Défaut : masqué. */
export const MAP_SIDEBAR_LIST_STORAGE_KEY = 'melosong_show_nearby_people';

export function getMapSidebarListVisible(): boolean {
  try {
    const raw = localStorage.getItem(MAP_SIDEBAR_LIST_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    /* ignore */
  }
  return false;
}

export function setMapSidebarListVisible(visible: boolean): void {
  try {
    localStorage.setItem(MAP_SIDEBAR_LIST_STORAGE_KEY, visible ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

const DEFAULT_PREFS: Omit<NearbyPanelPreferences, 'radiusKm' | 'filterByDistance'> = {
  platformFilter: 'all',
  livesOnly: false,
  sortBy: 'distance',
  favoritesFirst: true,
  musicalAffinitiesOnly: false,
};

/** Réordonne en plaçant les favoris en tête (ordre relatif conservé). */
export function applyFavoritesFirst<T>(
  items: T[],
  getUserId: (item: T) => string,
  favoriteIds: Set<string> | undefined,
  enabled: boolean | undefined
): T[] {
  if (!enabled || !favoriteIds?.size) return items;
  const favorites: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (favoriteIds.has(getUserId(item))) favorites.push(item);
    else rest.push(item);
  }
  return [...favorites, ...rest];
}

export function getNearbyPanelPreferences(): NearbyPanelPreferences {
  let platformFilter: NearbyPlatformFilter = DEFAULT_PREFS.platformFilter;
  let livesOnly = DEFAULT_PREFS.livesOnly;
  let sortBy: NearbySortBy = DEFAULT_PREFS.sortBy;
  /** OFF par défaut : on montre favoris + suivis. Activé = filtre par rayon. */
  let storiesFilterByDistance = false;
  let musicalAffinitiesOnly = DEFAULT_PREFS.musicalAffinitiesOnly;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NearbyPanelPreferences>;
      if (typeof parsed.filterByDistance === 'boolean') {
        storiesFilterByDistance = parsed.filterByDistance;
      }
      if (typeof parsed.musicalAffinitiesOnly === 'boolean') {
        musicalAffinitiesOnly = parsed.musicalAffinitiesOnly;
      }
      if (parsed.platformFilter === 'youtube' || parsed.platformFilter === 'all') {
        platformFilter = parsed.platformFilter;
      } else if (parsed.platformFilter === 'spotify') {
        platformFilter = 'all';
      }
      if (typeof parsed.livesOnly === 'boolean') livesOnly = parsed.livesOnly;
      if (
        parsed.sortBy === 'distance' ||
        parsed.sortBy === 'audience' ||
        parsed.sortBy === 'audience_asc' ||
        parsed.sortBy === 'none'
      ) {
        sortBy = parsed.sortBy;
      } else if ((parsed as { sortBy?: string }).sortBy === 'people_desc') {
        sortBy = 'audience';
      } else if ((parsed as { sortBy?: string }).sortBy === 'people_asc') {
        sortBy = 'audience_asc';
      }
    }
  } catch {
    /* ignore */
  }
  return {
    radiusKm: getNearbyRadiusKm(),
    filterByDistance: storiesFilterByDistance,
    platformFilter,
    livesOnly,
    sortBy,
    favoritesFirst: true,
    musicalAffinitiesOnly,
  };
}

export function setNearbyPanelPreferences(
  patch: Partial<
    Pick<
      NearbyPanelPreferences,
      | 'platformFilter'
      | 'livesOnly'
      | 'sortBy'
      | 'filterByDistance'
      | 'musicalAffinitiesOnly'
    >
  >
): NearbyPanelPreferences {
  const current = getNearbyPanelPreferences();
  const next: NearbyPanelPreferences = {
    ...current,
    ...patch,
    favoritesFirst: true,
  };
  if (patch.filterByDistance !== undefined) {
    setNearbyDistanceFilterEnabled(patch.filterByDistance);
    next.filterByDistance = patch.filterByDistance;
  }
  if (patch.sortBy !== undefined) {
    setNearbyDistanceFilterEnabled(patch.sortBy === 'distance');
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      filterByDistance: next.filterByDistance,
      platformFilter: next.platformFilter,
      livesOnly: next.livesOnly,
      sortBy: next.sortBy,
      musicalAffinitiesOnly: next.musicalAffinitiesOnly,
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

/** Salons affichés sur la carte selon les préférences du panneau. */
export function filterSalonsForMap<T extends { id: string; hostId: string; isLive?: boolean; platform?: string }>(
  salons: T[],
  people: NearbyPerson[],
  prefs: Pick<NearbyPanelPreferences, 'platformFilter' | 'livesOnly' | 'sortBy'>
): T[] {
  let result: T[];
  if (prefs.livesOnly) {
    result = salons.filter((s) => s.isLive);
  } else if (!isNearbyDistanceFilterActive(prefs)) {
    result = salons;
  } else {
    result = filterSalonsForNearbyPanel(salons, people);
  }
  if (prefs.platformFilter !== 'all') {
    result = result.filter((s) => s.platform === prefs.platformFilter);
  }
  return result;
}

/** Lives dont le host figure dans la liste filtrée. */
export function filterLivesForNearbyPanel<T extends { hostId: string }>(
  lives: T[],
  people: NearbyPerson[]
): T[] {
  const hostIds = new Set(people.map((p) => p.id));
  return lives.filter((l) => hostIds.has(l.hostId));
}

/** Lives affichés sur la carte selon les préférences du panneau. */
export function filterLivesForMap<T extends { hostId: string; platform?: string }>(
  lives: T[],
  people: NearbyPerson[],
  prefs: Pick<NearbyPanelPreferences, 'platformFilter' | 'livesOnly' | 'sortBy'>
): T[] {
  let result: T[];
  if (prefs.livesOnly) {
    result = lives;
  } else if (!isNearbyDistanceFilterActive(prefs)) {
    result = lives;
  } else {
    result = filterLivesForNearbyPanel(lives, people);
  }
  if (prefs.platformFilter !== 'all') {
    result = result.filter((l) => l.platform === prefs.platformFilter);
  }
  return result;
}

/** Live, hôte de salon, ou auteur d'un événement carte — sinon masqué (MODIF 447). */
export function personHasMapActivity(
  person: NearbyPerson,
  eventAuthorIds?: ReadonlySet<string>
): boolean {
  if (person.isLive) return true;
  if (person.salonId) return true;
  if (eventAuthorIds?.has(person.id)) return true;
  return false;
}

/** Personnes affichées sur la carte : coords valides + activité live/salon/événement. */
export function peopleMarkersOnMap(
  people: NearbyPerson[],
  eventAuthorIds?: ReadonlySet<string>
): NearbyPerson[] {
  return people.filter(
    (p) =>
      isValidLatLng(p.latitude, p.longitude) &&
      personHasMapActivity(p, eventAuthorIds)
  );
}

export function setNearbyPanelRadiusKm(km: number): number {
  setNearbyRadiusKm(km);
  return getNearbyRadiusKm();
}

/** Entrée liste « à proximité » représentant un salon (hôte, pas en live). */
export function isNearbySalonEntry(person: NearbyPerson): boolean {
  return Boolean(person.salonId) && !person.isLive;
}

/** Retire les salons de la liste latérale quand le filtre carte Salon est OFF. */
export function filterNearbySalonEntries(
  people: NearbyPerson[],
  showSalonEntries: boolean
): NearbyPerson[] {
  if (showSalonEntries) return people;
  return people.filter((p) => !isNearbySalonEntry(p));
}

export function filterNearbyPeople(
  people: NearbyPerson[],
  prefs: Pick<NearbyPanelPreferences, 'platformFilter' | 'livesOnly' | 'musicalAffinitiesOnly'>,
  viewerTastes?: ProfileTastes
): NearbyPerson[] {
  const affinityFilter =
    prefs.musicalAffinitiesOnly && viewerTastes && viewerHasTasteProfile(viewerTastes);

  return people.filter((p) => {
    if (prefs.livesOnly && !p.isLive) return false;
    if (prefs.platformFilter !== 'all') {
      if (p.listeningPlatform !== prefs.platformFilter) return false;
    }
    if (affinityFilter && !hasMusicalAffinity(viewerTastes!, p)) return false;
    if (prefs.musicalAffinitiesOnly && viewerTastes && !viewerHasTasteProfile(viewerTastes)) {
      return false;
    }
    return true;
  });
}

export function nearbyPanelFiltersActive(
  prefs: Pick<NearbyPanelPreferences, 'livesOnly' | 'sortBy' | 'musicalAffinitiesOnly'>
): boolean {
  const sortFilterActive =
    prefs.sortBy === 'audience' || prefs.sortBy === 'audience_asc';
  return prefs.livesOnly || sortFilterActive || prefs.musicalAffinitiesOnly;
}

function salonListenersById(salons: Pick<Salon, 'id' | 'listenersCount'>[]): Map<string, number> {
  return new Map(salons.map((s) => [s.id, s.listenersCount]));
}

/** Spectateurs live ou auditeurs salon pour une entrée « À proximité ». */
export function nearbyPersonAudienceCount(
  person: NearbyPerson,
  salonListeners: Map<string, number>
): number {
  if (person.isLive && person.liveViewersCount != null) return person.liveViewersCount;
  if (person.listenersCount != null) return person.listenersCount;
  if (person.salonId) return salonListeners.get(person.salonId) ?? 0;
  return 0;
}

export function sortNearbyPeople(
  people: NearbyPerson[],
  sortBy: NearbySortBy,
  salons: Pick<Salon, 'id' | 'listenersCount'>[] = [],
  options?: NearbySortOptions
): NearbyPerson[] {
  const arr = [...people];
  let sorted: NearbyPerson[];
  if (sortBy === 'none') {
    sorted = arr;
  } else if (sortBy === 'distance') {
    sorted = arr.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  } else {
    const salonListeners = salonListenersById(salons);
    if (sortBy === 'audience_asc') {
      sorted = arr.sort(
        (a, b) =>
          nearbyPersonAudienceCount(a, salonListeners) - nearbyPersonAudienceCount(b, salonListeners) ||
          (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
      );
    } else {
      sorted = arr.sort(
        (a, b) =>
          nearbyPersonAudienceCount(b, salonListeners) - nearbyPersonAudienceCount(a, salonListeners) ||
          (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
      );
    }
  }
  if (options?.sortByMusicalAffinity && options.viewerTastes) {
    const tastes = options.viewerTastes;
    sorted = [...sorted].sort(
      (a, b) =>
        countMusicalAffinityMatches(tastes, b) - countMusicalAffinityMatches(tastes, a) ||
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
  }
  return applyFavoritesFirst(sorted, (p) => p.id, options?.favoriteIds, options?.favoritesFirst);
}

export function sortSalonsForNearby<T extends { hostId: string; listenersCount: number; distanceKm?: number }>(
  salons: T[],
  sortBy: NearbySortBy,
  options?: NearbySortOptions
): T[] {
  const arr = [...salons];
  let sorted: T[];
  if (sortBy === 'none') {
    sorted = arr;
  } else if (sortBy === 'distance') {
    sorted = arr.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  } else if (sortBy === 'audience_asc') {
    sorted = arr.sort(
      (a, b) =>
        (a.listenersCount ?? 0) - (b.listenersCount ?? 0) ||
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
  } else {
    sorted = arr.sort(
      (a, b) =>
        (b.listenersCount ?? 0) - (a.listenersCount ?? 0) ||
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
  }
  return applyFavoritesFirst(sorted, (s) => s.hostId, options?.favoriteIds, options?.favoritesFirst);
}

export function sortLivesForNearby<T extends Pick<Live, 'hostId' | 'distanceKm' | 'viewersCount'>>(
  lives: T[],
  sortBy: NearbySortBy,
  options?: NearbySortOptions
): T[] {
  const arr = [...lives];
  let sorted: T[];
  if (sortBy === 'none') {
    sorted = arr;
  } else if (sortBy === 'distance') {
    sorted = arr.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  } else if (sortBy === 'audience_asc') {
    sorted = arr.sort(
      (a, b) =>
        (a.viewersCount ?? 0) - (b.viewersCount ?? 0) ||
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
  } else {
    sorted = arr.sort(
      (a, b) =>
        (b.viewersCount ?? 0) - (a.viewersCount ?? 0) ||
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
  }
  return applyFavoritesFirst(sorted, (l) => l.hostId, options?.favoriteIds, options?.favoritesFirst);
}

export const NEARBY_SORT_OPTIONS: { id: Exclude<NearbySortBy, 'none'>; label: string }[] = [
  { id: 'distance', label: 'Distance' },
  { id: 'audience', label: 'Plus de spectateurs' },
  { id: 'audience_asc', label: 'Moins de spectateurs' },
];
