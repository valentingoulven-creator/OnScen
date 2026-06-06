import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { StoryMusicTrack, YoutubeSearchResult } from '../types';

function parseYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  return (
    raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/)?.[1] ??
    (raw.length <= 15 && /^[a-zA-Z0-9_-]+$/.test(raw) ? raw : null)
  );
}

interface StoryMusicPickerProps {
  token: string;
  value: StoryMusicTrack | null;
  onChange: (track: StoryMusicTrack | null) => void;
}

export function StoryMusicPicker({ token, value, onChange }: StoryMusicPickerProps) {
  const [query, setQuery] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [results, setResults] = useState<YoutubeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setError(null);
    setOpen(true);
    debounceRef.current = setTimeout(() => {
      api
        .searchYoutube(token, q)
        .then((r) => setResults(r.results))
        .catch((e) => {
          setResults([]);
          setError(e instanceof Error ? e.message : 'Recherche impossible');
        })
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token]);

  const pickResult = (item: YoutubeSearchResult) => {
    onChange({
      title: item.title,
      artist: item.artist,
      videoId: item.videoId,
      url: item.externalUrl,
    });
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const applyUrl = () => {
    const videoId = parseYoutubeVideoId(urlInput);
    if (!videoId) {
      setError('Lien YouTube invalide');
      return;
    }
    onChange({
      title: 'Piste YouTube',
      artist: '',
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
    setUrlInput('');
    setError(null);
  };

  return (
    <div ref={rootRef} className="space-y-2">
      <p className="text-xs font-semibold text-gray-300">Musique</p>

      {value ? (
        <div className="flex items-center gap-2 rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2">
          <span className="text-lg" aria-hidden>
            🎵
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white font-medium truncate">{value.title}</p>
            {value.artist ? (
              <p className="text-[10px] text-gray-500 truncate">{value.artist}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[10px] text-gray-400 hover:text-white px-2 py-1"
          >
            Retirer
          </button>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length >= 2 && setOpen(true)}
            placeholder="Rechercher une piste…"
            className="w-full rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2 text-xs text-gray-100 placeholder:text-gray-600"
          />
          {open && (searching || results.length > 0 || error) ? (
            <div className="max-h-36 overflow-y-auto rounded-xl border border-[#2d2d3d] bg-[#0b0b0f]">
              {searching ? (
                <p className="px-3 py-2 text-[10px] text-gray-500">Recherche…</p>
              ) : error ? (
                <p className="px-3 py-2 text-[10px] text-red-400">{error}</p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.videoId}
                    type="button"
                    onClick={() => pickResult(r)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1a1a26]"
                  >
                    {r.thumbnailUrl ? (
                      <img src={r.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover" />
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-[11px] text-white truncate">{r.title}</p>
                      <p className="text-[10px] text-gray-500 truncate">{r.artist}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : null}

          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Ou coller un lien YouTube"
              className="flex-1 rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2 text-xs text-gray-100 placeholder:text-gray-600"
            />
            <button
              type="button"
              onClick={applyUrl}
              disabled={!urlInput.trim()}
              className="px-3 py-2 rounded-xl border border-[#2d2d3d] text-xs text-gray-300 hover:border-purple-500/50 disabled:opacity-40"
            >
              OK
            </button>
          </div>
        </>
      )}
    </div>
  );
}
