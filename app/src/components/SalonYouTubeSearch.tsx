import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { parseYoutubeVideoId } from '../lib/salonPlayback';
import type { PlaybackState, SalonQueueItem, YoutubeSearchResult } from '../types';

interface SalonYouTubeSearchProps {
  salonId: string;
  token: string;
  currentTitle: string;
  currentArtist: string;
  onTrackChanged?: (state: PlaybackState) => void;
  onQueueChanged?: (queue: SalonQueueItem[]) => void;
  /** queue = file directe (hôte/VIP). propose = PROPOSITIONS pour l'hôte (auditeur). */
  submitMode?: 'queue' | 'propose';
  /** Dans l'onglet panneau hôte — masque l'en-tête redondant. */
  embedded?: boolean;
  /** dropdown = portal sous le champ ; inline = résultats dans le flux (dock file d'attente). */
  layout?: 'dropdown' | 'inline';
  /** true dès que la requête est non vide (masque file / propositions dans le dock). */
  onSearchActiveChange?: (active: boolean) => void;
}

const GENERIC_YOUTUBE_TITLES = new Set(['vidéo youtube', 'sans titre', 'video youtube']);

function isCompleteSearchResult(item: YoutubeSearchResult): boolean {
  const title = item.title.trim();
  const artist = item.artist.trim();
  if (!item.videoId || !title) return false;
  if (GENERIC_YOUTUBE_TITLES.has(title.toLowerCase())) return false;
  if (title.toLowerCase() === 'youtube' && (!artist || artist.toLowerCase() === 'youtube')) return false;
  return true;
}

const actionBtnClass =
  'text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 disabled:opacity-50 transition';

function SearchMagnifierIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function SalonYouTubeSearch({
  salonId,
  token,
  currentTitle,
  currentArtist,
  onTrackChanged,
  onQueueChanged,
  submitMode = 'queue',
  embedded = false,
  layout = 'dropdown',
  onSearchActiveChange,
}: SalonYouTubeSearchProps) {
  const { t } = useTranslation();
  const isProposeMode = submitMode === 'propose';
  const isInline = layout === 'inline';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YoutubeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoToast, setInfoToast] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!infoToast) return;
    const timer = window.setTimeout(() => setInfoToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [infoToast]);

  useEffect(() => {
    onSearchActiveChange?.(query.trim().length > 0);
  }, [query, onSearchActiveChange]);

  useEffect(() => {
    if (isInline) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isInline]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setError(null);
      return;
    }
    setSearching(true);
    setError(null);
    if (!isInline) setDropdownOpen(true);
    debounceRef.current = setTimeout(() => {
      api
        .searchYoutube(token, q)
        .then((r) => setResults(r.results.filter(isCompleteSearchResult)))
        .catch((e) => {
          setResults([]);
          setError(e instanceof Error ? e.message : t('salon.youtubeSearch.errorGeneric'));
        })
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, token, t, isInline]);

  const clearSearchUi = () => {
    setQuery('');
    setResults([]);
    setDropdownOpen(false);
  };

  const trackBodyFromResult = (item: YoutubeSearchResult) => ({
    trackId: item.videoId,
    title: item.title,
    artist: item.artist,
    trackLink: item.externalUrl,
  });

  const isBusy = playingId !== null || addingId !== null;

  const playResult = async (item: YoutubeSearchResult) => {
    if (isProposeMode) {
      window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setPlayingId(item.videoId);
    setError(null);
    try {
      const { playbackState } = await api.salonChangeTrack(token, salonId, trackBodyFromResult(item));
      onTrackChanged?.(playbackState);
      setInfoToast(t('salon.youtubeSearch.playSuccess'));
      clearSearchUi();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('salon.youtubeSearch.changeError'));
    } finally {
      setPlayingId(null);
    }
  };

  const addResult = async (item: YoutubeSearchResult) => {
    setAddingId(item.videoId);
    setError(null);
    try {
      if (isProposeMode) {
        await api.proposeSalonTrack(token, salonId, {
          title: item.title,
          artist: item.artist,
          youtubeUrl: item.externalUrl,
        });
        setInfoToast(t('salon.youtubeSearch.proposeSuccess'));
        clearSearchUi();
        return;
      }

      const { queue } = await api.salonAddToQueue(token, salonId, trackBodyFromResult(item));
      onQueueChanged?.(queue);
      setInfoToast(t('salon.youtubeSearch.addSuccess'));
      clearSearchUi();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : isProposeMode
            ? t('salon.youtubeSearch.proposeError')
            : t('salon.youtubeSearch.addError')
      );
    } finally {
      setAddingId(null);
    }
  };

  const submitQuery = async () => {
    const q = query.trim();
    if (!q || isBusy) return;
    if (results.length > 0) {
      await addResult(results[0]);
      return;
    }
    const videoId = parseYoutubeVideoId(q);
    if (videoId) {
      await addResult({
        videoId,
        title: t('salon.youtubeSearch.defaultTrackTitle'),
        artist: 'YouTube',
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }
  };

  const trimmedQuery = query.trim();
  const showResultsPanel = isInline
    ? trimmedQuery.length >= 2
    : dropdownOpen && trimmedQuery.length >= 2;
  const showEmpty = !searching && !error && results.length === 0 && trimmedQuery.length >= 2;

  useLayoutEffect(() => {
    if (isInline || !showResultsPanel || !inputRef.current) return;
    const updatePosition = () => {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showResultsPanel, query, searching, results.length, error, isInline]);

  const addLabel = isProposeMode
    ? t('salon.youtubeSearch.propose')
    : isInline
      ? t('salon.youtubeSearch.addToQueueShort', { defaultValue: 'Ajouter à la file' })
      : t('salon.youtubeSearch.add');
  const playLabel = isInline
    ? t('salon.youtubeSearch.playNow', { defaultValue: 'Lire maintenant' })
    : t('salon.youtubeSearch.play');

  const resultsList = (
    <>
      {searching && results.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-3">{t('salon.youtubeSearch.searching')}</p>
      ) : null}
      {error && !searching ? (
        <p className="text-xs text-red-400 text-center py-3 px-3">{error}</p>
      ) : null}
      {showEmpty ? (
        <p className="text-xs text-gray-500 text-center py-3 px-3 leading-snug">
          {t('salon.youtubeSearch.noResultsHint')}
        </p>
      ) : null}
      {!searching && results.length > 0 ? (
        <ul className={isInline ? 'space-y-1' : 'max-h-52 overflow-y-auto py-1'} role="listbox">
          {results.map((item) => (
            <li key={item.videoId} role="option" aria-selected={false}>
              <div
                className={`flex items-center gap-2.5 px-2.5 py-2 transition ${
                  isInline
                    ? 'rounded-lg bg-[#0b0b0f] border border-[#222233]'
                    : 'hover:bg-[#1a1a26]'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    className="w-14 h-10 rounded-md object-cover bg-[#1e1e2f]"
                  />
                  <span className="absolute bottom-0.5 right-0.5 bg-[#e62117] rounded px-1 text-[7px] font-bold text-white leading-none py-px tracking-tight">
                    YouTube
                  </span>
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-white font-medium truncate">{item.title}</span>
                  <span className="block text-[10px] text-gray-500 truncate">{item.artist}</span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {!(isProposeMode && isInline) ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void playResult(item)}
                      className={`${actionBtnClass} border-white/20 text-white hover:bg-white/10`}
                      aria-label={`${playLabel} — ${item.title}`}
                    >
                      {playingId === item.videoId
                        ? '…'
                        : isInline
                          ? `▶ ${playLabel}`
                          : playLabel}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void addResult(item)}
                    className={`${actionBtnClass} border-purple-500/40 text-purple-300 hover:bg-purple-500/10`}
                    aria-label={`${addLabel} — ${item.title}`}
                  >
                    {addingId === item.videoId
                      ? '…'
                      : isProposeMode
                        ? addLabel
                        : isInline
                          ? `+ ${addLabel}`
                          : addLabel}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );

  const inputPlaceholder = isInline
    ? t('salon.youtubeSearch.dockPlaceholder', { defaultValue: 'Rechercher sur YouTube...' })
    : t('salon.youtubeSearch.placeholder');

  return (
    <div ref={rootRef} className={`relative ${isInline ? 'space-y-2' : 'space-y-2'}`}>
      {!embedded ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wide">
            {isProposeMode ? t('salon.youtubeSearch.proposeTrack') : t('salon.youtubeSearch.addToQueue')}
          </p>
          <span className="text-[10px] text-gray-500 truncate max-w-[55%]">
            {currentTitle}
            {currentArtist ? ` · ${currentArtist}` : ''}
          </span>
        </div>
      ) : null}

      <div className="relative">
        <span
          className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 ${
            isInline ? '' : 'text-sm'
          }`}
          aria-hidden
        >
          {isInline ? <SearchMagnifierIcon /> : '▶'}
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isInline && e.target.value.trim().length >= 2) setDropdownOpen(true);
          }}
          onFocus={() => !isInline && trimmedQuery.length >= 2 && setDropdownOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submitQuery();
            }
            if (e.key === 'Escape') {
              if (isInline) {
                clearSearchUi();
              } else {
                setDropdownOpen(false);
              }
            }
          }}
          placeholder={inputPlaceholder}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
          autoComplete="off"
          aria-label={inputPlaceholder}
          aria-expanded={showResultsPanel}
          aria-haspopup="listbox"
        />

        {!isInline && showResultsPanel
          ? createPortal(
              <div
                ref={dropdownRef}
                style={dropdownStyle}
                className="rounded-xl border border-[#2a2a3a] bg-[#12121a] shadow-xl overflow-hidden"
                role="listbox"
              >
                {resultsList}
              </div>,
              document.body
            )
          : null}
      </div>

      {isInline && showResultsPanel ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{resultsList}</div>
      ) : null}

      {!isInline ? (
        <p className="text-[10px] text-gray-600 leading-snug">
          {isProposeMode ? t('salon.youtubeSearch.proposeHint') : t('salon.youtubeSearch.addHint')}
        </p>
      ) : null}

      {infoToast ? (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-2 rounded-full bg-green-950/95 border border-green-500/40 text-sm text-green-100 shadow-lg text-center"
          role="status"
        >
          {infoToast}
        </div>
      ) : null}
    </div>
  );
}
