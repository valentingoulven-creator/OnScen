import type { UserAlbumItem, UserCompositionItem } from '../components/UserCompositionsSection';

/** Piste audio hébergée sur OnScen (/uploads/compositions/…). */
export const COMPOSITION_AUDIO_URL_RE =
  /^\/uploads\/compositions\/[a-zA-Z0-9._-]+\.(mp3|wav|m4a|ogg|webm|flac)$/i;

export function isCompositionAudioUrl(url: string): boolean {
  return COMPOSITION_AUDIO_URL_RE.test(url.trim());
}

export function resolveCompositionPlaybackUrl(fileUrl: string): string {
  const url = fileUrl.trim();
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  return url;
}

export type ReelAudioSource = 'mic' | 'composition';

export type CompositionPickerGroup = {
  album: UserAlbumItem | null;
  tracks: UserCompositionItem[];
};

/** Morceaux groupés par album (+ morceaux sans album en tête). */
export function groupCompositionsForPicker(
  compositions: UserCompositionItem[],
  albums: UserAlbumItem[]
): CompositionPickerGroup[] {
  const albumById = new Map(albums.map((a) => [a.id, a]));
  const loose: UserCompositionItem[] = [];
  const byAlbum = new Map<string, UserCompositionItem[]>();

  for (const track of compositions) {
    if (track.albumId && albumById.has(track.albumId)) {
      const list = byAlbum.get(track.albumId) ?? [];
      list.push(track);
      byAlbum.set(track.albumId, list);
    } else {
      loose.push(track);
    }
  }

  const groups: CompositionPickerGroup[] = [];
  if (loose.length > 0) {
    groups.push({ album: null, tracks: loose });
  }
  for (const album of albums) {
    const tracks = byAlbum.get(album.id);
    if (tracks?.length) {
      groups.push({ album, tracks });
    }
  }
  return groups;
}
