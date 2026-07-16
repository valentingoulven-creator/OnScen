import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchPlaces, type PlaceSearchHit } from '../lib/placeSearch';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

interface MapGlobePlaceSearchProps {
  onSelectPlace: (hit: PlaceSearchHit) => void;
  className?: string;
}

function groupSuggestions(hits: PlaceSearchHit[]): { countries: PlaceSearchHit[]; cities: PlaceSearchHit[] } {
  const countries: PlaceSearchHit[] = [];
  const cities: PlaceSearchHit[] = [];
  for (const hit of hits) {
    if (hit.kind === 'country') countries.push(hit);
    else cities.push(hit);
  }
  return { countries, cities };
}

export function MapGlobePlaceSearch({ onSelectPlace, className = '' }: MapGlobePlaceSearchProps) {
  const { t } = useTranslation();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(true);
  const [suggestions, setSuggestions] = useState<PlaceSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const flatSuggestions = suggestions;

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setSuggestions([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchPlaces(q, { signal: controller.signal })
        .then((results) => {
          if (!controller.signal.aborted) {
            setSuggestions(results);
            setLoading(false);
            setActiveIndex(results.length > 0 ? 0 : -1);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSuggestions([]);
            setLoading(false);
            setActiveIndex(-1);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const collapse = useCallback(() => {
    setOpen(false);
    setExpanded(false);
    setActiveIndex(-1);
  }, []);

  const expand = useCallback(() => {
    setExpanded(true);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) collapse();
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [collapse]);

  const pick = useCallback(
    (hit: PlaceSearchHit) => {
      onSelectPlace(hit);
      setQuery('');
      setSuggestions([]);
      collapse();
    },
    [collapse, onSelectPlace]
  );

  const showPanel = open && expanded && query.trim().length >= MIN_CHARS;
  const showEmpty = showPanel && !loading && flatSuggestions.length === 0;
  const { countries, cities } = groupSuggestions(flatSuggestions);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        setQuery('');
        setSuggestions([]);
      } else {
        collapse();
      }
      return;
    }
    if (!showPanel || flatSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? flatSuggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(flatSuggestions[activeIndex]!);
    }
  };

  const renderHit = (hit: PlaceSearchHit, index: number) => {
    const isActive = index === activeIndex;
    const isCountry = hit.kind === 'country';
    return (
      <li key={`${hit.kind}-${hit.label}-${index}`}>
        <button
          type="button"
          role="option"
          aria-selected={isActive}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => pick(hit)}
          className={`w-full text-left px-3 py-2.5 min-h-[44px] flex items-center gap-2.5 transition-colors ${
            isActive ? 'bg-purple-500/15' : 'hover:bg-[#1e1e2f] active:bg-[#252535]'
          }`}
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
              isCountry ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/15 text-emerald-300'
            }`}
            aria-hidden
          >
            {isCountry ? '🌍' : '📍'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-white truncate">{hit.label}</span>
            <span className="block text-[11px] text-gray-500 truncate">
              {isCountry
                ? t('map.globeSearchCountry', 'Pays')
                : hit.postalCode ?? t('map.globeSearchCity', 'Ville')}
            </span>
          </span>
        </button>
      </li>
    );
  };

  let runningIndex = -1;
  const nextIndex = () => {
    runningIndex += 1;
    return runningIndex;
  };

  return (
    <div className={`ms-map-globe-search ${expanded ? 'ms-map-globe-search--open' : ''} ${className}`.trim()}>
      <div ref={rootRef} className="ms-map-globe-search__inner">
        {!expanded ? (
          <button
            type="button"
            onClick={expand}
            aria-label={t('map.globeSearchLabel', 'Rechercher un pays ou une ville')}
            className="ms-map-globe-search__toggle"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <>
            <label className="sr-only" htmlFor={`${listId}-input`}>
              {t('map.globeSearchLabel', 'Rechercher un pays ou une ville')}
            </label>
            <div className="ms-map-globe-search__field">
              <span className="pointer-events-none absolute left-3 text-gray-500" aria-hidden>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                </svg>
              </span>
              <input
                ref={inputRef}
                id={`${listId}-input`}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={t('map.globeSearchPlaceholder', 'Pays ou ville…')}
                maxLength={80}
                autoComplete="off"
                enterKeyHint="search"
                aria-autocomplete="list"
                aria-controls={showPanel ? listId : undefined}
                aria-expanded={showPanel}
                className="ms-map-globe-search__input"
              />
              {loading ? (
                <span className="ms-map-globe-search__status" aria-hidden>
                  <span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                </span>
              ) : query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSuggestions([]);
                    inputRef.current?.focus();
                  }}
                  aria-label={t('map.globeSearchClear', 'Effacer')}
                  className="ms-map-globe-search__clear"
                >
                  ×
                </button>
              ) : (
                <button
                  type="button"
                  onClick={collapse}
                  aria-label={t('map.globeSearchClose', 'Fermer')}
                  className="ms-map-globe-search__clear"
                >
                  ×
                </button>
              )}
            </div>

            {showPanel && (
              <div
                id={listId}
                role="listbox"
                aria-label={t('map.globeSearchResults', 'Résultats')}
                className="ms-map-globe-search__panel"
              >
                {loading && flatSuggestions.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-500">{t('map.globeSearchLoading', 'Recherche…')}</p>
                ) : showEmpty ? (
                  <p className="px-3 py-3 text-xs text-gray-500">{t('map.globeSearchEmpty', 'Aucun résultat')}</p>
                ) : (
                  <ul className="max-h-56 overflow-y-auto py-1">
                    {countries.length > 0 && (
                      <>
                        <li className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          {t('map.globeSearchSectionCountries', 'Pays')}
                        </li>
                        {countries.map((hit) => renderHit(hit, nextIndex()))}
                      </>
                    )}
                    {cities.length > 0 && (
                      <>
                        <li className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          {t('map.globeSearchSectionCities', 'Villes')}
                        </li>
                        {cities.map((hit) => renderHit(hit, nextIndex()))}
                      </>
                    )}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
