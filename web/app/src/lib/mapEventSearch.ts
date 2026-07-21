import { hasUpcomingEventDate } from './feedEvents';
import { feedPostFromMapEventMarker } from './mapFeedEvents';
import type { FeedPost, MapEventMarker } from '../types';

export type MapEventSearchEventHit = {
  kind: 'event';
  marker: MapEventMarker;
  post: FeedPost | null;
  title: string;
  organizer: string;
  location: string;
};

export type MapEventSearchOrganizerHit = {
  kind: 'organizer';
  authorId: string;
  authorUsername: string;
  authorAvatarUrl?: string;
  upcomingCount: number;
  events: FeedPost[];
};

export type MapEventSearchHit = MapEventSearchEventHit | MapEventSearchOrganizerHit;

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function markerPost(
  marker: MapEventMarker,
  postsById: ReadonlyMap<string, FeedPost>
): FeedPost | null {
  return postsById.get(marker.id) ?? null;
}

function isUpcomingMarker(
  marker: MapEventMarker,
  postsById: ReadonlyMap<string, FeedPost>
): boolean {
  const post = markerPost(marker, postsById);
  if (post) return hasUpcomingEventDate(post);
  if (!marker.eventDate) return false;
  const start = new Date(marker.eventDate);
  return !Number.isNaN(start.getTime()) && start.getTime() >= Date.now() - 86_400_000;
}

/** Recherche locale événements (titre/lieu) et organisateurs (pseudo) sur les pins carte. */
export function searchMapEventsAndOrganizers(
  query: string,
  markers: MapEventMarker[],
  postsById: ReadonlyMap<string, FeedPost>,
  opts?: { limit?: number }
): { events: MapEventSearchEventHit[]; organizers: MapEventSearchOrganizerHit[] } {
  const q = normalizeSearchText(query);
  if (q.length < 2) return { events: [], organizers: [] };

  const limit = opts?.limit ?? 10;
  const upcoming = markers.filter((m) => isUpcomingMarker(m, postsById));

  const eventHits: MapEventSearchEventHit[] = [];
  const seenEventIds = new Set<string>();

  const organizerBuckets = new Map<
    string,
    { username: string; avatarUrl?: string; events: FeedPost[] }
  >();

  for (const marker of upcoming) {
    const post = markerPost(marker, postsById);
    const title = marker.title.trim() || post?.content.trim() || 'Événement';
    const organizer = marker.authorUsername ?? post?.author.username ?? '';
    const authorId = marker.authorId ?? post?.author.id ?? '';
    const location = marker.eventLocation?.trim() ?? post?.eventLocation?.trim() ?? '';

    if (authorId) {
      const bucket = organizerBuckets.get(authorId) ?? {
        username: organizer || 'Organisateur',
        avatarUrl: marker.authorAvatarUrl ?? post?.author.avatarUrl,
        events: [],
      };
      bucket.events.push(post ?? feedPostFromMapEventMarker(marker, null));
      organizerBuckets.set(authorId, bucket);
    }

    const titleMatch = normalizeSearchText(title).includes(q);
    const locationMatch = location ? normalizeSearchText(location).includes(q) : false;
    if ((titleMatch || locationMatch) && !seenEventIds.has(marker.id)) {
      seenEventIds.add(marker.id);
      eventHits.push({
        kind: 'event',
        marker,
        post,
        title,
        organizer,
        location,
      });
    }
  }

  const organizerHits: MapEventSearchOrganizerHit[] = [];
  for (const [authorId, bucket] of organizerBuckets) {
    if (!normalizeSearchText(bucket.username).includes(q)) continue;
    const events = bucket.events
      .filter(hasUpcomingEventDate)
      .sort(
        (a, b) =>
          new Date(a.eventDate ?? a.eventDates?.[0] ?? 0).getTime() -
          new Date(b.eventDate ?? b.eventDates?.[0] ?? 0).getTime()
      );
    if (events.length === 0) continue;
    organizerHits.push({
      kind: 'organizer',
      authorId,
      authorUsername: bucket.username,
      authorAvatarUrl: bucket.avatarUrl,
      upcomingCount: events.length,
      events,
    });
  }

  organizerHits.sort((a, b) => a.authorUsername.localeCompare(b.authorUsername, 'fr'));
  eventHits.sort((a, b) => a.title.localeCompare(b.title, 'fr'));

  return {
    events: eventHits.slice(0, limit),
    organizers: organizerHits.slice(0, limit),
  };
}
