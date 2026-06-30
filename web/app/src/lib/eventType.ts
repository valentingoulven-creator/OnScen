/** Type d'événement (publication fil + marqueurs carte). */
export type FeedEventType = 'dance' | 'chant' | 'autre';

export const FEED_EVENT_TYPES: FeedEventType[] = ['dance', 'chant', 'autre'];

export const DEFAULT_FEED_EVENT_TYPE: FeedEventType = 'autre';

const EVENT_TYPE_ICONS: Record<FeedEventType, string> = {
  dance: '💃',
  chant: '🎤',
  autre: '📍',
};

/** Icône carte / globe pour un type d'événement (défaut 📍). */
export function getEventTypeIcon(eventType?: FeedEventType | null): string {
  if (!eventType) return EVENT_TYPE_ICONS.autre;
  return EVENT_TYPE_ICONS[eventType] ?? EVENT_TYPE_ICONS.autre;
}

export function isFeedEventType(value: unknown): value is FeedEventType {
  return typeof value === 'string' && (FEED_EVENT_TYPES as string[]).includes(value);
}
