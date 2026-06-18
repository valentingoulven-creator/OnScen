import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { PlaybackState, SalonQueueItem, YoutubePlaylistSummary } from '../types';

interface SalonYouTubePlaylistProps {
  salonId: string;
  token: string;
  onTrackChanged: (state: PlaybackState) => void;
  onQueueChanged?: (queue: SalonQueueItem[]) => void;
  /** Dans l'onglet panneau hôte — contenu toujours visible. */
  embedded?: boolean;
}

export function SalonYouTubePlaylist({
  salonId,
  token,
  onTrackChanged,
  onQueueChanged,
  embedded = false,
}: SalonYouTubePlaylistProps) {
  const [playlists, setPlaylists] = useState<YoutubePlaylistSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [isRealAccount, setIsRealAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    api
      .getYoutubePlaylists(token)
      .then((r) => {
        if (cancelled) return;
        setPlaylists(r.playlists);
        setIsRealAccount(r.isRealAccount);
        if (r.playlists.length) setSelectedId(r.playlists[0].playlistId);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Playlists indisponibles');
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const launch = async () => {
    const body = playlistUrl.trim()
      ? { playlistUrl: playlistUrl.trim() }
      : selectedId
        ? { playlistId: selectedId }
        : null;
    if (!body) {
      setError('Choisissez une playlist ou collez un lien');
      return;
    }
    setLoadingPlay(true);
    setError(null);
    try {
      const r = await api.salonLoadYoutubePlaylist(token, salonId, body);
      onTrackChanged(r.playbackState);
      onQueueChanged?.(r.queue);
      setPlaylistUrl('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de lancer la playlist');
    } finally {
      setLoadingPlay(false);
    }
  };

  return (
    <div className="space-y-2">
      {!embedded ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-2 py-1 text-left"
          aria-expanded={expanded}
        >
          <span className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wide">Playlist hôte</span>
            <span className="inline-flex items-center bg-[#e62117] rounded px-1 text-[7px] font-bold text-white leading-none py-px tracking-tight">
              YouTube
            </span>
          </span>
          <span className="text-[10px] text-gray-500">{expanded ? 'Masquer ▲' : 'Afficher ▼'}</span>
        </button>
      ) : (
        <p className="text-[10px] text-gray-500 leading-snug">
          {isRealAccount
            ? 'Vos playlists YouTube (compte Google connecté).'
            : 'Playlists démo ou publiques — connectez Google pour les vôtres.'}
        </p>
      )}

      {(embedded || expanded) && (
        <div className="space-y-2 pt-1">
          {!embedded ? (
            <p className="text-[10px] text-gray-500 leading-snug">
              {isRealAccount
                ? 'Vos playlists YouTube (compte Google connecté).'
                : 'Playlists démo ou publiques — connectez Google pour les vôtres.'}
            </p>
          ) : null}

          {loadingList ? (
            <p className="text-xs text-gray-500 text-center py-1">Chargement…</p>
          ) : playlists.length > 0 ? (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-sm text-white"
            >
              {playlists.map((p) => (
                <option key={p.playlistId} value={p.playlistId}>
                  {p.title}
                  {p.itemCount != null ? ` (${p.itemCount})` : ''}
                </option>
              ))}
            </select>
          ) : null}

          <input
            type="url"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            placeholder="Ou lien playlist youtube.com/playlist?list=PL…"
            className="w-full px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-xs text-white placeholder:text-gray-500"
          />

          <button
            type="button"
            disabled={loadingPlay}
            onClick={launch}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-sm font-semibold disabled:opacity-50 transition shadow-lg shadow-orange-900/20"
          >
            {loadingPlay ? 'Chargement…' : 'Lancer la playlist'}
          </button>

          {error && <p className="text-[10px] text-red-400 text-center">{error}</p>}
        </div>
      )}
    </div>
  );
}
