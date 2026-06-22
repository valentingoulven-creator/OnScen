export interface MusicTrackItem {
  id: string;
  title: string;
  artist: string;
  albumArtUrl?: string;
  platform?: 'youtube' | 'spotify';
  trackId?: string;
  source: 'catalog' | 'composition' | 'live' | 'salon';
  liveId?: string;
  salonId?: string;
  hostId?: string;
  distanceKm?: number;
  score?: number;
  upvoteCount?: number;
  userHasUpvoted?: boolean;
}

export interface MusicLiveItem {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  title: string;
  viewersCount: number;
  distanceKm?: number;
  albumArtUrl?: string;
  trackTitle?: string;
  trackArtist?: string;
}

export interface MusicSalonItem {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  title: string;
  listenersCount: number;
  distanceKm?: number;
  albumArtUrl?: string;
  trackTitle?: string;
  trackArtist?: string;
}

export interface MusicArtistItem {
  id: string;
  name: string;
  avatarUrl?: string;
  isLive?: boolean;
  liveId?: string;
  score?: number;
}

export interface MusicHomePayload {
  geoLabel: string;
  nearby: {
    lives: MusicLiveItem[];
    salons: MusicSalonItem[];
    tracks: MusicTrackItem[];
    artists: MusicArtistItem[];
  };
  likes: {
    tracks: MusicTrackItem[];
    artists: MusicArtistItem[];
  };
  suggestions: {
    tracks: MusicTrackItem[];
    lives: MusicLiveItem[];
    artists: MusicArtistItem[];
  };
  newReleases: MusicTrackItem[];
  charts: {
    mostLiked: MusicTrackItem[];
    mostPlayed: MusicTrackItem[];
    trending: MusicTrackItem[];
  };
}

export type MusicSearchHit =
  | {
      kind: 'youtube';
      id: string;
      title: string;
      artist: string;
      albumArtUrl?: string;
      externalUrl: string;
    }
  | {
      kind: 'spotify';
      id: string;
      title: string;
      artist: string;
      albumArtUrl?: string;
      externalUrl: string;
    };
