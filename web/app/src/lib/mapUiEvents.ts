/** Ouvre la modale « Créer un salon » depuis l’onglet Carte (ex. CTA bandeau header). */
export const MAP_OPEN_CREATE_SALON_EVENT = 'melosong_map_open_create_salon';

/** Recharge les marqueurs événement sur la carte (après publication feed). */
export const MAP_EVENTS_REFRESH_EVENT = 'melosong_map_events_refresh';

/** Recharge le carrousel Sponso sidebar carte (après promotion Dev sur EventCard). */
export const MAP_SIDEBAR_SPONSO_REFRESH_EVENT = 'melosong_map_sidebar_sponso_refresh';

export function dispatchMapOpenCreateSalon(): void {
  window.dispatchEvent(new CustomEvent(MAP_OPEN_CREATE_SALON_EVENT));
}

export function dispatchMapEventsRefresh(): void {
  window.dispatchEvent(new Event(MAP_EVENTS_REFRESH_EVENT));
}

export function dispatchMapSidebarSponsoRefresh(): void {
  window.dispatchEvent(new Event(MAP_SIDEBAR_SPONSO_REFRESH_EVENT));
}
