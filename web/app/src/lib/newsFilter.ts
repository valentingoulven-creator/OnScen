import type { MusicNewsItem } from '../types';
import {
  hasMusicalAffinity,
  normalizeTags,
  type ProfileTastes,
  viewerHasTasteProfile,
} from './musicAffinities';
import type { NewsUserPrefs } from './feedUserPrefs';

function newsItemTastes(item: MusicNewsItem): ProfileTastes {
  return {
    favoriteGenres: item.genres,
    favoriteArtists: item.artist ? [item.artist] : undefined,
  };
}

function passesCategoryFilter(item: MusicNewsItem, prefs: NewsUserPrefs): boolean {
  if (prefs.categories.length === 0) return true;
  return prefs.categories.includes(item.category);
}

function passesAffinityFilter(
  item: MusicNewsItem,
  prefs: NewsUserPrefs,
  viewerTastes: ProfileTastes | undefined
): boolean {
  if (!prefs.musicalAffinitiesOnly) return true;
  if (!viewerTastes || !viewerHasTasteProfile(viewerTastes)) return false;
  const itemTastes = newsItemTastes(item);
  if (hasMusicalAffinity(viewerTastes, itemTastes)) return true;
  const viewerGenres = normalizeTags(viewerTastes.favoriteGenres);
  const itemGenres = normalizeTags(item.genres);
  for (const g of viewerGenres) {
    if (itemGenres.has(g)) return true;
  }
  return false;
}

/** Applique les préférences du panneau Actualités sur les news musicales. */
export function applyNewsPreferences(
  items: MusicNewsItem[],
  prefs: NewsUserPrefs,
  viewerTastes?: ProfileTastes
): MusicNewsItem[] {
  return items.filter(
    (item) =>
      passesCategoryFilter(item, prefs) && passesAffinityFilter(item, prefs, viewerTastes)
  );
}
