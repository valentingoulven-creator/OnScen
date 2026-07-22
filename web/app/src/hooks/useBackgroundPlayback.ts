import { useEffect } from 'react';
import {
  clearMediaSession,
  retainBackgroundAudioSession,
  updateMediaSession,
  type MediaSessionMeta,
} from '../lib/backgroundPlayback';

export function useBackgroundPlayback(
  meta: MediaSessionMeta | null,
  active: boolean,
  playing = true
): void {
  useEffect(() => {
    if (!active || !meta) return;
    const release = retainBackgroundAudioSession();
    updateMediaSession(meta, playing);
    return () => {
      release();
      clearMediaSession();
    };
  }, [active, playing, meta]);
}
