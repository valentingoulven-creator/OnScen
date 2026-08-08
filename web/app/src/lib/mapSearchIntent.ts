import { getEventFilterCityMapRadiusKm } from './mapEventFilter';

export type MapSearchPlaceKind = 'city' | 'country';

export interface MapSearchSearchIntent {
  location: string;
  latitude: number;
  longitude: number;
  kind?: MapSearchPlaceKind;
  /** Incrémenté à chaque sélection pour rejouer le fly même vers la même ville. */
  nonce: number;
}

/** Émis quand l'utilisateur choisit une ville/pays dans la recherche globale. */
export const MAP_FLY_TO_PLACE_EVENT = 'onscen_map_fly_to_place';

let pendingMapFly: MapSearchSearchIntent | null = null;

/** Demande un vol carte — conservé si HomePage n'est pas encore montée. */
export function requestMapFlyToPlace(intent: MapSearchSearchIntent): void {
  pendingMapFly = intent;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MAP_FLY_TO_PLACE_EVENT, { detail: intent }));
  }
}

export function takePendingMapFlyToPlace(): MapSearchSearchIntent | null {
  const next = pendingMapFly;
  pendingMapFly = null;
  return next;
}

const COUNTRY_FLY_RADIUS_KM = 280;

export function getMapSearchFlyRadiusKm(
  location: string,
  kind: MapSearchPlaceKind = 'city'
): number {
  if (kind === 'country') return COUNTRY_FLY_RADIUS_KM;
  return getEventFilterCityMapRadiusKm(location);
}
