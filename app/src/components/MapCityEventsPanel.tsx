import { useMemo } from 'react';
import { formatEventDateShort } from '../lib/feedEvents';
import { getEventTypeIcon } from '../lib/eventType';
import { sortMapEventsForPanel } from '../lib/mapEventClusters';
import type { MapDetailTier } from '../lib/mapMarkerVisibility';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import type { MapEventCityCluster, MapEventMarker } from '../types';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';

interface MapCityEventsPanelProps {
  cluster: MapEventCityCluster;
  layout?: 'side' | 'bottom';
  /** Niveau de zoom carte — affiche un message si la liste viewport est vide. */
  detailTier?: MapDetailTier;
  favoriteIds?: Set<string>;
  onEventClick: (event: MapEventMarker) => void;
  onBack: () => void;
  onHide?: () => void;
}

export function MapEventRow({
  event,
  onSelect,
}: {
  event: MapEventMarker;
  onSelect: () => void;
}) {
  const title = event.title.trim() || 'Événement';
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left px-2 sm:px-2.5 py-2 hover:bg-[var(--ms-surface-elevated)] border-l-2 border-transparent hover:border-purple-500/40 transition"
      >
        <div className="flex items-start gap-2">
          {event.authorId && event.authorUsername ? (
            <UserAvatarOnline
              userId={event.authorId}
              avatarUrl={event.authorAvatarUrl}
              username={event.authorUsername}
              size="sm"
            />
          ) : (
            <span className="text-lg shrink-0" aria-hidden>
              {getEventTypeIcon(event.eventType)}
            </span>
          )}
          <div className="min-w-0 flex-1 space-y-0.5">
            {event.authorUsername && (
              <UsernameDisplay
                username={event.authorUsername}
                usernameColor={event.authorUsernameColor}
                usernameWaveFrom={event.authorUsernameWaveFrom}
                usernameWaveTo={event.authorUsernameWaveTo}
                className="text-[11px] font-semibold truncate block"
              />
            )}
            <p className="text-xs text-gray-100 line-clamp-2 leading-snug">
              {event.authorId && event.authorUsername ? (
                <span className="mr-1" aria-hidden>
                  {getEventTypeIcon(event.eventType)}
                </span>
              ) : null}
              {title}
            </p>
            {event.eventDate && (
              <p className="text-[10px] text-purple-300/90 capitalize">
                {formatEventDateShort(event.eventDate)}
              </p>
            )}
            {event.eventLocation && (
              <p className="text-[10px] text-gray-500 line-clamp-1">{event.eventLocation}</p>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

export function MapCityEventsPanel({
  cluster,
  layout = 'side',
  detailTier,
  favoriteIds,
  onEventClick,
  onBack,
  onHide,
}: MapCityEventsPanelProps) {
  const isBottom = layout === 'bottom';

  const sortedEvents = useMemo(
    () => sortMapEventsForPanel(cluster.events, favoriteIds ?? new Set()),
    [cluster.events, favoriteIds]
  );

  const emptyViewportMessage =
    sortedEvents.length === 0 && detailTier && detailTier !== 'overview'
      ? 'Aucun événement dans la zone visible — zoomez ou déplacez la carte.'
      : null;

  return (
    <aside
      className={
        isBottom
          ? 'shrink-0 w-full max-h-[min(58vh,28rem)] flex flex-col min-h-0 overflow-hidden bg-[var(--ms-surface)] border-t border-[var(--ms-border)] z-20'
          : 'shrink-0 w-[10.5rem] sm:w-56 flex flex-col min-h-0 overflow-hidden bg-[var(--ms-surface)] border-r border-[var(--ms-border)] z-20'
      }
    >
      <div className="shrink-0 px-2.5 sm:px-3 py-2.5 border-b border-[var(--ms-border)]">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 mb-1 transition"
              aria-label="Retour à la liste carte"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Retour
            </button>
            <h2 className={`text-xs font-extrabold uppercase tracking-wider ${USERNAME_WAVE_CLASS}`}>
              {cluster.cityLabel}
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {cluster.count} événement{cluster.count !== 1 ? 's' : ''} cette semaine
            </p>
          </div>
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              title="Masquer la liste"
              aria-label="Masquer la liste"
              className="p-1.5 rounded-lg text-gray-500 hover:text-[var(--ms-text)] hover:bg-[var(--ms-surface-elevated)] transition shrink-0"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1">
        {emptyViewportMessage ? (
          <li className="px-2.5 sm:px-3 py-4 text-[11px] text-gray-500 text-center leading-snug">
            {emptyViewportMessage}
          </li>
        ) : (
          sortedEvents.map((event) => (
            <MapEventRow key={event.id} event={event} onSelect={() => onEventClick(event)} />
          ))
        )}
      </ul>
    </aside>
  );
}
