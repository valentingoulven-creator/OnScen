import type { FeedPost } from '../types';

/** Semaine calendaire lundi 00:00 → dimanche 23:59:59 (locale navigateur). */
export function getCurrentWeekRange(now = new Date()): { start: Date; end: Date } {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function isEventDateInWeek(iso: string, range = getCurrentWeekRange()): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= range.start.getTime() && t <= range.end.getTime();
}

export function formatEventDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function isUpcomingEvent(iso?: string): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() > Date.now();
}

/** Préfixe des publications événement seed (backend seed-feed-events). */
export const SEED_EVENT_POST_ID_PREFIX = 'feed-event-';

export function isUserCreatedEvent(post: Pick<FeedPost, 'id' | 'isEvent'>): boolean {
  return Boolean(post.isEvent) && !post.id.startsWith(SEED_EVENT_POST_ID_PREFIX);
}

export function getUpcomingUserEvents(
  posts: FeedPost[],
  opts?: { limit?: number; favoriteAuthorIds?: Set<string> }
): FeedPost[] {
  const limit = opts?.limit ?? 20;
  const fav = opts?.favoriteAuthorIds;

  return posts
    .filter((p) => isUserCreatedEvent(p) && isUpcomingEvent(p.eventDate))
    .sort((a, b) => {
      if (fav?.size) {
        const aFollowed = fav.has(a.author.id) ? 0 : 1;
        const bFollowed = fav.has(b.author.id) ? 0 : 1;
        if (aFollowed !== bFollowed) return aFollowed - bFollowed;
      }
      return new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime();
    })
    .slice(0, limit);
}

/** Date courte pour overlay hero (ex. « sam. 7 juin »). */
export function formatEventDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

export type EventHeroVisual =
  | { type: 'image'; url: string }
  | { type: 'gradient'; gradient: string; emoji: string };

/** Image hero : imageUrl du post, sinon Unsplash par ville/type, sinon dégradé + emoji. */
export function resolveEventHeroVisual(
  post: Pick<FeedPost, 'imageUrl' | 'eventLocation' | 'content'>
): EventHeroVisual {
  if (post.imageUrl?.trim()) {
    return { type: 'image', url: post.imageUrl.trim() };
  }

  const loc = (post.eventLocation ?? '').toLowerCase();
  const content = (post.content ?? '').toLowerCase();

  if (loc.includes('paris')) {
    return { type: 'image', url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80' };
  }
  if (loc.includes('montpellier')) {
    return { type: 'image', url: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800&q=80' };
  }
  if (content.includes('festival') || loc.includes('festival') || loc.includes('bois de vincennes')) {
    return { type: 'image', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80' };
  }
  if (content.includes('rock') || content.includes('guns')) {
    return { type: 'gradient', gradient: 'from-rose-900 via-red-950 to-orange-950', emoji: '🎸' };
  }
  if (content.includes('hip-hop') || content.includes('rap') || content.includes('xzibit')) {
    return { type: 'gradient', gradient: 'from-amber-900 via-yellow-950 to-orange-950', emoji: '🎤' };
  }
  if (
    content.includes('mozart') ||
    content.includes('classique') ||
    content.includes('violon') ||
    content.includes('opéra')
  ) {
    return { type: 'gradient', gradient: 'from-indigo-900 via-purple-900 to-slate-900', emoji: '🎻' };
  }
  if (
    content.includes('électro') ||
    content.includes('electro') ||
    content.includes('house') ||
    content.includes('dj')
  ) {
    return { type: 'gradient', gradient: 'from-cyan-900 via-blue-950 to-purple-950', emoji: '🎧' };
  }

  return { type: 'gradient', gradient: 'from-violet-900 via-purple-950 to-fuchsia-950', emoji: '🎵' };
}

export function formatWeekRangeLabel(range = getCurrentWeekRange()): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  const startStr = range.start.toLocaleDateString('fr-FR', opts);
  const endStr = range.end.toLocaleDateString('fr-FR', {
    ...opts,
    year: range.end.getFullYear() !== range.start.getFullYear() ? 'numeric' : undefined,
  });
  return `${startStr} – ${endStr}`;
}
