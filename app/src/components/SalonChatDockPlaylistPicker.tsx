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

function parseYoutubePlaylistBody(
  selectedId: string,
  playlistUrl: string
): { playlistId?: string; playlistUrl?: string } | null {
  const url = playlistUrl.trim();
  if (url) {
    const fromUrl = url.match(/[?&]list=([a-zA-Z0-9_-]+)/)?.[1];
    const playlistId = fromUrl ?? (/^PL[a-zA-Z0-9_-]+$/.test(url) ? url : null);
    return playlistId ? { playlistId } : { playlistUrl: url };
  }
  if (selectedId.trim()) return { playlistId: selectedId.trim() };
  return null;
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
  const [playlistUrl, setPlaylistUrl] = useState(savedPref?.playlistUrl ?? '');
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const [ytPlaylists, setYtPlaylists] = useState<YoutubePlaylistSummary[]>([]);
  const [ytLoading, setYtLoading] = useState(true);
  const [ytIsReal, setYtIsReal] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);

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

  const persistSelection = useCallback(
    (body: { playlistId?: string; playlistUrl?: string }, title?: string) => {
      writeSalonUserPlaylistPref(userId, 'youtube', {
        playlistId: body.playlistId,
        playlistUrl: body.playlistUrl,
        title,
      });
    },
    [userId]
  );

  const launch = async () => {
    setLaunchError(null);
    const body = parseYoutubePlaylistBody(selectedId, playlistUrl);
    if (!body) {
      setLaunchError(t('salon.chatDock.playlistPickRequired'));
      return;
    }
    setLoadingPlay(true);
    try {
      const result = await api.salonLoadPlaylist(token, salonId, body);
      const title =
        ytPlaylists.find((p) => p.playlistId === body.playlistId)?.title ?? savedPref?.title;
      persistSelection(body, title);
      onTrackChanged(result.playbackState);
      onQueueChanged(result.queue);
      setPlaylistUrl('');
      onLoaded?.();
    } catch (e) {
      setLaunchError(
        e instanceof Error ? e.message : t('salon.chatDock.playlistLoadError')
      );
    } finally {
      setLoadingPlay(false);
    }
  };

  const displayError = launchError ?? ytError;

  return (
    <div className="salon-chat-dock-playlist shrink-0 rounded-xl border border-[#2a2a3a] bg-[#101018] p-2.5 space-y-2">
      <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wide">
        {t('salon.chatDock.playlistTitle', { defaultValue: 'Playlist' })}
      </p>

      {ytLoading ? (
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
              onChange={(e) => setSelectedId(e.target.value)}
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
          <input
            type="url"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            placeholder={t('salon.chatDock.playlistYoutubeUrl')}
            className="w-full px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-xs text-white placeholder:text-gray-500"
          />
        </>
      )}

      <button
        type="button"
        disabled={loadingPlay}
        onClick={() => void launch()}
        className="w-full min-h-[44px] py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-lg shadow-orange-900/20"
      >
        {loadingPlay ? t('salon.chatDock.playlistLoading') : t('salon.chatDock.playlistLaunch')}
      </button>

      {displayError ? (
        <p className="text-[10px] text-red-400 text-center leading-snug">{displayError}</p>
      ) : null}
    </div>
  );
}
