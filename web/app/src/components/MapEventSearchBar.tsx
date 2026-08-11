import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  searchMapEventsAndOrganizers,
  type MapEventSearchEventHit,
  type MapEventSearchOrganizerHit,
} from '../lib/mapEventSearch';
import { searchPlaces, type PlaceSearchHit } from '../lib/placeSearch';
import type { FeedPost, MapEventMarker } from '../types';

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

interface MapEventSearchBarProps {
  markers: MapEventMarker[];
  postsById: ReadonlyMap<string, FeedPost>;
  onSelectEvent: (hit: MapEventSearchEventHit) => void;
  onSelectOrganizer: (hit: MapEventSearchOrganizerHit) => void;
  onSelectPlace: (hit: PlaceSearchHit) => void;
  className?: string;
}

type FlatHit =
  | { kind: 'place'; hit: PlaceSearchHit; index: number }
  | { kind: 'event'; hit: MapEventSearchEventHit; index: number }
  | { kind: 'organizer'; hit: MapEventSearchOrganizerHit; index: number };

function groupPlaces(hits: PlaceSearchHit[]): { countries: PlaceSearchHit[]; cities: PlaceSearchHit[] } {
  const countries: PlaceSearchHit[] = [];
  const cities: PlaceSearchHit[] = [];
  for (const hit of hits) {
    if (hit.kind === 'country') countries.push(hit);
    else cities.push(hit);
  }
  return { countries, cities };
}

