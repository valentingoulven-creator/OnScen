import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FilterIcon } from './FilterIcon';
import { MapLocationPicker } from './MapLocationPicker';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import { formatCompactCount } from '../lib/formatCount';
import {
  getLivesGeo,
  hasPersistedMapGeoPrefs,
  isFixedMapGeoSource,
  MAP_GEO_CHANGED_EVENT,
  resolveDefaultLivesGeoPrefs,
  setLivesGeo,
  type LivesGeoPrefs,
} from '../lib/livesGeo';
import { isValidLatLng } from '../lib/mapCoords';
import { countSalonsSidebarItems, type MapSidebarContent } from '../lib/mapSidebarContent';
import { NEARBY_PANEL_CHANGED_EVENT, setNearbyPanelPreferences } from '../lib/nearbyPanelSettings';
import {
  formatRadiusKm,
  getNearbyRadiusKm,
  setNearbyRadiusKm,
  SETTINGS_CHANGED_EVENT,
} from '../lib/settings';
import type { Live, Salon } from '../types';

const LIVES_RADIUS_PRESETS_KM = [10, 20, 30, 50, 100] as const;

export type MapSidebarBrowseMode = 'lives' | 'salon';
type BrowseTab = 'following' | 'inView' | 'suggestions';

const LIST_PAGE_SIZE = 8;

function MapViewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A2 2 0 014 15.382V5.618a2 2 0 011.553-1.947L9 2l6 3 5.447-2.724A2 2 0 0120 4.618v9.764a2 2 0 01-1.553 1.947L13 18l-4-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 2v18M15 5v13" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}

type BrowseTheme = {
  title: string;
  hint: string;
  filterLabel: string;
  viewOnMap: string;
  sheetBorder: string;
  titleAccent: string;
  tabActive: string;
  tabInactive: string;
  cardHover: string;
  badge: string;
  livePill: string;
  metaText: string;
  filterBtn: string;
  mapBtn: string;
  followingLabel: string;
  inViewLabel: string;
  suggestionsLabel: string;
  inViewEmpty: string;
};

function LiveBrowseCard({
  live,
  onSelect,
  theme,
}: {
  live: Live;
  onSelect: () => void;
  theme: BrowseTheme;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full flex items-center gap-3 px-3 py-3 min-h-[72px] text-left transition active:scale-[0.99] border-b border-white/5 last:border-b-0 ${theme.cardHover}`}
      >
        <UserAvatarOnline
          userId={live.hostId}
          username={live.hostName}
          avatarUrl={live.hostAvatarUrl}
          size="sm"
          isLive
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate leading-snug">{live.title}</p>
          <UsernameDisplay
            as="p"
            username={live.hostName}
            usernameColor={live.hostUsernameColor}
            usernameWaveFrom={live.hostUsernameWaveFrom}
            usernameWaveTo={live.hostUsernameWaveTo}
            className="text-xs text-gray-400 truncate mt-0.5"
          />
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <div className="flex flex-col items-end gap-0.5">
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${theme.livePill}`}>
              Live
            </span>
            {(live.viewersCount ?? 0) > 0 ? (
              <span className={`text-[11px] tabular-nums font-medium ${theme.metaText}`}>
                {formatCompactCount(live.viewersCount ?? 0)} 👁
              </span>
            ) : null}
          </div>
          <ChevronRightIcon className="w-4 h-4 text-gray-600 shrink-0" />
        </div>
      </button>
    </li>
  );
}

