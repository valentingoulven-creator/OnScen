import { db, type Live, type Salon, type UserComposition } from '../models/schema';
import { getDistanceKm } from './geo';
import { getFollowingIds } from './follows';
import { getCompositionUpvoteCount, userHasCompositionUpvote } from './compositionUpvotes';
import { MUSIC_CATALOG } from './musicCatalog';
import { resolveNearbyRadiusKm } from './geoLimits';

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

function trackKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

function trackFromPlayback(
  ps: Live['playbackState'] | Salon['playbackState'] | undefined,
  ctx: {
    source: 'live' | 'salon';
    liveId?: string;
    salonId?: string;
    hostId?: string;
    distanceKm?: number;
    score?: number;
  }
): MusicTrackItem | null {
  if (!ps?.title?.trim()) return null;
  const title = ps.title.trim();
  const artist = (ps.artist ?? '').trim() || 'Artiste inconnu';
  return {
    id: `playback:${trackKey(title, artist)}`,
    title,
    artist,
    albumArtUrl: ps.albumArtUrl,
    platform: ps.platform,
    trackId: ps.trackId,
    source: ctx.source,
    liveId: ctx.liveId,
    salonId: ctx.salonId,
    hostId: ctx.hostId,
    distanceKm: ctx.distanceKm,
    score: ctx.score,
  };
}

function catalogTrack(entry: (typeof MUSIC_CATALOG)[number], index: number): MusicTrackItem {
  const trackId = entry.youtube?.trackId ?? entry.spotify?.trackId;
  const platform = entry.youtube ? 'youtube' : entry.spotify ? 'spotify' : undefined;
  const albumArtUrl =
    entry.youtube?.trackId != null
      ? `https://i.ytimg.com/vi/${entry.youtube.trackId}/hqdefault.jpg`
      : undefined;
  return {
    id: `catalog:${index}:${trackKey(entry.title, entry.artist)}`,
    title: entry.title,
    artist: entry.artist,
    albumArtUrl,
    platform,
    trackId,
    source: 'catalog',
  };
}

