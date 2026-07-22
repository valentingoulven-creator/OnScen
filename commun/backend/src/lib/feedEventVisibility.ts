import type { FeedPost } from '../models/schema';

function getEventDatesFromPost(post: Pick<FeedPost, 'eventDate' | 'eventDates'>): string[] {
  if (post.eventDates?.length) {
    return [...post.eventDates].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
  }
  if (post.eventDate?.trim()) return [post.eventDate.trim()];
  return [];
}

function startOfLocalCalendarDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Événement entièrement passé (strictement avant aujourd'hui, jour calendaire). */
export function isFeedEventPastForMapDisplay(
  post: Pick<FeedPost, 'eventDate' | 'eventDates'>,
  at = Date.now()
): boolean {
  const dates = getEventDatesFromPost(post);
  if (dates.length === 0) return true;
  const todayStart = startOfLocalCalendarDay(at);
  return dates.every((iso) => {
    const t = new Date(iso).getTime();
    return !Number.isFinite(t) || t < todayStart;
  });
}

/** Publication encore pertinente pour Sponso (sidebar + pins carte). */
export function isFeedEventVisibleForMapSponso(
  post: Pick<FeedPost, 'eventDate' | 'eventDates'>,
  at = Date.now()
): boolean {
  return !isFeedEventPastForMapDisplay(post, at);
}

/** @deprecated Utiliser isFeedEventPastForMapDisplay — conservé pour tests existants. */
export function hasUpcomingFeedEventDate(
  post: Pick<FeedPost, 'eventDate' | 'eventDates'>,
  at = Date.now()
): boolean {
  return getEventDatesFromPost(post).some((iso) => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t > at;
  });
}
