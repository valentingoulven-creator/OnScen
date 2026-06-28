import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import {
  readSalonUserPlaylistPref,
  writeSalonUserPlaylistPref,
} from '../lib/salonUserPlaylistPref';
import type { PlaybackState, SalonQueueItem, YoutubePlaylistSummary } from '../types';

export interface SalonChatDockPlaylistPickerProps {
  salonId: string;
  token: string;
  userId: string;
  onTrackChanged: (state: PlaybackState) => void;
  onQueueChanged: (queue: SalonQueueItem[]) => void;
  onLoaded?: () => void;
}

export function SalonChatDockPlaylistPicker({
  salonId,
  token,
  userId,
  onTrackChanged,
  onQueueChanged,
  onLoaded,
}: SalonChatDockPlaylistPickerProps) {
  const { t } = useTranslation();
  const savedPref = readSalonUserPlaylistPref(userId, 'youtube');

  const [selectedId, setSelectedId] = useState(savedPref?.playlistId ?? '');
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ytPlaylists, setYtPlaylists] = useState<YoutubePlaylistSummary[]>([]);
  const [ytLoading, setYtLoading] = useState(true);
  const [ytIsReal, setYtIsReal] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);

  const persistSelection = useCallback(
    (playlistId: string, title?: string) => {
      writeSalonUserPlaylistPref(userId, 'youtube', {
        playlistId,
        title,
      });
    },
    [userId]
  );

  const loadPlaylist = useCallback(
    async (playlistId: string) => {
      if (!playlistId.trim()) return;
      setLoadError(null);
      setLoadingPlay(true);
      try {
        const result = await api.salonLoadPlaylist(token, salonId, { playlistId });
        const title = ytPlaylists.find((p) => p.playlistId === playlistId)?.title ?? savedPref?.title;
        persistSelection(playlistId, title);
        onTrackChanged(result.playbackState);
        onQueueChanged(result.queue);
        onLoaded?.();
      } catch (e) {
        setLoadError(
          e instanceof Error ? e.message : t('salon.chatDock.playlistLoadError')
        );
      } finally {
        setLoadingPlay(false);
      }
    },
    [
      token,
      salonId,
      ytPlaylists,
      savedPref?.title,
      persistSelection,
      onTrackChanged,
      onQueueChanged,
      onLoaded,
      t,
    ]
  );

  useEffect(() => {
    let cancelled = false;
    setYtLoading(true);
    setYtError(null);
    api
      .getYoutubePlaylists(token)
      .then((r) => {
        if (cancelled) return;
        setYtPlaylists(r.playlists);
        setYtIsReal(r.isRealAccount);
        const saved = readSalonUserPlaylistPref(userId, 'youtube');
        const savedInList = saved?.playlistId
          ? r.playlists.some((p) => p.playlistId === saved.playlistId)
          : false;
        if (savedInList && saved?.playlistId) {
          setSelectedId(saved.playlistId);
        } else if (r.playlists.length) {
          setSelectedId(r.playlists[0].playlistId);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setYtError(e instanceof Error ? e.message : t('salon.chatDock.playlistLoadError'));
        }
      })
      .finally(() => {
        if (!cancelled) setYtLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId, t]);

  const displayError = loadError ?? ytError;

  return (
    <div className="salon-chat-dock-playlist shrink-0 rounded-xl border border-[#2a2a3a] bg-[#101018] p-2.5 space-y-2">
      <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wide">
        {t('salon.chatDock.playlistTitle', { defaultValue: 'Playlist' })}
      </p>

      {ytLoading || loadingPlay ? (
        <p className="text-xs text-gray-500 text-center py-1">
          {t('salon.chatDock.playlistLoading')}
        </p>
      ) : (
        <>
          <p className="text-[10px] text-gray-500 leading-snug">
            {ytIsReal
              ? ytPlaylists.length > 0
                ? t('salon.chatDock.playlistYoutubeHint')
                : t('salon.chatDock.playlistYoutubeReconnect')
              : t('salon.chatDock.playlistYoutubePublic')}
          </p>
          {ytPlaylists.length > 0 ? (
            <select
              value={selectedId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedId(id);
                void loadPlaylist(id);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-sm text-white"
              aria-label={t('salon.chatDock.playlistPickLabel')}
            >
              {ytPlaylists.map((p) => (
                <option key={p.playlistId} value={p.playlistId}>
                  {p.title}
                  {p.itemCount != null ? ` (${p.itemCount})` : ''}
                </option>
              ))}
            </select>
          ) : null}
        </>
      )}

      {displayError ? (
        <p className="text-[10px] text-red-400 text-center leading-snug">{displayError}</p>
      ) : null}
    </div>
  );
}
