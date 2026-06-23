import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  geocodeQueryBestEffort,
  reverseGeocodeLocationLabel,
  searchAddressSuggestions,
  type AddressPrecision,
} from '../lib/geocodeAddress';
import { buildEventLocationPresets, type EventLocationPreset } from '../lib/eventLocationPresets';
import { searchCities } from '../lib/citySearch';
import {
  filterPresetCitySuggestions,
  PRESET_CITIES,
  presetCityToSuggestion,
} from '../lib/livesGeo';
import {
  cacheEventCoords,
  resolveEventCityCoordsSync,
  resolveEventCoordsSync,
} from '../lib/mapEventCoords';
import { EventLocationMapPicker, formatPickerCoord } from './EventLocationMapPicker';
import type { LivesGeoPrefs } from '../lib/livesGeo';

const DEBOUNCE_MS = 300;
const MIN_SEARCH_CHARS = 3;
const MIN_CITY_SEARCH_CHARS = 2;
const MAX_SUGGESTIONS = 6;

export interface EventLocationPickPayload {
  label: string;
  latitude: number;
  longitude: number;
}

interface EventLocationInputProps {
  value: string;
  onChange: (value: string) => void;
  profileCity?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Filtre carte : sélection ville/lieu directe sans mini-carte de confirmation. */
  cityPickMode?: boolean;
  onCityPicked?: (payload: EventLocationPickPayload) => void;
}

type DropdownItem =
  | { kind: 'preset'; preset: EventLocationPreset; label: string }
  | {
      kind: 'search';
      label: string;
      subtitle?: string;
      latitude: number;
      longitude: number;
      precision: AddressPrecision;
    }
  | { kind: 'use_typed'; query: string }
  | { kind: 'my_position' };

function citySuggestionToSearchItem(s: {
  label: string;
  postalCode?: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
}): Extract<DropdownItem, { kind: 'search' }> {
  return {
    kind: 'search',
    label: s.label,
    subtitle: s.subtitle ?? s.postalCode,
    latitude: s.latitude,
    longitude: s.longitude,
    precision: 'city',
  };
}

