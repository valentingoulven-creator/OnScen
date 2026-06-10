import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  getLivesGeo,
  setLivesGeo,
  setLivesGeoRadiusKm,
  MAP_GEO_CHANGED_EVENT,
  type LivesGeoPrefs,
} from '../lib/livesGeo';
import { MapLocationPicker } from '../components/MapLocationPicker';
import {
  clampNearbyRadiusKm,
  formatRadiusKm,
  NEARBY_RADIUS_HARD_MAX,
  NEARBY_RADIUS_MAX,
  NEARBY_RADIUS_MIN,
} from '../lib/settings';
import { FilterIcon } from '../components/FilterIcon';
import { FollowUserButton } from '../components/FollowUserButton';
import { UsernameDisplay } from '../components/UsernameDisplay';
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
import { formatCompactCount } from '../lib/formatCount';
import { dicebearAdventurerAvatar } from '../lib/avatarUrl';
import {
  collectLiveCountryOptions,
  filterLivesByCountry,
  getLivesCountryFilter,
  hasLivesOutsideFrance,
  LIVES_COUNTRY_FILTER_ALL,
  setLivesCountryFilter,
} from '../lib/liveCountry';
import type { Live } from '../types';
import { StartLiveMediaSetupModal } from '../components/StartLiveMediaSetupModal';

function formatLiveViewersLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n < 1000) {
    return n === 1 ? '1 spectateur' : `${n} spectateurs`;
  }
  const compact = formatCompactCount(n).replace('.', ',').replace('K', ' k').replace('M', ' M');
  return `${compact} spectateurs`;
}

interface LivesTabPageProps {
  onOpenLive: (liveId: string) => void;
  isActive?: boolean;
}

interface LiveGridCardProps {
  live: Live;
  currentUserId?: string;
  isFollowing: boolean;
  onOpenLive: (liveId: string) => void;
  onFollowingChange: (hostId: string, following: boolean) => void;
}

