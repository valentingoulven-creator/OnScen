export interface MusicAlbumItem {
  id: string;
  userId: string;
  creatorName: string;
  creatorAvatarUrl?: string;
  title: string;
  description?: string;
  coverUrl?: string;
  trackCount: number;
  updatedAt: number;
}

export interface MusicTrackItem {
  id: string;
  title: string;
  artist: string;
  albumArtUrl?: string;
  source: 'composition';
  hostId: string;
  creatorName: string;
  albumId?: string;
  albumTitle?: string;
  durationSec?: number;
  upvoteCount?: number;
  userHasUpvoted?: boolean;
  createdAt: number;
}

export interface MusicHomeSection {
  albums: MusicAlbumItem[];
  tracks: MusicTrackItem[];
}

export interface MusicHomePayload {
  discover: MusicHomeSection;
  following: MusicHomeSection;
  library: MusicHomeSection;
  popular: MusicHomeSection;
}

export interface MusicSearchPayload {
  albums: MusicAlbumItem[];
  tracks: MusicTrackItem[];
}
