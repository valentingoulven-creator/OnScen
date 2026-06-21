import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { YoutubePlaylistSummary } from '../types';

export interface CreateSalonPlaylistSelection {
  playlistId?: string;
  playlistUrl?: string;
  title: string;
}

interface CreateSalonPlaylistPickerProps {
  token: string;
  value: CreateSalonPlaylistSelection | null;
  onChange: (selection: CreateSalonPlaylistSelection | null) => void;
  compact?: boolean;
}

export function CreateSalonPlaylistPicker({
  token,
  value,
  onChange,
  compact,
}: CreateSalonPlaylistPickerProps) {
  const [playlists, setPlaylists] = useState<YoutubePlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRealAccount, setIsRealAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getYoutubePlaylists(token)
      .then((r) => {
        if (cancelled) return;
        setPlaylists(r.playlists);
        setIsRealAccount(r.isRealAccount);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Playlists indisponibles');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const pickFromList = (playlistId: string) => {
    const p = playlists.find((x) => x.playlistId === playlistId);
    if (!p) return;
    setPlaylistUrl('');
    onChange({ playlistId: p.playlistId, title: p.title });
  };

  const pickFromUrl = () => {
    const url = playlistUrl.trim();
    if (!url) return;
    onChange({ playlistUrl: url, title: 'Playlist YouTube' });
  };

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {!compact && <span className="text-xs text-gray-400">Playlist YouTube (optionnel)</span>}

      {value ? (
        <div className="flex items-center gap-2 rounded-lg bg-[#0b0b0f] border border-[#2d2d3d] px-2.5 py-1.5">
          <span className="text-base" aria-hidden>
            📋
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-white font-medium truncate">{value.title}</p>
            {!compact && (
              <p className="text-[10px] text-gray-500 truncate">
                {value.playlistId || value.playlistUrl || 'Lien playlist'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setPlaylistUrl('');
              onChange(null);
            }}
            className="text-[10px] text-gray-400 hover:text-white px-1.5 py-0.5"
          >
            Retirer
          </button>
        </div>
      ) : (
        <>
          {!compact && (
            <p className="text-[10px] text-gray-500 leading-snug">
              {isRealAccount
                ? 'Vos playlists YouTube (compte connecté).'
                : 'Playlists démo — connectez Google pour les vôtres.'}
            </p>
          )}

          {loading ? (
            <p className="text-[10px] text-gray-500">Chargement…</p>
          ) : playlists.length > 0 ? (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) pickFromList(e.target.value);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-xs text-white"
              aria-label="Choisir une playlist YouTube"
            >
              <option value="" disabled>
                Choisir une playlist…
              </option>
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
            onBlur={pickFromUrl}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                pickFromUrl();
              }
            }}
            placeholder="Lien playlist youtube.com/playlist?list=PL…"
            className="w-full px-2.5 py-1.5 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-[11px] text-white placeholder:text-gray-500"
          />

          {error && <p className="text-[10px] text-red-400">{error}</p>}

          {!compact && (
            <p className="text-[10px] text-gray-600">
              La file d&apos;attente sera remplie au lancement du salon.
            </p>
          )}
        </>
      )}
    </div>
  );
}
