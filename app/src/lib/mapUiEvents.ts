/** Ouvre la modale « Créer un salon » depuis l’onglet Carte (ex. CTA bandeau header). */
export const MAP_OPEN_CREATE_SALON_EVENT = 'melosong_map_open_create_salon';

export function dispatchMapOpenCreateSalon(): void {
  window.dispatchEvent(new CustomEvent(MAP_OPEN_CREATE_SALON_EVENT));
}
