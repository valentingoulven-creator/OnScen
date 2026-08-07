const VOLUME_KEY = 'soundy_music_player_volume';
const MUTED_KEY = 'soundy_music_player_muted';

export function getMusicPlayerVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const n = raw != null ? Number(raw) : 85;
    if (!Number.isFinite(n)) return 85;
    return Math.min(100, Math.max(0, Math.round(n)));
  } catch {
    return 85;
  }
}

export function setMusicPlayerVolume(value: number): number {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  try {
    localStorage.setItem(VOLUME_KEY, String(v));
  } catch {
    /* ignore */
  }
  return v;
}

export function getMusicPlayerMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMusicPlayerMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTED_KEY, '1');
    else localStorage.removeItem(MUTED_KEY);
  } catch {
    /* ignore */
  }
}

export function applyMusicPlayerVolume(audio: HTMLAudioElement, volumePct: number, muted: boolean): void {
  audio.volume = muted ? 0 : Math.min(1, Math.max(0, volumePct / 100));
}
