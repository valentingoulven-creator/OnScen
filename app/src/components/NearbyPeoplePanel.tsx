import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlatformListeningIcon } from './PlatformListeningIcon';
import type { NearbyPerson } from '../types';
import { SETTINGS_CHANGED_EVENT } from '../lib/settings';
import {
  filterNearbyPeople,
  getNearbyPanelPreferences,
  nearbyPanelFiltersActive,
  setNearbyPanelPreferences,
  setNearbyPanelRadiusKm,
  type NearbyPanelPreferences,
  type NearbyPlatformFilter,
} from '../lib/nearbyPanelSettings';
import {
  getLivesGeo,
  setLivesGeo,
  PRESET_CITIES,
  MAP_GEO_CHANGED_EVENT,
  type LivesGeoPrefs,
} from '../lib/livesGeo';

const ROLE_SHORT: Record<string, string> = {
  auditeur: 'Auditeur',
  host: 'Host',
  les_deux: 'Host & auditeur',
};

function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
      />
    </svg>
  );
}

interface NearbyPeoplePanelProps {
  people: NearbyPerson[];
  loading?: boolean;
  selectedSalonId?: string | null;
  onSelectPerson: (person: NearbyPerson) => void;
  onOpenProfile: (person: NearbyPerson) => void;
  onHide?: () => void;
}

const PLATFORM_OPTIONS: { id: NearbyPlatformFilter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'spotify', label: 'Spotify' },
  { id: 'youtube', label: 'YouTube' },
];

