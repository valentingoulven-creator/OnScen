import { MusicPlatform } from '../models/schema';

/** Format ID vidéo YouTube (6–15 car. alphanum / _ -). */
export const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{6,15}$/;

export function isValidYoutubeVideoId(id: string | undefined | null): id is string {
  const raw = id?.trim();
  return Boolean(raw && raw !== 'demo' && YOUTUBE_VIDEO_ID_RE.test(raw));
}

export function parseMusicLink(
  platform: MusicPlatform,
  urlOrId: string
): { trackId: string; title?: string } | null {
  const raw = urlOrId.trim();
  if (!raw) return null;

  if (platform === 'youtube') {
    const idFromUrl = raw.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/
    )?.[1];
    if (idFromUrl && isValidYoutubeVideoId(idFromUrl)) return { trackId: idFromUrl };
    if (isValidYoutubeVideoId(raw)) return { trackId: raw };
    return null;
  }

  const spotifyId =
    raw.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/)?.[1] ||
    raw.match(/^spotify:track:([a-zA-Z0-9]+)$/)?.[1] ||
    (raw.length <= 30 && /^[a-zA-Z0-9]+$/.test(raw) ? raw : null);
  return spotifyId ? { trackId: spotifyId } : null;
}

export const PLATFORM_LABELS: Record<MusicPlatform, string> = {
  spotify: 'Spotify',
  youtube: 'YouTube',
};

export function parseYoutubePlaylistId(urlOrId: string): string | null {
  const raw = urlOrId.trim();
  const fromUrl = raw.match(/[?&]list=([a-zA-Z0-9_-]+)/)?.[1];
  if (fromUrl) return fromUrl;
  if (/^PL[a-zA-Z0-9_-]+$/.test(raw)) return raw;
  return null;
}

/** Playlist ID from pasted URL, bare PL… id, or null if unrecognizable. */
export function resolveYoutubePlaylistId(urlOrId: string): string | null {
  const raw = urlOrId.trim();
  if (!raw) return null;
  return parseYoutubePlaylistId(raw);
}

export function parseSpotifyPlaylistId(urlOrId: string): string | null {
  const raw = urlOrId.trim();
  const fromUrl =
    raw.match(/spotify\.com\/(?:embed\/|intl-[a-z]{2}\/)?playlist\/([a-zA-Z0-9]+)/)?.[1] ||
    raw.match(/^spotify:playlist:([a-zA-Z0-9]+)$/)?.[1];
  if (fromUrl) return fromUrl;
  if (/^[a-zA-Z0-9]{10,}$/.test(raw) && !raw.startsWith('spotify:track:')) return raw;
  return null;
}

export function buildPlatformTrackUrl(platform: MusicPlatform, trackId: string): string {
  if (platform === 'youtube') {
    return `https://www.youtube.com/watch?v=${trackId}`;
  }
  return `https://open.spotify.com/track/${trackId}`;
}
