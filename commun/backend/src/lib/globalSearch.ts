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

function queryMatchesAnyText(q: string, ...texts: (string | undefined)[]): boolean {
  return texts.some((text) => {
    const hay = normalizeGlobalSearchQuery(text ?? '');
    return hay.length > 0 && hay.includes(q);
  });
}

function bestSearchRank(q: string, ...texts: (string | undefined)[]): number {
  const ranks = texts
    .map((text) => searchRank(text ?? '', q))
    .filter((rank) => rank < 99);
  return ranks.length > 0 ? Math.min(...ranks) : 99;
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

  type RankedUser = { rank: number; hit: GlobalSearchUserHit };
  const userCandidates: RankedUser[] = [];
  const seenUserIds = new Set<string>();

  const pushUserHit = (userId: string, rankTexts: (string | undefined)[]) => {
    if (userId === viewerId || seenUserIds.has(userId)) return;
    const u = db.users.get(userId);
    if (!u || u.isGhostMode) return;
    seenUserIds.add(userId);
    const salon = getActiveSalonForHost(u.id);
    const live = isUserHostingLive(u.id);
    userCandidates.push({
      rank: bestSearchRank(q, ...rankTexts, u.username, u.city),
      hit: {
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
    });
  };

  for (const row of searchUsernamesInIndex(viewerId, q, PER_SECTION * 3)) {
    pushUserHit(row.id, [row.username]);
  }

  const users: GlobalSearchUserHit[] = userCandidates
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.hit.username.localeCompare(b.hit.username, 'fr');
    })
    .slice(0, PER_SECTION)
    .map((row) => row.hit);

  const events: GlobalSearchEventHit[] = [...db.feedPosts.values()]
    .filter((p) => {
      if (!p.isEvent || p.adminBlocked || !hasUpcomingEventDate(p)) return false;
      const authorUsername = usernameForUserId(p.userId);
      if (queryMatchesAnyText(q, p.content, p.eventLocation, authorUsername)) return true;
      for (const tagId of p.eventTaggedUserIds ?? []) {
        const tagged = db.users.get(tagId);
        if (tagged && queryMatchesAnyText(q, tagged.username)) return true;
      }
      return false;
    })
    .sort((a, b) => {
      const ra = bestSearchRank(q, a.content, a.eventLocation, usernameForUserId(a.userId));
      const rb = bestSearchRank(q, b.content, b.eventLocation, usernameForUserId(b.userId));
      if (ra !== rb) return ra - rb;
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
    .filter((a) => {
      const authorUsername = usernameForUserId(a.userId);
      return queryMatchesAnyText(q, a.title, a.description, authorUsername);
    })
    .sort(
      (a, b) =>
        bestSearchRank(q, a.title, a.description, usernameForUserId(a.userId)) -
          bestSearchRank(q, b.title, b.description, usernameForUserId(b.userId)) ||
        b.updatedAt - a.updatedAt
    )
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
      const authorUsername = usernameForUserId(c.userId);
      const album = c.albumId
        ? db.albums.find((a) => a.id === c.albumId && a.userId === c.userId)
        : undefined;
      return queryMatchesAnyText(q, c.title, c.artist, authorUsername, album?.title);
    })
    .sort(
      (a, b) => {
        const albumA = a.albumId
          ? db.albums.find((x) => x.id === a.albumId && x.userId === a.userId)
          : undefined;
        const albumB = b.albumId
          ? db.albums.find((x) => x.id === b.albumId && x.userId === b.userId)
          : undefined;
        const ra = bestSearchRank(
          q,
          a.title,
          a.artist,
          usernameForUserId(a.userId),
          albumA?.title
        );
        const rb = bestSearchRank(
          q,
          b.title,
          b.artist,
          usernameForUserId(b.userId),
          albumB?.title
        );
        if (ra !== rb) return ra - rb;
        return b.createdAt - a.createdAt;
      }
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