function SalonBrowseCard({
  salon,
  active,
  onSelect,
  theme,
}: {
  salon: Salon;
  active: boolean;
  onSelect: () => void;
  theme: BrowseTheme;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full flex items-center gap-3 px-3 py-3 min-h-[72px] text-left transition active:scale-[0.99] border-b border-white/5 last:border-b-0 ${
          active ? 'bg-fuchsia-950/40 border-l-2 border-l-fuchsia-500' : theme.cardHover
        }`}
      >
        <UserAvatarOnline
          userId={salon.hostId}
          username={salon.hostName}
          avatarUrl={salon.hostAvatarUrl}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate leading-snug">{salon.title}</p>
          <UsernameDisplay
            as="p"
            username={salon.hostName}
            usernameColor={salon.hostUsernameColor}
            usernameWaveFrom={salon.hostUsernameWaveFrom}
            usernameWaveTo={salon.hostUsernameWaveTo}
            className="text-xs text-gray-400 truncate mt-0.5"
          />
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {(salon.listenersCount ?? 0) > 0 ? (
            <span className={`text-[11px] tabular-nums font-medium ${theme.metaText}`}>
              {formatCompactCount(salon.listenersCount ?? 0)} 🎧
            </span>
          ) : null}
          <ChevronRightIcon className="w-4 h-4 text-gray-600 shrink-0" />
        </div>
      </button>
    </li>
  );
}

function livesBrowseLocationLabel(
  geo: LivesGeoPrefs,
  userPosition: [number, number] | null | undefined,
  t: (key: string, opts?: { defaultValue?: string }) => string
): string {
  if (
    geo.source === 'my_position' &&
    userPosition &&
    isValidLatLng(userPosition[0], userPosition[1])
  ) {
    return t('sessionLocation.myPosition', { defaultValue: 'Ma position' });
  }
  return geo.label.trim() || t('map.livesBrowseLocationPlaceholder');
}

function LivesBrowseGeoToolbar({
  profileCity,
  userPosition,
}: {
  profileCity?: string;
  userPosition?: [number, number] | null;
}) {
  const { t } = useTranslation();
  const [geo, setGeo] = useState<LivesGeoPrefs>(() => getLivesGeo());
  const [radiusKm, setRadiusKm] = useState(() => getNearbyRadiusKm());
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const persisted = getLivesGeo();
    if (
      hasPersistedMapGeoPrefs() &&
      isFixedMapGeoSource(persisted.source) &&
      persisted.label.trim()
    ) {
      setGeo(persisted);
      return;
    }

    const defaults = resolveDefaultLivesGeoPrefs(profileCity, userPosition);
    const shouldPersist =
      !hasPersistedMapGeoPrefs() ||
      (persisted.source === 'my_position' && !userPosition);

    if (shouldPersist && (defaults.label.trim() || defaults.source === 'my_position')) {
      setLivesGeo(defaults);
    }
    setGeo(defaults);
  }, [profileCity, userPosition]);

  useEffect(() => {
    const sync = () => {
      setGeo(getLivesGeo());
      setRadiusKm(getNearbyRadiusKm());
    };
    window.addEventListener(MAP_GEO_CHANGED_EVENT, sync);
    window.addEventListener(SETTINGS_CHANGED_EVENT, sync);
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(MAP_GEO_CHANGED_EVENT, sync);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, sync);
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, sync);
    };
  }, []);

  const persistGeo = useCallback((next: LivesGeoPrefs) => {
    setGeo(next);
    setLivesGeo(next);
  }, []);

  const handleRadiusChange = useCallback((raw: string) => {
    const km = Number(raw);
    if (!Number.isFinite(km)) return;
    setNearbyRadiusKm(km);
    setNearbyPanelPreferences({ sortBy: 'distance' });
    setRadiusKm(getNearbyRadiusKm());
  }, []);

  return (
    <div className="px-3 pb-3 border-b border-white/5">
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          className="min-w-0 flex-1 max-w-[min(100%,14rem)] inline-flex items-center gap-1.5 min-h-9 px-2.5 rounded-lg text-[11px] font-medium text-red-100 border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 transition touch-manipulation"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0 text-red-300" fill="currentColor" aria-hidden>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
          </svg>
          <span className="truncate">{livesBrowseLocationLabel(geo, userPosition, t)}</span>
        </button>
        <label className="sr-only" htmlFor="lives-browse-radius">
          {t('map.livesBrowseRadiusLabel')}
        </label>
        <select
          id="lives-browse-radius"
          value={String(radiusKm)}
          onChange={(e) => handleRadiusChange(e.target.value)}
          className="shrink-0 min-h-9 rounded-lg bg-[#0b0b0f] border border-[#2a2a3d] px-2 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-red-500/40 [color-scheme:dark]"
        >
          {LIVES_RADIUS_PRESETS_KM.map((km) => (
            <option key={km} value={km}>
              {formatRadiusKm(km)}
            </option>
          ))}
          {LIVES_RADIUS_PRESETS_KM.includes(radiusKm as (typeof LIVES_RADIUS_PRESETS_KM)[number]) ? null : (
            <option value={radiusKm}>{formatRadiusKm(radiusKm)}</option>
          )}
        </select>
      </div>
      {pickerOpen ? (
        <div className="mt-2">
          <MapLocationPicker mapGeo={geo} onPersist={persistGeo} size="compact" accent="red" />
        </div>
      ) : null}
    </div>
  );
}

function BrowseTabBar({
  activeTab,
  onTabChange,
  counts,
  theme,
  ariaLabel,
}: {
  activeTab: BrowseTab;
  onTabChange: (tab: BrowseTab) => void;
  counts: Record<BrowseTab, number>;
  theme: BrowseTheme;
  ariaLabel: string;
}) {
  const tabs: { id: BrowseTab; label: string }[] = [
    { id: 'following', label: theme.followingLabel },
    { id: 'inView', label: theme.inViewLabel },
    { id: 'suggestions', label: theme.suggestionsLabel },
  ];

  return (
    <div className="px-3 pb-3 flex justify-end" role="tablist" aria-label={ariaLabel}>
      <div className="inline-flex max-w-full gap-1 p-1 rounded-xl bg-[#0b0b0f] border border-[#1e1e2f]">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(tab.id)}
              className={`min-h-[44px] min-w-[4.5rem] px-2 py-1.5 rounded-lg transition flex flex-col items-center justify-center gap-0.5 ${
                selected ? theme.tabActive : theme.tabInactive
              }`}
            >
              <span className="text-[10px] sm:text-xs font-semibold truncate max-w-full">{tab.label}</span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                  selected ? 'bg-white/20 text-white' : 'bg-[#1a1a26] text-gray-500'
                }`}
              >
                {counts[tab.id]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface MapSidebarBrowseSheetProps {
  mode: MapSidebarBrowseMode;
  open: boolean;
  onClose: () => void;
  content: MapSidebarContent;
  itemCount: number;
  profileCity?: string;
  userPosition?: [number, number] | null;
  selectedSalonId?: string | null;
  onOpenFilter?: () => void;
  onViewOnMap?: () => void;
  onLiveClick?: (live: Live) => void;
  onSalonClick?: (salon: Salon) => void;
}

export function MapSidebarBrowseSheet({
  mode,
  open,
  onClose,
  content,
  itemCount,
  profileCity,
  userPosition,
  selectedSalonId,
  onOpenFilter,
  onViewOnMap,
  onLiveClick,
  onSalonClick,
}: MapSidebarBrowseSheetProps) {
  const { t } = useTranslation();
  const isLives = mode === 'lives';
  const [activeTab, setActiveTab] = useState<BrowseTab>('inView');
  const [visibleLimit, setVisibleLimit] = useState(LIST_PAGE_SIZE);
  const openedAtRef = useRef(0);

  const sectionData = useMemo(() => {
    if (isLives) {
      return {
        following: content.livesFollowing,
        inView: content.lives,
        suggestions: content.livesSuggestions,
      };
    }
    return {
      following: content.salonsFollowing,
      inView: content.salons,
      suggestions: content.salonsSuggestions,
    };
  }, [isLives, content]);

  const tabCounts = useMemo(
    (): Record<BrowseTab, number> => ({
      following: sectionData.following.length,
      inView: sectionData.inView.length,
      suggestions: sectionData.suggestions.length,
    }),
    [sectionData]
  );

  useEffect(() => {
    if (!open) {
      setVisibleLimit(LIST_PAGE_SIZE);
      return;
    }
    openedAtRef.current = Date.now();
    if (isLives) {
      setActiveTab('inView');
      return;
    }
    if (tabCounts.following > 0) setActiveTab('following');
    else if (tabCounts.inView > 0) setActiveTab('inView');
    else setActiveTab('suggestions');
  }, [open, isLives, tabCounts.following, tabCounts.inView]);

  useEffect(() => {
    setVisibleLimit(LIST_PAGE_SIZE);
  }, [activeTab]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const theme = useMemo((): BrowseTheme => {
    if (isLives) {
      return {
        title: t('map.livesBrowseTitle', { defaultValue: 'Lives' }),
        hint: t('map.livesBrowseHint', { defaultValue: 'Directs en cours autour de vous.' }),
        filterLabel: t('map.livesBrowseFilter', { defaultValue: 'Filtres lives' }),
        viewOnMap: t('map.livesBrowseViewOnMap', { defaultValue: 'Voir sur la carte' }),
        sheetBorder: 'border-red-500/25 shadow-red-950/20',
        titleAccent: 'text-red-200',
        tabActive: 'bg-red-600 text-white shadow-md shadow-red-900/30',
        tabInactive: 'text-gray-400 hover:text-gray-200 hover:bg-white/5',
        cardHover: 'hover:bg-red-500/5',
        badge: 'bg-red-600/90 text-white',
        livePill: 'bg-red-500/20 text-red-300',
        metaText: 'text-red-300/80',
        filterBtn: 'text-red-300 hover:bg-red-500/15 hover:border-red-500/30',
        mapBtn: 'text-red-200 border-red-500/35 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40',
        followingLabel: t('map.browseTabFollowing', { defaultValue: 'Suivi' }),
        inViewLabel: t('map.browseTabAround', { defaultValue: 'Autour' }),
        suggestionsLabel: t('map.browseTabSuggestions', { defaultValue: 'Suggestion' }),
        inViewEmpty: content.zoomTooWide
          ? t('map.sidebarLivesZoomHint', { defaultValue: 'Zoomez pour voir les lives dans cette zone.' })
          : t('map.sidebarLivesEmpty', { defaultValue: 'Aucun live dans cette zone.' }),
      };
    }
    return {
      title: t('map.salonBrowseTitle', { defaultValue: 'Salons' }),
      hint: t('map.salonBrowseHint', { defaultValue: 'Salons musicaux sur la carte.' }),
      filterLabel: t('map.salonFilterTitle'),
      viewOnMap: t('map.salonBrowseViewOnMap', { defaultValue: 'Voir sur la carte' }),
      sheetBorder: 'border-fuchsia-500/25 shadow-fuchsia-950/20',
      titleAccent: 'text-fuchsia-200',
      tabActive: 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-900/30',
      tabInactive: 'text-gray-400 hover:text-gray-200 hover:bg-white/5',
      cardHover: 'hover:bg-fuchsia-500/5',
      badge: 'bg-fuchsia-600/90 text-white',
      livePill: 'bg-fuchsia-500/20 text-fuchsia-300',
      metaText: 'text-fuchsia-300/80',
      filterBtn: 'text-fuchsia-300 hover:bg-fuchsia-500/15 hover:border-fuchsia-500/30',
      mapBtn: 'text-fuchsia-200 border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 disabled:opacity-40',
      followingLabel: t('map.browseTabFollowing', { defaultValue: 'Suivi' }),
      inViewLabel: t('map.browseTabAround', { defaultValue: 'Autour' }),
      suggestionsLabel: t('map.browseTabSuggestions', { defaultValue: 'Suggestion' }),
      inViewEmpty: t('map.sidebarSalonsEmpty', { defaultValue: 'Aucun salon dans cette zone.' }),
    };
  }, [isLives, content.zoomTooWide, t]);

  const activeItems = isLives ? sectionData.inView : sectionData[activeTab];
  const visibleItems = activeItems.slice(0, visibleLimit);
  const hiddenCount = activeItems.length - visibleItems.length;

  const emptyText = useMemo(() => {
    if (isLives || activeTab === 'inView') return theme.inViewEmpty;
    if (activeTab === 'following') {
      return t('map.sidebarFollowingEmpty', { defaultValue: 'Aucun contenu suivi.' });
    }
    return t('map.sidebarSuggestionsEmpty', { defaultValue: 'Aucune suggestion.' });
  }, [activeTab, isLives, theme.inViewEmpty, t]);

  const handleFilterClick = useCallback(() => {
    onOpenFilter?.();
  }, [onOpenFilter]);

  const handleBackdropClose = useCallback(() => {
    if (Date.now() - openedAtRef.current < 450) return;
    onClose();
  }, [onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm ms-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-sidebar-browse-title"
        onClick={handleBackdropClose}
      >
        <div
          className={`relative w-full max-w-md sm:max-w-lg max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-0.5rem))] sm:max-h-[min(36rem,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-2rem))] flex flex-col bg-[#0e0e14] border rounded-2xl ms-modal-panel shadow-2xl overflow-hidden ${theme.sheetBorder}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sm:hidden flex justify-center pt-2.5 pb-0.5 shrink-0" aria-hidden>
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className="shrink-0 border-b border-white/10">
            <div className="px-4 py-2.5 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 id="map-sidebar-browse-title" className={`text-base font-bold truncate ${theme.titleAccent}`}>
                    {theme.title}
                  </h2>
                  {itemCount > 0 ? (
                    <span
                      className={`shrink-0 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${theme.badge}`}
                    >
                      {itemCount}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{theme.hint}</p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {onViewOnMap ? (
                  <button
                    type="button"
                    onClick={() => {
                      onViewOnMap();
                      onClose();
                    }}
                    disabled={itemCount <= 0}
                    title={theme.viewOnMap}
                    aria-label={theme.viewOnMap}
                    className={`w-11 h-11 flex items-center justify-center rounded-xl border transition touch-manipulation disabled:pointer-events-none ${theme.mapBtn}`}
                  >
                    <MapViewIcon className="w-4 h-4" />
                  </button>
                ) : null}
                {(onOpenFilter && !isLives) ? (
                  <button
                    type="button"
                    onClick={handleFilterClick}
                    title={theme.filterLabel}
                    aria-label={theme.filterLabel}
                    className={`w-11 h-11 flex items-center justify-center rounded-xl border border-transparent transition touch-manipulation ${theme.filterBtn}`}
                  >
                    <FilterIcon className="w-4 h-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-[#1e1e2f] transition touch-manipulation"
                  aria-label={t('common.close')}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {isLives ? (
              <LivesBrowseGeoToolbar profileCity={profileCity} userPosition={userPosition} />
            ) : null}

            {!isLives ? (
              <BrowseTabBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                counts={tabCounts}
                theme={theme}
                ariaLabel={t('map.livesBrowseTabsAria', { defaultValue: 'Catégories' })}
              />
            ) : null}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" role="tabpanel">
            {activeItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <span className="text-3xl mb-3 opacity-60" aria-hidden>
                  {isLives ? '🔴' : '🎵'}
                </span>
                <p className="text-sm text-gray-400 leading-snug">{emptyText}</p>
              </div>
            ) : (
              <ul className="py-1">
                {isLives
                  ? visibleItems.map((live) => (
                      <LiveBrowseCard
                        key={live.id}
                        live={live as Live}
                        theme={theme}
                        onSelect={() => onLiveClick?.(live as Live)}
                      />
                    ))
                  : visibleItems.map((salon) => (
                      <SalonBrowseCard
                        key={salon.id}
                        salon={salon as Salon}
                        active={salon.id === selectedSalonId}
                        theme={theme}
                        onSelect={() => onSalonClick?.(salon as Salon)}
                      />
                    ))}
              </ul>
            )}
          </div>

          {hiddenCount > 0 ? (
            <div className="shrink-0 px-3 py-2.5 border-t border-white/10 bg-[#0b0b0f]/80 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:pb-2.5">
              <button
                type="button"
                onClick={() => setVisibleLimit((n) => n + LIST_PAGE_SIZE)}
                className="w-full min-h-11 rounded-xl text-sm font-semibold text-purple-200 border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/15 transition touch-manipulation"
              >
                {t('map.sidebarShowMore', {
                  count: hiddenCount,
                  defaultValue: `Afficher plus (${hiddenCount})`,
                })}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>,
    document.body
  );
}

export function uniqueLiveCountFromContent(content: MapSidebarContent): number {
  return content.lives.length;
}

export function uniqueSalonCountFromContent(content: MapSidebarContent): number {
  return countSalonsSidebarItems(content);
}

export function collectGeoPointsFromLivesContent(content: MapSidebarContent): { latitude: number; longitude: number }[] {
  return content.lives.map((live) => ({
    latitude: live.latitude,
    longitude: live.longitude,
  }));
}

export function collectGeoPointsFromSalonContent(content: MapSidebarContent): { latitude: number; longitude: number }[] {
  const merged = [...content.salonsFollowing, ...content.salons, ...content.salonsSuggestions];
  const seen = new Set<string>();
  const out: { latitude: number; longitude: number }[] = [];
  for (const salon of merged) {
    if (seen.has(salon.id)) continue;
    seen.add(salon.id);
    out.push({ latitude: salon.latitude, longitude: salon.longitude });
  }
  return out;
}
