import { buildPlatformTrackUrl } from './salonPlayback';

function isMobileSpotify(): boolean {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/** URI scheme pour ouvrir l'app Spotify (Connect — pas de Web Playback SDK). */
export function buildSpotifyAppUri(trackId?: string | null): string {
  const id = trackId?.trim();
  if (!id || id === 'demo') return 'spotify:';
  if (isMobileSpotify()) return `spotify://track/${id}`;
  return `spotify:track:${id}`;
}

export function buildSpotifyWebUrl(trackId?: string | null): string {
  const id = trackId?.trim();
  if (!id || id === 'demo') return 'https://open.spotify.com/';
  return buildPlatformTrackUrl('spotify', id);
}

/** Ouvre l'app Spotify (ou la page web en secours) — deep link + Connect uniquement. */
export function openSpotifyApp(trackId?: string | null): void {
  if (typeof window === 'undefined') return;

  const uri = buildSpotifyAppUri(trackId);
  const webUrl = buildSpotifyWebUrl(trackId);

  if (isMobileSpotify()) {
    window.location.assign(uri);
    window.setTimeout(() => {
      window.location.assign(webUrl);
    }, 1200);
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = uri;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => {
    window.open(webUrl, '_blank', 'noopener,noreferrer');
  }, 800);
}
