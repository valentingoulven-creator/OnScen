import { api } from './api';
import { getLivesGeo, isFixedMapGeoSource } from './livesGeo';
import type { CreateSalonPlaylistSelection } from '../components/CreateSalonPlaylistPicker';

/** Position salon : GPS rapide (cache 2 min) ou centre carte fixe. */
export async function resolveSalonCreatePosition(
  fallbackLatitude: number,
  fallbackLongitude: number
): Promise<{ latitude: number; longitude: number }> {
  const geo = getLivesGeo();
  if (isFixedMapGeoSource(geo.source)) {
    return { latitude: fallbackLatitude, longitude: fallbackLongitude };
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
export function shouldVerifySpotifyPlaylistOnCreate(
  selection: CreateSalonPlaylistSelection | null
): boolean {
  if (!selection) return false;
  return Boolean(selection.playlistUrl?.trim());
}

export function buildPlaylistLoadBody(
  platform: 'spotify' | 'youtube',
  youtubePlaylist: CreateSalonPlaylistSelection | null,
  spotifyPlaylist: CreateSalonPlaylistSelection | null
): { playlistId?: string; playlistUrl?: string } | null {
  if (platform === 'youtube' && youtubePlaylist) {
    if (youtubePlaylist.playlistUrl) return { playlistUrl: youtubePlaylist.playlistUrl };
    if (youtubePlaylist.playlistId) return { playlistId: youtubePlaylist.playlistId };
    return null;
  }
  if (platform === 'spotify' && spotifyPlaylist) {
    if (spotifyPlaylist.playlistId) return { playlistId: spotifyPlaylist.playlistId };
    if (spotifyPlaylist.playlistUrl) return { playlistUrl: spotifyPlaylist.playlistUrl };
    return null;
  }
  return null;
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
