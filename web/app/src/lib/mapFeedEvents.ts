import { api } from './api';
import { hasUpcomingEventDate, getPrimaryEventDate } from './feedEvents';
import {
  resolveManyEventCoordsRemaining,
  resolveManyEventCoordsSync,
} from './mapEventCoords';
import { isValidLatLng } from './mapCoords';
import type { FeedPost, MapEventMarker } from '../types';

/** Posts événement avec lieu et date encore à venir (carte / sidebar). */
export function filterPostsForMapEvents(posts: FeedPost[]): FeedPost[] {
  return posts.filter(
    (p) =>
      p.isEvent &&
      getPrimaryEventDate(p) &&
      p.eventLocation?.trim() &&
      hasUpcomingEventDate(p)
  );
}

function postToMapEventMarker(
  post: FeedPost,
  coords: { latitude: number; longitude: number }
): MapEventMarker {
  return {
    id: post.id,
    latitude: coords.latitude,
    longitude: coords.longitude,
    title: post.content.trim() || 'Événement',
    eventDate: getPrimaryEventDate(post),
    eventDates: post.eventDates,
    eventEndTimes: post.eventEndTimes,
    eventLocation: post.eventLocation,
    eventType: post.eventType,
    authorId: post.author.id,
    authorUsername: post.author.username,
    authorAvatarUrl: post.author.avatarUrl,
    authorUsernameColor: post.author.usernameColor,
    authorUsernameWaveFrom: post.author.usernameWaveFrom,
    authorUsernameWaveTo: post.author.usernameWaveTo,
    ...(post.eventTaggedUsers?.length ? { eventTaggedUsers: post.eventTaggedUsers } : {}),
  };
}

/** Applique l'état favori enregistré (publication) si connu côté client. */
export function applySavedEventFavoriteState(
  post: FeedPost,
  savedEventPostIds?: ReadonlySet<string>
): FeedPost {
  if (!savedEventPostIds?.size || post.favoriteByMe) return post;
  return savedEventPostIds.has(post.id) ? { ...post, favoriteByMe: true } : post;
}

/** Reconstruit un FeedPost minimal depuis un marqueur carte (fallback sans cache). */
export function feedPostFromMapEventMarker(
  marker: MapEventMarker,
  cached?: FeedPost | null,
  savedEventPostIds?: ReadonlySet<string>
): FeedPost {
  if (cached) return applySavedEventFavoriteState(cached, savedEventPostIds);
  return applySavedEventFavoriteState(
    {
      id: marker.id,
      userId: marker.authorId ?? '',
      content: marker.title,
      createdAt: 0,
      author: {
        id: marker.authorId ?? '',
        username: marker.authorUsername ?? 'Utilisateur',
        avatarUrl: marker.authorAvatarUrl,
        usernameColor: marker.authorUsernameColor,
        usernameWaveFrom: marker.authorUsernameWaveFrom,
        usernameWaveTo: marker.authorUsernameWaveTo,
      },
      likeCount: 0,
      likedByMe: false,
      commentCount: 0,
      favoriteByMe: false,
      recentComments: [],
      isEvent: true,
      eventDate: marker.eventDate,
      eventDates: marker.eventDates,
      eventEndTimes: marker.eventEndTimes,
      eventLocation: marker.eventLocation,
      eventType: marker.eventType,
      ...(marker.eventTaggedUsers?.length ? { eventTaggedUsers: marker.eventTaggedUsers } : {}),
    },
    savedEventPostIds
  );
}

export function buildMapEventPostsById(posts: FeedPost[]): Map<string, FeedPost> {
  return new Map(filterPostsForMapEvents(posts).map((p) => [p.id, p]));
}

function markersFromPostsAndCoords(
  posts: FeedPost[],
  coordsByLocation: ReadonlyMap<string, { latitude: number; longitude: number }>,
  signal?: { cancelled: boolean }
): MapEventMarker[] {
  const markers: MapEventMarker[] = [];
  for (const post of posts) {
    if (signal?.cancelled) return markers;
    const location = post.eventLocation!.trim();
    const coords = coordsByLocation.get(location);
    if (!coords || !isValidLatLng(coords.latitude, coords.longitude)) continue;
    markers.push(postToMapEventMarker(post, coords));
  }
  return markers;
}

/** Convertit des publications événement en marqueurs carte (géocodage async). */
export async function buildMapEventMarkersFromPosts(
  posts: FeedPost[],
  opts?: {
    signal?: { cancelled: boolean };
    /** Marqueurs résolus sans réseau — affichage immédiat sur la carte. */
    onProgress?: (markers: MapEventMarker[]) => void;
  }
): Promise<MapEventMarker[]> {
  const eligible = filterPostsForMapEvents(posts);
  if (eligible.length === 0) return [];

  const locations = eligible.map((p) => p.eventLocation!.trim());
  const syncCoords = resolveManyEventCoordsSync(locations);
  const syncMarkers = markersFromPostsAndCoords(eligible, syncCoords, opts?.signal);
  if (syncMarkers.length > 0) opts?.onProgress?.(syncMarkers);

  const allCoords = await resolveManyEventCoordsRemaining(locations, syncCoords, opts);
  const finalMarkers = markersFromPostsAndCoords(eligible, allCoords, opts?.signal);
  if (finalMarkers.length !== syncMarkers.length) {
    opts?.onProgress?.(finalMarkers);
  }
  return finalMarkers;
}

/** Charge les marqueurs événement depuis l'API feed (eventsOnly). */
export async function loadMapEventMarkers(
  token: string,
  opts?: {
    signal?: { cancelled: boolean };
    onProgress?: (markers: MapEventMarker[]) => void;
  }
): Promise<{ markers: MapEventMarker[]; postsById: Map<string, FeedPost> }> {
  const res = await api.getFeedPosts(token, {
    eventsOnly: true,
  });
  if (opts?.signal?.cancelled) return { markers: [], postsById: new Map() };
  const postsById = buildMapEventPostsById(res.posts);
  const markers = await buildMapEventMarkersFromPosts(res.posts, opts);
  return { markers, postsById };
}
