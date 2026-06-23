import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchGlobal, type GlobalSearchResultItem } from '../lib/globalSearch';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import { SearchInlineSpinner } from './SearchInlineSpinner';
import type { NearbyPerson, UserSearchHit } from '../types';

export type { GlobalSearchResultItem };

interface ProfileSearchBarProps {
  token: string;
  onSelectResult: (item: GlobalSearchResultItem) => void;
  className?: string;
}

function searchHitToPreview(hit: UserSearchHit): NearbyPerson {
  return {
    id: hit.id,
    username: hit.username,
    usernameColor: hit.usernameColor,
    usernameWaveFrom: hit.usernameWaveFrom,
    usernameWaveTo: hit.usernameWaveTo,
    avatarUrl: hit.avatarUrl,
    city: hit.city,
    listeningRole: hit.listeningRole,
    isLive: hit.isLive,
    liveId: hit.liveId,
    liveViewersCount: hit.liveViewersCount,
    salonId: hit.salonId,
    salonTitle: hit.salonTitle,
  };
}

export function userSearchHitFromItem(item: GlobalSearchResultItem): UserSearchHit | null {
  if (item.kind !== 'user') return null;
  return item;
}

export function nearbyPreviewFromSearchItem(item: GlobalSearchResultItem): NearbyPerson | undefined {
  if (item.kind !== 'user') return undefined;
  return searchHitToPreview(item);
}

function itemKey(item: GlobalSearchResultItem, index: number): string {
  switch (item.kind) {
    case 'user':
      return `user-${item.id}`;
    case 'event':
      return `event-${item.id}`;
    case 'album':
      return `album-${item.id}`;
    case 'song':
      return `song-${item.id}`;
    case 'city':
      return `city-${item.label}-${index}`;
    case 'country':
      return `country-${item.label}`;
    default:
      return `item-${index}`;
  }
}

export function ProfileSearchBar({ token, onSelectResult, className }: ProfileSearchBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [compactPlaceholder, setCompactPlaceholder] = useState(false);
  const [results, setResults] = useState<GlobalSearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cacheRef = useRef<Map<string, GlobalSearchResultItem[]>>(new Map());

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setCompactPlaceholder(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(q.toLowerCase());
    if (cached) {
      setResults(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchGlobal(token, q, controller.signal)
        .then((grouped) => {
          cacheRef.current.set(q.toLowerCase(), grouped.flat);
          setResults(grouped.flat);
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, token]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = useCallback(
    (item: GlobalSearchResultItem) => {
      setQuery('');
      setResults([]);
      setOpen(false);
      onSelectResult(item);
    },
    [onSelectResult]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(results[activeIndex]!);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showDropdown = open && query.trim().length >= 2;
  const showEmpty = !loading && results.length === 0;

  const sectionLabel = (item: GlobalSearchResultItem): string | null => {
    switch (item.kind) {
      case 'city':
      case 'country':
        return t('globalSearch.sectionPlace');
      case 'event':
        return t('globalSearch.sectionEvent');
      case 'user':
        return t('globalSearch.sectionProfile');
      case 'album':
        return t('globalSearch.sectionAlbum');
      case 'song':
        return t('globalSearch.sectionSong');
      default:
        return null;
    }
  };

  let lastSection: string | null = null;

  return (
    <div ref={rootRef} className={`relative w-full min-w-0${className ? ` ${className}` : ''}`}>
      <div className="relative flex items-center h-7 sm:h-8 lg:h-9 rounded-full bg-[#1a1a26]/90 border border-[#2d2d3d]/90 shadow-sm shadow-black/20 transition-[border-color,box-shadow] focus-within:border-purple-500/50 focus-within:ring-2 focus-within:ring-purple-500/25 focus-within:shadow-purple-500/10">
        <span className="absolute left-2 sm:left-2.5 lg:left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden>
          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t(compactPlaceholder ? 'globalSearch.placeholderShort' : 'globalSearch.placeholder')}
          autoComplete="off"
          aria-label={t('globalSearch.label')}
          aria-expanded={showDropdown}
          aria-controls="profile-search-results"
          className="w-full h-full pl-7 sm:pl-8 lg:pl-9 pr-6 sm:pr-7 lg:pr-8 text-[11px] sm:text-xs rounded-full bg-transparent text-white placeholder:text-gray-500/90 outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 text-sm leading-none transition-colors"
            aria-label={t('globalSearch.clear')}
          >
            ×
          </button>
        )}
      </div>

      {showDropdown && (
        <ul
          id="profile-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 max-h-72 overflow-y-auto rounded-xl border border-[#2d2d3d] bg-[#12121a]/98 backdrop-blur-sm shadow-xl shadow-black/40 py-0.5"
        >
          {loading && results.length === 0 ? (
            <li>
              <SearchInlineSpinner label={t('globalSearch.searching')} />
            </li>
          ) : null}
          {showEmpty ? (
            <li className="px-3 py-2 text-xs text-gray-500">{t('globalSearch.noResults')}</li>
          ) : null}
          {results.map((item, i) => {
            const section = sectionLabel(item);
            const showHeader = section && section !== lastSection;
            if (showHeader) lastSection = section;
            return (
              <li key={itemKey(item, i)}>
                {showHeader && (
                  <p className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-500">
                    {section}
                  </p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => pick(item)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-purple-900/30 ${
                    i === activeIndex ? 'bg-purple-900/40' : ''
                  }`}
                >
                  {item.kind === 'user' ? (
                    <>
                      <UserAvatarOnline
                        userId={item.id}
                        avatarUrl={item.avatarUrl}
                        size="sm"
                        isLive={item.isLive}
                        liveViewersCount={item.isLive ? item.liveViewersCount : undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <UsernameDisplay
                          as="p"
                          username={item.username}
                          usernameColor={item.usernameColor}
                          usernameWaveFrom={item.usernameWaveFrom}
                          usernameWaveTo={item.usernameWaveTo}
                          className="text-xs font-semibold truncate"
                        />
                        {item.city && (
                          <p className="text-[9px] text-gray-500 truncate">📍 {item.city}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-[#1a1a26] text-sm" aria-hidden>
                        {item.kind === 'city' || item.kind === 'country' ? '📍' : null}
                        {item.kind === 'event' ? '📅' : null}
                        {item.kind === 'album' ? '💿' : null}
                        {item.kind === 'song' ? '🎵' : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">
                          {item.kind === 'event'
                            ? item.title
                            : item.kind === 'album' || item.kind === 'song'
                              ? item.title
                              : item.label}
                        </p>
                        <p className="text-[9px] text-gray-500 truncate">
                          {item.kind === 'event' &&
                            [item.eventLocation, item.authorUsername].filter(Boolean).join(' · ')}
                          {item.kind === 'album' && item.authorUsername}
                          {item.kind === 'song' &&
                            [item.artist ?? item.authorUsername, item.authorUsername]
                              .filter(Boolean)
                              .join(' · ')}
                          {item.kind === 'city' && t('globalSearch.openOnMap')}
                          {item.kind === 'country' && t('globalSearch.openCountryOnMap')}
                        </p>
                      </div>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
