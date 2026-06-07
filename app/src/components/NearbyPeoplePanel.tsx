import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { countMusicalAffinityMatches } from '../lib/musicAffinities';
import { FilterIcon } from './FilterIcon';
import { PlatformListeningIcon } from './PlatformListeningIcon';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import type { NearbyPerson } from '../types';
import { SETTINGS_CHANGED_EVENT } from '../lib/settings';
import {
  filterNearbyPeople,
  getNearbyPanelPreferences,
  isNearbyDistanceFilterActive,
  NEARBY_PANEL_CHANGED_EVENT,
  nearbyPanelFiltersActive,
  setNearbyPanelPreferences,
  setNearbyPanelRadiusKm,
  sortNearbyPeople,
  type NearbyPanelPreferences,
  NEARBY_SORT_OPTIONS,
} from '../lib/nearbyPanelSettings';
import type { Salon } from '../types';
import {
  getLivesGeo,
  setLivesGeo,
  setLivesGeoRadiusKm,
  MAP_GEO_CHANGED_EVENT,
  type LivesGeoPrefs,
} from '../lib/livesGeo';
import { MapLocationPicker } from './MapLocationPicker';
import {
  clampNearbyRadiusKm,
  formatRadiusKm,
  NEARBY_RADIUS_HARD_MAX,
  NEARBY_RADIUS_MAX,
  NEARBY_RADIUS_MIN,
} from '../lib/settings';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';

const ROLE_SHORT: Record<string, string> = {
  auditeur: 'Auditeur',
  host: 'Host',
  les_deux: 'Host & auditeur',
};

interface NearbyPeoplePanelProps {
  people: NearbyPerson[];
  salons?: Salon[];
  /** Marqueurs réellement affichés sur la carte (salons + personnes sans salon). */
  mapMarkerCount?: number;
  loading?: boolean;
  selectedSalonId?: string | null;
  /** Panneau latéral (legacy) ou bandeau en bas de la carte. */
  layout?: 'side' | 'bottom';
  /** Clic personne : le parent gère live / salon carte / zoom (jamais profil). */
  onPersonClick: (person: NearbyPerson) => void;
  onHide?: () => void;
  favoriteIds?: Set<string>;
}

interface NearbyPersonRowProps {
  p: NearbyPerson;
  active: boolean;
  affinityMatches: number;
  onPersonClick: (person: NearbyPerson) => void;
}

