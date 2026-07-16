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
  weeklyPlayCount?: number;
  createdAt: number;
}

export interface MusicWeeklyReelItem {
  id: string;
  title: string;
  artist: string;
  posterUrl: string;
  authorId: string;
  creatorName: string;
  creatorAvatarUrl?: string;
  weeklyUpvoteCount: number;
  durationSec?: number;
}

export interface MusicHomeSection {
  albums: MusicAlbumItem[];
  tracks: MusicTrackItem[];
}

export interface MusicHomeWeeklySection extends MusicHomeSection {
  weekStart: number;
  reels: MusicWeeklyReelItem[];
}

export interface MusicHomePayload {
  discover: MusicHomeSection;
  following: MusicHomeSection;
  library: MusicHomeSection;
  popular: MusicHomeSection;
  weeklyTrend: MusicHomeWeeklySection;
}

export interface MusicSearchPayload {
  albums: MusicAlbumItem[];
  tracks: MusicTrackItem[];
}