export function MapEventSearchBar({
  markers,
  postsById,
  onSelectEvent,
  onSelectOrganizer,
  onSelectPlace,
  className = '',
}: MapEventSearchBarProps) {
  const { t } = useTranslation();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const placesSeqRef = useRef(0);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [places, setPlaces] = useState<PlaceSearchHit[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setDebouncedQuery('');
      setPlaces([]);
      setPlacesLoading(false);
      setActiveIndex(-1);
      return;
    }
    const timer = window.setTimeout(() => setDebouncedQuery(q), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < MIN_CHARS) {
      setPlaces([]);
      setPlacesLoading(false);
      return;
    }

    const seq = ++placesSeqRef.current;
    setPlacesLoading(true);
    const controller = new AbortController();

    searchPlaces(q, { signal: controller.signal })
      .then((results) => {
        if (controller.signal.aborted || seq !== placesSeqRef.current) return;
        setPlaces(results);
        setPlacesLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted || seq !== placesSeqRef.current) return;
        setPlaces([]);
        setPlacesLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  const { events, organizers } = useMemo(
    () => searchMapEventsAndOrganizers(debouncedQuery, markers, postsById),
    [debouncedQuery, markers, postsById]
  );

  const flatHits: FlatHit[] = useMemo(() => {
    const out: FlatHit[] = [];
    let index = 0;
    for (const hit of places) {
      out.push({ kind: 'place', hit, index: index++ });
    }
    for (const hit of events) {
      out.push({ kind: 'event', hit, index: index++ });
    }
    for (const hit of organizers) {
      out.push({ kind: 'organizer', hit, index: index++ });
    }
    return out;
  }, [places, events, organizers]);

  useEffect(() => {
    setActiveIndex(flatHits.length > 0 ? 0 : -1);
  }, [flatHits]);

  const collapse = useCallback(() => {
    if (query.trim()) return;
    setOpen(false);
    setExpanded(false);
    setActiveIndex(-1);
  }, [query]);

  const expand = useCallback(() => {
    setExpanded(true);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) collapse();
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [collapse, expanded]);

  const pickPlace = useCallback(
    (hit: PlaceSearchHit) => {
      onSelectPlace(hit);
      setQuery('');
      setPlaces([]);
      collapse();
    },
    [collapse, onSelectPlace]
  );

  const pickEvent = useCallback(
    (hit: MapEventSearchEventHit) => {
      onSelectEvent(hit);
      setQuery('');
      collapse();
    },
    [collapse, onSelectEvent]
  );

  const pickOrganizer = useCallback(
    (hit: MapEventSearchOrganizerHit) => {
      onSelectOrganizer(hit);
      setQuery('');
      collapse();
    },
    [collapse, onSelectOrganizer]
  );

  const showPanel = open && expanded && query.trim().length >= MIN_CHARS;
  const debouncing = query.trim() !== debouncedQuery.trim();
  const searching = showPanel && (debouncing || placesLoading);
  const showEmpty =
    showPanel &&
    debouncedQuery.trim().length >= MIN_CHARS &&
    !searching &&
    flatHits.length === 0;

  const { countries, cities } = groupPlaces(places);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        setQuery('');
        setPlaces([]);
      } else {
        collapse();
      }
      return;
    }
    if (!showPanel || flatHits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatHits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? flatHits.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const picked = flatHits[activeIndex];
      if (!picked) return;
      if (picked.kind === 'place') pickPlace(picked.hit);
      else if (picked.kind === 'event') pickEvent(picked.hit);
      else pickOrganizer(picked.hit);
    }
  };

  const renderPlaceHit = (hit: PlaceSearchHit, idx: number) => {
    const isActive = idx === activeIndex;
    const isCountry = hit.kind === 'country';
    return (
      <li key={`${hit.kind}-${hit.label}-${idx}`}>
        <button
          type="button"
          role="option"
          aria-selected={isActive}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActiveIndex(idx)}
          onClick={() => pickPlace(hit)}
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
    <div
      className={`ms-map-event-search ms-map-globe-search ${expanded ? 'ms-map-globe-search--open' : ''} ${className}`.trim()}
    >
      <div ref={rootRef} className="ms-map-globe-search__inner">
        {!expanded ? (
          <button
            type="button"
            onClick={expand}
            aria-label={t('map.eventSearchLabel', 'Rechercher un événement, un lieu ou un organisateur')}
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
              {t('map.eventSearchLabel', 'Rechercher un événement, un lieu ou un organisateur')}
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
                placeholder={t('map.eventSearchPlaceholder', 'Événement, ville, organisateur…')}
                maxLength={80}
                autoComplete="off"
                enterKeyHint="search"
                aria-autocomplete="list"
                aria-controls={showPanel ? listId : undefined}
                aria-expanded={showPanel}
                className="ms-map-globe-search__input"
              />
              {searching ? (
                <span className="ms-map-globe-search__status" aria-hidden>
                  <span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                </span>
              ) : query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setPlaces([]);
                    inputRef.current?.focus();
                  }}
                  aria-label={t('map.eventSearchClear', 'Effacer')}
                  className="ms-map-globe-search__clear"
                >
                  ×
                </button>
              ) : (
                <button
                  type="button"
                  onClick={collapse}
                  aria-label={t('map.eventSearchClose', 'Fermer')}
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
                aria-label={t('map.eventSearchResults', 'Résultats')}
                className="ms-map-globe-search__panel"
              >
                {showEmpty ? (
                  <p className="px-3 py-3 text-xs text-gray-500">
                    {t('map.eventSearchEmpty', 'Aucun événement, lieu ou organisateur')}
                  </p>
                ) : (
                  <ul className="max-h-60 overflow-y-auto py-1">
                    {countries.length > 0 && (
                      <>
                        <li className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          {t('map.globeSearchSectionCountries', 'Pays')}
                        </li>
                        {countries.map((hit) => renderPlaceHit(hit, nextIndex()))}
                      </>
                    )}
                    {cities.length > 0 && (
                      <>
                        <li className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          {t('map.globeSearchSectionCities', 'Villes')}
                        </li>
                        {cities.map((hit) => renderPlaceHit(hit, nextIndex()))}
                      </>
                    )}
                    {events.length > 0 && (
                      <>
                        <li className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          {t('map.eventSearchSectionEvents', 'Événements')}
                        </li>
                        {events.map((hit) => {
                          const idx = nextIndex();
                          const isActive = idx === activeIndex;
                          return (
                            <li key={`event-${hit.marker.id}`}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={isActive}
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseEnter={() => setActiveIndex(idx)}
                                onClick={() => pickEvent(hit)}
                                className={`w-full text-left px-3 py-2.5 min-h-[44px] flex items-center gap-2.5 transition-colors ${
                                  isActive ? 'bg-purple-500/15' : 'hover:bg-[#1e1e2f] active:bg-[#252535]'
                                }`}
                              >
                                <span
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300 text-sm"
                                  aria-hidden
                                >
                                  📅
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm text-white truncate">{hit.title}</span>
                                  <span className="block text-[11px] text-gray-500 truncate">
                                    {hit.organizer}
                                    {hit.location ? ` · ${hit.location}` : ''}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </>
                    )}
                    {organizers.length > 0 && (
                      <>
                        <li className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          {t('map.eventSearchSectionOrganizers', 'Organisateurs')}
                        </li>
                        {organizers.map((hit) => {
                          const idx = nextIndex();
                          const isActive = idx === activeIndex;
                          return (
                            <li key={`org-${hit.authorId}`}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={isActive}
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseEnter={() => setActiveIndex(idx)}
                                onClick={() => pickOrganizer(hit)}
                                className={`w-full text-left px-3 py-2.5 min-h-[44px] flex items-center gap-2.5 transition-colors ${
                                  isActive ? 'bg-purple-500/15' : 'hover:bg-[#1e1e2f] active:bg-[#252535]'
                                }`}
                              >
                                {hit.authorAvatarUrl ? (
                                  <img
                                    src={hit.authorAvatarUrl}
                                    alt=""
                                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                                  />
                                ) : (
                                  <span
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300 text-sm font-bold"
                                    aria-hidden
                                  >
                                    {hit.authorUsername.slice(0, 1).toUpperCase()}
                                  </span>
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm text-white truncate">@{hit.authorUsername}</span>
                                  <span className="block text-[11px] text-gray-500 truncate">
                                    {t('map.eventSearchOrganizerUpcoming', {
                                      count: hit.upcomingCount,
                                      defaultValue:
                                        hit.upcomingCount === 1
                                          ? '1 événement à venir'
                                          : `${hit.upcomingCount} événements à venir`,
                                    })}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
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
