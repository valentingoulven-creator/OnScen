import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useVisibleInterval } from '../hooks/usePageVisible';
import { api } from '../lib/api';
import { dicebearAdventurerAvatar } from '../lib/avatarUrl';
import { formatCompactCount } from '../lib/formatCount';
import {
  collectLiveCountryOptions,
  filterLivesByCountry,
  getLivesCountryFilter,
  hasLivesOutsideFrance,
  LIVES_COUNTRY_FILTER_ALL,
  setLivesCountryFilter,
} from '../lib/liveCountry';
import {
  getLivesGeo,
  MAP_GEO_CHANGED_EVENT,
  setLivesGeo,
  type LivesGeoPrefs,
} from '../lib/livesGeo';
import {
  getNearbyPanelPreferences,
  isNearbyDistanceFilterActive,
  NEARBY_PANEL_CHANGED_EVENT,
  NEARBY_SORT_OPTIONS,
  setNearbyPanelPreferences,
  sortLivesForNearby,
  type NearbyPanelPreferences,
} from '../lib/nearbyPanelSettings';
import { SETTINGS_CHANGED_EVENT } from '../lib/settings';
import { FilterIcon } from './FilterIcon';
import { FollowUserButton } from './FollowUserButton';
import { MapLocationPicker } from './MapLocationPicker';
import { UsernameDisplay } from './UsernameDisplay';
import type { Live } from '../types';

export const LIVE_GRID_CLASS =
  'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-2 gap-y-3 sm:gap-y-4';

function LiveGridSkeleton() {
  return (
    <ul className={`px-3 pb-3 pt-1 ${LIVE_GRID_CLASS}`} aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="animate-pulse">
          <div className="aspect-video w-full h-[5.75rem] sm:h-auto bg-[#1a1a26] rounded-lg ms-skeleton" />
          <div className="flex items-start gap-2 mt-2">
            <div className="size-9 shrink-0 rounded-full bg-[#1a1a26] ms-skeleton" />
            <div className="flex-1 space-y-1.5 pt-1">
              <div className="h-3 bg-[#1a1a26] rounded ms-skeleton w-3/4" />
              <div className="h-2.5 bg-[#1a1a26] rounded ms-skeleton w-1/2" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatLiveViewersLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n < 1000) {
    return n === 1 ? '1 spectateur' : `${n} spectateurs`;
  }
  const compact = formatCompactCount(n).replace('.', ',').replace('K', ' k').replace('M', ' M');
  return `${compact} spectateurs`;
}