const NearbyPersonRow = memo(function NearbyPersonRow({
  p,
  active,
  affinityMatches,
  onPersonClick,
}: NearbyPersonRowProps) {
  const viewerCount = p.isLive ? p.liveViewersCount : p.listenersCount;
  const handleClick = () => onPersonClick(p);
  const clickTitle = p.isLive && p.liveId
    ? `Live de ${p.username}`
    : p.salonId
      ? `Salon de ${p.username}`
      : `Localiser ${p.username} sur la carte`;
  return (
    <li>
      <div
        className={`w-full flex items-center gap-1.5 px-2 sm:px-2.5 py-2 transition ${
          active
            ? 'bg-purple-900/40 border-l-2 border-purple-500'
            : 'hover:bg-[var(--ms-surface-elevated)] border-l-2 border-transparent'
        }`}
      >
        <button
          type="button"
          onClick={handleClick}
          className="relative shrink-0 hover:opacity-90 transition"
          title={clickTitle}
          aria-label={clickTitle}
        >
          <UserAvatarOnline
            userId={p.id}
            username={p.username}
            avatarUrl={p.avatarUrl}
            size="sm"
            isLive={p.isLive}
            liveViewersCount={p.isLive ? p.liveViewersCount : undefined}
          />
          {p.listeningPlatform && (
            <span className="absolute top-0 left-0 z-10">
              <PlatformListeningIcon platform={p.listeningPlatform} />
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={handleClick}
          className="flex-1 min-w-0 text-left"
          title={clickTitle}
        >
          <div className="min-w-0">
            <UsernameDisplay
              as="p"
              username={p.username}
              usernameColor={p.usernameColor}
              usernameWaveFrom={p.usernameWaveFrom}
              usernameWaveTo={p.usernameWaveTo}
              className="text-xs font-semibold truncate leading-tight"
            />
            <p className="text-[10px] text-gray-500 truncate hidden sm:block">
              {p.distanceKm != null ? `${p.distanceKm} km` : p.city || 'À proximité'}
              {p.listeningRole && ` · ${ROLE_SHORT[p.listeningRole] ?? p.listeningRole}`}
            </p>
            <p className="text-[10px] text-gray-500 sm:hidden">
              {p.distanceKm != null ? `${p.distanceKm} km` : p.city || 'À proximité'}
            </p>
            {p.salonTitle && (
              <p className="text-[10px] text-purple-400/90 truncate hidden sm:block">{p.salonTitle}</p>
            )}
            {p.hostRatingAverage != null && (
              <p className="text-[10px] text-amber-500/90 hidden sm:block">
                ★ {p.hostRatingAverage}
                {p.hostRatingCount ? ` (${p.hostRatingCount})` : ''}
              </p>
            )}
            <div className="flex flex-wrap gap-1 mt-0.5 sm:hidden">
              {p.isBot && (
                <span className="text-[8px] px-1 rounded bg-cyan-900/40 text-cyan-400">BOT</span>
              )}
              {p.isLive && (
                <span className="text-[8px] px-1 rounded bg-red-900/40 text-red-400">LIVE</span>
              )}
              {!p.isLive && p.salonId && (
                <span className="text-[8px] px-1 rounded bg-purple-900/40 text-purple-400">SALON</span>
              )}
            </div>
          </div>
        </button>
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          {affinityMatches > 0 && (
            <span
              className="text-[8px] px-1 py-0.5 rounded bg-fuchsia-900/35 text-fuchsia-300 leading-none tabular-nums"
              title={`${affinityMatches} point${affinityMatches > 1 ? 's' : ''} en commun avec votre profil`}
            >
              ♫ {affinityMatches}
            </span>
          )}
          {viewerCount != null && viewerCount > 0 && (
            <span
              className="text-[8px] text-gray-500 leading-none tabular-nums"
              title={p.isLive ? 'Spectateurs' : 'Auditeurs'}
            >
              👥 {viewerCount}
            </span>
          )}
        </div>
      </div>
    </li>
  );
});

export function NearbyPeoplePanel({
  people,
  salons = [],
  mapMarkerCount,
  loading,
  selectedSalonId,
  layout = 'bottom',
  onPersonClick,
  onHide,
  favoriteIds,
}: NearbyPeoplePanelProps) {
  const { user } = useAuth();
  const isBottom = layout === 'bottom';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<NearbyPanelPreferences>(() => getNearbyPanelPreferences());
  const [mapGeo, setMapGeo] = useState<LivesGeoPrefs>(() => getLivesGeo());

  useEffect(() => {
    const sync = () => setPrefs(getNearbyPanelPreferences());
    const syncGeo = () => setMapGeo(getLivesGeo());
    window.addEventListener(SETTINGS_CHANGED_EVENT, sync);
    window.addEventListener(NEARBY_PANEL_CHANGED_EVENT, sync);
    window.addEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, sync);
      window.removeEventListener(NEARBY_PANEL_CHANGED_EVENT, sync);
      window.removeEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    };
  }, []);

  const persistMapGeo = useCallback((next: LivesGeoPrefs) => {
    setMapGeo(next);
    setLivesGeo(next);
  }, []);

  const viewerTastes = useMemo(
    () => ({
      interests: user?.interests,
      favoriteGenres: user?.favoriteGenres,
      favoriteArtists: user?.favoriteArtists,
    }),
    [user?.interests, user?.favoriteGenres, user?.favoriteArtists]
  );

  /** Max rows rendered in the DOM — prevents freezing with 10 000+ bots. */
  const MAX_LIST_ITEMS = 300;

  const filteredPeople = useMemo(() => {
    const filtered = filterNearbyPeople(people, prefs, viewerTastes);
    return sortNearbyPeople(filtered, prefs.sortBy, salons, {
      favoriteIds,
      favoritesFirst: true,
      sortByMusicalAffinity: prefs.musicalAffinitiesOnly,
      viewerTastes,
    });
  }, [
    people,
    salons,
    prefs.livesOnly,
    prefs.sortBy,
    prefs.musicalAffinitiesOnly,
    viewerTastes,
    favoriteIds,
  ]);

  const displayedPeople = useMemo(
    () => filteredPeople.slice(0, MAX_LIST_ITEMS),
    [filteredPeople]
  );
  const hiddenCount = filteredPeople.length - displayedPeople.length;

  const filtersActive = nearbyPanelFiltersActive(prefs);

  const updatePrefs = (
    patch: Partial<
      Pick<NearbyPanelPreferences, 'livesOnly' | 'sortBy' | 'musicalAffinitiesOnly'>
    >
  ) => {
    setPrefs(setNearbyPanelPreferences(patch));
  };

  const distanceFilterActive = isNearbyDistanceFilterActive(prefs);

  const applyRadius = (km: number) => {
    if (!Number.isFinite(km)) return;
    const clamped = clampNearbyRadiusKm(km);
    const v = setNearbyPanelRadiusKm(clamped);
    setPrefs((p) => ({ ...p, radiusKm: v }));
    setLivesGeoRadiusKm(v);
  };

  const applyRadiusInput = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    applyRadius(clampNearbyRadiusKm(n));
  };

  const countLabel = () => {
    if (loading) return '...';
    if (filtersActive && filteredPeople.length !== people.length) {
      return `${filteredPeople.length} / ${people.length}`;
    }
    return String(people.length);
  };

  const mapCount =
    mapMarkerCount != null && Number.isFinite(mapMarkerCount) ? mapMarkerCount : null;

  const filterChipClass = (active: boolean) =>
    `min-w-[4.25rem] flex-1 px-1.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-semibold border transition whitespace-nowrap ${
      active
        ? 'border-purple-500/50 bg-purple-500/15 text-purple-300'
        : 'border-[#2d2d3d] text-gray-500 hover:text-gray-300'
    }`;

  const radiusControls = (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-gray-400">Rayon</span>
        <span className="text-purple-400 font-bold">{formatRadiusKm(prefs.radiusKm)}</span>
      </div>
      <input
        type="range"
        min={NEARBY_RADIUS_MIN}
        max={NEARBY_RADIUS_MAX}
        step={1}
        value={Math.min(prefs.radiusKm, NEARBY_RADIUS_MAX)}
        onChange={(e) => applyRadius(Number(e.target.value))}
        className="w-full accent-purple-500 h-1.5"
      />
      <div className="flex items-center gap-1.5 mt-1.5">
        <input
          type="number"
          min={NEARBY_RADIUS_MIN}
          step={1}
          value={prefs.radiusKm >= NEARBY_RADIUS_HARD_MAX ? '' : prefs.radiusKm}
          placeholder="ex : 1000"
          onChange={(e) => applyRadiusInput(e.target.value)}
          onBlur={(e) => applyRadiusInput(e.target.value)}
          className="w-16 px-1.5 py-1 rounded-lg bg-[#0b0b0f] border border-[#2a2a3f] text-[10px] text-white text-center"
          aria-label="Distance en kilomètres"
        />
        <span className="text-[10px] text-gray-500">km</span>
        <button
          type="button"
          onClick={() => applyRadius(NEARBY_RADIUS_HARD_MAX)}
          className={`text-[9px] px-1.5 py-0.5 rounded border transition ${
            prefs.radiusKm >= NEARBY_RADIUS_HARD_MAX
              ? 'border-purple-500/50 bg-purple-500/15 text-purple-300'
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

  const settingsScrollClass = isBottom
    ? 'max-h-[min(52vh,18rem)]'
    : 'max-h-[min(40vh,16rem)] sm:max-h-[min(52vh,18rem)]';

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
            <h2 className={`text-xs font-extrabold uppercase tracking-wider ${USERNAME_WAVE_CLASS}`}>
              {isBottom ? 'Liste à proximité' : 'À proximité'}
            </h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {countLabel()} personne{people.length !== 1 ? 's' : ''}
              {filtersActive && !loading ? ' (filtré)' : ''}
            </p>
            {mapCount != null && !loading && (
              <p className="text-[9px] text-gray-600 mt-0.5">
                {mapCount} sur la carte
                {mapCount !== people.length ? ` · ${people.length} en liste` : ''}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              title="Réglages à proximité"
              aria-label="Réglages à proximité"
              aria-expanded={settingsOpen}
              className={`p-1.5 rounded-lg transition ${
                settingsOpen
                  ? 'text-purple-300 bg-purple-900/40'
                  : 'text-gray-500 hover:text-[var(--ms-text)] hover:bg-[var(--ms-surface-elevated)]'
              }`}
            >
              <FilterIcon />
            </button>
            {onHide && (
              <button
                type="button"
                onClick={onHide}
                title="Masquer la liste"
                aria-label="Masquer les personnes à proximité"
                className="p-1.5 rounded-lg text-gray-500 hover:text-[var(--ms-text)] hover:bg-[var(--ms-surface-elevated)]"
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
      </div>

      {!settingsOpen && distanceFilterActive && (
        <div className="shrink-0 px-2.5 sm:px-3 py-2 border-b border-[var(--ms-border)]/80">
          {radiusControls}
        </div>
      )}

      {settingsOpen && (
        <div
          className={`shrink-0 min-h-0 overflow-y-auto overscroll-contain px-2.5 sm:px-3 py-2.5 border-b border-[var(--ms-border)]/80 space-y-3 ${settingsScrollClass}`}
        >
            <MapLocationPicker
              mapGeo={mapGeo}
              onPersist={persistMapGeo}
              size="compact"
              accent="purple"
            />

            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-[10px] text-gray-300 leading-snug pr-2">
                Affinités musicales
                <span className="block text-[9px] text-gray-500 font-normal">
                  Mêmes centres d&apos;intérêt, genres ou artistes que mon profil
                </span>
              </span>
              <input
                type="checkbox"
                checked={prefs.musicalAffinitiesOnly}
                onChange={(e) => updatePrefs({ musicalAffinitiesOnly: e.target.checked })}
                className="melosong-checkbox scale-90 shrink-0"
              />
            </label>

            <div>
              <p className="text-[10px] text-gray-400 mb-1.5">Trier par</p>
              <div className="flex flex-wrap gap-1">
                {NEARBY_SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      updatePrefs({ sortBy: prefs.sortBy === opt.id ? 'none' : opt.id })
                    }
                    className={filterChipClass(prefs.sortBy === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {distanceFilterActive && radiusControls}

        </div>
      )}

      <ul className="flex-1 min-h-0 overflow-y-auto py-1">
        {loading && filteredPeople.length === 0 && people.length === 0 && (
          <li className="px-3 py-6 text-center text-[10px] text-gray-500">Chargement...</li>
        )}

        {!loading && filteredPeople.length === 0 && (
          <li className="px-2 sm:px-3 py-6 text-center text-[10px] text-gray-500 leading-snug">
            {people.length === 0
              ? 'Personne à proximité pour le moment'
              : prefs.musicalAffinitiesOnly
                ? 'Aucune personne avec des goûts communs pour le moment. Complétez votre profil (intérêts, genres, artistes).'
                : 'Aucun résultat avec ces filtres'}
          </li>
        )}

        {displayedPeople.map((p) => (
          <NearbyPersonRow
            key={p.id}
            p={p}
            active={!!(p.salonId && p.salonId === selectedSalonId)}
            affinityMatches={countMusicalAffinityMatches(viewerTastes, p)}
            onPersonClick={onPersonClick}
          />
        ))}

        {hiddenCount > 0 && (
          <li className="px-3 py-3 text-center text-[10px] text-gray-500 border-t border-[var(--ms-border)]/50">
            +{hiddenCount} personne{hiddenCount > 1 ? 's' : ''} · activez un filtre pour affiner
          </li>
        )}
      </ul>
    </aside>
  );
}
