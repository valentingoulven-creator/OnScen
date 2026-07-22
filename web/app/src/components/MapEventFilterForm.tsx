import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventLocationInput } from './EventLocationInput';
import {
  applyEventFilterDraftDefaults,
  createDefaultEventFilter,
  DEFAULT_EVENT_FILTER_RADIUS_KM,
  type MapEventFilterCriteria,
  type MapEventFilterEventType,
} from '../lib/mapEventFilter';
import { resolveEventCoords, resolveEventCityCoordsSync, resolveEventCoordsSync } from '../lib/mapEventCoords';
import { getEventTypeIcon, type FeedEventType } from '../lib/eventType';
import { MapEventFilterDateRangeInput } from './MapEventFilterDateRangeInput';

const FILTER_EVENT_TYPES: FeedEventType[] = ['dance', 'chant', 'autre'];

function eventTypeFilterLabel(type: FeedEventType, t: (key: string) => string): string {
  if (type === 'dance') return t('feed.eventTypeDance');
  if (type === 'chant') return t('feed.eventTypeChant');
  return t('feed.eventTypeAutre');
}

function toggleEventTypeFilter(current: MapEventFilterEventType, type: FeedEventType): MapEventFilterEventType {
  return current === type ? 'all' : type;
}

export interface MapEventFilterFormProps {
  active: boolean;
  initialCriteria: MapEventFilterCriteria;
  profileCity?: string;
  onApply: (criteria: MapEventFilterCriteria) => void;
  onCancel?: () => void;
  onPreviewCity?: (latitude: number, longitude: number, location: string) => void;
  idPrefix?: string;
  className?: string;
  /** `inline` = colonne titre browse ; `header` = bandeau pleine largeur ; `standalone` = modal. */
  layout?: 'standalone' | 'header' | 'inline';
}

