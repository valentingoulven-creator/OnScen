import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MusicHomeSections,
  MusicSearchResults,
} from '../components/MusicHomeContent';
import { useDebouncedApiSearch } from '../hooks/useDebouncedApiSearch';
import { useMusicHome } from '../hooks/useMusicHome';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';
import type { MusicSearchHit } from '../lib/musicTypes';

interface MusicTabPageProps {
  isActive?: boolean;
  onOpenMap?: () => void;
  onOpenLive?: (liveId: string) => void;
  onOpenSalon?: (salonId: string) => void;
  onOpenProfile?: (userId: string) => void;
}

export function MusicTabPage({
  isActive = true,
  onOpenMap,
  onOpenLive,
  onOpenSalon,
  onOpenProfile,
}: MusicTabPageProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery);
  const searchActive = deferredSearchQuery.trim().length >= 2;

  const { data, loading, error, reload } = useMusicHome(isActive);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 320);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const {
    results: searchHits,
    loading: searchLoading,
  } = useDebouncedApiSearch<MusicSearchHit>({
    query: deferredSearchQuery,
    enabled: isActive && Boolean(token),
    minLength: 2,
    debounceMs: 0,
    cacheNamespace: 'music-search',
    fetcher: async (q, signal) => {
      if (!token) return [];
      const [yt, sp] = await Promise.allSettled([
        api.searchYoutube(token, q),
        api.searchSpotify(token, q, signal, 8),
      ]);
      const hits: MusicSearchHit[] = [];
      if (yt.status === 'fulfilled') {
        for (const r of yt.value.results.slice(0, 6)) {
          hits.push({
            kind: 'youtube',
            id: r.videoId,
            title: r.title,
            artist: r.artist,
            albumArtUrl: r.thumbnailUrl,
            externalUrl: r.externalUrl,
          });
        }
      }
      if (sp.status === 'fulfilled') {
        for (const r of sp.value.results.slice(0, 6)) {
          hits.push({
            kind: 'spotify',
            id: r.id,
            title: r.name,
            artist: r.artist,
            albumArtUrl: r.albumArtUrl,
            externalUrl: r.externalUrl,
          });
        }
      }
      return hits;
    },
  });

  const handleOpenLive = (liveId: string) => onOpenLive?.(liveId);
  const handleOpenSalon = (salonId: string) => onOpenSalon?.(salonId);
  const handleOpenProfile = (userId: string) => onOpenProfile?.(userId);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f]">
      <header className="shrink-0 px-4 pt-4 pb-3 border-b border-[#1e1e2f] ms-safe-area-top">
        <h1 className={`text-xl font-bold leading-tight ${USERNAME_WAVE_CLASS}`}>
          {t('music.tabTitle', { defaultValue: 'Musique' })}
        </h1>
        <p className="text-xs text-gray-500 mt-1 leading-snug">
          {t('music.tabSubtitle', {
            defaultValue: 'Découverte, likes et lives autour de toi.',
          })}
        </p>
        <label className="mt-3 block">
          <span className="sr-only">{t('music.searchPlaceholder', { defaultValue: 'Rechercher' })}</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={!isActive}
            placeholder={t('music.searchPlaceholder', {
              defaultValue: 'Artiste, album, chanson, live…',
            })}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#12121a] border border-[#2d2d3d] text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-amber-500/50"
          />
        </label>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4 pb-[calc(var(--tab-nav-total-h,4rem)+0.75rem)]">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-200">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-2 min-h-[44px] px-2 text-amber-400 font-semibold"
            >
              {t('music.retry', { defaultValue: 'Réessayer' })}
            </button>
          </div>
        ) : null}

        {searchActive ? (
          <MusicSearchResults hits={searchHits} loading={searchLoading} query={deferredSearchQuery} />
        ) : (
          <MusicHomeSections
            data={data}
            loading={loading}
            onOpenMap={onOpenMap}
            onOpenLive={handleOpenLive}
            onOpenSalon={handleOpenSalon}
            onOpenProfile={handleOpenProfile}
          />
        )}
      </div>
    </div>
  );
}
