import type { LivesGeoPrefs } from './livesGeo';
import { resolveInitialCreateSalonGenres } from './createSalonGenres';

export type SalonCreateSetupPrefs = {
  title?: string;
  accessMode?: 'public' | 'invite';
  allowQueue?: boolean;
  genres?: string[];
  startLatitude?: number;
  startLongitude?: number;
  startLocationLabel?: string;
  startLocationSource?: 'my_position' | 'city' | 'address';
};

export function prefsFromSalonCreateForm(
  form: {
    title: string;
    accessMode: 'public' | 'invite';
    allowQueue: boolean;
    genres: string[];
  },
  salonLocation: LivesGeoPrefs
): SalonCreateSetupPrefs {
  return {
    title: form.title.trim() || undefined,
    accessMode: form.accessMode,
    allowQueue: form.allowQueue,
    genres: form.genres.length > 0 ? form.genres : undefined,
    startLatitude: salonLocation.latitude,
    startLongitude: salonLocation.longitude,
    startLocationLabel: salonLocation.label?.trim() || undefined,
    startLocationSource: salonLocation.source,
  };
}

export function applySavedSalonCreateSetup(
  saved: SalonCreateSetupPrefs | null,
  defaults: {
    defaultTitle: string;
    initialGeo: LivesGeoPrefs;
    profileGenres?: string[];
    presetAccess?: 'public' | 'invite';
    presetAllowedUserIds?: string[];
  }
): {
  title: string;
  accessMode: 'public' | 'invite';
  allowQueue: boolean;
  genres: string[];
  salonLocation: LivesGeoPrefs;
} {
  const lat = saved?.startLatitude;
  const lon = saved?.startLongitude;
  const salonLocation: LivesGeoPrefs =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? {
          ...defaults.initialGeo,
          latitude: lat!,
          longitude: lon!,
          label: saved?.startLocationLabel ?? defaults.initialGeo.label,
          source:
            saved?.startLocationSource === 'city'
              ? 'city'
              : saved?.startLocationSource === 'address'
                ? 'address'
                : saved?.startLocationSource === 'my_position'
                  ? 'my_position'
                  : defaults.initialGeo.source,
        }
      : { ...defaults.initialGeo };

  const genreOptions = resolveInitialCreateSalonGenres(defaults.profileGenres);
  const savedGenres =
    saved?.genres?.filter((g) => g.trim().length > 0).slice(0, 10) ?? [];
  const genres = savedGenres.length > 0 ? savedGenres : genreOptions;

  return {
    title: saved?.title?.trim() || defaults.defaultTitle,
    accessMode: defaults.presetAccess ?? saved?.accessMode ?? 'public',
    allowQueue: saved?.allowQueue ?? true,
    genres,
    salonLocation,
  };
}
