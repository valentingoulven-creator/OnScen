import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventLocationInput } from './EventLocationInput';
import { getNearbyPanelPreferences } from '../lib/nearbyPanelSettings';
import { resolveEventCoords } from '../lib/mapEventCoords';
import { isValidLatLng } from '../lib/mapCoords';
import {
  normalizeTag,
  toggleSalonGenreFilter,
  type SalonAffinityGenreFilter,
} from '../lib/musicAffinities';
import { filterCreateSalonGenreSuggestions } from '../lib/createSalonGenres';
import {
  listActiveSalonGenres,
  rankTrendingSalonGenres,
  sortGenresByTrendingPriority,
  type SalonGenreSource,
} from '../lib/salonTrendingGenres';

export type MapSalonFilterCriteria = {
  location: string;
  latitude: number | null;
  longitude: number | null;
  affinityGenres: SalonAffinityGenreFilter | null;
  affinityGenreOptions: string[];
};

interface MapSalonFilterSheetProps {
  open: boolean;
  initialCriteria: MapSalonFilterCriteria;
  profileCity?: string;
  profileGenres?: string[];
  /** Salons visibles sur la carte — sert à calculer les tendances genres. */
  activeSalons?: SalonGenreSource[];
  onClose: () => void;
  onApply: (criteria: MapSalonFilterCriteria) => void;
  onPreviewCity?: (latitude: number, longitude: number, location: string) => void;
}

const DEFAULT_SALON_FILTER: Omit<
  MapSalonFilterCriteria,
  'location' | 'latitude' | 'longitude' | 'affinityGenreOptions'
> = {
  affinityGenres: null,
};

