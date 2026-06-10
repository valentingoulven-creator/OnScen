import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useDebouncedApiSearch } from '../hooks/useDebouncedApiSearch';

import { api } from '../lib/api';

import type { SpotifySearchResult } from '../types';

import { SearchInlineSpinner } from './SearchInlineSpinner';

import { SpotifySearchResultRow } from './SpotifySearchResultRow';



export interface CreateSalonSpotifySelection {

  trackLink: string;

  trackTitle: string;

  artist: string;

}



interface CreateSalonSpotifyPickerProps {

  token: string;

  value: CreateSalonSpotifySelection | null;

  onChange: (selection: CreateSalonSpotifySelection | null) => void;

}



export function CreateSalonSpotifyPicker({ token, value, onChange }: CreateSalonSpotifyPickerProps) {

  const { t } = useTranslation();

  const [query, setQuery] = useState('');

  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);



  const fetchSpotify = useCallback(

    (q: string, signal: AbortSignal) =>

      api.searchSpotify(token, q, signal).then((r) => r.results),

    [token]

  );



  const { results, loading, fetching, error, setResults } = useDebouncedApiSearch<SpotifySearchResult>({

    query,

    fetcher: fetchSpotify,

    cacheNamespace: 'spotify-tracks',

    debounceMs: 350,

    minLength: 2,

    enabled: !value,

  });



  useEffect(() => {

    const onDocClick = (e: MouseEvent) => {

      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);

    };

    document.addEventListener('mousedown', onDocClick);

    return () => document.removeEventListener('mousedown', onDocClick);

  }, []);



  const pickResult = (item: SpotifySearchResult) => {

    onChange({

      trackLink: item.externalUrl,

      trackTitle: item.name,

      artist: item.artist,

    });

    setQuery('');

    setResults([]);

    setOpen(false);

  };



  const trimmedQuery = query.trim();

  const showPanel = open && trimmedQuery.length >= 2 && (loading || results.length > 0 || Boolean(error));



  return (

    <div ref={rootRef} className="space-y-2">

      <span className="text-xs text-gray-400">{t('salon.spotifySearch.createLabel')}</span>



      {value ? (

        <div className="flex items-center gap-2 rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2">

          <span className="text-lg" aria-hidden>

            🎧

          </span>

          <div className="min-w-0 flex-1">

            <p className="text-xs text-white font-medium truncate">{value.trackTitle}</p>

            {value.artist ? (

              <p className="text-[10px] text-gray-500 truncate">{value.artist}</p>

            ) : null}

          </div>

          <button

            type="button"

            onClick={() => onChange(null)}

            className="text-[10px] text-gray-400 hover:text-white px-2 py-1"

          >

            {t('salon.spotifySearch.remove')}

          </button>

        </div>

      ) : (

        <>

          <div className="relative">

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

                if (e.target.value.trim().length >= 2) setOpen(true);

              }}

              onFocus={() => trimmedQuery.length >= 2 && setOpen(true)}

              placeholder={t('salon.spotifySearch.placeholder')}

              className="w-full rounded-xl bg-[#1a1a26] border border-[#2d2d3d] px-3 py-2 pr-9 text-sm text-white placeholder:text-gray-500"

              aria-label={t('salon.spotifySearch.placeholder')}

            />

          </div>

          {showPanel ? (

            <div className="max-h-40 overflow-y-auto rounded-xl border border-[#2d2d3d] bg-[#0b0b0f]">

              {loading && results.length === 0 ? (

                <SearchInlineSpinner label={t('salon.spotifySearch.searching')} />

              ) : error ? (

                <p className="px-3 py-2 text-xs text-red-400">{error}</p>

              ) : results.length === 0 ? (

                <p className="px-3 py-2 text-xs text-gray-500">{t('salon.spotifySearch.noResults')}</p>

              ) : (

                results.map((r) => (

                  <SpotifySearchResultRow

                    key={r.id}

                    item={r}

                    compact

                    onSelect={(row) => pickResult(row as SpotifySearchResult)}

                    actionLabel=""

                  />

                ))

              )}

            </div>

          ) : null}

          <p className="text-[10px] text-gray-600">{t('salon.spotifySearch.createHint')}</p>

          <p className="text-[10px] text-[#1DB954]/70">{t('salon.spotifySearch.poweredBy')}</p>

        </>

      )}

    </div>

  );

}


