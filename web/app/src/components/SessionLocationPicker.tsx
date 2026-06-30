import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { MajorCityDto } from '../lib/api/geo';
import {
  findNearestMajorCities,
  matchesPresetCityCoords,
  resolveLocationAnchorCoords,
  type LivesGeoPrefs,
  type PresetCity,
} from '../lib/livesGeo';

export type SessionLocationVariant = 'live' | 'salon';

type LocationMode = 'gps' | 'city';

function segmentClass(active: boolean, variant: SessionLocationVariant): string {
  const base =
    'flex-1 min-h-[40px] px-2 py-1.5 rounded-lg border text-center flex items-center justify-center gap-1.5 transition-colors text-xs font-semibold';
  if (active) {
    return variant === 'salon'
      ? `${base} border-purple-500/60 bg-purple-500/10 text-white`
      : `${base} border-red-500/60 bg-red-500/10 text-white`;
  }
  return `${base} border-[#2d2d3d] bg-[#1a1a26] text-gray-400 hover:border-[#3d3d4d] hover:text-gray-200`;
}

function cityChipClass(active: boolean, variant: SessionLocationVariant): string {
  const base =
    'w-full min-h-[44px] px-3 py-2 rounded-lg border text-left transition-colors flex flex-col gap-0.5';
  if (active) {
    return variant === 'salon'
      ? `${base} border-purple-500/60 bg-purple-500/15 text-white`
      : `${base} border-red-500/60 bg-red-500/15 text-white`;
  }
  return `${base} border-[#2d2d3d] bg-[#12121a] text-gray-200 hover:border-[#3d3d4d]`;
}

function formatDistanceKm(km: number): string {
  if (km < 1) return '< 1';
  return String(Math.round(km));
}

function toPresetLike(city: MajorCityDto): PresetCity {
  return {
    id: city.id,
    label: city.label,
    latitude: city.latitude,
    longitude: city.longitude,
    postalCode: city.postalCode ?? undefined,
  };
}

function localFallbackCities(lat: number, lon: number, limit: number): MajorCityDto[] {
  return findNearestMajorCities(lat, lon, limit).map((city) => ({
    id: city.id,
    name: city.label.split(',')[0]?.trim() || city.label,
    countryCode: city.label.includes('France') ? 'FR' : '',
    label: city.label,
    latitude: city.latitude,
    longitude: city.longitude,
    postalCode: city.postalCode ?? null,
    distanceKm: city.distanceKm,
  }));
}

function IcoPin({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? 'w-4 h-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IcoCity({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? 'w-4 h-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 9h.01M15 9h.01" />
    </svg>
  );
}

export interface SessionLocationPickerProps {
  value: LivesGeoPrefs;
  onChange: (next: LivesGeoPrefs) => void;
  variant?: SessionLocationVariant;
  profileCity?: string;
  anchorLatitude?: number;
  anchorLongitude?: number;
  token?: string | null;
}

