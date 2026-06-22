import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
  `min-w-[4.25rem] flex-1 px-1.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-semibold border transition whitespace-nowrap ${
    active
      ? 'border-red-500/50 bg-red-500/15 text-red-300'
      : 'border-[#2d2d3d] text-gray-500 hover:text-gray-300'
  }`;

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

  useEffect(() => {
    if (!isActive) return;
    loadLives();
    const interval = setInterval(loadLives, 8000);
    return () => clearInterval(interval);
  }, [isActive, loadLives]);

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

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {settingsOpen && (
        <div className="shrink-0 px-3 pt-3 pb-2 border-b border-[#1e1e2f]">
          <div className="rounded-xl bg-[#12121a] border border-[#1e1e2f] p-3 space-y-3 max-h-[min(40vh,16rem)] overflow-y-auto overscroll-contain">
            <MapLocationPicker mapGeo={geo} onPersist={persistGeo} size="compact" accent="red" />
            {showCountryFilter && (
              <div>
                <p className="text-[10px] text-gray-400 mb-1.5">Pays</p>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => updateCountryFilter(LIVES_COUNTRY_FILTER_ALL)}
                    className={filterChipClass(countryFilter === LIVES_COUNTRY_FILTER_ALL)}
                  >
                    Tous
                  </button>
                  {countryOptions.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => updateCountryFilter(opt.code)}
                      className={filterChipClass(countryFilter === opt.code)}
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-[10px] text-gray-400 mb-1.5">Trier par</p>
              <div className="flex flex-wrap gap-1">
                {NEARBY_SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      updatePanelPrefs({
                        sortBy: panelPrefs.sortBy === opt.id ? 'none' : opt.id,
                      })
                    }
                    className={filterChipClass(panelPrefs.sortBy === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && lives.length === 0 && <LiveGridSkeleton />}

      {showFilterButton && (
        <div className="shrink-0 px-3 pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            title="Filtres lives"
            aria-label="Filtres lives"
            aria-expanded={settingsOpen}
            className={`p-1 rounded-lg transition ${
              settingsOpen ? 'ring-2 ring-red-500/50 bg-red-900/20' : 'hover:bg-[#1a1a26]'
            }`}
          >
            <FilterIcon />
          </button>
        </div>
      )}

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
