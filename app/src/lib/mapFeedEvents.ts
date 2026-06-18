import { api } from './api';
import { isUpcomingEvent } from './feedEvents';
import { resolveEventCoords } from './mapEventCoords';
import { isValidLatLng } from './mapCoords';
import type { FeedPost, MapEventMarker } from '../types';

/** Posts événement avec lieu et date encore à venir (carte / sidebar). */
export function filterPostsForMapEvents(posts: FeedPost[]): FeedPost[] {
  return posts.filter(
    (p) =>
      p.isEvent &&
      p.eventDate &&
      p.eventLocation?.trim() &&
      isUpcomingEvent(p.eventDate)
  );
}

/** Convertit des publications événement en marqueurs carte (géocodage async). */
export async function buildMapEventMarkersFromPosts(
  posts: FeedPost[],
  opts?: { signal?: { cancelled: boolean } }
): Promise<MapEventMarker[]> {
  const markers: MapEventMarker[] = [];

  for (const post of filterPostsForMapEvents(posts)) {
    if (opts?.signal?.cancelled) return markers;

    const location = post.eventLocation!.trim();
    const coords = await resolveEventCoords(location);
    if (!coords || !isValidLatLng(coords.latitude, coords.longitude)) continue;

    markers.push({
      id: post.id,
      latitude: coords.latitude,
      longitude: coords.longitude,
      title: post.content.trim() || 'Événement',
      eventDate: post.eventDate,
      eventLocation: post.eventLocation,
      eventType: post.eventType,
      authorId: post.author.id,
      authorUsername: post.author.username,
      authorAvatarUrl: post.author.avatarUrl,
      authorUsernameColor: post.author.usernameColor,
      authorUsernameWaveFrom: post.author.usernameWaveFrom,
      authorUsernameWaveTo: post.author.usernameWaveTo,
    });
  }

  return markers;
}

/** Charge les marqueurs événement depuis l'API feed (eventsOnly). */
export async function loadMapEventMarkers(
  token: string,
  opts?: { signal?: { cancelled: boolean } }
): Promise<MapEventMarker[]> {
  const res = await api.getFeedPosts(token, {
    eventsOnly: true,
  });
  if (opts?.signal?.cancelled) return [];
  return buildMapEventMarkersFromPosts(res.posts, opts);
}
