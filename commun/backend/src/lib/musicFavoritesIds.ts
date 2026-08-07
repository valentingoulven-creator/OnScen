/** Id album playlist « Mes favoris » — un par utilisateur. */
export function favoritesAlbumId(userId: string): string {
  return `album-favorites-${userId}`;
}

export function isFavoritesAlbumId(albumId: string, userId: string): boolean {
  return albumId === favoritesAlbumId(userId);
}