function resolveSalonGenreOptions(
  profileGenres?: string[],
  salonGenres?: string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (g: string) => {
    const label = g.trim();
    const key = normalizeTag(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(label);
  };
  for (const g of salonGenres ?? []) add(g);
  for (const g of profileGenres ?? []) add(g);
  return out;
}

function countSelectedSoundTypes(
  filter: SalonAffinityGenreFilter | null,
  genreOptions: string[]
): number {
  if (filter === 'all') return genreOptions.length;
  if (!filter) return 0;
  return filter.length;
}

const SOUND_TYPE_SUGGESTION_LIMIT = 12;
const SOUND_TYPE_SEARCH_LIMIT = 20;

function resolveSoundTypeSuggestions(
  salonGenres: string[],
  query: string,
  filter: SalonAffinityGenreFilter | null,
  trendingGenres: string[]
): string[] {
  const selectedNorm = new Set(
    filter === 'all'
      ? salonGenres.map(normalizeTag)
      : (filter ?? []).map(normalizeTag)
  );
  let pool = salonGenres.filter((g) => !selectedNorm.has(normalizeTag(g)));

  const q = query.trim();
  if (q) {
    pool = filterCreateSalonGenreSuggestions(pool, q);
    return sortGenresByTrendingPriority(pool, trendingGenres).slice(0, SOUND_TYPE_SEARCH_LIMIT);
  }

  return sortGenresByTrendingPriority(pool, trendingGenres).slice(0, SOUND_TYPE_SUGGESTION_LIMIT);
}

function listSelectedSoundTypes(filter: SalonAffinityGenreFilter | null): string[] {
  if (filter === 'all') return [];
  if (!filter) return [];
  return filter;
}

export function hasSalonFilterCityLocation(criteria: MapSalonFilterCriteria): boolean {
  return Boolean(
    criteria.location.trim() &&
      criteria.latitude != null &&
      criteria.longitude != null &&
      isValidLatLng(criteria.latitude, criteria.longitude)
  );
}

export function MapSalonFilterSheet({
  open,
  initialCriteria,
  profileCity,
  profileGenres,
  activeSalons = [],
  onClose,
  onApply,
  onPreviewCity,
}: MapSalonFilterSheetProps) {
  const { t } = useTranslation();
  const trendingSalonGenres = useMemo(
    () => rankTrendingSalonGenres(activeSalons, SOUND_TYPE_SUGGESTION_LIMIT),
    [activeSalons]
  );
  const activeSalonGenres = useMemo(
    () => listActiveSalonGenres(activeSalons),
    [activeSalons]
  );
  const genreOptions = useMemo(
    () => resolveSalonGenreOptions(profileGenres, activeSalonGenres),
    [profileGenres, activeSalonGenres]
  );
  const [draft, setDraft] = useState<MapSalonFilterCriteria>(initialCriteria);
  const [genreQuery, setGenreQuery] = useState('');
  const [applying, setApplying] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const lastPreviewLocationRef = useRef<string | null>(null);

  const previewMapCity = useCallback(
    (latitude: number, longitude: number, location: string) => {
      const key = location.trim().toLowerCase();
      if (!key || lastPreviewLocationRef.current === key) return;
      lastPreviewLocationRef.current = key;
      onPreviewCity?.(latitude, longitude, location);
    },
    [onPreviewCity]
  );

  useEffect(() => {
    if (!open) {
      lastPreviewLocationRef.current = null;
      return;
    }
    setDraft({
      ...initialCriteria,
      affinityGenreOptions:
        initialCriteria.affinityGenreOptions.length > 0
          ? initialCriteria.affinityGenreOptions
          : genreOptions,
    });
    setLocationError(null);
    setApplying(false);
    setGenreQuery('');
    if (hasSalonFilterCityLocation(initialCriteria)) {
      previewMapCity(
        initialCriteria.latitude!,
        initialCriteria.longitude!,
        initialCriteria.location
      );
    }
  }, [open, initialCriteria, previewMapCity, genreOptions]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleReset = useCallback(() => {
    lastPreviewLocationRef.current = null;
    setDraft({
      ...DEFAULT_SALON_FILTER,
      location: profileCity?.trim() || '',
      latitude: null,
      longitude: null,
      affinityGenreOptions: genreOptions,
    });
    setLocationError(null);
    setGenreQuery('');
  }, [profileCity, genreOptions]);

  const handleApply = useCallback(async () => {
    setApplying(true);
    setLocationError(null);

    let latitude = draft.latitude;
    let longitude = draft.longitude;
    const location = draft.location.trim();

    if (location) {
      if (latitude == null || longitude == null) {
        const coords = await resolveEventCoords(location);
        if (!coords) {
          setLocationError(t('map.eventFilterLocationError'));
          setApplying(false);
          return;
        }
        latitude = coords.latitude;
        longitude = coords.longitude;
      }
    } else {
      latitude = null;
      longitude = null;
    }

    onApply({
      ...draft,
      location,
      latitude,
      longitude,
      affinityGenreOptions: genreOptions,
    });
    setApplying(false);
  }, [draft, onApply, t, genreOptions]);

  const selectAllGenres = useCallback(() => {
    setDraft((d) => ({ ...d, affinityGenres: 'all', affinityGenreOptions: genreOptions }));
  }, [genreOptions]);

  const toggleGenre = useCallback(
    (genre: string) => {
      setDraft((d) => ({
        ...d,
        affinityGenres: toggleSalonGenreFilter(d.affinityGenres, genre, genreOptions),
        affinityGenreOptions: genreOptions,
      }));
    },
    [genreOptions]
  );

  const affinityActive = draft.affinityGenres != null;
  const selectedSoundTypeCount = countSelectedSoundTypes(draft.affinityGenres, genreOptions);
  const selectedSoundTypes = listSelectedSoundTypes(draft.affinityGenres);
  const soundTypeSuggestions = useMemo(
    () =>
      resolveSoundTypeSuggestions(
        activeSalonGenres,
        genreQuery,
        draft.affinityGenres,
        trendingSalonGenres
      ),
    [activeSalonGenres, genreQuery, draft.affinityGenres, trendingSalonGenres]
  );
  const allSoundTypesSelected = draft.affinityGenres === 'all';

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center ms-modal-overlay bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-salon-filter-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] flex flex-col bg-[#12121a] border border-fuchsia-500/40 rounded-2xl shadow-2xl shadow-fuchsia-950/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-fuchsia-500/20 flex items-center justify-between gap-3 bg-fuchsia-950/30">
          <div className="min-w-0">
            <h2 id="map-salon-filter-title" className="font-bold text-fuchsia-100 flex items-center gap-2">
              <span aria-hidden>🎵</span>
              {t('map.salonFilterTitle')}
            </h2>
            <p className="text-[11px] text-fuchsia-300/70 mt-0.5">{t('map.salonFilterHint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none shrink-0"
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              {t('feed.eventLocation')}
            </label>
            <EventLocationInput
              value={draft.location}
              cityPickMode
              onCityPicked={({ label, latitude, longitude }) => {
                lastPreviewLocationRef.current = null;
                setDraft((d) => ({
                  ...d,
                  location: label,
                  latitude,
                  longitude,
                }));
                previewMapCity(latitude, longitude, label);
              }}
              onChange={(value) =>
                setDraft((d) => ({
                  ...d,
                  location: value,
                  latitude: null,
                  longitude: null,
                }))
              }
              profileCity={profileCity}
              placeholder={t('map.eventFilterLocationPlaceholder')}
            />
            {locationError && <p className="mt-1 text-[11px] text-red-400">{locationError}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {t('map.salonFilterSoundTypes')}
                </p>
                {selectedSoundTypeCount > 0 && (
                  <p className="text-[10px] text-fuchsia-300/80 mt-0.5">
                    {t('map.salonFilterSoundTypesCount', { count: selectedSoundTypeCount })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={selectAllGenres}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold border transition ${
                  allSoundTypesSelected
                    ? 'bg-fuchsia-600/40 border-fuchsia-400/60 text-fuchsia-100'
                    : 'border-[#2a2a3d] text-gray-400 hover:border-fuchsia-500/40 hover:text-fuchsia-200'
                }`}
              >
                {t('map.salonFilterAffinitiesAll')}
              </button>
            </div>
            <input
              type="search"
              value={genreQuery}
              onChange={(e) => setGenreQuery(e.target.value)}
              placeholder={t('map.salonFilterSoundTypesSearch')}
              className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-lg px-3 py-2.5 min-h-[44px] text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-fuchsia-500/60"
              autoComplete="off"
              aria-label={t('map.salonFilterSoundTypesSearch')}
            />
            {(allSoundTypesSelected || selectedSoundTypes.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {allSoundTypesSelected ? (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, affinityGenres: null, affinityGenreOptions: genreOptions }))
                    }
                    className="rounded-full px-2.5 py-1 min-h-[44px] sm:min-h-0 text-[10px] font-semibold border border-fuchsia-400/50 bg-fuchsia-600/30 text-fuchsia-100"
                  >
                    {t('map.salonFilterAffinitiesAll')} ×
                  </button>
                ) : (
                  selectedSoundTypes.map((genre) => (
                    <button
                      key={`sel-${genre}`}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className="rounded-full px-2.5 py-1 min-h-[44px] sm:min-h-0 text-[10px] font-semibold border border-fuchsia-400/50 bg-fuchsia-600/30 text-fuchsia-100"
                    >
                      {genre} ×
                    </button>
                  ))
                )}
              </div>
            )}
            {!allSoundTypesSelected && (
              <div className="mt-2 rounded-lg border border-[#2d2d3d] bg-[#0b0b0f]/80 p-1.5">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-600 px-1 pb-1">
                  {activeSalonGenres.length > 0 && !genreQuery.trim()
                    ? t('map.salonFilterSoundTypesTrending')
                    : t('map.salonFilterSoundTypesSuggestions')}
                </p>
                {soundTypeSuggestions.length === 0 ? (
                  <p className="text-[10px] text-gray-500 px-1 py-1">
                    {genreQuery.trim()
                      ? t('map.salonFilterSoundTypesEmpty')
                      : activeSalonGenres.length > 0
                        ? t('map.salonFilterSoundTypesTrendingEmpty')
                        : t('map.salonFilterSoundTypesNoSalonGenres')}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto overscroll-y-contain">
                    {soundTypeSuggestions.map((genre) => (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        className="rounded-full px-2.5 py-1 min-h-[44px] sm:min-h-0 text-[11px] font-semibold border border-[#2a2a3d] text-gray-400 hover:border-fuchsia-500/40 hover:text-fuchsia-200 transition"
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {affinityActive && !(profileGenres?.length ?? 0) && (
              <p className="text-[9px] text-amber-500/80 mt-1.5">
                {t('map.salonFilterAffinitiesProfileHint')}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 px-3 py-3 border-t border-[#1e1e2f] flex flex-wrap gap-2 bg-[#12121a]">
          <button
            type="button"
            onClick={handleReset}
            disabled={applying}
            className="px-4 py-2 rounded-full text-xs font-semibold border border-[#2d2d3d] text-gray-300 hover:border-fuchsia-500/40 hover:text-fuchsia-200 transition disabled:opacity-50"
          >
            {t('map.salonFilterReset')}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="px-4 py-2 rounded-full text-xs font-semibold border border-[#2d2d3d] text-gray-300 hover:text-white transition disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={applying}
            className="px-5 py-2 rounded-full text-xs font-bold bg-fuchsia-600/80 border border-fuchsia-400/60 text-white hover:bg-fuchsia-600 transition disabled:opacity-60 flex items-center gap-2"
          >
            {applying && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {t('map.salonFilterApply')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function getDefaultSalonFilterCriteria(): MapSalonFilterCriteria {
  const prefs = getNearbyPanelPreferences();
  return {
    affinityGenres: prefs.salonAffinityGenres,
    affinityGenreOptions: prefs.salonAffinityGenreOptions,
    location: '',
    latitude: null,
    longitude: null,
  };
}
