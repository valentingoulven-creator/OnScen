import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchCities } from '../lib/citySearch';
import {
  coordsForCityName,
  filterPresetCitySuggestions,
  presetCityToSuggestion,
  type LivesGeoPrefs,
} from '../lib/livesGeo';

export type SessionLocationVariant = 'live' | 'salon';

type LocationMode = 'gps' | 'city';

interface CitySuggestion {
  label: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
}

function mapPresetSuggestions(query: string): CitySuggestion[] {
  return filterPresetCitySuggestions(query).map((c) => presetCityToSuggestion(c));
}

function mapRemoteSuggestions(items: Awaited<ReturnType<typeof searchCities>>): CitySuggestion[] {
  return items.flatMap((item) => {
    if (item.latitude == null || item.longitude == null) return [];
    return [
      {
        label: item.label,
        postalCode: item.postalCode,
        latitude: item.latitude,
        longitude: item.longitude,
      },
    ];
  });
}

function mergeCitySuggestions(preset: CitySuggestion[], remote: CitySuggestion[]): CitySuggestion[] {
  const out = [...preset];
  const seen = new Set(preset.map((s) => `${s.label.toLowerCase()}|${s.postalCode ?? ''}`));
  for (const item of remote) {
    const key = `${item.label.toLowerCase()}|${item.postalCode ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 8) break;
  }
  return out;
}

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

function fieldCls(): string {
  return 'w-full px-3 py-2 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-sm text-white focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30';
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
}

export function SessionLocationPicker({
  value,
  onChange,
  variant = 'live',
}: SessionLocationPickerProps) {
  const { t } = useTranslation();
  const listId = useId();
  const cityRootRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<LocationMode>(() =>
    value.source === 'my_position' ? 'gps' : 'city'
  );
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [customCity, setCustomCity] = useState('');
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const geoAvailable = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

  useEffect(() => {
    setMode(value.source === 'my_position' ? 'gps' : 'city');
    if (value.source === 'city' && value.label) {
      setCustomCity(value.label);
    }
  }, [value.source, value.label]);

  useEffect(() => {
    if (mode !== 'city') {
      setSuggestions([]);
      return;
    }
    const q = customCity.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const preset = mapPresetSuggestions(q);
    setSuggestions(preset);
    setActiveIndex(-1);

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingSuggestions(true);
      searchCities(q)
        .then((remote) => {
          if (cancelled) return;
          setSuggestions(mergeCitySuggestions(preset, mapRemoteSuggestions(remote)));
        })
        .catch(() => {
          if (!cancelled) setSuggestions(preset);
        })
        .finally(() => {
          if (!cancelled) setLoadingSuggestions(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customCity, mode]);

  useEffect(() => {
    if (!suggestOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (cityRootRef.current && !cityRootRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [suggestOpen]);

  const useMyPosition = async () => {
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
    } finally {
      setLocating(false);
    }
  };

  const pickSuggestion = (suggestion: CitySuggestion) => {
    setCustomCity(suggestion.label);
    setGeoError(null);
    setSuggestOpen(false);
    setSuggestions([]);
    onChange({
      ...value,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      label: suggestion.label,
      source: 'city',
    });
  };

  const applyCustomCity = () => {
    const query = customCity.trim();
    if (!query) return;
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      pickSuggestion(suggestions[activeIndex]!);
      return;
    }
    const coords = coordsForCityName(query);
    setGeoError(null);
    setSuggestOpen(false);
    onChange({
      ...value,
      latitude: coords.latitude,
      longitude: coords.longitude,
      label: coords.label,
      source: 'city',
    });
  };

  const accentBadge =
    variant === 'salon'
      ? 'bg-purple-500/10 border-purple-500/30 text-purple-200'
      : 'bg-red-500/10 border-red-500/30 text-red-200';

  const showSuggestions = suggestOpen && customCity.trim().length >= 2 && (suggestions.length > 0 || loadingSuggestions);

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
            setSuggestOpen(false);
            if (value.source !== 'my_position') void useMyPosition();
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
              onClick={() => void useMyPosition()}
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
        <div className="flex gap-1.5 items-start">
          <div ref={cityRootRef} className="relative flex-1 min-w-0">
            <input
              type="text"
              value={customCity}
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={listId}
              aria-autocomplete="list"
              onFocus={() => setSuggestOpen(true)}
              onChange={(e) => {
                setCustomCity(e.target.value);
                setSuggestOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (suggestions.length > 0) {
                    setSuggestOpen(true);
                    setActiveIndex((i) => (i + 1) % suggestions.length);
                  }
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (suggestions.length > 0) {
                    setSuggestOpen(true);
                    setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                  }
                  return;
                }
                if (e.key === 'Escape') {
                  setSuggestOpen(false);
                  setActiveIndex(-1);
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyCustomCity();
                }
              }}
              placeholder={t('sessionLocation.customCityPlaceholder')}
              aria-label={t('sessionLocation.customCityLabel')}
              className={`${fieldCls()} py-1.5`}
            />

            {showSuggestions && (
              <ul
                id={listId}
                role="listbox"
                className="absolute z-20 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto rounded-lg border border-[#2d2d3d] bg-[#12121a] shadow-xl py-1"
              >
                {loadingSuggestions && suggestions.length === 0 && (
                  <li className="px-3 py-2 text-[11px] text-gray-500">
                    {t('sessionLocation.suggestionsLoading')}
                  </li>
                )}
                {suggestions.map((s, index) => (
                  <li key={`${s.label}-${s.postalCode ?? ''}-${s.latitude}`} role="option" aria-selected={activeIndex === index}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion(s)}
                      className={`w-full text-left px-3 py-2 transition-colors flex items-center justify-between gap-2 min-w-0 ${
                        activeIndex === index
                          ? variant === 'salon'
                            ? 'bg-purple-500/15 text-white'
                            : 'bg-red-500/15 text-white'
                          : 'text-gray-200 hover:bg-[#1a1a26]'
                      }`}
                    >
                      <span className="truncate text-sm">{s.label}</span>
                      {s.postalCode && !s.label.includes(s.postalCode) && (
                        <span className="shrink-0 text-[10px] font-semibold text-gray-500 tabular-nums">
                          {s.postalCode}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={applyCustomCity}
            disabled={!customCity.trim()}
            title={t('sessionLocation.customCityApply')}
            aria-label={t('sessionLocation.customCityApply')}
            className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border text-sm font-bold transition disabled:opacity-40 ${
              variant === 'salon'
                ? 'border-purple-500/40 text-purple-200 hover:bg-purple-500/10'
                : 'border-red-500/40 text-red-200 hover:bg-red-500/10'
            }`}
          >
            →
          </button>
        </div>
      )}

      {geoError && <p className="text-[10px] text-red-300 leading-snug">{geoError}</p>}
    </div>
  );
}

/** @deprecated Utiliser SessionLocationPicker */
export const LiveStartLocationPicker = SessionLocationPicker;
