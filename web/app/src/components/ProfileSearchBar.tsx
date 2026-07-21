import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { GlobalSearchResultItem } from '../lib/globalSearch';
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

function toUserResult(hit: UserSearchHit): GlobalSearchResultItem {
  return { kind: 'user', ...hit };
}

export function userSearchHitFromItem(item: GlobalSearchResultItem): UserSearchHit | null {
  if (item.kind !== 'user') return null;
  return item;
}

export function nearbyPreviewFromSearchItem(item: GlobalSearchResultItem): NearbyPerson | undefined {
  if (item.kind !== 'user') return undefined;
  return searchHitToPreview(item);
}

export function ProfileSearchBar({ token, onSelectResult, className }: ProfileSearchBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [compactPlaceholder, setCompactPlaceholder] = useState(false);
  const [results, setResults] = useState<UserSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cacheRef = useRef<Map<string, UserSearchHit[]>>(new Map());
  const searchSeqRef = useRef(0);

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

    const cacheKey = q.toLowerCase();
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setResults(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const controller = new AbortController();
    const seq = ++searchSeqRef.current;
    const timer = window.setTimeout(() => {
      api
        .searchUsers(token, q, controller.signal)
        .then(({ users }) => {
          if (controller.signal.aborted || seq !== searchSeqRef.current) return;
          const hits = users ?? [];
          cacheRef.current.set(cacheKey, hits);
          setResults(hits);
        })
        .catch(() => {
          if (controller.signal.aborted || seq !== searchSeqRef.current) return;
          setResults([]);
        })
        .finally(() => {
          if (controller.signal.aborted || seq !== searchSeqRef.current) return;
          setLoading(false);
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

  const placeholderKey = compactPlaceholder
    ? 'profileSearch.placeholderShort'
    : 'profileSearch.placeholder';

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = useCallback(
    (hit: UserSearchHit) => {
      setQuery('');
      setResults([]);
      setOpen(false);
      onSelectResult(toUserResult(hit));
    },
    [onSelectResult]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(results[activeIndex]!);
    }
  };

  const trimmedQuery = query.trim();
  const showPanel = open;
  const showResults = trimmedQuery.length >= 2;
  const showEmpty = showResults && !loading && results.length === 0;

  return (
    <div ref={rootRef} className={`relative w-full min-w-0${className ? ` ${className}` : ''}`}>
      <div className="relative flex items-center h-7 sm:h-8 lg:h-9 rounded-full bg-[#1a1a26]/90 border border-[#2d2d3d]/90 shadow-sm shadow-black/20 transition-[border-color,box-shadow] focus-within:border-purple-500/50 focus-within:ring-2 focus-within:ring-purple-500/25 focus-within:shadow-purple-500/10">
        <div className="relative flex flex-1 min-w-0 items-center">
          <span className="pl-2 sm:pl-2.5 text-gray-500 shrink-0 pointer-events-none" aria-hidden>
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
            placeholder={t(placeholderKey)}
            autoComplete="off"
            aria-label={t('profileSearch.label')}
            aria-expanded={showPanel}
            aria-controls="profile-search-results"
            className="w-full min-w-0 h-full pl-1.5 sm:pl-2 pr-6 sm:pr-7 lg:pr-8 text-[11px] sm:text-xs rounded-full bg-transparent text-white placeholder:text-gray-500/90 outline-none [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 text-sm leading-none transition-colors"
            aria-label={t('profileSearch.clear')}
          >
            ×
          </button>
        )}
      </div>

      {showPanel && (
        <div
          id="profile-search-results"
          className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 max-h-80 overflow-hidden rounded-xl border border-[#2d2d3d] bg-[#12121a]/98 backdrop-blur-sm shadow-xl shadow-black/40"
        >
          {!showResults ? (
            <p className="px-3 py-2.5 text-xs text-gray-500">{t('globalSearch.typeHint')}</p>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto py-0.5">
              {loading && results.length === 0 ? (
                <li>
                  <SearchInlineSpinner label={t('profileSearch.searching')} />
                </li>
              ) : null}
              {showEmpty ? (
                <li className="px-3 py-2 text-xs text-gray-500">{t('profileSearch.noResults')}</li>
              ) : null}
              {results.map((hit, index) => (
                <li key={hit.id} className="list-none min-w-0">
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onClick={() => pick(hit)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-purple-900/30 ${
                      index === activeIndex ? 'bg-purple-900/40' : ''
                    }`}
                  >
                    <UserAvatarOnline
                      userId={hit.id}
                      avatarUrl={hit.avatarUrl}
                      size="sm"
                      isLive={hit.isLive}
                      liveViewersCount={hit.isLive ? hit.liveViewersCount : undefined}
                    />
                    <div className="min-w-0 flex-1">
                      <UsernameDisplay
                        as="p"
                        username={hit.username}
                        usernameColor={hit.usernameColor}
                        usernameWaveFrom={hit.usernameWaveFrom}
                        usernameWaveTo={hit.usernameWaveTo}
                        className="text-xs font-semibold truncate"
                      />
                      {hit.city && (
                        <p className="text-[9px] text-gray-500 truncate">📍 {hit.city}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