const LiveGridCard = memo(function LiveGridCard({
  live,
  currentUserId,
  isFollowing,
  onOpenLive,
  onFollowingChange,
}: {
  live: Live;
  currentUserId?: string;
  isFollowing: boolean;
  onOpenLive: (liveId: string) => void;
  onFollowingChange: (hostId: string, following: boolean) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenLive(live.id)}
        className="w-full flex flex-col text-left group"
      >
        <div className="relative w-full h-[5.75rem] sm:h-auto sm:aspect-video bg-[#0b0b0f] overflow-hidden rounded-lg">
          {live.playbackState.albumArtUrl ? (
            <img
              src={live.playbackState.albumArtUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a26] to-[#0b0b0f]" />
          )}
          <span
            className="absolute top-1.5 left-1.5 size-2 rounded-full bg-red-500 ring-2 ring-red-500/40 shadow-[0_0_6px_rgba(239,68,68,0.6)] live-indicator-dot"
            aria-label="En direct"
          />
          {live.hostId !== currentUserId && (
            <div
              className="absolute top-1.5 right-1.5 opacity-90 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <FollowUserButton
                userId={live.hostId}
                username={live.hostName}
                initialFollowing={isFollowing}
                iconOnly
                onFollowingChange={(f) => onFollowingChange(live.hostId, f)}
              />
            </div>
          )}
        </div>
        <div className="flex items-start gap-1.5 mt-1.5 min-w-0">
          <img
            src={dicebearAdventurerAvatar(live.hostId)}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-7 sm:size-8 shrink-0 rounded-full object-cover bg-[#1a1a26]"
          />
          <div className="flex-1 min-w-0 overflow-hidden leading-tight">
            <p className="text-xs sm:text-sm font-semibold text-white truncate">{live.title}</p>
            <div className="flex items-center gap-1 min-w-0 mt-0.5">
              <UsernameDisplay
                username={live.hostName}
                usernameColor={live.hostUsernameColor}
                usernameWaveFrom={live.hostUsernameWaveFrom}
                usernameWaveTo={live.hostUsernameWaveTo}
                className="text-xs text-gray-400 truncate min-w-0"
              />
              <span className="text-xs text-gray-500 shrink-0" aria-hidden>
                ·
              </span>
              <span className="text-xs text-gray-500 shrink-0 tabular-nums">
                {formatLiveViewersLabel(live.viewersCount)}
              </span>
            </div>
          </div>
        </div>
      </button>
    </li>
  );
});

const filterChipClass = (active: boolean) =>
  `shrink-0 min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold border transition touch-manipulation whitespace-nowrap ${
    active
      ? 'border-red-500/50 bg-red-500/15 text-red-200 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.15)]'
      : 'border-[#2d2d3d] bg-[#0b0b0f] text-gray-400 hover:text-gray-200 hover:border-[#3d3d4d]'
  }`;

export function LivesBrowseFilterPanel({
  geo,
  onPersistGeo,
  showCountryFilter,
  countryOptions,
  countryFilter,
  onCountryFilter,
  sortBy,
  onSortBy,
  onClose,
  onReset,
}: {
  geo: LivesGeoPrefs;
  onPersistGeo: (next: LivesGeoPrefs) => void;
  showCountryFilter: boolean;
  countryOptions: { code: string; name: string }[];
  countryFilter: string;
  onCountryFilter: (code: string) => void;
  sortBy: NearbyPanelPreferences['sortBy'];
  onSortBy: (id: Exclude<NearbyPanelPreferences['sortBy'], 'none'> | 'none') => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const [zoneMapOpen, setZoneMapOpen] = useState(false);
  const hasCustomSort = sortBy !== 'none';
  const hasCountry = showCountryFilter && countryFilter !== LIVES_COUNTRY_FILTER_ALL;

  return (
    <>
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-[#1e1e2f] bg-[#0f0f16]">
        <div className="min-w-0">
          <h3 id="lives-filter-title" className="text-sm font-semibold text-white">
            Filtres lives
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5 truncate">{geo.label}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(hasCustomSort || hasCountry) && (
            <button
              type="button"
              onClick={onReset}
              className="min-h-11 px-2.5 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition touch-manipulation"
            >
              Réinitialiser
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-[#1e1e2f] transition touch-manipulation"
            aria-label="Fermer les filtres"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-4">
        <section aria-labelledby="lives-filter-zone">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <h4 id="lives-filter-zone" className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Zone de recherche
              </h4>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                Centre la carte pour affiner les lives à proximité
              </p>
            </div>
            <button
              type="button"
              onClick={() => setZoneMapOpen((v) => !v)}
              aria-expanded={zoneMapOpen}
              className={`shrink-0 min-h-11 px-3 rounded-xl text-xs font-semibold border transition touch-manipulation ${
                zoneMapOpen
                  ? 'border-red-500/40 bg-red-500/10 text-red-200'
                  : 'border-[#2d2d3d] text-gray-300 hover:border-red-500/30'
              }`}
            >
              {zoneMapOpen ? 'Masquer' : 'Carte'}
            </button>
          </div>
          {!zoneMapOpen ? (
            <div className="rounded-xl border border-[#1e1e2f] bg-[#0b0b0f] px-3 py-2.5 flex items-center gap-2.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-red-500/15 text-red-300 shrink-0">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-200 truncate">{geo.label}</p>
                <p className="text-[10px] font-mono text-gray-500 tabular-nums truncate">
                  {geo.latitude.toFixed(4)}°, {geo.longitude.toFixed(4)}°
                </p>
              </div>
            </div>
          ) : (
            <MapLocationPicker mapGeo={geo} onPersist={onPersistGeo} size="compact" accent="red" />
          )}
        </section>

        {showCountryFilter && (
          <section aria-labelledby="lives-filter-country">
            <h4 id="lives-filter-country" className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Pays
            </h4>
            <div className="overflow-x-auto -mx-1 px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-2 w-max min-w-full sm:min-w-0 sm:flex-wrap sm:w-auto">
                <button
                  type="button"
                  onClick={() => onCountryFilter(LIVES_COUNTRY_FILTER_ALL)}
                  className={filterChipClass(countryFilter === LIVES_COUNTRY_FILTER_ALL)}
                >
                  Tous les pays
                </button>
                {countryOptions.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => onCountryFilter(opt.code)}
                    className={filterChipClass(countryFilter === opt.code)}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="lives-filter-sort">
          <h4 id="lives-filter-sort" className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
            Trier par
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0b0b0f] border border-[#1e1e2f]">
            {NEARBY_SORT_OPTIONS.map((opt) => {
              const active = sortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSortBy(active ? 'none' : opt.id)}
                  className={`min-h-11 px-2 py-2 rounded-lg text-xs font-semibold transition touch-manipulation text-center leading-snug ${
                    active
                      ? 'bg-red-500/20 text-red-100 ring-1 ring-red-500/40'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a26]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {sortBy === 'distance' && (
            <p className="text-[10px] text-gray-500 mt-2 leading-snug">
              Seuls les lives dans votre rayon de proximité sont affichés.
            </p>
          )}
        </section>
      </div>

      <div className="shrink-0 px-3 py-3 border-t border-[#1e1e2f] bg-[#0f0f16] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-11 rounded-xl bg-red-500/90 hover:bg-red-500 active:bg-red-600 text-sm font-semibold text-white transition touch-manipulation"
        >
          Terminé
        </button>
      </div>
    </>
  );
}

export function LivesBrowseFilterModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lives-filter-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        aria-label="Fermer les filtres"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[90dvh] rounded-t-2xl sm:rounded-2xl bg-[#12121a] border border-[#1e1e2f] shadow-2xl flex flex-col overflow-hidden">
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function LivesBrowseGrid({
  onOpenLive,
  isActive = true,
  onLivesChange,
  showFilterButton = true,
  className = '',
}: {
  onOpenLive: (liveId: string) => void;
  isActive?: boolean;
  onLivesChange?: (lives: Live[]) => void;
  showFilterButton?: boolean;
  className?: string;
}) {
  const { token, user } = useAuth();
  const [lives, setLives] = useState<Live[]>([]);
  const [loading, setLoading] = useState(true);
  const [geo, setGeo] = useState<LivesGeoPrefs>(getLivesGeo);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelPrefs, setPanelPrefs] = useState<NearbyPanelPreferences>(() => getNearbyPanelPreferences());
  const [countryFilter, setCountryFilter] = useState(() => getLivesCountryFilter());

  useEffect(() => {
    const syncPrefs = () => setPanelPrefs(getNearbyPanelPreferences());
    window.addEventListener(SETTINGS_CHANGED_EVENT, syncPrefs);
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, syncPrefs);
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, syncPrefs);
    };
  }, []);

  useEffect(() => {
    const syncGeo = () => setGeo(getLivesGeo());
    window.addEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    return () => window.removeEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
  }, []);

  useEffect(() => {
    if (!isActive || !token) return;
    api.getMyFollowing(token).then((r) => setFollowingIds(new Set(r.followingIds)));
  }, [isActive, token]);

  const persistGeo = useCallback((next: LivesGeoPrefs) => {
    setGeo(next);
    setLivesGeo(next);
  }, []);

  const updatePanelPrefs = useCallback((patch: Partial<Pick<NearbyPanelPreferences, 'sortBy'>>) => {
    setPanelPrefs(setNearbyPanelPreferences(patch));
  }, []);

  const handleFollowingChange = useCallback((hostId: string, following: boolean) => {
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (following) next.add(hostId);
      else next.delete(hostId);
      return next;
    });
  }, []);

  const loadLives = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const prefs = getNearbyPanelPreferences();
    api
      .getLives(token, {
        latitude: geo.latitude,
        longitude: geo.longitude,
        radiusKm: geo.radiusKm,
        distanceFilter: isNearbyDistanceFilterActive(prefs),
      })
      .then((r) => {
        const active = r.lives.filter((l) => l.isActive);
        setLives(active);
        onLivesChange?.(active);
      })
      .finally(() => setLoading(false));
  }, [token, geo.latitude, geo.longitude, geo.radiusKm, panelPrefs.sortBy, onLivesChange]);

  useVisibleInterval(loadLives, 12_000, isActive);

  const showCountryFilter = useMemo(() => hasLivesOutsideFrance(lives), [lives]);
  const countryOptions = useMemo(() => collectLiveCountryOptions(lives), [lives]);

  useEffect(() => {
    if (!showCountryFilter && countryFilter !== LIVES_COUNTRY_FILTER_ALL) {
      const reset = setLivesCountryFilter(LIVES_COUNTRY_FILTER_ALL);
      setCountryFilter(reset);
    }
  }, [showCountryFilter, countryFilter]);

  const filteredLives = useMemo(
    () => (showCountryFilter ? filterLivesByCountry(lives, countryFilter) : lives),
    [lives, countryFilter, showCountryFilter]
  );

  const sortedLives = useMemo(
    () => sortLivesForNearby(filteredLives, panelPrefs.sortBy),
    [filteredLives, panelPrefs.sortBy]
  );

  const suiviLives = useMemo(
    () => sortedLives.filter((l) => followingIds.has(l.hostId)),
    [sortedLives, followingIds]
  );

  const suggestionsLives = useMemo(
    () =>
      followingIds.size === 0
        ? sortedLives
        : sortedLives.filter((l) => !followingIds.has(l.hostId)),
    [sortedLives, followingIds]
  );

  const updateCountryFilter = useCallback((code: string) => {
    setCountryFilter(setLivesCountryFilter(code));
  }, []);

  const activeCountryLabel = useMemo(() => {
    if (countryFilter === LIVES_COUNTRY_FILTER_ALL) return null;
    return countryOptions.find((o) => o.code === countryFilter)?.name ?? countryFilter;
  }, [countryFilter, countryOptions]);

  const activeSortLabel = useMemo(
    () => NEARBY_SORT_OPTIONS.find((o) => o.id === panelPrefs.sortBy)?.label ?? null,
    [panelPrefs.sortBy],
  );

  const hasActiveFilters =
    panelPrefs.sortBy !== 'none' ||
    (showCountryFilter && countryFilter !== LIVES_COUNTRY_FILTER_ALL);

  const resetFilters = useCallback(() => {
    updateCountryFilter(LIVES_COUNTRY_FILTER_ALL);
    updatePanelPrefs({ sortBy: 'none' });
  }, [updateCountryFilter, updatePanelPrefs]);

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {showFilterButton && (
        <div className="shrink-0 px-3 pt-2 pb-2 border-b border-[#1e1e2f]/80 flex items-center gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {!settingsOpen && hasActiveFilters ? (
              <>
                {activeSortLabel ? (
                  <span className="shrink-0 inline-flex items-center min-h-8 px-2.5 rounded-full bg-red-500/10 border border-red-500/25 text-[11px] font-semibold text-red-200">
                    {activeSortLabel}
                  </span>
                ) : null}
                {activeCountryLabel ? (
                  <span className="shrink-0 inline-flex items-center min-h-8 px-2.5 rounded-full bg-[#1a1a26] border border-[#2d2d3d] text-[11px] font-semibold text-gray-300">
                    {activeCountryLabel}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-xs text-gray-500 truncate">Tous les lives en direct</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            title="Filtres lives"
            aria-label="Filtres lives"
            aria-expanded={settingsOpen}
            className={`relative shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border transition touch-manipulation ${
              settingsOpen || hasActiveFilters
                ? 'border-red-500/40 bg-red-500/10 text-red-200'
                : 'border-[#2d2d3d] text-gray-400 hover:text-gray-200 hover:border-[#3d3d4d] hover:bg-[#1a1a26]'
            }`}
          >
            <FilterIcon className="w-5 h-5" />
            {hasActiveFilters && !settingsOpen ? (
              <span
                className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500 ring-2 ring-[#0b0b0f]"
                aria-hidden
              />
            ) : null}
          </button>
        </div>
      )}

      <LivesBrowseFilterModal open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <LivesBrowseFilterPanel
          geo={geo}
          onPersistGeo={persistGeo}
          showCountryFilter={showCountryFilter}
          countryOptions={countryOptions}
          countryFilter={countryFilter}
          onCountryFilter={updateCountryFilter}
          sortBy={panelPrefs.sortBy}
          onSortBy={(id) => updatePanelPrefs({ sortBy: id === 'none' ? 'none' : id })}
          onClose={() => setSettingsOpen(false)}
          onReset={resetFilters}
        />
      </LivesBrowseFilterModal>

      {loading && lives.length === 0 && <LiveGridSkeleton />}

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {!loading && followingIds.size > 0 && (
          <div className="px-3 pt-2">
            <h2 className="text-sm font-semibold text-gray-300 px-1 mb-2">Suivi</h2>
            {suiviLives.length === 0 ? (
              <div className="py-5 text-center">
                <p className="text-gray-400 text-sm">Aucun live en cours parmi tes lives suivis</p>
              </div>
            ) : (
              <ul className={`${LIVE_GRID_CLASS} pb-2`}>
                {suiviLives.map((live) => (
                  <LiveGridCard
                    key={live.id}
                    live={live}
                    currentUserId={user?.id}
                    isFollowing={followingIds.has(live.hostId)}
                    onOpenLive={onOpenLive}
                    onFollowingChange={handleFollowingChange}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {!loading && (
          <div className={`px-3 pb-3 ${followingIds.size > 0 ? 'pt-3 border-t border-[#1e1e2f]' : 'pt-2'}`}>
            <h2 className="text-sm font-semibold text-gray-300 px-1 mb-2">Suggestions</h2>
            {suggestionsLives.length === 0 ? (
              <div className="py-5 text-center">
                <p className="text-gray-400 text-sm">Aucun live en cours pour le moment</p>
              </div>
            ) : (
              <ul className={LIVE_GRID_CLASS}>
                {suggestionsLives.map((live) => (
                  <LiveGridCard
                    key={live.id}
                    live={live}
                    currentUserId={user?.id}
                    isFollowing={followingIds.has(live.hostId)}
                    onOpenLive={onOpenLive}
                    onFollowingChange={handleFollowingChange}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
