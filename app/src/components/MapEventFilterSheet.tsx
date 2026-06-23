import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventLocationInput } from './EventLocationInput';
import {
  applyEventFilterDraftDefaults,
  createDefaultEventFilter,
  DEFAULT_EVENT_FILTER_RADIUS_KM,
  type MapEventFilterCriteria,
} from '../lib/mapEventFilter';
import { resolveEventCoords, resolveEventCityCoordsSync, resolveEventCoordsSync } from '../lib/mapEventCoords';

interface MapEventFilterSheetProps {
  open: boolean;
  initialCriteria: MapEventFilterCriteria;
  profileCity?: string;
  onClose: () => void;
  onApply: (criteria: MapEventFilterCriteria) => void;
  /** Vol carte vers la ville sélectionnée (aperçu avant Appliquer). */
  onPreviewCity?: (latitude: number, longitude: number, location: string) => void;
}

export function MapEventFilterSheet({
  open,
  initialCriteria,
  profileCity,
  onClose,
  onApply,
  onPreviewCity,
}: MapEventFilterSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<MapEventFilterCriteria>(initialCriteria);
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

    const next = applyEventFilterDraftDefaults(initialCriteria, profileCity);
    const location = next.location.trim();
    let withCoords = next;

    if (location) {
      const sync =
        resolveEventCoordsSync(location) ?? resolveEventCityCoordsSync(location);
      if (sync) {
        withCoords = { ...next, latitude: sync.latitude, longitude: sync.longitude };
        previewMapCity(sync.latitude, sync.longitude, location);
      }
    }

    setDraft(withCoords);
    setLocationError(null);
    setApplying(false);
  }, [open, initialCriteria, profileCity, previewMapCity]);

  useEffect(() => {
    if (!open) return;
    const location = draft.location.trim();
    if (!location || (draft.latitude != null && draft.longitude != null)) return;

    let cancelled = false;
    void resolveEventCoords(location).then((coords) => {
      if (cancelled || !coords) return;
      setDraft((current) =>
        current.location.trim() === location
          ? { ...current, latitude: coords.latitude, longitude: coords.longitude }
          : current
      );
      previewMapCity(coords.latitude, coords.longitude, location);
    });
    return () => {
      cancelled = true;
    };
  }, [open, draft.location, draft.latitude, draft.longitude, previewMapCity]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleReset = useCallback(() => {
    const next = createDefaultEventFilter(profileCity);
    const location = next.location.trim();
    lastPreviewLocationRef.current = null;

    if (location) {
      const sync =
        resolveEventCoordsSync(location) ?? resolveEventCityCoordsSync(location);
      if (sync) {
        setDraft({ ...next, latitude: sync.latitude, longitude: sync.longitude });
        previewMapCity(sync.latitude, sync.longitude, location);
        setLocationError(null);
        return;
      }
    }

    setDraft(next);
    setLocationError(null);
  }, [profileCity, previewMapCity]);

  const handleApply = useCallback(async () => {
    setApplying(true);
    setLocationError(null);

    let latitude = draft.latitude;
    let longitude = draft.longitude;
    const location = draft.location.trim();

    if (location) {
      const coords = await resolveEventCoords(location);
      if (!coords) {
        setLocationError(t('map.eventFilterLocationError'));
        setApplying(false);
        return;
      }
      latitude = coords.latitude;
      longitude = coords.longitude;
    } else {
      latitude = null;
      longitude = null;
    }

    onApply({
      ...draft,
      location,
      latitude,
      longitude,
      radiusKm: draft.radiusKm || DEFAULT_EVENT_FILTER_RADIUS_KM,
    });
    setApplying(false);
  }, [draft, onApply, t]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-event-filter-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] flex flex-col bg-[#12121a] border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-950/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-purple-500/20 flex items-center justify-between gap-3 bg-purple-950/30">
          <div className="min-w-0">
            <h2 id="map-event-filter-title" className="font-bold text-purple-100 flex items-center gap-2">
              <span aria-hidden>📅</span>
              {t('map.eventFilterTitle')}
            </h2>
            <p className="text-[11px] text-purple-300/70 mt-0.5">{t('map.eventFilterHint')}</p>
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
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              {t('map.eventFilterDateLabel')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5" htmlFor="map-event-filter-from">
                  {t('map.eventFilterDateFrom')}
                </label>
                <input
                  id="map-event-filter-from"
                  type="date"
                  value={draft.dateFrom}
                  onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
                  className="w-full rounded-lg bg-[#0b0b0f] border border-[#2a2a3d] px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5" htmlFor="map-event-filter-to">
                  {t('map.eventFilterDateTo')}
                </label>
                <input
                  id="map-event-filter-to"
                  type="date"
                  value={draft.dateTo}
                  min={draft.dateFrom || undefined}
                  onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
                  className="w-full rounded-lg bg-[#0b0b0f] border border-[#2a2a3d] px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              {t('map.eventFilterTypeLabel')}
            </p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('map.eventFilterTypeLabel')}>
              {(
                [
                  ['all', t('map.eventFilterTypeAll')],
                  ['dance', t('feed.eventTypeDance')],
                  ['chant', t('feed.eventTypeChant')],
                  ['autre', t('feed.eventTypeAutre')],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`cursor-pointer select-none rounded-full px-3 py-1 text-[11px] font-semibold border transition ${
                    draft.eventType === value
                      ? 'bg-purple-600/40 border-purple-400/60 text-purple-100'
                      : 'bg-[#0b0b0f] border-[#2a2a3d] text-gray-400 hover:border-purple-500/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="map-event-filter-type"
                    value={value}
                    checked={draft.eventType === value}
                    onChange={() => setDraft((d) => ({ ...d, eventType: value }))}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

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
            <p className="mt-1 text-[10px] text-gray-500">
              {t('map.eventFilterRadius', { km: draft.radiusKm || DEFAULT_EVENT_FILTER_RADIUS_KM })}
            </p>
            {locationError && <p className="mt-1 text-[11px] text-red-400">{locationError}</p>}
          </div>
        </div>

        <div className="shrink-0 px-3 py-3 border-t border-[#1e1e2f] flex flex-wrap gap-2 bg-[#12121a]">
          <button
            type="button"
            onClick={handleReset}
            disabled={applying}
            className="px-4 py-2 rounded-full text-xs font-semibold border border-[#2d2d3d] text-gray-300 hover:border-purple-500/40 hover:text-purple-200 transition disabled:opacity-50"
          >
            {t('map.eventFilterReset')}
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
            className="px-5 py-2 rounded-full text-xs font-bold bg-purple-600/80 border border-purple-400/60 text-white hover:bg-purple-600 transition disabled:opacity-60 flex items-center gap-2"
          >
            {applying && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {t('map.eventFilterApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