export function EventLocationInput({
  value,
  onChange,
  profileCity,
  placeholder,
  className = '',
  inputClassName = 'w-full rounded-lg bg-[#0b0b0f] border border-[#2a2a3d] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50',
  cityPickMode = false,
  onCityPicked,
}: EventLocationInputProps) {
  const { t } = useTranslation();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastEmittedRef = useRef(value);
  const [focused, setFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<Extract<DropdownItem, { kind: 'search' }>[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [usingTyped, setUsingTyped] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mapPickerState, setMapPickerState] = useState<LivesGeoPrefs | null>(null);
  const [confirmedCoords, setConfirmedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const geoAvailable = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);

  const presets = useMemo(
    () =>
      buildEventLocationPresets({
        profileCity,
        geoAvailable,
        max: MAX_SUGGESTIONS,
      }),
    [profileCity, geoAvailable]
  );

  const trimmed = value.trim();
  const minSearchChars = cityPickMode ? MIN_CITY_SEARCH_CHARS : MIN_SEARCH_CHARS;
  const isSearching = trimmed.length >= minSearchChars;

  const onSingleChange = (next: string) => {
    setConfirmedCoords(null);
    lastEmittedRef.current = next;
    onChange(next);
  };

  useEffect(() => {
    if (!isSearching) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    if (cityPickMode) {
      const presetItems = filterPresetCitySuggestions(trimmed, MAX_SUGGESTIONS).map((c) =>
        citySuggestionToSearchItem(presetCityToSuggestion(c))
      );
      setSearchResults(presetItems);
      setLoading(true);

      const timer = window.setTimeout(() => {
        searchCities(trimmed)
          .then((results) => {
            if (cancelled) return;
            setSearchResults(
              results
                .flatMap((r) => {
                  if (r.latitude == null || r.longitude == null) return [];
                  return [
                    citySuggestionToSearchItem({
                      label: r.label,
                      postalCode: r.postalCode,
                      subtitle: r.subtitle,
                      latitude: r.latitude,
                      longitude: r.longitude,
                    }),
                  ];
                })
                .slice(0, MAX_SUGGESTIONS)
            );
            setLoading(false);
          })
          .catch(() => {
            if (!cancelled) {
              setSearchResults(presetItems);
              setLoading(false);
            }
          });
      }, DEBOUNCE_MS);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      searchAddressSuggestions(trimmed)
        .then((results) => {
          if (cancelled) return;
          setSearchResults(
            results.slice(0, MAX_SUGGESTIONS).map((r) => ({
              kind: 'search' as const,
              label: r.label,
              subtitle: r.fullLabel !== r.label ? r.fullLabel : undefined,
              latitude: r.latitude,
              longitude: r.longitude,
              precision: r.precision,
            }))
          );
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setSearchResults([]);
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed, isSearching, cityPickMode]);

  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  const cityPopularItems = useMemo((): DropdownItem[] => {
    if (!cityPickMode || trimmed.length > 0) return [];
    return PRESET_CITIES.slice(0, MAX_SUGGESTIONS).map((c) =>
      citySuggestionToSearchItem(presetCityToSuggestion(c))
    );
  }, [cityPickMode, trimmed]);

  const presetItems: DropdownItem[] = presets.map((preset) => ({
    kind: 'preset',
    preset,
    label:
      preset.kind === 'my_position'
        ? t('feed.eventLocationMyPosition')
        : preset.label,
  }));

  const actionItems: DropdownItem[] = isSearching
    ? [
        ...(geoAvailable && !cityPickMode ? [{ kind: 'my_position' as const }] : []),
        ...(cityPickMode ? [] : [{ kind: 'use_typed' as const, query: trimmed }]),
      ]
    : [];

  const items: DropdownItem[] = isSearching
    ? [...searchResults, ...actionItems]
    : cityPickMode
      ? cityPopularItems
      : presetItems;

  const showDropdown =
    focused &&
    (loading ||
      items.length > 0 ||
      usingTyped ||
      locating ||
      (isSearching && trimmed.length >= minSearchChars));

  useEffect(() => {
    setActiveIndex(-1);
  }, [trimmed, focused, items.length]);

  const closeDropdown = () => {
    setFocused(false);
    setActiveIndex(-1);
  };

  const emitCityPick = (label: string, coords: { latitude: number; longitude: number }) => {
    cacheEventCoords(label, coords);
    onCityPicked?.({ label, latitude: coords.latitude, longitude: coords.longitude });
  };

  const pickLabel = (label: string, coords?: { latitude: number; longitude: number }) => {
    if (coords) {
      cacheEventCoords(label, coords);
      if (cityPickMode) emitCityPick(label, coords);
    }
    lastEmittedRef.current = label;
    onChange(label);
    closeDropdown();
  };

  const showMapPicker = (label: string, latitude: number, longitude: number) => {
    closeDropdown();
    setConfirmedCoords(null);
    setMapPickerState({
      latitude,
      longitude,
      radiusKm: 0,
      label,
      source: 'address',
    });
  };

  const resolveCoordsForLabel = async (
    label: string
  ): Promise<{ latitude: number; longitude: number } | null> => {
    const sync = resolveEventCoordsSync(label) ?? resolveEventCityCoordsSync(label);
    if (sync) return sync;
    const result = await geocodeQueryBestEffort(label);
    return result ? { latitude: result.latitude, longitude: result.longitude } : null;
  };

  const pickLabelWithMap = async (label: string) => {
    const coords = await resolveCoordsForLabel(label);
    if (coords && cityPickMode) {
      pickLabel(label, coords);
      return;
    }
    if (coords) {
      showMapPicker(label, coords.latitude, coords.longitude);
      return;
    }
    pickLabel(label);
  };

  const pickMyPosition = () => {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const label = await reverseGeocodeLocationLabel(
            pos.coords.latitude,
            pos.coords.longitude
          );
          if (cityPickMode) {
            pickLabel(label, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          } else {
            showMapPicker(label, pos.coords.latitude, pos.coords.longitude);
          }
        } catch {
          if (cityPickMode) {
            pickLabel(t('feed.eventLocationMyPosition'), {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          } else {
            showMapPicker(
              t('feed.eventLocationMyPosition'),
              pos.coords.latitude,
              pos.coords.longitude
            );
          }
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        closeDropdown();
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 }
    );
  };

  const pickUseTyped = async (query: string) => {
    if (usingTyped) return;
    setUsingTyped(true);
    const label = query.trim();
    try {
      const coords = await resolveCoordsForLabel(label);
      if (coords && cityPickMode) {
        pickLabel(label, coords);
      } else if (coords) {
        showMapPicker(label, coords.latitude, coords.longitude);
      } else {
        pickLabel(label);
      }
    } finally {
      setUsingTyped(false);
      closeDropdown();
    }
  };

  const pickItem = (item: DropdownItem) => {
    if (item.kind === 'my_position' || (item.kind === 'preset' && item.preset.kind === 'my_position')) {
      pickMyPosition();
      return;
    }
    if (item.kind === 'use_typed') {
      void pickUseTyped(item.query);
      return;
    }
    if (item.kind === 'search') {
      if (cityPickMode) {
        pickLabel(item.label, { latitude: item.latitude, longitude: item.longitude });
        return;
      }
      showMapPicker(item.label, item.latitude, item.longitude);
      return;
    }
    void pickLabelWithMap(item.label);
  };

  const handleModifyPosition = () => {
    if (!confirmedCoords) return;
    const label = value.trim();
    setMapPickerState({
      latitude: confirmedCoords.lat,
      longitude: confirmedCoords.lng,
      radiusKm: 0,
      label: label || '',
      source: 'address',
    });
  };

  const precisionLabel = (precision: AddressPrecision): string | null => {
    if (precision === 'exact') return null;
    if (precision === 'street') return t('feed.eventLocationPrecisionStreet');
    if (precision === 'city') return t('feed.eventLocationPrecisionCity');
    return t('feed.eventLocationPrecisionApprox');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || items.length === 0) {
      if (e.key === 'Escape') closeDropdown();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
      return;
    }
    if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < items.length) {
      e.preventDefault();
      pickItem(items[activeIndex]!);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    }
  };

  const itemKey = (item: DropdownItem, index: number): string => {
    if (item.kind === 'my_position') return 'my_position';
    if (item.kind === 'use_typed') return 'use_typed';
    if (item.kind === 'search') return `search-${item.latitude}-${item.longitude}-${index}`;
    if (item.preset.kind === 'my_position') return 'preset_my_position';
    return `preset-${item.preset.id}`;
  };

  const streetPlaceholder = placeholder ?? t('feed.eventLocationPlaceholder');

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onSingleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={onKeyDown}
        placeholder={streetPlaceholder}
        maxLength={300}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={showDropdown ? listId : undefined}
        aria-expanded={showDropdown}
        aria-activedescendant={
          showDropdown && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
        }
        className={inputClassName}
      />
      {confirmedCoords && !mapPickerState && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-emerald-400 truncate">
            {formatPickerCoord(confirmedCoords.lat, confirmedCoords.lng)}
          </span>
          <button
            type="button"
            onClick={handleModifyPosition}
            className="shrink-0 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
          >
            · Modifier
          </button>
        </div>
      )}
      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-[#2a2a3d] bg-[#12121a] shadow-lg overflow-hidden"
        >
          <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-gray-500 border-b border-[#1e1e2f]">
            {isSearching ? t('feed.eventLocationSearch') : t('feed.eventLocationSuggestions')}
          </p>
          {loading && isSearching && searchResults.length === 0 && !usingTyped ? (
            <p className="px-2 py-1.5 text-[10px] text-gray-500">{t('feed.eventLocationSearching')}</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-1.5 text-[10px] text-gray-500">{t('feed.eventLocationNoResults')}</p>
          ) : (
            <ul className="max-h-52 overflow-y-auto">
              {items.map((item, index) => {
                const isMyPosition =
                  item.kind === 'my_position' ||
                  (item.kind === 'preset' && item.preset.kind === 'my_position');
                const isUseTyped = item.kind === 'use_typed';
                const isAction = isMyPosition || isUseTyped;
                const active = index === activeIndex;
                const prevItem = index > 0 ? items[index - 1] : null;
                const showActionDivider =
                  isAction && prevItem?.kind === 'search';

                return (
                  <li key={itemKey(item, index)}>
                    {showActionDivider && (
                      <p className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-600 border-t border-[#1e1e2f] bg-[#0f0f16]">
                        {t('feed.eventLocationManual')}
                      </p>
                    )}
                    <button
                      type="button"
                      id={`${listId}-opt-${index}`}
                      role="option"
                      aria-selected={active}
                      disabled={(isMyPosition && locating) || (isUseTyped && usingTyped)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickItem(item)}
                      className={`w-full text-left px-2 py-1.5 text-[10px] flex items-start gap-1.5 ${
                        active
                          ? 'bg-purple-900/40 text-purple-100'
                          : isAction
                            ? 'text-purple-200 hover:bg-[#1a1a26] active:bg-[#252535]'
                            : 'text-gray-200 hover:bg-[#1a1a26] active:bg-[#252535]'
                      } disabled:opacity-50`}
                    >
                      {isMyPosition && (
                        <svg
                          viewBox="0 0 24 24"
                          className="w-3 h-3 shrink-0 text-purple-400 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 11a3 3 0 100-6 3 3 0 000 6z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 22s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z"
                          />
                        </svg>
                      )}
                      <span className="min-w-0 flex-1">
                        {isMyPosition && locating ? (
                          t('feed.eventLocationLocating')
                        ) : isUseTyped && usingTyped ? (
                          t('feed.eventLocationUsingTyped')
                        ) : isUseTyped ? (
                          t('feed.eventLocationUseTyped', { query: item.query })
                        ) : isMyPosition ? (
                          t('feed.eventLocationMyPosition')
                        ) : item.kind === 'search' ? (
                          <>
                            <span className="line-clamp-2 block">{item.label}</span>
                            {item.subtitle && (
                              <span className="line-clamp-1 block text-[9px] text-gray-500 mt-0.5">
                                {item.subtitle}
                              </span>
                            )}
                            {precisionLabel(item.precision) && (
                              <span className="line-clamp-1 block text-[9px] text-amber-500/80 mt-0.5">
                                {precisionLabel(item.precision)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="line-clamp-2 block">{item.label}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {mapPickerState && (
        <EventLocationMapPicker
          lat={mapPickerState.latitude}
          lng={mapPickerState.longitude}
          label={mapPickerState.label}
          onConfirm={(confirmedLat, confirmedLng) => {
            pickLabel(mapPickerState.label, { latitude: confirmedLat, longitude: confirmedLng });
            setConfirmedCoords({ lat: confirmedLat, lng: confirmedLng });
            setMapPickerState(null);
          }}
          onCancel={() => setMapPickerState(null)}
        />
      )}
    </div>
  );
}