const LiveGridCard = memo(function LiveGridCard({
  live,
  currentUserId,
  isFollowing,
  onOpenLive,
  onFollowingChange,
}: LiveGridCardProps) {
  return (
    <li>
      <button
        onClick={() => onOpenLive(live.id)}
        className="w-full flex flex-col text-left group"
      >
        <div className="relative aspect-video w-full bg-[#0b0b0f] overflow-hidden rounded-lg">
          {live.playbackState.albumArtUrl ? (
            <img
              src={live.playbackState.albumArtUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a26] to-[#0b0b0f]" />
          )}
          <span
            className="absolute top-2 left-2 size-2.5 rounded-full bg-red-500 ring-2 ring-red-500/40 shadow-[0_0_6px_rgba(239,68,68,0.6)] live-indicator-dot"
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
        <div className="flex items-start gap-2 mt-2 min-w-0">
          <img
            src={dicebearAdventurerAvatar(live.hostId)}
            alt=""
            className="size-9 shrink-0 rounded-full object-cover bg-[#1a1a26]"
          />
          <div className="flex-1 min-w-0 overflow-hidden leading-tight">
            <p className="text-sm font-semibold text-white truncate">{live.title}</p>
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

export function LivesTabPage({ onOpenLive, isActive = true }: LivesTabPageProps) {
  const { token, user } = useAuth();
  const [lives, setLives] = useState<Live[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [mediaSetupOpen, setMediaSetupOpen] = useState(false);
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
    if (!isActive || !token) return;
    api.getMyFollowing(token).then((r) => setFollowingIds(new Set(r.followingIds)));
  }, [isActive, token]);

  const persistGeo = useCallback((next: LivesGeoPrefs) => {
    setGeo(next);
    setLivesGeo(next);
  }, []);

  useEffect(() => {
    const syncGeo = () => setGeo(getLivesGeo());
    window.addEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    return () => window.removeEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
  }, []);

  const updatePanelPrefs = useCallback((patch: Partial<Pick<NearbyPanelPreferences, 'sortBy'>>) => {
    setPanelPrefs(setNearbyPanelPreferences(patch));
  }, []);

  const toggleSettingsOpen = useCallback(() => setSettingsOpen((v) => !v), []);

  const handleFollowingChange = useCallback((hostId: string, following: boolean) => {
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (following) next.add(hostId);
      else next.delete(hostId);
      return next;
    });
  }, []);

  const distanceFilterActive = isNearbyDistanceFilterActive(panelPrefs);

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
      .then((r) => setLives(r.lives.filter((l) => l.isActive)))
      .finally(() => setLoading(false));
  }, [token, geo.latitude, geo.longitude, geo.radiusKm, panelPrefs.sortBy]);

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

  const updateCountryFilter = useCallback((code: string) => {
    setCountryFilter(setLivesCountryFilter(code));
  }, []);

  const changeRadius = (km: number) => {
    if (!Number.isFinite(km)) return;
    const radiusKm = clampNearbyRadiusKm(km);
    setGeo((prev) => ({ ...prev, radiusKm }));
    setLivesGeoRadiusKm(radiusKm);
  };

  const changeRadiusInput = (raw: string) => {
    const n = Number(raw);
    if (!raw.trim() || !Number.isFinite(n)) return;
    changeRadius(n);
  };

  const filterChipClass = (active: boolean) =>
    `min-w-[4.25rem] flex-1 px-1.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-semibold border transition whitespace-nowrap ${
      active
        ? 'border-red-500/50 bg-red-500/15 text-red-300'
        : 'border-[#2d2d3d] text-gray-500 hover:text-gray-300'
    }`;

  const radiusControls = (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-gray-400">Rayon</span>
        <span className="text-red-400 font-bold">{formatRadiusKm(geo.radiusKm)}</span>
      </div>
      <input
        type="range"
        min={NEARBY_RADIUS_MIN}
        max={NEARBY_RADIUS_MAX}
        step={1}
        value={Math.min(geo.radiusKm, NEARBY_RADIUS_MAX)}
        onChange={(e) => changeRadius(Number(e.target.value))}
        className="w-full accent-red-500 h-1.5"
      />
      <div className="flex items-center gap-1.5 mt-1.5">
        <input
          type="number"
          min={NEARBY_RADIUS_MIN}
          step={1}
          value={geo.radiusKm >= NEARBY_RADIUS_HARD_MAX ? '' : geo.radiusKm}
          placeholder="ex : 1000"
          onChange={(e) => changeRadiusInput(e.target.value)}
          onBlur={(e) => changeRadiusInput(e.target.value)}
          className="w-16 px-1.5 py-1 rounded-lg bg-[#0b0b0f] border border-[#2a2a3f] text-[10px] text-white text-center"
          aria-label="Distance en kilomètres"
        />
        <span className="text-[10px] text-gray-500">km</span>
        <button
          type="button"
          onClick={() => changeRadius(NEARBY_RADIUS_HARD_MAX)}
          className={`text-[9px] px-1.5 py-0.5 rounded border transition ${
            geo.radiusKm >= NEARBY_RADIUS_HARD_MAX
              ? 'border-red-500/50 bg-red-500/15 text-red-300'
              : 'border-[#2d2d3d] text-gray-500 hover:text-gray-300'
          }`}
          title="Rayon illimité (20 000 km)"
        >
          Illimité
        </button>
      </div>
      <p className="text-[9px] text-gray-600 mt-1">
        Curseur : 1–500 km · Saisie manuelle : ex. 1 000, 5 000 km
      </p>
    </div>
  );

  const launchLiveAfterSetup = async () => {
    if (!token) return;
    setStarting(true);
    try {
      const { live } = await api.startLive(token, `Live — ${user?.username}`, {
        latitude: geo.latitude,
        longitude: geo.longitude,
      });
      loadLives();
      onOpenLive(live.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impossible de démarrer le live');
    } finally {
      setStarting(false);
    }
  };

  const startMyLive = () => {
    if (!token || starting) return;
    setMediaSetupOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0b0b0f]">
      <div className="p-4 border-b border-[#1e1e2f] bg-gradient-to-b from-red-950/30 to-transparent">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Lives
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={startMyLive}
              disabled={starting || mediaSetupOpen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-full text-xs font-bold text-white disabled:opacity-50"
            >
              {starting ? (
                '...'
              ) : (
                <>
                  <span
                    className="w-1.5 h-1.5 shrink-0 rounded-full bg-white animate-pulse"
                    aria-hidden="true"
                  />
                  <span className="leading-none">Démarrer mon Live</span>
                </>
              )}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Sessions en direct avec chat rapide et réactions
        </p>

        {!settingsOpen && distanceFilterActive && (
          <div className="rounded-xl bg-[#12121a] border border-[#1e1e2f] p-3">
            {radiusControls}
          </div>
        )}

        {settingsOpen && (
          <div className="rounded-xl bg-[#12121a] border border-[#1e1e2f] p-3 space-y-3 max-h-[min(52vh,18rem)] overflow-y-auto overscroll-contain">
            <MapLocationPicker
              mapGeo={geo}
              onPersist={persistGeo}
              size="compact"
              accent="red"
            />

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

            {distanceFilterActive && radiusControls}
          </div>
        )}
      </div>

      {loading && (
        <p className="p-8 text-center text-gray-500 text-sm">Chargement des lives...</p>
      )}

      {!loading && sortedLives.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-gray-400 text-sm">
            {showCountryFilter && countryFilter !== LIVES_COUNTRY_FILTER_ALL
              ? 'Aucun live en cours dans ce pays'
              : distanceFilterActive
                ? `Aucun live en cours dans un rayon de ${geo.radiusKm} km`
                : 'Aucun live en cours pour le moment'}
          </p>
          <p className="text-gray-500 text-xs mt-2">
            {showCountryFilter && countryFilter !== LIVES_COUNTRY_FILTER_ALL
              ? 'Choisissez un autre pays ou affichez tous les lives'
              : distanceFilterActive
                ? 'Élargissez le rayon, changez de ville ou désactivez le tri par distance'
                : 'Revenez plus tard ou lancez votre propre session'}
          </p>
        </div>
      )}

      <div className="px-3 pt-2 flex justify-end">
        <button
          type="button"
          onClick={toggleSettingsOpen}
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

      <ul className="px-3 pb-3 pt-1 grid grid-cols-2 gap-x-2 gap-y-4">
        {sortedLives.map((live) => (
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

      <StartLiveMediaSetupModal
        open={mediaSetupOpen}
        onClose={() => setMediaSetupOpen(false)}
        onReady={() => {
          setMediaSetupOpen(false);
          void launchLiveAfterSetup();
        }}
      />
    </div>
  );
}


