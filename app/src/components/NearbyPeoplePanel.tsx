import { memo } from 'react';
import { formatWeekRangeLabel } from '../lib/feedEvents';
import {
  countMapSidebarItems,
  mapDetailTierLabel,
  type MapSidebarContent,
} from '../lib/mapSidebarContent';
import type { MapViewDetailState } from '../lib/mapMarkerVisibility';
import { MapEventRow } from './MapCityEventsPanel';
import { PlatformListeningIcon } from './PlatformListeningIcon';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import type { Live, MapEventCityCluster, MapEventMarker, NearbyPerson, Salon } from '../types';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';

interface NearbyPeoplePanelProps {
  content: MapSidebarContent;
  detail: MapViewDetailState;
  loading?: boolean;
  eventsLoading?: boolean;
  layout?: 'side' | 'bottom';
  selectedSalonId?: string | null;
  onHide?: () => void;
  onEventClick?: (event: MapEventMarker) => void;
  onEventClusterClick?: (cluster: MapEventCityCluster) => void;
  onSalonClick?: (salon: Salon) => void;
  onLiveClick?: (live: Live) => void;
  onPersonClick?: (person: NearbyPerson) => void;
  eventsFilterOn?: boolean;
  livesFilterOn?: boolean;
  salonFilterOn?: boolean;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <li className="px-2.5 sm:px-3 py-1.5 border-b border-[var(--ms-border)]/80" aria-hidden>
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{children}</p>
    </li>
  );
}

const CityClusterRow = memo(function CityClusterRow({
  cluster,
  onSelect,
}: {
  cluster: MapEventCityCluster;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left px-2 sm:px-2.5 py-2 hover:bg-[var(--ms-surface-elevated)] border-l-2 border-transparent hover:border-purple-500/40 transition"
      >
        <div className="flex items-start gap-2">
          <span className="text-lg shrink-0" aria-hidden>
            📍
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-xs font-semibold text-gray-100 truncate">{cluster.cityLabel}</p>
            <p className="text-[10px] text-purple-300/90">
              {cluster.count} événement{cluster.count !== 1 ? 's' : ''} cette semaine
            </p>
          </div>
        </div>
      </button>
    </li>
  );
});

