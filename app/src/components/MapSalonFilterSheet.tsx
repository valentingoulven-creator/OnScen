import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventLocationInput } from './EventLocationInput';
import {
  getNearbyPanelPreferences,
  NEARBY_SORT_OPTIONS,
  type NearbyPanelPreferences,
  type NearbySortBy,
} from '../lib/nearbyPanelSettings';
import { resolveEventCoords } from '../lib/mapEventCoords';
import { isValidLatLng } from '../lib/mapCoords';
import type { LivesGeoPrefs } from '../lib/livesGeo';

export type MapSalonFilterCriteria = Pick<
  NearbyPanelPreferences,
  'sortBy' | 'musicalAffinitiesOnly'
> & {
  location: string;
  latitude: number | null;
  longitude: number | null;
};

interface MapSalonFilterSheetProps {
  open: boolean;
  initialCriteria: MapSalonFilterCriteria;
  profileCity?: string;
  onClose: () => void;
  onApply: (criteria: MapSalonFilterCriteria) => void;
  onPreviewCity?: (latitude: number, longitude: number, location: string) => void;
}

const DEFAULT_SALON_FILTER: Omit<MapSalonFilterCriteria, 'location' | 'latitude' | 'longitude'> = {
  sortBy: 'audience',
  musicalAffinitiesOnly: false,
};

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
  onClose,
  onApply,
  onPreviewCity,
}: MapSalonFilterSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<MapSalonFilterCriteria>(initialCriteria);
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
    setDraft(initialCriteria);
    setLocationError(null);
    setApplying(false);
    if (hasSalonFilterCityLocation(initialCriteria)) {
      previewMapCity(
        initialCriteria.latitude!,
        initialCriteria.longitude!,
        initialCriteria.location
      );
    }
  }, [open, initialCriteria, previewMapCity]);

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
    });
    setLocationError(null);
  }, [profileCity]);

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
    });
    setApplying(false);
  }, [draft, onApply, t]);

  const toggleSort = useCallback((id: NearbySortBy) => {
    setDraft((d) => ({ ...d, sortBy: d.sortBy === id ? 'none' : id }));
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
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
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              {t('map.salonFilterSortLabel')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NEARBY_SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleSort(opt.id)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold border transition ${
                    draft.sortBy === opt.id
                      ? 'bg-fuchsia-600/40 border-fuchsia-400/60 text-fuchsia-100'
                      : 'border-[#2a2a3d] text-gray-400 hover:border-fuchsia-500/40 hover:text-fuchsia-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-[#2a2a3d] bg-[#0b0b0f] px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.musicalAffinitiesOnly}
              onChange={(e) => setDraft((d) => ({ ...d, musicalAffinitiesOnly: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-[#2a2a3d] bg-[#12121a] text-fuchsia-500 focus:ring-fuchsia-500/50"
            />
            <span className="min-w-0">
              <span className="text-sm text-white font-medium">{t('map.salonFilterAffinities')}</span>
              <span className="block text-[10px] text-gray-500 mt-0.5 leading-snug">
                {t('map.salonFilterAffinitiesHint')}
              </span>
            </span>
          </label>
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

export function getDefaultSalonFilterCriteria(mapGeo: LivesGeoPrefs): MapSalonFilterCriteria {
  const prefs = getNearbyPanelPreferences();
  return {
    sortBy: prefs.sortBy === 'none' ? 'audience' : prefs.sortBy,
    musicalAffinitiesOnly: prefs.musicalAffinitiesOnly,
    location: mapGeo.label,
    latitude: mapGeo.latitude,
    longitude: mapGeo.longitude,
  };
}