export function SessionLocationPicker({
  value,
  onChange,
  variant = 'live',
  profileCity,
  anchorLatitude,
  anchorLongitude,
  token,
}: SessionLocationPickerProps) {
  const { t } = useTranslation();
  const cityModeInitializedRef = useRef(false);
  const [mode, setMode] = useState<LocationMode>(() =>
    value.source === 'my_position' ? 'gps' : 'city'
  );
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [nearestCities, setNearestCities] = useState<MajorCityDto[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const geoAvailable = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

  const anchor = useMemo(
    () =>
      resolveLocationAnchorCoords({
        profileCity,
        anchorLatitude,
        anchorLongitude,
      }),
    [profileCity, anchorLatitude, anchorLongitude]
  );

  useEffect(() => {
    if (mode !== 'city') return;
    let cancelled = false;
    setCitiesLoading(true);
    void api
      .nearestMajorCities(anchor.latitude, anchor.longitude, 3, token)
      .then((res) => {
        if (!cancelled) setNearestCities(res.cities);
      })
      .catch(() => {
        if (!cancelled) {
          setNearestCities(localFallbackCities(anchor.latitude, anchor.longitude, 3));
        }
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, anchor.latitude, anchor.longitude, token]);

  const pickMajorCity = useCallback(
    (city: MajorCityDto) => {
      setGeoError(null);
      onChange({
        ...value,
        latitude: city.latitude,
        longitude: city.longitude,
        label: city.label,
        source: 'city',
      });
    },
    [onChange, value]
  );

  const isCitySelected = useCallback(
    (city: MajorCityDto) =>
      value.source === 'city' && matchesPresetCityCoords(value.latitude, value.longitude, toPresetLike(city)),
    [value.latitude, value.longitude, value.source]
  );

  useEffect(() => {
    setMode(value.source === 'my_position' ? 'gps' : 'city');
  }, [value.source]);

  useEffect(() => {
    if (mode !== 'city') {
      cityModeInitializedRef.current = false;
      return;
    }
    if (cityModeInitializedRef.current || citiesLoading || nearestCities.length === 0) return;
    cityModeInitializedRef.current = true;
    const alreadySelected = nearestCities.some((city) => isCitySelected(city));
    if (!alreadySelected) {
      pickMajorCity(nearestCities[0]!);
    }
  }, [mode, nearestCities, citiesLoading, isCitySelected, pickMajorCity]);

  const requestMyPosition = async () => {
    if (!geoAvailable) {
      setGeoError(t('sessionLocation.geoUnavailable'));
      return;
    }
    setLocating(true);
    setGeoError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 120_000,
        })
      );
      onChange({
        ...value,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        label: t('sessionLocation.myPositionLabel'),
        source: 'my_position',
      });
    } catch {
      setGeoError(t('sessionLocation.geoFailed'));
      setMode('city');
    } finally {
      setLocating(false);
    }
  };

  const accentBadge =
    variant === 'salon'
      ? 'bg-purple-500/10 border-purple-500/30 text-purple-200'
      : 'bg-red-500/10 border-red-500/30 text-red-200';

  return (
    <div className="rounded-xl border border-[#2d2d3d] bg-[#1a1a26]/80 p-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <p className="text-[10px] font-medium text-gray-400 leading-snug">
          {t('sessionLocation.title')}
        </p>
        <span
          className={`shrink-0 max-w-[55%] truncate text-[10px] font-semibold px-2 py-0.5 rounded-full border ${accentBadge}`}
          title={value.label}
        >
          {value.label}
        </span>
      </div>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => {
            setMode('gps');
            setGeoError(null);
            if (value.source !== 'my_position') void requestMyPosition();
          }}
          className={segmentClass(mode === 'gps', variant)}
        >
          <IcoPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{t('sessionLocation.myPosition')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('city');
            setGeoError(null);
          }}
          className={segmentClass(mode === 'city', variant)}
        >
          <IcoCity className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{t('sessionLocation.cityMode')}</span>
        </button>
      </div>

      {mode === 'gps' ? (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-500 leading-snug">
            {t(variant === 'salon' ? 'sessionLocation.salonHintShort' : 'sessionLocation.liveHintShort')}
          </p>
          {value.source !== 'my_position' && (
            <button
              type="button"
              onClick={() => void requestMyPosition()}
              disabled={locating || !geoAvailable}
              className={`w-full min-h-[40px] rounded-lg text-xs font-semibold border transition disabled:opacity-40 ${
                variant === 'salon'
                  ? 'border-purple-500/40 text-purple-200 hover:bg-purple-500/10'
                  : 'border-red-500/40 text-red-200 hover:bg-red-500/10'
              }`}
            >
              {locating ? t('sessionLocation.locating') : t('sessionLocation.activateGps')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-500 leading-snug">
            {t('sessionLocation.nearbyMajorCitiesHint')}
          </p>
          {citiesLoading && nearestCities.length === 0 && (
            <p className="text-[11px] text-gray-500 animate-pulse">
              {t('sessionLocation.suggestionsLoading')}
            </p>
          )}
          <div className="space-y-1.5" role="listbox" aria-label={t('sessionLocation.citySelectLabel')}>
            {nearestCities.map((city, index) => {
              const active = isCitySelected(city);
              return (
                <button
                  key={city.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pickMajorCity(city)}
                  className={cityChipClass(active, variant)}
                >
                  <span className="flex items-center justify-between gap-2 min-w-0 w-full">
                    <span className="truncate text-sm font-semibold">{city.name}</span>
                    <span className="shrink-0 text-[10px] text-gray-500 tabular-nums">
                      {t('sessionLocation.majorCityDistance', {
                        distance: formatDistanceKm(city.distanceKm),
                      })}
                    </span>
                  </span>
                  {index === 0 && (
                    <span className="text-[9px] font-medium text-gray-500">
                      {t('sessionLocation.majorCitySuggested')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {geoError && <p className="text-[10px] text-red-300 leading-snug">{geoError}</p>}
    </div>
  );
}

/** @deprecated Utiliser SessionLocationPicker */
export const LiveStartLocationPicker = SessionLocationPicker;