const SalonSidebarRow = memo(function SalonSidebarRow({
  salon,
  active,
  onSelect,
}: {
  salon: Salon;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full flex items-center gap-1.5 px-2 sm:px-2.5 py-2 transition text-left ${
          active
            ? 'bg-fuchsia-900/30 border-l-2 border-fuchsia-500'
            : 'hover:bg-[var(--ms-surface-elevated)] border-l-2 border-transparent'
        }`}
      >
        <UserAvatarOnline
          userId={salon.hostId}
          username={salon.hostName}
          avatarUrl={salon.hostAvatarUrl}
          size="sm"
          isLive={salon.isLive}
        />
        <div className="min-w-0 flex-1">
          <UsernameDisplay
            as="p"
            username={salon.hostName}
            usernameColor={salon.hostUsernameColor}
            usernameWaveFrom={salon.hostUsernameWaveFrom}
            usernameWaveTo={salon.hostUsernameWaveTo}
            className="text-xs font-semibold truncate leading-tight"
          />
          <p className="text-[10px] text-fuchsia-300/90 truncate">{salon.title}</p>
        </div>
      </button>
    </li>
  );
});

const LiveSidebarRow = memo(function LiveSidebarRow({
  live,
  onSelect,
}: {
  live: Live;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full flex items-center gap-1.5 px-2 sm:px-2.5 py-2 hover:bg-[var(--ms-surface-elevated)] border-l-2 border-transparent hover:border-red-500/40 transition text-left"
      >
        <UserAvatarOnline
          userId={live.hostId}
          username={live.hostName}
          size="sm"
          isLive
          liveViewersCount={live.viewersCount}
        />
        <div className="min-w-0 flex-1">
          <UsernameDisplay
            as="p"
            username={live.hostName}
            usernameColor={live.hostUsernameColor}
            usernameWaveFrom={live.hostUsernameWaveFrom}
            usernameWaveTo={live.hostUsernameWaveTo}
            className="text-xs font-semibold truncate leading-tight"
          />
          <p className="text-[10px] text-red-300/90 truncate">{live.title}</p>
        </div>
      </button>
    </li>
  );
});

const PersonSidebarRow = memo(function PersonSidebarRow({
  person,
  onSelect,
}: {
  person: NearbyPerson;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full flex items-center gap-1.5 px-2 sm:px-2.5 py-2 hover:bg-[var(--ms-surface-elevated)] border-l-2 border-transparent hover:border-red-500/40 transition text-left"
      >
        <span className="relative shrink-0">
          <UserAvatarOnline
            userId={person.id}
            username={person.username}
            avatarUrl={person.avatarUrl}
            size="sm"
            isLive={person.isLive}
            liveViewersCount={person.isLive ? person.liveViewersCount : undefined}
          />
          {person.listeningPlatform && (
            <span className="absolute top-0 left-0 z-10">
              <PlatformListeningIcon platform={person.listeningPlatform} />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <UsernameDisplay
            as="p"
            username={person.username}
            usernameColor={person.usernameColor}
            usernameWaveFrom={person.usernameWaveFrom}
            usernameWaveTo={person.usernameWaveTo}
            className="text-xs font-semibold truncate leading-tight"
          />
          <p className="text-[10px] text-gray-500 truncate">
            {person.distanceKm != null ? `${person.distanceKm} km` : person.city || 'En direct'}
          </p>
        </div>
      </button>
    </li>
  );
});

export const NearbyPeoplePanel = memo(function NearbyPeoplePanel({
  content,
  detail,
  loading = false,
  eventsLoading = false,
  layout = 'bottom',
  selectedSalonId,
  onHide,
  onEventClick,
  onEventClusterClick,
  onSalonClick,
  onLiveClick,
  onPersonClick,
  eventsFilterOn = false,
  livesFilterOn = false,
  salonFilterOn = false,
}: NearbyPeoplePanelProps) {
  const isBottom = layout === 'bottom';
  const itemCount = countMapSidebarItems(content);
  const showWeekLabel = eventsFilterOn && (content.eventClusters.length > 0 || content.events.length > 0);

  const summaryParts: string[] = [];
  if (content.eventClusters.length > 0) {
    summaryParts.push(
      `${content.eventClusters.length} ville${content.eventClusters.length !== 1 ? 's' : ''}`
    );
  }
  if (content.events.length > 0) {
    summaryParts.push(`${content.events.length} événement${content.events.length !== 1 ? 's' : ''}`);
  }
  if (content.lives.length > 0) {
    summaryParts.push(`${content.lives.length} live${content.lives.length !== 1 ? 's' : ''}`);
  }
  if (content.salons.length > 0) {
    summaryParts.push(`${content.salons.length} salon${content.salons.length !== 1 ? 's' : ''}`);
  }
  if (content.people.length > 0) {
    summaryParts.push(`${content.people.length} personne${content.people.length !== 1 ? 's' : ''}`);
  }

  const emptyMessage = () => {
    if (content.noFilters) {
      return 'Activez Lives, Salon ou Évènement sur la carte pour afficher la liste.';
    }
    if (content.zoomTooWide) {
      if (livesFilterOn && !salonFilterOn && !eventsFilterOn) {
        return 'Zoomez pour voir les lives.';
      }
      if (salonFilterOn && !livesFilterOn && !eventsFilterOn) {
        return 'Zoomez sur une ville pour voir les salons dans cette zone.';
      }
      return 'Zoomez sur une ville pour voir les lives et salons dans cette zone.';
    }
    if (eventsLoading) return 'Chargement des événements…';
    if (loading) return 'Chargement…';
    return 'Aucun résultat dans cette zone pour les filtres actifs.';
  };

  return (
    <aside
      className={
        isBottom
          ? 'ms-map-sidebar-panel shrink-0 w-full max-h-[min(52dvh,22rem)] sm:max-h-[min(58vh,28rem)] flex flex-col min-h-0 overflow-hidden bg-[var(--ms-surface)] border-t border-[var(--ms-border)] z-20'
          : 'ms-map-sidebar-panel shrink-0 w-[min(38vw,10.5rem)] min-w-[7.5rem] sm:w-56 flex flex-col min-h-0 overflow-hidden bg-[var(--ms-surface)] border-r border-[var(--ms-border)] z-20'
      }
    >
      <div className="shrink-0 px-2.5 sm:px-3 py-2.5 border-b border-[var(--ms-border)]">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <h2 className={`text-xs font-extrabold uppercase tracking-wider ${USERNAME_WAVE_CLASS}`}>
              {isBottom ? 'Liste carte' : 'Carte'}
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {mapDetailTierLabel(detail.tier)}
              {summaryParts.length > 0 ? ` · ${summaryParts.join(' · ')}` : loading ? ' · …' : ''}
            </p>
            {showWeekLabel && (
              <p className="text-[9px] text-purple-400/80 mt-0.5">Cette semaine · {formatWeekRangeLabel()}</p>
            )}
          </div>
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              title="Masquer la liste"
              aria-label="Masquer la liste carte"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-500 hover:text-[var(--ms-text)] hover:bg-[var(--ms-surface-elevated)] shrink-0"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  d="M3 3l18 18M10.5 10.7a3 3 0 0 0 4.2 4.2M7.8 7.8C5.6 9.8 4 12.4 4 15a8 8 0 0 0 8 8c2.6 0 5.2-1.6 7.2-3.8M14.2 14.2c2.2-2 3.8-4.6 3.8-7.2a8 8 0 0 0-8-8c-2.6 0-5.2 1.6-7.2 3.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto py-1">
        {itemCount === 0 ? (
          <li className="px-2 sm:px-3 py-6 text-center text-[10px] text-gray-500 leading-snug">
            {emptyMessage()}
          </li>
        ) : (
          <>
            {content.eventClusters.length > 0 && (
              <>
                <SectionLabel>Événements par ville</SectionLabel>
                {content.eventClusters.map((cluster) => (
                  <CityClusterRow
                    key={cluster.cityKey}
                    cluster={cluster}
                    onSelect={() => onEventClusterClick?.(cluster)}
                  />
                ))}
              </>
            )}

            {content.events.length > 0 && (
              <>
                {content.eventClusters.length === 0 && <SectionLabel>Événements</SectionLabel>}
                {content.events.map((event) => (
                  <MapEventRow
                    key={event.id}
                    event={event}
                    onSelect={() => onEventClick?.(event)}
                  />
                ))}
              </>
            )}

            {content.lives.length > 0 && (
              <>
                <SectionLabel>Lives</SectionLabel>
                {content.lives.map((live) => (
                  <LiveSidebarRow key={live.id} live={live} onSelect={() => onLiveClick?.(live)} />
                ))}
              </>
            )}

            {content.salons.length > 0 && (
              <>
                <SectionLabel>Salons</SectionLabel>
                {content.salons.map((salon) => (
                  <SalonSidebarRow
                    key={salon.id}
                    salon={salon}
                    active={salon.id === selectedSalonId}
                    onSelect={() => onSalonClick?.(salon)}
                  />
                ))}
              </>
            )}

            {content.people.length > 0 && (
              <>
                <SectionLabel>En direct</SectionLabel>
                {content.people.map((person) => (
                  <PersonSidebarRow
                    key={person.id}
                    person={person}
                    onSelect={() => onPersonClick?.(person)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ul>
    </aside>
  );
});
