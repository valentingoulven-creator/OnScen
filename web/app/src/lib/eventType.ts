/** Type d'événement (publication fil + marqueurs carte). */
export type FeedEventType = 'dance' | 'chant' | 'autre';

export const FEED_EVENT_TYPES: FeedEventType[] = ['dance', 'chant', 'autre'];

export const DEFAULT_FEED_EVENT_TYPE: FeedEventType = 'autre';

const EVENT_TYPE_ICONS: Record<FeedEventType, string> = {
  dance: '💃',
  chant: '🎶',
  /** Autre — pas 📍 (réservé aux pins jour carte). */
  autre: '✨',
};

/** Icône visuelle des événements sponsorisés (sidebar carte · Sponso). */
export const SPONSOR_EVENT_ICON = '✨';

/** Icône selon le type (défaut ✨). */
export function getEventTypeIcon(eventType?: FeedEventType | null): string {
  if (!eventType) return EVENT_TYPE_ICONS.autre;
  return EVENT_TYPE_ICONS[eventType] ?? EVENT_TYPE_ICONS.autre;
}

/** Libellé affiché sur cartes / modals (type legacy « dance » → Musique). */
export function getFeedEventTypeDisplayLabel(
  t: (key: string, opts?: { defaultValue?: string }) => string,
  eventType?: FeedEventType | null,
  opts?: { sponsored?: boolean }
): string {
  if (opts?.sponsored) {
    return t('map.sidebarSponsoCategory', { defaultValue: 'Sponso' });
  }
  if (eventType === 'dance' || eventType === 'chant') {
    return t('feed.eventTypeChant');
  }
  return t('feed.eventTypeAutre');
}

/** Icône affichée sur cartes (dance → même icône que Musique). */
export function getFeedEventTypeDisplayIcon(
  eventType?: FeedEventType | null,
  opts?: { sponsored?: boolean }
): string {
  if (opts?.sponsored) return SPONSOR_EVENT_ICON;
  if (eventType === 'dance' || eventType === 'chant') return EVENT_TYPE_ICONS.chant;
  return getEventTypeIcon(eventType);
}

export function getMapEventDisplayIcon(
  eventType: FeedEventType | null | undefined,
  opts?: { sponsored?: boolean }
): string {
  return opts?.sponsored ? SPONSOR_EVENT_ICON : getEventTypeIcon(eventType);
}

export function normalizeFeedEventType(eventType?: FeedEventType | null): FeedEventType {
  return eventType ?? DEFAULT_FEED_EVENT_TYPE;
}

export function isFeedEventType(value: unknown): value is FeedEventType {
  return typeof value === 'string' && (FEED_EVENT_TYPES as string[]).includes(value);
}