export function NearbyPeoplePanel({
  people,
  loading,
  selectedSalonId,
  onSelectPerson,
  onOpenProfile,
  onHide,
}: NearbyPeoplePanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<NearbyPanelPreferences>(() => getNearbyPanelPreferences());
  const [mapGeo, setMapGeo] = useState<LivesGeoPrefs>(() => getLivesGeo());
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setPrefs(getNearbyPanelPreferences());
    const syncGeo = () => setMapGeo(getLivesGeo());
    window.addEventListener(SETTINGS_CHANGED_EVENT, sync);
    window.addEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, sync);
      window.removeEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    };
  }, []);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return PRESET_CITIES;
    return PRESET_CITIES.filter((c) => c.label.toLowerCase().includes(q));
  }, [citySearch]);

  const persistMapGeo = useCallback((next: LivesGeoPrefs) => {
    setMapGeo(next);
    setLivesGeo(next);
  }, []);

  const selectCity = (city: (typeof PRESET_CITIES)[number]) => {
    const current = getLivesGeo();
    persistMapGeo({
      latitude: city.latitude,
      longitude: city.longitude,
      radiusKm: current.radiusKm,
      label: city.label,
      source: 'city',
    });
    setShowCityPicker(false);
    setCitySearch('');
    setGeoError(null);
  };

  const useMyPosition = () => {
    if (!navigator.geolocation) {
      setGeoError('Géolocalisation non disponible');
      return;
    }
    setLocating(true);
    setGeoError(null);
    const current = getLivesGeo();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        persistMapGeo({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          radiusKm: current.radiusKm,
          label: 'Ma position',
          source: 'my_position',
        });
        setLocating(false);
        setShowCityPicker(false);
      },
      () => {
        setLocating(false);
        setGeoError('Impossible d\'obtenir votre position');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const filteredPeople = useMemo(
    () => filterNearbyPeople(people, prefs),
    [people, prefs.platformFilter, prefs.livesOnly]
  );

  const filtersActive = nearbyPanelFiltersActive(prefs);

  const updatePrefs = (patch: Partial<Pick<NearbyPanelPreferences, 'platformFilter' | 'livesOnly'>>) => {
    setPrefs(setNearbyPanelPreferences(patch));
  };

  const applyRadius = (km: number) => {
    const v = setNearbyPanelRadiusKm(km);
    setPrefs((p) => ({ ...p, radiusKm: v }));
  };

  const countLabel = () => {
    if (loading) return '...';
    if (filtersActive && filteredPeople.length !== people.length) {
      return `${filteredPeople.length} / ${people.length}`;
    }
    return String(people.length);
  };

  return (
    <aside className="shrink-0 w-[9.5rem] sm:w-56 flex flex-col min-h-0 bg-[#12121a]/95 border-r border-[#1e1e2f] z-20 backdrop-blur-md">
      <div className="shrink-0 px-2.5 sm:px-3 py-2.5 border-b border-[#1e1e2f]">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <h2 className="text-xs font-bold text-purple-400 uppercase tracking-wider">À proximité</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {countLabel()} personne{people.length !== 1 ? 's' : ''}
              {filtersActive && !loading ? ' (filtré)' : ''}
            </p>
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
                  : 'text-gray-500 hover:text-white hover:bg-[#1a1a26]'
              }`}
            >
              <GearIcon className="w-4 h-4" />
            </button>
            {onHide && (
              <button
                type="button"
                onClick={onHide}
                title="Masquer la liste"
                aria-label="Masquer les personnes à proximité"
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#1a1a26]"
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

        {settingsOpen && (
          <div className="mt-3 pt-3 border-t border-[#1e1e2f]/80 space-y-3">
            <div>
              <p className="text-[10px] text-gray-400 mb-1.5">Ville</p>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setShowCityPicker((v) => !v)}
                  className="w-full px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-[#1a1a26] text-gray-200 border border-[#2a2a3f] hover:border-purple-500/40 text-left truncate"
                >
                  {mapGeo.label}
                </button>
                <button
                  type="button"
                  onClick={useMyPosition}
                  disabled={locating}
                  className="w-full px-2 py-1 rounded-lg text-[9px] font-semibold text-purple-300 border border-purple-500/30 hover:bg-purple-900/20 disabled:opacity-50"
                >
                  {locating ? 'Localisation…' : 'Ma position'}
                </button>
              </div>
              {geoError && <p className="text-[9px] text-red-400 mt-1">{geoError}</p>}
              {showCityPicker && (
                <div className="mt-2 space-y-1.5">
                  <input
                    type="search"
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    placeholder="Rechercher…"
                    className="w-full px-2 py-1.5 rounded-lg bg-[#0b0b0f] border border-[#2a2a3f] text-[10px] text-white placeholder:text-gray-500"
                  />
                  <ul className="max-h-28 overflow-y-auto space-y-0.5">
                    {filteredCities.map((city) => (
                      <li key={city.id}>
                        <button
                          type="button"
                          onClick={() => selectCity(city)}
                          className="w-full text-left px-2 py-1.5 rounded-lg text-[10px] text-gray-200 hover:bg-[#1a1a26]"
                        >
                          {city.label}
                        </button>
                      </li>
                    ))}
                    {filteredCities.length === 0 && (
                      <li className="px-2 py-1.5 text-[10px] text-gray-500">Aucune ville</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-gray-400">Distance</span>
                <span className="text-purple-400 font-bold">{prefs.radiusKm} km</span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={1}
                value={prefs.radiusKm}
                onChange={(e) => applyRadius(Number(e.target.value))}
                className="w-full accent-purple-500 h-1.5"
              />
            </div>

            <div>
              <p className="text-[10px] text-gray-400 mb-1.5">Application</p>
              <div className="flex flex-wrap gap-1">
                {PLATFORM_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePrefs({ platformFilter: opt.id })}
                    className={`flex-1 min-w-0 px-1.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-semibold border transition ${
                      prefs.platformFilter === opt.id
                        ? opt.id === 'spotify'
                          ? 'border-green-500/50 bg-green-500/15 text-green-300'
                          : opt.id === 'youtube'
                            ? 'border-red-500/50 bg-red-500/15 text-red-300'
                            : 'border-purple-500/50 bg-purple-500/15 text-purple-300'
                        : 'border-[#2d2d3d] text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-[10px] text-gray-300">Lives uniquement</span>
              <input
                type="checkbox"
                checked={prefs.livesOnly}
                onChange={(e) => updatePrefs({ livesOnly: e.target.checked })}
                className="melosong-checkbox scale-90"
              />
            </label>
          </div>
        )}
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto py-1">
        {loading && filteredPeople.length === 0 && people.length === 0 && (
          <li className="px-3 py-6 text-center text-[10px] text-gray-500">Chargement...</li>
        )}

        {!loading && filteredPeople.length === 0 && (
          <li className="px-2 sm:px-3 py-6 text-center text-[10px] text-gray-500 leading-snug">
            {people.length === 0
              ? 'Personne à proximité pour le moment'
              : 'Aucun résultat avec ces filtres'}
          </li>
        )}

        {filteredPeople.map((p) => {
          const active = p.salonId && p.salonId === selectedSalonId;
          return (
            <li key={p.id}>
              <div
                className={`w-full flex items-center gap-2 px-2 sm:px-2.5 py-2 transition ${
                  active
                    ? 'bg-purple-900/40 border-l-2 border-purple-500'
                    : 'hover:bg-[#1a1a26] border-l-2 border-transparent'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProfile(p);
                  }}
                  className="relative shrink-0 rounded-full ring-0 hover:ring-2 hover:ring-pink-500/50 transition"
                  title={`Profil de ${p.username}`}
                  aria-label={`Voir le profil de ${p.username}`}
                >
                  <img
                    src={p.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${p.id}`}
                    alt=""
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover bg-[#1a1a26]"
                  />
                  {p.listeningPlatform && (
                    <span className="absolute -bottom-0.5 -left-0.5">
                      <PlatformListeningIcon platform={p.listeningPlatform} />
                    </span>
                  )}
                  {p.isLive && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border border-[#12121a]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectPerson(p)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate leading-tight">{p.username}</p>
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
                    </div>
                  </div>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
