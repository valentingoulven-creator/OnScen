import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { isDevStaff } from '../lib/adminStaffRoles';
import {
  MAP_SIDEBAR_SPONSO_REFRESH_EVENT,
} from '../lib/mapUiEvents';

type Listener = (ids: Set<string>) => void;

let cachedPostIds = new Set<string>();
let fetchPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

function notifyListeners(): void {
  const snapshot = new Set(cachedPostIds);
  listeners.forEach((listener) => listener(snapshot));
}

async function loadDevSponsorIds(token: string): Promise<void> {
  const { postIds } = await api.getDevMapSidebarEventSponsorIds(token);
  cachedPostIds = new Set(postIds ?? []);
  notifyListeners();
}

function ensureLoaded(token: string): Promise<void> {
  if (!fetchPromise) {
    fetchPromise = loadDevSponsorIds(token).finally(() => {
      fetchPromise = null;
    });
  }
  return fetchPromise;
}

function invalidateAndReload(token: string): Promise<void> {
  fetchPromise = loadDevSponsorIds(token).finally(() => {
    fetchPromise = null;
  });
  return fetchPromise;
}

/** État partagé des événements sponsorisés (sidebar carte) — visible et modifiable par Dev uniquement. */
export function useDevMapSidebarEventSponso() {
  const { user, token } = useAuth();
  const isDev = isDevStaff(user);
  const [postIds, setPostIds] = useState<Set<string>>(() => new Set(cachedPostIds));

  useEffect(() => {
    if (!isDev || !token) {
      setPostIds(new Set());
      return;
    }

    const listener: Listener = (ids) => setPostIds(ids);
    listeners.add(listener);
    setPostIds(new Set(cachedPostIds));
    void ensureLoaded(token);

    const onRefresh = () => {
      void invalidateAndReload(token);
    };
    window.addEventListener(MAP_SIDEBAR_SPONSO_REFRESH_EVENT, onRefresh);

    return () => {
      listeners.delete(listener);
      window.removeEventListener(MAP_SIDEBAR_SPONSO_REFRESH_EVENT, onRefresh);
    };
  }, [isDev, token]);

  const isSponsored = useCallback((postId: string) => postIds.has(postId), [postIds]);

  return { isDev, isSponsored };
}
