import { api } from './api';
import { getLivesGeo, isFixedMapGeoSource, type LivesGeoPrefs } from './livesGeo';
import type { CreateSalonPlaylistSelection } from '../components/CreateSalonPlaylistPicker';

/** Position initiale du modal création salon (carte / préférences utilisateur). */
export function initialSalonCreateLocation(
  fallbackLatitude: number,
  fallbackLongitude: number
): LivesGeoPrefs {
  const geo = getLivesGeo();
  const useGeoCoords =
    Number.isFinite(geo.latitude) &&
    Number.isFinite(geo.longitude) &&
    (isFixedMapGeoSource(geo.source) || geo.source === 'my_position');
  return {
    ...geo,
    latitude: useGeoCoords ? geo.latitude : fallbackLatitude,
    longitude: useGeoCoords ? geo.longitude : fallbackLongitude,
    label: useGeoCoords ? geo.label : geo.label || 'Carte',
    source: useGeoCoords ? geo.source : geo.source,
  };
}

/** @deprecated Préférer le choix explicite dans CreateSalonModal (SessionLocationPicker). */
export async function resolveSalonCreatePosition(
  fallbackLatitude: number,
  fallbackLongitude: number
): Promise<{ latitude: number; longitude: number }> {
  const geo = getLivesGeo();
  if (isFixedMapGeoSource(geo.source)) {
    return { latitude: geo.latitude, longitude: geo.longitude };
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { latitude: fallbackLatitude, longitude: fallbackLongitude };
  }
  try {
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 120_000,
      })
    );
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return { latitude: fallbackLatitude, longitude: fallbackLongitude };
  }
}

/** Playlists bibliothèque (/me/playlists) : verify-access redondant au submit. */
export function shouldVerifyYoutubePlaylistOnCreate(
  selection: CreateSalonPlaylistSelection | null
): boolean {
  if (!selection) return false;
  return Boolean(selection.playlistUrl?.trim());
}

export function buildPlaylistLoadBody(
  youtubePlaylist: CreateSalonPlaylistSelection | null
): { playlistId?: string; playlistUrl?: string } | null {
  if (!youtubePlaylist) return null;
  if (youtubePlaylist.playlistUrl) return { playlistUrl: youtubePlaylist.playlistUrl };
  if (youtubePlaylist.playlistId) return { playlistId: youtubePlaylist.playlistId };
  return null;
}

export function translateSalonCreateError(
  t: (key: string, options?: Record<string, unknown>) => string,
  e: unknown,
  _platform: 'youtube' = 'youtube'
): string {
  if (e instanceof Error && e.message) return e.message;
  return t('salon.create.errorGeneric', { defaultValue: 'Impossible de créer le salon.' });
}

/** Charge la playlist après entrée salon (socket `salon_updated`). */
export function deferSalonPlaylistLoad(
  token: string,
  salonId: string,
  body: { playlistId?: string; playlistUrl?: string },
  onError?: (error: unknown) => void
): void {
  void api.salonLoadPlaylist(token, salonId, body).catch((error) => {
    console.warn('[create-salon] deferred playlist load failed', error);
    onError?.(error);
  });
}
