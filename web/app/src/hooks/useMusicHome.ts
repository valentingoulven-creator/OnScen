import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { MusicHomePayload } from '../lib/musicTypes';
import { MUSIC_FAVORITES_CHANGED } from '../lib/musicFavoritesEvents';

export function useMusicHome(enabled: boolean) {
  const { token } = useAuth();
  const [data, setData] = useState<MusicHomePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await api.getMusicHome(token);
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [token, enabled]);

  useEffect(() => {
    if (!enabled || !token) return;
    void reload();
  }, [enabled, token, reload]);

  useEffect(() => {
    const onChange = () => void reload();
    window.addEventListener(MUSIC_FAVORITES_CHANGED, onChange);
    return () => window.removeEventListener(MUSIC_FAVORITES_CHANGED, onChange);
  }, [reload]);

  return { data, loading, error, reload };
}
