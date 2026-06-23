export interface GlobalSearchEventHit {
  kind: 'event';
  id: string;
  title: string;
  eventLocation?: string;
  eventDate?: string;
  authorId: string;
  authorUsername: string;
}

export interface GlobalSearchAlbumHit {
  kind: 'album';
  id: string;
  userId: string;
  title: string;
  authorUsername: string;
  coverUrl?: string;
}

export interface GlobalSearchSongHit {
  kind: 'song';
  id: string;
  userId: string;
  title: string;
  artist?: string;
  authorUsername: string;
  albumId?: string;
}

export interface GlobalSearchApiResult {
  users: import('../types').UserSearchHit[];
  events: GlobalSearchEventHit[];
  albums: GlobalSearchAlbumHit[];
  songs: GlobalSearchSongHit[];
}
