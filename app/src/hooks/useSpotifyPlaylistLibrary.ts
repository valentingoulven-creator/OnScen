import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import {
  applySpotifyPlaylistListSession,
  redirectToSpotifyReconnect,
  spotifyApiErrorNeedsReconnect,
  translateSpotifyApiError,
} from '../lib/spotifyPlaylistSession';
import type { SpotifyPlaylistSummary } from '../types';

export interface UseSpotifyPlaylistLibraryResult {
  playlists: SpotifyPlaylistSummary[];
  loading: boolean;
  isRealAccount: boolean;
  spotifySessionValid: boolean;
  needsReconnect: boolean;
  connectingSpotify: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  reportApiError: (error: unknown, fallbackKey: string) => void;
  reconnectSpotify: () => Promise<void>;
  verifyPlaylistAccess: (ref: { playlistId?: string; playlistUrl?: string }) => Promise<boolean>;
}

/** Charge la bibliothèque Spotify hôte + état session (create salon et salon in-app). */
export function useSpotifyPlaylistLibrary(token: string): UseSpotifyPlaylistLibraryResult {
  const { t } = useTranslation();
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRealAccount, setIsRealAccount] = useState(false);
  const [spotifySessionValid, setSpotifySessionValid] = useState(true);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [connectingSpotify, setConnectingSpotify] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNeedsReconnect(false);

    api
      .getSpotifyPlaylists(token)
      .then((response) => {
        if (cancelled) return;
        setPlaylists(response.playlists);
        setIsRealAccount(response.isRealAccount);
        setSpotifySessionValid(response.spotifySessionValid !== false);
        const session = applySpotifyPlaylistListSession(
          response.spotifySessionValid,
          response.spotifySessionCode,
          t
        );
        setNeedsReconnect(session.needsReconnect);
        if (session.error) setError(session.error);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(translateSpotifyApiError(t, e, 'salon.spotifySearch.playlistError'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const reconnectSpotify = useCallback(async () => {
    setConnectingSpotify(true);
    setError(null);
    try {
      await redirectToSpotifyReconnect(token);
    } catch (e) {
      setError(translateSpotifyApiError(t, e, 'platform.connectError'));
      setConnectingSpotify(false);
    }
  }, [token, t]);

  const verifyPlaylistAccess = useCallback(
    async (ref: { playlistId?: string; playlistUrl?: string }) => {
      setError(null);
      try {
        await api.verifySpotifyPlaylistAccess(token, ref);
        return true;
      } catch (e) {
        if (spotifyApiErrorNeedsReconnect(e)) setNeedsReconnect(true);
        setError(translateSpotifyApiError(t, e, 'salon.spotifySearch.playlistError'));
        return false;
      }
    },
    [token, t]
  );

  const reportApiError = useCallback(
    (apiError: unknown, fallbackKey: string) => {
      if (spotifyApiErrorNeedsReconnect(apiError)) setNeedsReconnect(true);
      setError(translateSpotifyApiError(t, apiError, fallbackKey));
    },
    [t]
  );

  return {
    playlists,
    loading,
    isRealAccount,
    spotifySessionValid,
    needsReconnect,
    connectingSpotify,
    error,
    setError,
    reportApiError,
    reconnectSpotify,
    verifyPlaylistAccess,
  };
}
