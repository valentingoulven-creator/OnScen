import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { TrendingUser } from '../types';

const TRENDING_REFRESH_MS = 5 * 60 * 1000;

export function useTrendingUsers(options: {
  enabled: boolean;
  token: string | null;
  countryCode: string;
}): {
  users: TrendingUser[];
  loading: boolean;
  reload: () => Promise<void>;
} {
  const { enabled, token, countryCode } = options;
  const [users, setUsers] = useState<TrendingUser[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await api.getTrendingUsers(token, countryCode);
      setUsers(r.users);
    } catch {
      /* section vide */
    } finally {
      setLoading(false);
    }
  }, [token, countryCode]);

  useEffect(() => {
    if (!enabled || !token) {
      setUsers([]);
      setLoading(false);
      return;
    }
    void reload();
    const timer = setInterval(() => void reload(), TRENDING_REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled, token, reload]);

  return { users, loading, reload };
}
