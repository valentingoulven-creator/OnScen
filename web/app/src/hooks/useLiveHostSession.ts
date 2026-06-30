import { useCallback, useEffect, useState } from 'react';
import {
  getLiveHostSession,
  patchLiveHostSession,
  subscribeLiveHostSession,
  type LiveHostSession,
} from '../lib/liveHostSession';

export function useLiveHostSession(liveId: string) {
  const [session, setSession] = useState<LiveHostSession>(() => getLiveHostSession(liveId));

  useEffect(() => {
    setSession(getLiveHostSession(liveId));
    return subscribeLiveHostSession(liveId, () => {
      setSession(getLiveHostSession(liveId));
    });
  }, [liveId]);

  const update = useCallback(
    (patch: Partial<LiveHostSession> | ((prev: LiveHostSession) => Partial<LiveHostSession>)) => {
      return patchLiveHostSession(liveId, patch);
    },
    [liveId],
  );

  return { session, update };
}