export function MapEventFilterForm({
  active,
  initialCriteria,
  profileCity,
  onApply,
  onCancel,
  onPreviewCity,
  idPrefix = 'map-event-filter',
  className = '',
  layout = 'standalone',
}: MapEventFilterFormProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<MapEventFilterCriteria>(initialCriteria);
  const [applying, setApplying] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [dateCalendarOpen, setDateCalendarOpen] = useState(false);
  const lastPreviewLocationRef = useRef<string | null>(null);
  const skipLiveApplyRef = useRef(true);
  const liveApplyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      skipLiveApplyRef.current = true;
    }
  }, [active]);

  const commitDraft = useCallback(
    async (source: MapEventFilterCriteria) => {
      setLocationError(null);

      let latitude: number | null = source.latitude;
      let longitude: number | null = source.longitude;
      const location = source.location.trim();

      if (location) {
        if (latitude == null || longitude == null) {
          const coords = await resolveEventCoords(location);
          if (!coords) {
            setLocationError(t('map.eventFilterLocationError'));
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
        ...source,
        location,
        latitude,
        longitude,
        radiusKm: source.radiusKm || DEFAULT_EVENT_FILTER_RADIUS_KM,
      });
    },
    [onApply, t]
  );

  useEffect(() => {
    if (!active || layout !== 'inline') return;

    const location = draft.location.trim();
    const waitingForCoords =
      Boolean(location) && (draft.latitude == null || draft.longitude == null);
    if (waitingForCoords) return;

    if (skipLiveApplyRef.current) {
      skipLiveApplyRef.current = false;
      return;
    }

    if (liveApplyTimerRef.current != null) {
      window.clearTimeout(liveApplyTimerRef.current);
    }
    liveApplyTimerRef.current = window.setTimeout(() => {
      liveApplyTimerRef.current = null;
      void commitDraft(draft);
    }, 320);

    return () => {
      if (liveApplyTimerRef.current != null) {
        window.clearTimeout(liveApplyTimerRef.current);
        liveApplyTimerRef.current = null;
      }
    };
  }, [
    active,
    layout,
    commitDraft,
    draft.dateFrom,
    draft.dateTo,
    draft.eventType,
    draft.location,
    draft.latitude,
    draft.longitude,
    draft.radiusKm,
  ]);

  useEffect(() => {
    return () => {
      if (liveApplyTimerRef.current != null) {
        window.clearTimeout(liveApplyTimerRef.current);
      }
    };
  }, []);

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
    if (!active) {
      lastPreviewLocationRef.current = null;
      setDateCalendarOpen(false);
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
    skipLiveApplyRef.current = true;
  }, [active, initialCriteria, profileCity, previewMapCity]);

  useEffect(() => {
    if (!active) return;
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
  }, [active, draft.location, draft.latitude, draft.longitude, previewMapCity]);

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
    await commitDraft(draft);
    setApplying(false);
  }, [commitDraft, draft]);

  if (!active) return null;

  const isHeader = layout === 'header';
  const isInline = layout === 'inline';

  if (isInline) {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 min-w-0 ${className}`.trim()}>
        <div className="w-[min(100%,8.75rem)] shrink-0">
          <MapEventFilterDateRangeInput
            idPrefix={`${idPrefix}-date`}
            dateFrom={draft.dateFrom}
            dateTo={draft.dateTo}
            minimal
            onOpenChange={setDateCalendarOpen}
            onChange={({ dateFrom, dateTo }) =>
              setDraft((d) => ({ ...d, dateFrom, dateTo }))
            }
          />
        </div>
        <div
          className="flex items-center gap-0.5 shrink-0"
          role="group"
          aria-label={t('map.eventFilterTypeLabel')}
        >
          {FILTER_EVENT_TYPES.map((type) => {
            const selected = draft.eventType === type;
            const label = eventTypeFilterLabel(type, t);
            return (
              <button
                key={type}
                type="button"
                aria-pressed={selected}
                aria-label={label}
                title={label}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    eventType: toggleEventTypeFilter(d.eventType, type),
                  }))
                }
                className={`w-8 h-8 flex items-center justify-center rounded-md border text-sm leading-none transition touch-manipulation ${
                  selected
                    ? 'bg-purple-600/40 border-purple-400/60'
                    : 'bg-[#0b0b0f]/80 border-[#2a2a3d] opacity-75 hover:opacity-100 hover:border-purple-500/35'
                }`}
              >
                <span aria-hidden>{getEventTypeIcon(type)}</span>
              </button>
            );
          })}
        </div>
        <div className="min-w-[5.5rem] flex-1 max-w-[min(100%,11rem)]">
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
            placeholder={t('map.eventFilterLocationShort')}
            inputClassName="w-full rounded-md bg-[#0b0b0f] border border-[#2a2a3d] px-2 py-1.5 text-[11px] text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="shrink-0 text-[10px] font-medium text-gray-500 hover:text-purple-200 transition min-h-8 px-1 touch-manipulation"
        >
          {t('map.eventFilterResetShort')}
        </button>
        {locationError ? (
          <p className="w-full basis-full text-[10px] text-red-400 leading-snug -mt-0.5">
            {locationError}
          </p>
        ) : null}
      </div>
    );
  }

  const isCompact = isHeader;
  const rootClass = isHeader
    ? `shrink-0 border-t border-white/10 ${className}`.trim()
    : `flex flex-col min-h-0 flex-1 ${className}`.trim();
  const fieldsClass = isHeader
    ? `px-4 py-3 space-y-3 ${dateCalendarOpen ? '' : 'max-h-[min(38dvh,16rem)] overflow-y-auto overscroll-contain'}`.trim()
    : 'flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-3';
  const actionsClass = isHeader
    ? 'shrink-0 px-4 py-2.5 border-t border-white/10 flex flex-wrap gap-2 bg-[#0e0e14]/95'
    : 'shrink-0 px-3 py-3 border-t border-white/10 flex flex-wrap gap-2 bg-[#0e0e14]';

  return (
    <div className={rootClass}>
      <div className={fieldsClass}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
            {t('map.eventFilterDateLabel')}
          </p>
          <MapEventFilterDateRangeInput
            idPrefix={`${idPrefix}-date`}
            dateFrom={draft.dateFrom}
            dateTo={draft.dateTo}
            compact={isCompact}
            onOpenChange={isCompact ? setDateCalendarOpen : undefined}
            onChange={({ dateFrom, dateTo }) =>
              setDraft((d) => ({ ...d, dateFrom, dateTo }))
            }
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {t('map.eventFilterTypeLabel')}
            </p>
            {draft.eventType === 'all' ? (
              <span className="text-[10px] text-purple-300/80">{t('map.eventFilterTypeAll')}</span>
            ) : null}
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={t('map.eventFilterTypeLabel')}
          >
            {FILTER_EVENT_TYPES.map((type) => {
              const selected = draft.eventType === type;
              const label = eventTypeFilterLabel(type, t);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selected}
                  aria-label={label}
                  title={label}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      eventType: toggleEventTypeFilter(d.eventType, type),
                    }))
                  }
                  className={`w-11 h-11 flex items-center justify-center rounded-xl border text-xl leading-none transition touch-manipulation ${
                    selected
                      ? 'bg-purple-600/35 border-purple-400/70 shadow-sm shadow-purple-900/30 scale-[1.02]'
                      : 'bg-[#0b0b0f] border-[#2a2a3d] opacity-80 hover:opacity-100 hover:border-purple-500/40'
                  }`}
                >
                  <span aria-hidden>{getEventTypeIcon(type)}</span>
                </button>
              );
            })}
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

      <div className={actionsClass}>
        <button
          type="button"
          onClick={handleReset}
          disabled={applying}
          className="px-4 py-2 rounded-full text-xs font-semibold border border-[#2d2d3d] text-gray-300 hover:border-purple-500/40 hover:text-purple-200 transition disabled:opacity-50 min-h-[44px]"
        >
          {t('map.eventFilterReset')}
        </button>
        <div className="flex-1" />
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={applying}
            className="px-4 py-2 rounded-full text-xs font-semibold border border-[#2d2d3d] text-gray-300 hover:text-white transition disabled:opacity-50 min-h-[44px]"
          >
            {t('common.cancel')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={applying}
          className="px-5 py-2 rounded-full text-xs font-bold bg-purple-600/80 border border-purple-400/60 text-white hover:bg-purple-600 transition disabled:opacity-60 flex items-center gap-2 min-h-[44px]"
        >
          {applying && (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {t('map.eventFilterApply')}
        </button>
      </div>
    </div>
  );
}
