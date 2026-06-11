import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useDebouncedApiSearch } from '../hooks/useDebouncedApiSearch';

import { api, ApiRequestError } from '../lib/api';

import { openSpotifyApp } from '../lib/spotifyDeepLink';

import type { PlaybackState, SpotifySearchResult } from '../types';

import { SearchInlineSpinner } from './SearchInlineSpinner';

import { SpotifySearchResultRow } from './SpotifySearchResultRow';



interface SalonSpotifySearchProps {

  salonId: string;

  token: string;

  currentTitle: string;

  currentArtist: string;

  onTrackChanged: (state: PlaybackState) => void;

  /** Masque le morceau en cours (affiché ailleurs, ex. barre lecture salon). */
  showCurrentTrack?: boolean;

}



function parseSpotifyTrackId(input: string): string | null {

  const raw = input.trim();

  if (!raw) return null;

  return (

    raw.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/)?.[1] ??

    raw.match(/^spotify:track:([a-zA-Z0-9]+)$/)?.[1] ??

    (raw.length <= 30 && /^[a-zA-Z0-9]+$/.test(raw) ? raw : null)

  );

}



export function SalonSpotifySearch({

  salonId,

  token,

  currentTitle,

  currentArtist,

  onTrackChanged,

  showCurrentTrack = true,

}: SalonSpotifySearchProps) {

  const { t } = useTranslation();

  const [query, setQuery] = useState('');

  const [changingId, setChangingId] = useState<string | null>(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [infoToast, setInfoToast] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  const spotifyLaunchRetryRef = useRef<number | null>(null);

  const spotifyAppLaunchIssuedRef = useRef(false);



  const fetchSpotify = useCallback(

    (q: string, signal: AbortSignal) =>

      api.searchSpotify(token, q, signal).then((r) => r.results),

    [token]

  );



  const { results, loading, fetching, error, setError, setResults } = useDebouncedApiSearch<SpotifySearchResult>({

    query,

    fetcher: fetchSpotify,

    cacheNamespace: 'spotify-tracks',

    debounceMs: 350,

    minLength: 2,

  });



  useEffect(() => {
    return () => {
      if (spotifyLaunchRetryRef.current !== null) {
        window.clearTimeout(spotifyLaunchRetryRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!infoToast) return;
    const timer = window.setTimeout(() => setInfoToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [infoToast]);

  const clearSearchUi = () => {
    setQuery('');
    setResults([]);
    setDropdownOpen(false);
  };

  const scheduleSpotifyPlayRetry = useCallback(() => {
    if (spotifyLaunchRetryRef.current !== null) {
      window.clearTimeout(spotifyLaunchRetryRef.current);
    }
    spotifyLaunchRetryRef.current = window.setTimeout(() => {
      spotifyLaunchRetryRef.current = null;
      void api.spotifySalonPlaybackControl(token, salonId, 'play').catch(() => {
        /* Toast déjà affiché — l'hôte peut relancer Lecture manuellement. */
      });
    }, 3500);
  }, [token, salonId]);

  const handleSpotifyNoActiveDevice = useCallback(
    (trackId: string, playbackState?: PlaybackState) => {
      if (playbackState) {
        onTrackChanged(playbackState);
      }
      if (!spotifyAppLaunchIssuedRef.current) {
        spotifyAppLaunchIssuedRef.current = true;
        openSpotifyApp(trackId);
        window.setTimeout(() => {
          spotifyAppLaunchIssuedRef.current = false;
        }, 5000);
      }
      setInfoToast(t('salon.playbackMode.spotifyLaunchingApp'));
      scheduleSpotifyPlayRetry();
      clearSearchUi();
    },
    [onTrackChanged, scheduleSpotifyPlayRetry, t]
  );

  useEffect(() => {

    const onDocClick = (e: MouseEvent) => {

      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {

        setDropdownOpen(false);

      }

    };

    document.addEventListener('mousedown', onDocClick);

    return () => document.removeEventListener('mousedown', onDocClick);

  }, []);



  const playResult = async (item: SpotifySearchResult) => {

    setChangingId(item.id);

    setError(null);

    try {

      const { playbackState } = await api.salonChangeTrack(token, salonId, {

        trackId: item.id,

        title: item.name,

        artist: item.artist,

        trackLink: item.externalUrl,

        albumArtUrl: item.albumArtUrl || undefined,

      });

      onTrackChanged(playbackState);

      clearSearchUi();

    } catch (e) {

      if (e instanceof ApiRequestError && e.code === 'no_active_device') {
        handleSpotifyNoActiveDevice(item.id, e.playbackState);
        return;
      }

      setError(e instanceof Error ? e.message : t('salon.spotifySearch.changeError'));

    } finally {

      setChangingId(null);

    }

  };



  const submitQuery = async () => {

    const q = query.trim();

    if (!q || changingId) return;

    if (results.length > 0) {

      await playResult(results[0]);

      return;

    }

    const trackId = parseSpotifyTrackId(q);

    if (trackId) {

      await playResult({

        id: trackId,

        uri: `spotify:track:${trackId}`,

        name: t('salon.spotifySearch.defaultTrackTitle'),

        artist: 'Spotify',

        albumArtUrl: '',

        externalUrl: `https://open.spotify.com/track/${trackId}`,

      });

    }

  };



  const trimmedQuery = query.trim();

  const showDropdown =

    dropdownOpen && trimmedQuery.length >= 2 && (loading || results.length > 0 || Boolean(error));

  const showEmpty = !loading && !error && results.length === 0 && trimmedQuery.length >= 2;



  return (

    <div ref={rootRef} className="relative space-y-2">

      <div className="flex items-center justify-between gap-2">

        <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wide">

          {t('salon.spotifySearch.changeTrack')}

        </p>

        {showCurrentTrack ? (
          <span className="text-[10px] text-gray-500 truncate max-w-[55%]">

            {currentTitle}

            {currentArtist ? ` · ${currentArtist}` : ''}

          </span>
        ) : null}

      </div>



      <div className="relative">

        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" aria-hidden>

          🎧

        </span>

        {fetching ? (

          <span

            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-gray-600 border-t-green-400 animate-spin"

            aria-hidden

          />

        ) : null}

        <input

          type="search"

          value={query}

          onChange={(e) => {

            setQuery(e.target.value);

            if (e.target.value.trim().length >= 2) setDropdownOpen(true);

          }}

          onFocus={() => trimmedQuery.length >= 2 && setDropdownOpen(true)}

          onKeyDown={(e) => {

            if (e.key === 'Enter') {

              e.preventDefault();

              void submitQuery();

            }

            if (e.key === 'Escape') {

              setDropdownOpen(false);

            }

          }}

          placeholder={t('salon.spotifySearch.placeholder')}

          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30"

          autoComplete="off"

          aria-label={t('salon.spotifySearch.placeholder')}

          aria-expanded={showDropdown}

          aria-haspopup="listbox"

        />



        {showDropdown && (

          <div

            className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[#2a2a3a] bg-[#12121a] shadow-xl overflow-hidden"

            role="listbox"

          >

            {loading && results.length === 0 ? (

              <SearchInlineSpinner label={t('salon.spotifySearch.searching')} />

            ) : null}

            {error && !loading ? (
              <p className="text-xs text-red-400 text-center py-3 px-3 leading-snug">{error}</p>
            ) : null}

            {showEmpty ? (

              <p className="text-xs text-gray-500 text-center py-3 px-3 leading-snug">

                {t('salon.spotifySearch.noResultsHint')}

              </p>

            ) : null}

            {results.length > 0 ? (

              <ul className="max-h-52 overflow-y-auto py-1">

                {results.map((item) => (

                  <li key={item.id}>

                    <SpotifySearchResultRow

                      item={item}

                      disabled={changingId !== null}

                      onSelect={(row) => playResult(row as SpotifySearchResult)}

                      actionLabel={changingId === item.id ? '…' : t('salon.spotifySearch.play')}

                    />

                  </li>

                ))}

              </ul>

            ) : null}

          </div>

        )}

      </div>



      <p className="text-[10px] text-gray-600 leading-snug">{t('salon.spotifySearch.changeHint')}</p>

      <p className="text-[10px] text-[#1DB954]/70">{t('salon.spotifySearch.poweredBy')}</p>

      {infoToast ? (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2 rounded-full bg-amber-950/95 border border-amber-500/40 text-sm text-amber-100 shadow-lg text-center"
          role="status"
        >
          {infoToast}
        </div>
      ) : null}

    </div>

  );

}