function compositionTrack(c: UserComposition, viewerId: string): MusicTrackItem {
  return {
    id: `composition:${c.id}`,
    title: c.title,
    artist: c.artist ?? 'Artiste',
    source: 'composition',
    hostId: c.userId,
    upvoteCount: getCompositionUpvoteCount(c.id),
    userHasUpvoted: userHasCompositionUpvote(c.id, viewerId),
  };
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function artistMatchesFavorites(artist: string, favorites: string[]): boolean {
  const a = normalize(artist);
  return favorites.some((f) => a.includes(normalize(f)) || normalize(f).includes(a));
}

function dedupeTracks(tracks: MusicTrackItem[], limit: number): MusicTrackItem[] {
  const seen = new Set<string>();
  const out: MusicTrackItem[] = [];
  for (const t of tracks) {
    const key = trackKey(t.title, t.artist);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

function liveItem(l: Live, lat: number, lon: number): MusicLiveItem {
  const host = db.users.get(l.hostId);
  const distanceKm = getDistanceKm(lat, lon, l.latitude, l.longitude);
  return {
    id: l.id,
    hostId: l.hostId,
    hostName: l.hostName,
    hostAvatarUrl: host?.avatarUrl,
    title: l.title,
    viewersCount: l.viewersCount ?? 0,
    distanceKm,
    albumArtUrl: l.playbackState?.albumArtUrl,
    trackTitle: l.playbackState?.title,
    trackArtist: l.playbackState?.artist,
  };
}

function salonItem(s: Salon, lat: number, lon: number): MusicSalonItem {
  const host = db.users.get(s.hostId);
  const distanceKm = getDistanceKm(lat, lon, s.latitude, s.longitude);
  return {
    id: s.id,
    hostId: s.hostId,
    hostName: s.hostName,
    hostAvatarUrl: host?.avatarUrl,
    title: s.title,
    listenersCount: s.listenersCount ?? 0,
    distanceKm,
    albumArtUrl: s.playbackState?.albumArtUrl,
    trackTitle: s.playbackState?.title,
    trackArtist: s.playbackState?.artist,
  };
}

function artistFromHost(hostId: string, score: number, liveId?: string): MusicArtistItem | null {
  const host = db.users.get(hostId);
  if (!host) return null;
  return {
    id: host.id,
    name: host.username,
    avatarUrl: host.avatarUrl,
    isLive: Boolean(liveId),
    liveId,
    score,
  };
}

export function buildMusicHome(
  viewerId: string,
  lat: number,
  lon: number,
  radiusKmRaw: number,
  geoLabel: string
): MusicHomePayload {
  const maxRadius = resolveNearbyRadiusKm(radiusKmRaw, true) ?? radiusKmRaw;
  const within = (d: number) => d <= maxRadius;

  const viewer = db.users.get(viewerId);
  const favoriteArtists = viewer?.favoriteArtists ?? [];
  const following = new Set(getFollowingIds(viewerId));

  const activeLives = [...db.lives.values()].filter((l) => l.isActive);
  const nearbyLives = activeLives
    .map((l) => ({ live: l, distanceKm: getDistanceKm(lat, lon, l.latitude, l.longitude) }))
    .filter(({ distanceKm }) => within(distanceKm))
    .sort((a, b) => b.live.viewersCount - a.live.viewersCount || a.distanceKm - b.distanceKm);

  const nearbySalons = [...db.salons.values()]
    .map((s) => ({ salon: s, distanceKm: getDistanceKm(lat, lon, s.latitude, s.longitude) }))
    .filter(({ distanceKm }) => within(distanceKm))
    .sort((a, b) => (b.salon.listenersCount ?? 0) - (a.salon.listenersCount ?? 0) || a.distanceKm - b.distanceKm);

  const nearbyLiveItems = nearbyLives.slice(0, 8).map(({ live, distanceKm }) => liveItem(live, lat, lon));
  const nearbySalonItems = nearbySalons.slice(0, 8).map(({ salon }) => salonItem(salon, lat, lon));

  const nearbyTracks = dedupeTracks(
    [
      ...nearbyLives.map(({ live, distanceKm }) =>
        trackFromPlayback(live.playbackState, {
          source: 'live',
          liveId: live.id,
          hostId: live.hostId,
          distanceKm,
          score: live.viewersCount,
        })
      ),
      ...nearbySalons.map(({ salon, distanceKm }) =>
        trackFromPlayback(salon.playbackState, {
          source: 'salon',
          salonId: salon.id,
          hostId: salon.hostId,
          distanceKm,
          score: salon.listenersCount ?? 0,
        })
      ),
    ].filter((t): t is MusicTrackItem => t != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    12
  );

  const artistScore = new Map<string, { score: number; liveId?: string }>();
  for (const { live, distanceKm } of nearbyLives) {
    const boost = live.viewersCount + Math.max(0, 20 - distanceKm);
    const prev = artistScore.get(live.hostId);
    artistScore.set(live.hostId, {
      score: (prev?.score ?? 0) + boost,
      liveId: live.id,
    });
  }
  for (const { salon, distanceKm } of nearbySalons) {
    const boost = (salon.listenersCount ?? 0) + Math.max(0, 15 - distanceKm);
    const prev = artistScore.get(salon.hostId);
    artistScore.set(salon.hostId, {
      score: (prev?.score ?? 0) + boost,
      liveId: prev?.liveId,
    });
  }
  const nearbyArtists = [...artistScore.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 10)
    .map(([hostId, meta]) => artistFromHost(hostId, meta.score, meta.liveId))
    .filter((a): a is MusicArtistItem => a != null);

  const likedCompositions = db.compositions
    .filter((c) => userHasCompositionUpvote(c.id, viewerId))
    .map((c) => compositionTrack(c, viewerId));

  const likedArtistItems: MusicArtistItem[] = favoriteArtists.slice(0, 10).map((name, i) => ({
    id: `favorite:${i}:${normalize(name)}`,
    name,
  }));

  const likedTracks = dedupeTracks(likedCompositions, 12);

  const catalogAll = MUSIC_CATALOG.map((e, i) => catalogTrack(e, i));
  const suggestedCatalog = catalogAll.filter((t) => artistMatchesFavorites(t.artist, favoriteArtists));
  const suggestedFollowingLives = activeLives
    .filter((l) => following.has(l.hostId))
    .sort((a, b) => b.viewersCount - a.viewersCount)
    .slice(0, 6)
    .map((l) => liveItem(l, lat, lon));

  const suggestedArtists = [...following]
    .map((id) => {
      const live = activeLives.find((l) => l.hostId === id);
      return artistFromHost(id, live?.viewersCount ?? 1, live?.id);
    })
    .filter((a): a is MusicArtistItem => a != null)
    .slice(0, 8);

  const suggestionTracks = dedupeTracks(
    [
      ...suggestedCatalog,
      ...suggestedFollowingLives
        .map((l) =>
          trackFromPlayback(
            {
              platform: 'youtube',
              trackId: '',
              title: l.trackTitle ?? l.title,
              artist: l.trackArtist ?? l.hostName,
              albumArtUrl: l.albumArtUrl,
              isPlaying: true,
              progressMs: 0,
              updatedAt: Date.now(),
            },
            { source: 'live', liveId: l.id, hostId: l.hostId, score: l.viewersCount }
          )
        )
        .filter((t): t is MusicTrackItem => t != null),
      ...catalogAll.slice(0, 4),
    ],
    12
  );

  const newReleases = [...catalogAll].reverse().slice(0, 10);

  const compositionCharts = db.compositions
    .map((c) => compositionTrack(c, viewerId))
    .sort((a, b) => (b.upvoteCount ?? 0) - (a.upvoteCount ?? 0))
    .slice(0, 10);

  const playedTracks = dedupeTracks(
    [
      ...activeLives.map((l) =>
        trackFromPlayback(l.playbackState, {
          source: 'live',
          liveId: l.id,
          hostId: l.hostId,
          score: l.viewersCount,
        })
      ),
      ...[...db.salons.values()].map((s) =>
        trackFromPlayback(s.playbackState, {
          source: 'salon',
          salonId: s.id,
          hostId: s.hostId,
          score: s.listenersCount ?? 0,
        })
      ),
    ]
      .filter((t): t is MusicTrackItem => t != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    10
  );

  const trendingTracks = dedupeTracks(
    [...playedTracks.map((t) => ({ ...t, score: (t.score ?? 0) * 2 })), ...compositionCharts].sort(
      (a, b) => (b.score ?? b.upvoteCount ?? 0) - (a.score ?? a.upvoteCount ?? 0)
    ),
    10
  );

  return {
    geoLabel,
    nearby: {
      lives: nearbyLiveItems,
      salons: nearbySalonItems,
      tracks: nearbyTracks,
      artists: nearbyArtists,
    },
    likes: {
      tracks: likedTracks,
      artists: likedArtistItems,
    },
    suggestions: {
      tracks: suggestionTracks,
      lives: suggestedFollowingLives,
      artists: suggestedArtists,
    },
    newReleases,
    charts: {
      mostLiked: compositionCharts,
      mostPlayed: playedTracks,
      trending: trendingTracks,
    },
  };
}
