const STORAGE_KEY = 'onscen.salon.youtubeVolume';
const MUTED_STORAGE_KEY = 'onscen.salon.youtubeMuted';

export function getSalonYoutubeVolume(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw != null ? Number(raw) : 80;
    if (!Number.isFinite(n)) return 80;
    return Math.min(100, Math.max(0, Math.round(n)));
  } catch {
    return 80;
  }
}

export function setSalonYoutubeVolume(value: number): number {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    /* ignore */
  }
  return v;
}

export function getSalonYoutubeMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSalonYoutubeMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}
