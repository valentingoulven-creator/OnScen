import { db } from '../models/schema';
import { searchUsernamesInIndex } from './globalSearchIndex';
import { getActiveSalonForHost, publicProfile } from './profile';
import { isSalonPublic } from './salonAccess';
import {
  getActiveLiveIdForHost,
  getLiveViewersCountForHost,
  isUserHostingLive,
} from './liveStatus';

function getPrimaryEventDate(post: { eventDate?: string; eventDates?: string[] }): string | undefined {
  if (post.eventDates?.length) return post.eventDates[0];
  return post.eventDate;
}

function hasUpcomingEventDate(post: { eventDate?: string; eventDates?: string[] }): boolean {
  const dates = post.eventDates?.length ? post.eventDates : post.eventDate ? [post.eventDate] : [];
  if (dates.length === 0) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dates.some((d) => {
    const t = new Date(d).getTime();
    return Number.isFinite(t) && t >= today.getTime();
  });
}

export function normalizeGlobalSearchQuery(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function searchRank(text: string, q: string): number {
  const hay = normalizeGlobalSearchQuery(text);
  if (hay === q) return 0;
  if (hay.startsWith(q)) return 1;
  if (hay.includes(q)) return 2;
  return 99;
}

function usernameForUserId(userId: string): string {
  return db.users.get(userId)?.username ?? 'Utilisateur';
}

export interface GlobalSearchUserHit {
  kind: 'user';
  id: string;
  username: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
  avatarUrl?: string;
  city?: string;
  listeningRole?: string;
  isLive?: boolean;
  liveId?: string;
  liveViewersCount?: number;
  salonId?: string;
  salonTitle?: string;
}

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

export type GlobalSearchHit =
  | GlobalSearchUserHit
  | GlobalSearchEventHit
  | GlobalSearchAlbumHit
  | GlobalSearchSongHit;

export interface GlobalSearchResult {
  users: GlobalSearchUserHit[];
  events: GlobalSearchEventHit[];
  albums: GlobalSearchAlbumHit[];
  songs: GlobalSearchSongHit[];
}

const PER_SECTION = 6;

export function globalSearch(viewerId: string, rawQuery: string): GlobalSearchResult {
  const q = normalizeGlobalSearchQuery(rawQuery);
  if (q.length < 2) {
    return { users: [], events: [], albums: [], songs: [] };
  }

  const indexedHits = searchUsernamesInIndex(viewerId, q, PER_SECTION);
  const users: GlobalSearchUserHit[] = indexedHits
    .sort((a, b) => {
      const ra = searchRank(a.username, q);
      const rb = searchRank(b.username, q);
      if (ra !== rb) return ra - rb;
      return a.username.localeCompare(b.username, 'fr');
    })
    .flatMap((row) => {
      const u = db.users.get(row.id);
      if (!u) return [];
      const salon = getActiveSalonForHost(u.id);
      const live = isUserHostingLive(u.id);
      return [
        {
          kind: 'user' as const,
          id: u.id,
          username: u.username,
          usernameColor: u.usernameColor,
          usernameWaveFrom: u.usernameWaveFrom,
          usernameWaveTo: u.usernameWaveTo,
          avatarUrl: u.avatarUrl,
          city: u.city || undefined,
          listeningRole: u.listeningRole,
          isLive: live,
          liveId: live ? getActiveLiveIdForHost(u.id) : undefined,
          liveViewersCount: live ? getLiveViewersCountForHost(u.id) : undefined,
          salonId: salon && isSalonPublic(salon) ? salon.id : undefined,
          salonTitle:
            salon && isSalonPublic(salon)
              ? salon.title || salon.playbackState?.title || undefined
              : undefined,
        },
      ];
    });

  const events: GlobalSearchEventHit[] = [...db.feedPosts.values()]
    .filter(
      (p) =>
        p.isEvent &&
        hasUpcomingEventDate(p) &&
        (normalizeGlobalSearchQuery(p.content).includes(q) ||
          normalizeGlobalSearchQuery(p.eventLocation ?? '').includes(q))
    )
    .sort((a, b) => {
      const ta = getPrimaryEventDate(a) ?? '';
      const tb = getPrimaryEventDate(b) ?? '';
      return ta.localeCompare(tb);
    })
    .slice(0, PER_SECTION)
    .map((p) => ({
      kind: 'event' as const,
      id: p.id,
      title: p.content.trim() || 'Événement',
      eventLocation: p.eventLocation,
      eventDate: getPrimaryEventDate(p),
      authorId: p.userId,
      authorUsername: usernameForUserId(p.userId),
    }));

  const albums: GlobalSearchAlbumHit[] = db.albums
    .filter((a) => normalizeGlobalSearchQuery(a.title).includes(q))
    .sort((a, b) => searchRank(a.title, q) - searchRank(b.title, q) || b.updatedAt - a.updatedAt)
    .slice(0, PER_SECTION)
    .map((a) => ({
      kind: 'album' as const,
      id: a.id,
      userId: a.userId,
      title: a.title,
      authorUsername: usernameForUserId(a.userId),
      coverUrl: a.coverUrl,
    }));

  const songs: GlobalSearchSongHit[] = db.compositions
    .filter((c) => {
      const title = normalizeGlobalSearchQuery(c.title);
      const artist = normalizeGlobalSearchQuery(c.artist ?? '');
      return title.includes(q) || (artist && artist.includes(q));
    })
    .sort(
      (a, b) =>
        searchRank(a.title, q) - searchRank(b.title, q) || b.createdAt - a.createdAt
    )
    .slice(0, PER_SECTION)
    .map((c) => ({
      kind: 'song' as const,
      id: c.id,
      userId: c.userId,
      title: c.title,
      artist: c.artist,
      authorUsername: usernameForUserId(c.userId),
      albumId: c.albumId,
    }));

  return { users, events, albums, songs };
}
/** Expose public profile helper for tests. */
export function globalSearchPublicUser(userId: string) {
  const u = db.users.get(userId);
  return u ? publicProfile(u, false) : null;
}