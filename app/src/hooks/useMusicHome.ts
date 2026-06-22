import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getLivesGeo, MAP_GEO_CHANGED_EVENT, type LivesGeoPrefs } from '../lib/livesGeo';
import type { MusicHomePayload } from '../lib/musicTypes';

export function useMusicHome(enabled: boolean) {
  const { token } = useAuth();
  const [geo, setGeo] = useState<LivesGeoPrefs>(() => getLivesGeo());
  const [data, setData] = useState<MusicHomePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setGeo(getLivesGeo());
    sync();
    window.addEventListener(MAP_GEO_CHANGED_EVENT, sync);
    return () => window.removeEventListener(MAP_GEO_CHANGED_EVENT, sync);
  }, []);

  const reload = useCallback(async () => {
    if (!token || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const current = getLivesGeo();
      const payload = await api.getMusicHome(token, {
        latitude: current.latitude,
        longitude: current.longitude,
        radiusKm: current.radiusKm,
        label: current.label,
      });
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
  }, [enabled, token, geo.latitude, geo.longitude, geo.radiusKm, geo.label, reload]);

  return { data, loading, error, geo, reload };
}
