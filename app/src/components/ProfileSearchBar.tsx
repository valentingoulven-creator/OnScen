import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import type { NearbyPerson, UserSearchHit } from '../types';

interface ProfileSearchBarProps {
  token: string;
  onSelectUser: (userId: string, preview?: NearbyPerson) => void;
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

export function ProfileSearchBar({ token, onSelectUser, className }: ProfileSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      api
        .searchUsers(token, q)
        .then((r) => {
          setResults(r.users);
          setActiveIndex(-1);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query, token]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (hit: UserSearchHit) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelectUser(hit.id, searchHitToPreview(hit));
  };

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
      pick(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className={`relative w-full min-w-0${className ? ` ${className}` : ''}`}>
      <div className="relative flex items-center h-9 rounded-full bg-[#1a1a26]/90 border border-[#2d2d3d]/90 shadow-sm shadow-black/20 transition-[border-color,box-shadow] focus-within:border-purple-500/50 focus-within:ring-2 focus-within:ring-purple-500/25 focus-within:shadow-purple-500/10">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          placeholder="Rechercher un profil…"
          autoComplete="off"
          aria-label="Rechercher un profil"
          aria-expanded={showDropdown}
          aria-controls="profile-search-results"
          className="w-full h-full pl-9 pr-8 text-xs rounded-full bg-transparent text-white placeholder:text-gray-500/90 outline-none [&::-webkit-search-cancel-button]:hidden"
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
            aria-label="Effacer la recherche"
          >
            ×
          </button>
        )}
      </div>

      {showDropdown && (
        <ul
          id="profile-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 max-h-56 overflow-y-auto rounded-xl border border-[#2d2d3d] bg-[#12121a]/98 backdrop-blur-sm shadow-xl shadow-black/40 py-0.5"
        >
          {loading && (
            <li className="px-3 py-2 text-xs text-gray-500">Recherche…</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-gray-500">Aucun profil trouvé</li>
          )}
          {!loading &&
            results.map((u, i) => (
              <li key={u.id} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  onClick={() => pick(u)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-purple-900/30 ${
                    i === activeIndex ? 'bg-purple-900/40' : ''
                  }`}
                >
                  <UserAvatarOnline
                    userId={u.id}
                    avatarUrl={u.avatarUrl}
                    size="sm"
                    isLive={u.isLive}
                    liveViewersCount={u.isLive ? u.liveViewersCount : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <UsernameDisplay
                        as="p"
                        username={u.username}
                        usernameColor={u.usernameColor}
                        usernameWaveFrom={u.usernameWaveFrom}
                        usernameWaveTo={u.usernameWaveTo}
                        className="text-xs font-semibold truncate min-w-0"
                      />
                      {u.isLive && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white uppercase tracking-wide shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          LIVE
                        </span>
                      )}
                      {!u.isLive && u.salonId && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-800/80 text-purple-200 uppercase tracking-wide shrink-0">
                          SALON
                        </span>
                      )}
                    </div>
                    {u.city && <p className="text-[9px] text-gray-500 truncate">📍 {u.city}</p>}
                  </div>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
