import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  getLivesGeo,
  setLivesGeo,
  MAP_GEO_CHANGED_EVENT,
  type LivesGeoPrefs,
} from '../lib/livesGeo';
import { MapLocationPicker } from '../components/MapLocationPicker';
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
import { clearLiveMediaDraft } from '../lib/liveMediaPrefs';
import { LiveStripeConnectGate } from '../components/LiveStripeConnectGate';
import { LiveLegalAcceptanceModal } from '../components/LiveLegalAcceptanceModal';
import { isStripeConnectSkipped, setStripeConnectSkipped } from '../lib/stripeConnectSkip';

function LiveGridSkeleton() {
  return (
    <ul className="px-3 pb-3 pt-1 grid grid-cols-2 gap-x-2 gap-y-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="animate-pulse">
          <div className="aspect-video w-full bg-[#1a1a26] rounded-lg ms-skeleton" />
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

interface LivesTabPageProps {
  onOpenLive: (liveId: string) => void;
  isActive?: boolean;
  hasActiveSalon?: boolean;
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
              loading="lazy"
              decoding="async"
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
            loading="lazy"
            decoding="async"
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

export function LivesTabPage({ onOpenLive, isActive = true, hasActiveSalon = false }: LivesTabPageProps) {
  const { token, user, setUserFromProfile } = useAuth();
  const [lives, setLives] = useState<Live[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [mediaSetupOpen, setMediaSetupOpen] = useState(false);
  const [mediaSetupGeneration, setMediaSetupGeneration] = useState(0);
  const [stripeGateOpen, setStripeGateOpen] = useState(false);
  const [stripeGatePending, setStripeGatePending] = useState(false);
  const [legalGateOpen, setLegalGateOpen] = useState(false);
  const [geo, setGeo] = useState<LivesGeoPrefs>(getLivesGeo);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelPrefs, setPanelPrefs] = useState<NearbyPanelPreferences>(() => getNearbyPanelPreferences());
  const [countryFilter, setCountryFilter] = useState(() => getLivesCountryFilter());

  /** Stripe Connect status — fetched once when tab becomes active. */
  const [stripeChecked, setStripeChecked] = useState(false);
  const [stripeSimulation, setStripeSimulation] = useState(false);
  const [stripeChargesEnabled, setStripeChargesEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isActive || !token || stripeChecked) return;
    api.getDonationsConfig(token)
      .then((config) => {
        setStripeSimulation(config.simulation ?? false);
        if (config.simulation) {
          setStripeChecked(true);
          return;
        }
        if (user?.stripeConnectAccountId) {
          api.getStripeConnectStatus(token)
            .then((s) => setStripeChargesEnabled(s.chargesEnabled ?? false))
            .catch(() => setStripeChargesEnabled(null))
            .finally(() => setStripeChecked(true));
        } else {
          setStripeChecked(true);
        }
      })
      .catch(() => setStripeChecked(true));
  }, [isActive, token, user?.stripeConnectAccountId, stripeChecked]);

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

  const suiviLives = useMemo(
    () => sortedLives.filter((l) => followingIds.has(l.hostId)),
    [sortedLives, followingIds]
  );

  const suggestionsLives = useMemo(
    () => followingIds.size === 0 ? sortedLives : sortedLives.filter((l) => !followingIds.has(l.hostId)),
    [sortedLives, followingIds]
  );

  const updateCountryFilter = useCallback((code: string) => {
    setCountryFilter(setLivesCountryFilter(code));
  }, []);

  const filterChipClass = (active: boolean) =>
    `min-w-[4.25rem] flex-1 px-1.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-semibold border transition whitespace-nowrap ${
      active
        ? 'border-red-500/50 bg-red-500/15 text-red-300'
        : 'border-[#2d2d3d] text-gray-500 hover:text-gray-300'
    }`;

  const launchLiveAfterSetup = async () => {
    if (!token) return;
    setStarting(true);
    try {
      const skipped = isStripeConnectSkipped() || stripeSimulation;
      const { live } = await api.startLive(token, `Live — ${user?.username}`, {
        latitude: geo.latitude,
        longitude: geo.longitude,
        stripeConnectSkipped: skipped || undefined,
      });
      clearLiveMediaDraft();
      setMediaSetupGeneration((g) => g + 1);
      loadLives();
      onOpenLive(live.id);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Impossible de démarrer le live');
    } finally {
      setStarting(false);
    }
  };

  const continueLiveStartAfterStripe = () => {
    if (!user?.liveTermsAcceptedAt) {
      setLegalGateOpen(true);
      return;
    }
    setMediaSetupOpen(true);
  };

  const handleStripeConnectSkip = () => {
    setStripeConnectSkipped();
    setStripeGateOpen(false);
    continueLiveStartAfterStripe();
  };

  const proceedToMediaSetup = () => {
    setStripeGateOpen(false);
    setLegalGateOpen(false);
    setMediaSetupOpen(true);
  };

  const startMyLive = () => {
    if (!token || starting) return;

    // Guard: cannot start a live while already in an active salon session
    if (hasActiveSalon) {
      setStartError("Tu es déjà dans un salon. Quitte le salon pour démarrer un live.");
      return;
    }

    // Gate 1 — Stripe Connect (ignoré en mode simulation ou si l'utilisateur a choisi de passer)
    if (!stripeSimulation && !isStripeConnectSkipped()) {
      if (!user?.stripeConnectAccountId) {
        setStripeGatePending(false);
        setStripeGateOpen(true);
        return;
      }
      if (stripeChargesEnabled === false) {
        setStripeGatePending(true);
        setStripeGateOpen(true);
        return;
      }
    }

    // Gate 2 — Acceptation des règles de diffusion (premier live uniquement)
    if (!user?.liveTermsAcceptedAt) {
      setLegalGateOpen(true);
      return;
    }

    setMediaSetupOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0b0b0f]">
      <div className="px-4 pt-4 pb-3 border-b border-[#1e1e2f]">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />
          <h2 className="text-xl font-bold text-white leading-tight">Lives</h2>
          {lives.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[10px] font-semibold text-purple-300 tabular-nums">
              {lives.length} en cours
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500 mb-3 leading-snug">
          Sessions en direct avec chat et réactions
        </p>

        <button
          type="button"
          onClick={startMyLive}
          disabled={starting || mediaSetupOpen}
          className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-sm font-bold text-white transition-colors"
        >
          {starting ? (
            <span>Démarrage…</span>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Démarrer mon Live</span>
            </>
          )}
        </button>

        {startError && (
          <p className="mt-3 rounded-lg bg-red-950/60 border border-red-500/30 text-red-200 text-xs px-3 py-2" role="alert">
            {startError}
            <button
              type="button"
              onClick={() => setStartError(null)}
              className="ml-2 text-red-400 hover:text-white bg-transparent border-0 p-0 cursor-pointer"
              aria-label="Fermer"
            >
              ×
            </button>
          </p>
        )}

        {settingsOpen && (
          <div className="mt-3 rounded-xl bg-[#12121a] border border-[#1e1e2f] p-3 space-y-3 max-h-[min(52vh,18rem)] overflow-y-auto overscroll-contain">
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
          </div>
        )}
      </div>

      {loading && lives.length === 0 && <LiveGridSkeleton />}

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

      {!loading && followingIds.size > 0 && (
        <div className="px-3 pt-2">
          <h2 className="text-sm font-semibold text-gray-300 px-1 mb-2">Suivi</h2>
          {suiviLives.length === 0 ? (
            <div className="py-5 text-center">
              <p className="text-gray-400 text-sm">Aucun live en cours parmi tes lives suivis</p>
              <p className="text-gray-500 text-xs mt-1">Abonne-toi à des streameurs pour les voir ici</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-x-2 gap-y-4 pb-2">
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
              <p className="text-gray-400 text-sm">
                {showCountryFilter && countryFilter !== LIVES_COUNTRY_FILTER_ALL
                  ? 'Aucun live en cours dans ce pays'
                  : 'Aucun live en cours pour le moment'}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {showCountryFilter && countryFilter !== LIVES_COUNTRY_FILTER_ALL
                  ? 'Choisissez un autre pays ou affichez tous les lives'
                  : 'Reviens plus tard ou lance ta propre session'}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-x-2 gap-y-4">
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

      <StartLiveMediaSetupModal
        key={mediaSetupGeneration}
        open={mediaSetupOpen}
        onClose={() => setMediaSetupOpen(false)}
        onReady={() => {
          setMediaSetupOpen(false);
          void launchLiveAfterSetup();
        }}
      />

      {stripeGateOpen && token && (
        <LiveStripeConnectGate
          token={token}
          isPending={stripeGatePending}
          onClose={() => setStripeGateOpen(false)}
          onSkip={handleStripeConnectSkip}
        />
      )}

      {legalGateOpen && token && (
        <LiveLegalAcceptanceModal
          token={token}
          onClose={() => setLegalGateOpen(false)}
          onAccepted={(acceptedAt) => {
            setUserFromProfile({ ...user!, liveTermsAcceptedAt: acceptedAt });
            proceedToMediaSetup();
          }}
        />
      )}
    </div>
  );
}


