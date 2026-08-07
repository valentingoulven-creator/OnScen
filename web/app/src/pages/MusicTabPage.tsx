import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MusicHomeSections,
  MusicSearchResults,
} from '../components/MusicHomeContent';
import { useMusicHome } from '../hooks/useMusicHome';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { MusicSearchPayload } from '../lib/musicTypes';

interface MusicTabPageProps {
  isActive?: boolean;
  onOpenProfile?: (userId: string) => void;
}

export function MusicTabPage({
  isActive = true,
  onOpenProfile,
}: MusicTabPageProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery);
  const searchActive = deferredSearchQuery.trim().length >= 2;
  const [searchResults, setSearchResults] = useState<MusicSearchPayload | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const { data, loading, error, reload } = useMusicHome(isActive);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 320);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!isActive || !token || !searchActive) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    void api
      .searchMusic(token, deferredSearchQuery)
      .then((payload) => {
        if (!cancelled) setSearchResults(payload);
      })
      .catch(() => {
        if (!cancelled) setSearchResults({ albums: [], tracks: [] });
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isActive, token, searchActive, deferredSearchQuery]);

  const handleOpenProfile = (userId: string) => onOpenProfile?.(userId);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--ms-bg)]">
      <header className="sticky top-0 z-20 shrink-0 ms-safe-area-top ms-music-tab-header overflow-hidden border-b border-white/10">
        <div
          className="pointer-events-none absolute inset-0 bg-[#0b0b0f]/92 backdrop-blur-xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-20 left-1/2 h-28 w-[min(100%,24rem)] -translate-x-1/2 rounded-full bg-purple-600/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-8 top-0 h-32 w-32 rounded-full bg-pink-500/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent"
          aria-hidden
        />

        <div className="relative px-4 pt-3 pb-3 max-w-full">
          <h1 className="sr-only">{t('music.tabTitle', { defaultValue: 'Musique' })}</h1>
          <label className="group relative block">
            <span className="sr-only">{t('music.searchPlaceholder', { defaultValue: 'Rechercher' })}</span>
            <span
              className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-pink-500/20 via-purple-500/15 to-purple-600/20 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100"
              aria-hidden
            />
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3.5 top-1/2 z-[1] size-4 -translate-y-1/2 text-gray-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.2-3.2" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!isActive}
              placeholder={t('music.searchPlaceholder', {
                defaultValue: 'Album, morceau, créateur…',
              })}
              className="relative z-[1] w-full min-h-[44px] rounded-2xl border border-white/10 bg-[#12121a]/90 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-gray-500 shadow-inner shadow-black/20 transition focus:border-purple-500/45 focus:outline-none focus:ring-2 focus:ring-purple-500/25"
            />
          </label>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4 pb-[calc(var(--tab-nav-total-h,4rem)+var(--ms-music-player-bar-h,0px)+0.75rem)]">
        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-200">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-2 min-h-[44px] px-2 text-purple-400 hover:text-purple-300 font-semibold transition"
            >
              {t('music.retry', { defaultValue: 'Réessayer' })}
            </button>
          </div>
        ) : null}

        {searchActive ? (
          <MusicSearchResults
            results={searchResults}
            loading={searchLoading}
            query={deferredSearchQuery}
            onOpenProfile={handleOpenProfile}
          />
        ) : (
          <MusicHomeSections
            data={data}
            loading={loading}
            onOpenProfile={handleOpenProfile}
            isActive={isActive}
          />
        )}
      </div>
    </div>
  );
}
