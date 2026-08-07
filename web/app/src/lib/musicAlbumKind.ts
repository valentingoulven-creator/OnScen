import type { MusicAlbumItem } from './musicTypes';

export const FAVORITES_ALBUM_TITLE = 'Mes favoris';

export function favoritesAlbumId(userId: string): string {
  return `album-favorites-${userId}`;
}

/** Playlist perso (ex. Mes favoris) — distincte de la discographie / albums publiés. */
export function isUserPlaylistAlbum(album: MusicAlbumItem, viewerUserId?: string | null): boolean {
  if (!viewerUserId || album.userId !== viewerUserId) return false;
  return album.id === favoritesAlbumId(viewerUserId) || album.title === FAVORITES_ALBUM_TITLE;
}

export function partitionLibraryAlbums(
  albums: MusicAlbumItem[],
  viewerUserId?: string | null
): { playlists: MusicAlbumItem[]; discographyAlbums: MusicAlbumItem[] } {
  const playlists: MusicAlbumItem[] = [];
  const discographyAlbums: MusicAlbumItem[] = [];
  for (const album of albums) {
    if (isUserPlaylistAlbum(album, viewerUserId)) playlists.push(album);
    else discographyAlbums.push(album);
  }
  return { playlists, discographyAlbums };
}
